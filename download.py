#!/usr/bin/env python3
"""
下载 Project SEKAI Wiki 中全部角色的卡面立绘。

目录结构示例：

pjsk_cards/
├── AkiyamaMizuki/
│   ├── Obsessed_With_Cuteness.png
│   └── ...
├── HoshinoIchika/
│   └── ...
└── ...

功能：
1. 从 Card List 页提取所有角色的 Cards 页面。
2. 从每个角色页面的 Card images 模块提取卡面。
3. 下载 Fandom CDN 返回的原始图片内容。
4. 若服务器返回 WebP、JPEG、AVIF 等格式，自动转换为真正的 PNG。
5. 保留透明通道和原始像素尺寸。
6. 支持并发下载、失败重试、断点续传式跳过已有文件。
7. 每个角色保存至独立子目录，如 AkiyamaMizuki。

依赖：
    python -m pip install requests beautifulsoup4 pillow

运行：
    python download_pjsk_cards.py

指定输出目录：
    python download_pjsk_cards.py -o D:/PJSK_Cards

调整并发数：
    python download_pjsk_cards.py -o ./pjsk_cards --workers 4

覆盖已有文件：
    python download_pjsk_cards.py --overwrite
"""

from __future__ import annotations

import argparse
import concurrent.futures
import html
import re
import sys
import threading
import time
from pathlib import Path
from typing import Iterable
from urllib.parse import unquote, urljoin, urlparse

import requests
from bs4 import BeautifulSoup, Tag
from PIL import Image, ImageOps, UnidentifiedImageError
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


API_URL = "https://projectsekai.fandom.com/api.php"
WIKI_BASE = "https://projectsekai.fandom.com"
CARD_LIST_PAGE = "Card_List"

# 建议替换为你自己的联系方式。
USER_AGENT = (
    "PJSKCardDownloader/2.0 "
    "(personal archival script; contact: replace-with-your-email@example.com)"
)

REQUEST_TIMEOUT = 60

# 每处理完一个角色页面后暂停的秒数。
PAGE_INTERVAL = 0.8

_thread_local = threading.local()
_print_lock = threading.Lock()


def safe_print(*args, **kwargs) -> None:
    """避免多线程输出互相穿插。"""
    with _print_lock:
        print(*args, **kwargs, flush=True)


def create_session() -> requests.Session:
    """创建带自动重试机制的 HTTP 会话。"""
    session = requests.Session()

    retry = Retry(
        total=5,
        connect=5,
        read=5,
        status=5,
        backoff_factor=1.2,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=frozenset({"GET"}),
        respect_retry_after_header=True,
    )

    adapter = HTTPAdapter(
        max_retries=retry,
        pool_connections=20,
        pool_maxsize=20,
    )

    session.mount("https://", adapter)
    session.mount("http://", adapter)

    session.headers.update(
        {
            "User-Agent": USER_AGENT,
            "Accept": (
                "text/html,application/xhtml+xml,application/json,"
                "image/png,image/jpeg,image/webp,image/avif,*/*;q=0.8"
            ),
            "Accept-Language": "en-US,en;q=0.9",
        }
    )

    return session


def get_thread_session() -> requests.Session:
    """为每个下载线程维护独立 Session。"""
    if not hasattr(_thread_local, "session"):
        _thread_local.session = create_session()

    return _thread_local.session


def fetch_parsed_html(
    session: requests.Session,
    page_title: str,
) -> tuple[str, str]:
    """
    通过 MediaWiki API 获取页面解析后的 HTML。

    返回：
        (规范化页面标题, HTML)
    """
    params = {
        "action": "parse",
        "page": page_title,
        "prop": "text",
        "format": "json",
        "formatversion": "2",
        "redirects": "1",
        "disableeditsection": "1",
    }

    response = session.get(
        API_URL,
        params=params,
        timeout=REQUEST_TIMEOUT,
    )
    response.raise_for_status()

    data = response.json()

    if "error" in data:
        error = data["error"]
        code = error.get("code", "unknown")
        info = error.get("info", "Unknown API error")

        raise RuntimeError(
            f"MediaWiki API 错误：{code}: {info}"
        )

    parsed = data.get("parse")

    if not parsed:
        raise RuntimeError(
            f"API 没有返回页面内容：{page_title}"
        )

    title = parsed.get("title", page_title)
    page_html = parsed.get("text", "")

    if not page_html:
        raise RuntimeError(
            f"页面 HTML 为空：{page_title}"
        )

    return title, page_html


def normalize_wiki_title_from_href(
    href: str,
) -> str | None:
    """
    从 Wiki 链接中提取页面标题。

    示例：
        /wiki/Akiyama_Mizuki/Cards
        -> Akiyama_Mizuki/Cards
    """
    if not href:
        return None

    absolute_url = urljoin(
        WIKI_BASE,
        html.unescape(href),
    )

    parsed = urlparse(absolute_url)

    if parsed.netloc not in {
        "projectsekai.fandom.com",
        "www.projectsekai.fandom.com",
    }:
        return None

    prefix = "/wiki/"

    if not parsed.path.startswith(prefix):
        return None

    title = unquote(
        parsed.path[len(prefix):]
    ).strip("/")

    return title or None


def find_characters_section(
    soup: BeautifulSoup,
) -> Tag | BeautifulSoup:
    """
    尝试定位 Card List 页面中的 Characters 章节。

    若页面结构发生变化，则返回整个页面，
    后续通过 /Cards 链接规则继续筛选。
    """
    heading = soup.find(
        id=lambda value: (
            isinstance(value, str)
            and value.strip().lower() == "characters"
        )
    )

    if heading is None:
        heading = soup.find(
            ["h2", "h3", "h4"],
            string=lambda value: (
                isinstance(value, str)
                and value.strip().lower() == "characters"
            ),
        )

    if heading is None:
        return soup

    heading_container = (
        heading.find_parent(["h2", "h3", "h4"])
        or heading
    )

    table = heading_container.find_next("table")

    if table is not None:
        return table

    return heading_container.parent or soup


def extract_character_card_pages(
    page_html: str,
) -> list[str]:
    """从 Card List 的 Characters 表格提取角色 Cards 页面。"""
    soup = BeautifulSoup(
        page_html,
        "html.parser",
    )

    section = find_characters_section(soup)

    card_pages: set[str] = set()

    for link in section.find_all("a", href=True):
        title = normalize_wiki_title_from_href(
            link["href"]
        )

        if title is None:
            continue

        normalized = (
            title.replace(" ", "_")
            .rstrip("/")
        )

        if re.fullmatch(
            r"[^/]+/Cards",
            normalized,
            flags=re.IGNORECASE,
        ):
            card_pages.add(normalized)

    # 如果 Characters 区域定位失败，再扫描整个页面。
    if not card_pages and section is not soup:
        for link in soup.find_all("a", href=True):
            title = normalize_wiki_title_from_href(
                link["href"]
            )

            if title is None:
                continue

            normalized = (
                title.replace(" ", "_")
                .rstrip("/")
            )

            if re.fullmatch(
                r"[^/]+/Cards",
                normalized,
                flags=re.IGNORECASE,
            ):
                card_pages.add(normalized)

    return sorted(
        card_pages,
        key=str.casefold,
    )


def character_folder_name(
    card_page_title: str,
) -> str:
    """
    将页面名转换为角色文件夹名。

    Akiyama_Mizuki/Cards -> AkiyamaMizuki
    """
    character_title = card_page_title.rsplit(
        "/Cards",
        1,
    )[0]

    character_title = unquote(character_title)

    folder_name = re.sub(
        r"[^A-Za-z0-9]+",
        "",
        character_title,
    )

    if not folder_name:
        raise ValueError(
            f"无法从页面标题生成目录名：{card_page_title}"
        )

    return folder_name


def get_image_url_from_tag(
    image: Tag,
) -> str | None:
    """从 img 标签的普通或懒加载属性中提取图片 URL。"""
    candidate_attributes = (
        "data-src",
        "data-original",
        "src",
    )

    for attribute in candidate_attributes:
        value = image.get(attribute)

        if not value:
            continue

        value = html.unescape(
            str(value)
        ).strip()

        if value.startswith("data:"):
            continue

        return urljoin(
            WIKI_BASE,
            value,
        )

    srcset = (
        image.get("data-srcset")
        or image.get("srcset")
    )

    if srcset:
        candidates: list[str] = []

        for part in str(srcset).split(","):
            url = part.strip().split()[0]

            if url and not url.startswith("data:"):
                candidates.append(url)

        if candidates:
            return urljoin(
                WIKI_BASE,
                candidates[-1],
            )

    return None


def get_image_url_from_anchor(
    anchor: Tag,
) -> str | None:
    """从包裹图片的 a 标签提取原图链接。"""
    href = anchor.get("href")

    if not href:
        return None

    value = html.unescape(
        str(href)
    ).strip()

    if value.startswith("data:"):
        return None

    absolute_url = urljoin(
        WIKI_BASE,
        value,
    )

    if (
        "static.wikia.nocookie.net/projectsekai/images/"
        in absolute_url
    ):
        return absolute_url

    return None


def normalize_original_image_url(
    url: str,
) -> str | None:
    """
    将 Fandom 的缩略图或 revision URL 转换为原始图片 URL。

    输入示例：
        .../Card.png/revision/latest/scale-to-width-down/...
        .../Card.png/revision/latest?cb=...

    输出：
        .../Card.png/revision/latest
    """
    url = (
        html.unescape(url)
        .replace("\\/", "/")
        .strip()
    )

    if url.startswith("//"):
        url = "https:" + url

    url = urljoin(
        WIKI_BASE,
        url,
    )

    parsed = urlparse(url)

    if (
        "static.wikia.nocookie.net"
        not in parsed.netloc.lower()
    ):
        return None

    if "/projectsekai/images/" not in parsed.path:
        return None

    match = re.search(
        r"(?P<base>"
        r"https?://static\.wikia\.nocookie\.net/"
        r"projectsekai/images/.+?\.(?:png|webp|jpg|jpeg)"
        r")"
        r"(?:/revision/.*)?$",
        url,
        flags=re.IGNORECASE,
    )

    if not match:
        return None

    base_url = match.group("base")

    return f"{base_url}/revision/latest"


def find_card_images_container(
    soup: BeautifulSoup,
) -> list[Tag]:
    """
    定位 Card images 模块。

    返回一个或多个可能包含卡面的 HTML 容器。
    """
    candidates: list[Tag] = []

    for heading in soup.find_all(
        ["h2", "h3", "h4", "div", "span"]
    ):
        text = " ".join(
            heading.get_text(
                " ",
                strip=True,
            ).split()
        ).lower()

        if text not in {
            "card images",
            "card image",
        }:
            continue

        heading_container = (
            heading.find_parent(
                ["h2", "h3", "h4"]
            )
            or heading
        )

        current = heading_container.find_next_sibling()

        while current is not None:
            if isinstance(current, Tag):
                if current.name in {"h2", "h3"}:
                    break

                candidates.append(current)

            current = current.find_next_sibling()

        if candidates:
            return candidates

    class_pattern = re.compile(
        r"(card.?images?|card.?gallery|gallery|tabber)",
        flags=re.IGNORECASE,
    )

    for container in soup.find_all(
        ["div", "section", "table"],
        class_=class_pattern,
    ):
        candidates.append(container)

    return candidates


def image_looks_like_card(
    image: Tag,
    url: str,
) -> bool:
    """
    对兜底扫描结果做基础过滤，
    避免下载头像、图标和 UI 图片。
    """
    lowered = url.lower()

    excluded_words = (
        "icon",
        "logo",
        "rarity",
        "attribute",
        "stamp",
        "button",
        "placeholder",
        "site-logo",
        "favicon",
    )

    if any(
        word in lowered
        for word in excluded_words
    ):
        return False

    width = image.get("width")
    height = image.get("height")

    try:
        if width and height:
            width_num = int(
                re.sub(
                    r"\D",
                    "",
                    str(width),
                )
                or "0"
            )

            height_num = int(
                re.sub(
                    r"\D",
                    "",
                    str(height),
                )
                or "0"
            )

            if (
                width_num
                and height_num
                and max(width_num, height_num) < 200
            ):
                return False

    except ValueError:
        pass

    return True


def collect_urls_from_containers(
    containers: Iterable[Tag],
) -> set[str]:
    """从指定容器中收集卡面原图 URL。"""
    urls: set[str] = set()

    for container in containers:
        for image in container.find_all("img"):
            candidates: list[str] = []

            parent_link = image.find_parent(
                "a",
                href=True,
            )

            if parent_link is not None:
                anchor_url = get_image_url_from_anchor(
                    parent_link
                )

                if anchor_url:
                    candidates.append(anchor_url)

            image_url = get_image_url_from_tag(
                image
            )

            if image_url:
                candidates.append(image_url)

            for candidate in candidates:
                original_url = normalize_original_image_url(
                    candidate
                )

                if original_url:
                    urls.add(original_url)

        # 某些 gallery 链接可能不含 img，单独扫描 a。
        for anchor in container.find_all(
            "a",
            href=True,
        ):
            anchor_url = get_image_url_from_anchor(
                anchor
            )

            if not anchor_url:
                continue

            original_url = normalize_original_image_url(
                anchor_url
            )

            if original_url:
                urls.add(original_url)

    return urls


def extract_card_image_urls(
    page_html: str,
) -> list[str]:
    """从角色 Cards 页面提取 Card images 模块中的原图链接。"""
    soup = BeautifulSoup(
        page_html,
        "html.parser",
    )

    containers = find_card_images_container(
        soup
    )

    image_urls = collect_urls_from_containers(
        containers
    )

    if image_urls:
        return sorted(image_urls)

    # 页面结构变化时的兜底方案：
    # 扫描页面全部图片，再过滤明显的小图标。
    fallback_urls: set[str] = set()

    for image in soup.find_all("img"):
        candidates: list[str] = []

        parent_link = image.find_parent(
            "a",
            href=True,
        )

        if parent_link is not None:
            anchor_url = get_image_url_from_anchor(
                parent_link
            )

            if anchor_url:
                candidates.append(anchor_url)

        image_url = get_image_url_from_tag(
            image
        )

        if image_url:
            candidates.append(image_url)

        for candidate in candidates:
            original_url = normalize_original_image_url(
                candidate
            )

            if not original_url:
                continue

            if image_looks_like_card(
                image,
                original_url,
            ):
                fallback_urls.add(original_url)

    return sorted(fallback_urls)


def filename_from_image_url(
    url: str,
) -> str:
    """
    从 Fandom 图片 URL 中提取文件名，
    并统一将扩展名设为 .png。
    """
    path = unquote(
        urlparse(url).path
    )

    match = re.search(
        r"/([^/]+?)\.(?:png|webp|jpg|jpeg)"
        r"(?:/revision/.*)?$",
        path,
        flags=re.IGNORECASE,
    )

    if not match:
        raise ValueError(
            f"无法提取图片文件名：{url}"
        )

    stem = match.group(1)

    stem = re.sub(
        r'[<>:"/\\|?*\x00-\x1f]',
        "_",
        stem,
    )

    stem = stem.rstrip(". ")

    if not stem:
        raise ValueError(
            f"提取到的文件名为空：{url}"
        )

    return f"{stem}.png"


def prepare_download_jobs(
    character_directory: Path,
    image_urls: list[str],
) -> list[tuple[str, Path]]:
    """
    创建下载任务，并处理同一目录中的重名文件。
    """
    jobs: list[tuple[str, Path]] = []
    used_names: dict[str, str] = {}

    for url in image_urls:
        original_name = filename_from_image_url(
            url
        )

        name_key = original_name.casefold()

        if name_key not in used_names:
            filename = original_name
            used_names[name_key] = url

        elif used_names[name_key] == url:
            continue

        else:
            stem = Path(original_name).stem
            suffix = Path(original_name).suffix

            number = 2

            while True:
                candidate = (
                    f"{stem}_{number}{suffix}"
                )

                candidate_key = candidate.casefold()

                if candidate_key not in used_names:
                    filename = candidate
                    used_names[candidate_key] = url
                    break

                number += 1

        jobs.append(
            (
                url,
                character_directory / filename,
            )
        )

    return jobs


def is_existing_png(
    path: Path,
) -> bool:
    """检查文件是否为有效的 PNG。"""
    if (
        not path.is_file()
        or path.stat().st_size < 8
    ):
        return False

    try:
        with path.open("rb") as file:
            if file.read(8) != b"\x89PNG\r\n\x1a\n":
                return False

        # 再使用 Pillow 验证图片是否完整。
        with Image.open(path) as image:
            image.verify()

        return True

    except (
        OSError,
        UnidentifiedImageError,
        SyntaxError,
    ):
        return False


def detect_image_extension(
    content_type: str,
) -> str:
    """
    根据 HTTP Content-Type 推断临时文件扩展名。

    Fandom 即使 URL 以 .png 结尾，
    也可能返回 WebP 或 AVIF。
    """
    normalized = (
        content_type
        .split(";", 1)[0]
        .strip()
        .lower()
    )

    extension_map = {
        "image/png": ".png",
        "image/webp": ".webp",
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg",
        "image/avif": ".avif",
        "image/gif": ".gif",
        "image/bmp": ".bmp",
        "image/tiff": ".tiff",
    }

    return extension_map.get(
        normalized,
        ".image",
    )


def convert_image_to_png(
    source_path: Path,
    destination_path: Path,
) -> None:
    """
    使用 Pillow 将下载到的图片转换为真正的 PNG。

    source_path 可以是 PNG、WebP、JPEG、AVIF 等
    Pillow 支持的格式。
    """
    converted_path = destination_path.with_name(
        destination_path.name + ".converting"
    )

    try:
        with Image.open(source_path) as source_image:
            try:
                source_image.seek(0)
            except EOFError:
                pass

            # 根据 EXIF 方向自动旋转。
            image = ImageOps.exif_transpose(
                source_image
            )

            has_transparency = (
                image.mode in {
                    "RGBA",
                    "LA",
                    "PA",
                }
                or "transparency" in image.info
            )

            if has_transparency:
                converted_image = image.convert(
                    "RGBA"
                )
            else:
                converted_image = image.convert(
                    "RGB"
                )

            try:
                converted_image.save(
                    converted_path,
                    format="PNG",
                    optimize=True,
                    compress_level=6,
                )
            finally:
                converted_image.close()

        if not is_existing_png(converted_path):
            raise RuntimeError(
                "转换后的文件不是有效 PNG"
            )

        converted_path.replace(
            destination_path
        )

    except UnidentifiedImageError as error:
        raise RuntimeError(
            "Pillow 无法识别服务器返回的图片格式"
        ) from error

    finally:
        try:
            converted_path.unlink(
                missing_ok=True
            )
        except OSError:
            pass


def download_one_image(
    url: str,
    destination: Path,
    overwrite: bool,
) -> tuple[str, Path, str]:
    """
    下载单张图片并统一转换为 PNG。

    Fandom CDN 可能出现：
        URL 文件名是 .png
        实际 HTTP 响应是 image/webp

    本函数会：
    1. 保存服务器返回的原始图片内容；
    2. 使用 Pillow 解码；
    3. 转换为真正的 PNG；
    4. 删除临时文件。

    返回：
        (状态, 文件路径, 附加信息)

    状态：
        downloaded / skipped / failed
    """
    if (
        not overwrite
        and is_existing_png(destination)
    ):
        return (
            "skipped",
            destination,
            "",
        )

    session = get_thread_session()

    raw_temporary_path: Path | None = None

    try:
        response = session.get(
            url,
            timeout=REQUEST_TIMEOUT,
            stream=True,
            headers={
                "Referer": WIKI_BASE + "/",
                "Accept": (
                    "image/png,image/webp,image/jpeg,"
                    "image/avif,*/*;q=0.8"
                ),
            },
        )

        response.raise_for_status()

        content_type = (
            response.headers
            .get("Content-Type", "")
            .split(";", 1)[0]
            .strip()
            .lower()
        )

        if not content_type.startswith("image/"):
            raise RuntimeError(
                "服务器返回的内容不是图片："
                f"{content_type or '未知 Content-Type'}"
            )

        temporary_extension = detect_image_extension(
            content_type
        )

        raw_temporary_path = destination.with_name(
            destination.name
            + ".download"
            + temporary_extension
        )

        destination.parent.mkdir(
            parents=True,
            exist_ok=True,
        )

        first_bytes = b""

        with raw_temporary_path.open("wb") as file:
            for chunk in response.iter_content(
                chunk_size=1024 * 256
            ):
                if not chunk:
                    continue

                if len(first_bytes) < 64:
                    needed = 64 - len(first_bytes)
                    first_bytes += chunk[:needed]

                file.write(chunk)

        if not raw_temporary_path.is_file():
            raise RuntimeError(
                "临时图片文件没有生成"
            )

        if raw_temporary_path.stat().st_size == 0:
            raise RuntimeError(
                "服务器返回了空文件"
            )

        lowered_first_bytes = (
            first_bytes
            .lstrip()
            .lower()
        )

        if (
            lowered_first_bytes.startswith(
                b"<!doctype html"
            )
            or lowered_first_bytes.startswith(
                b"<html"
            )
            or lowered_first_bytes.startswith(
                b"<?xml"
            )
        ):
            raise RuntimeError(
                "服务器返回了 HTML/XML 页面，而不是图片"
            )

        convert_image_to_png(
            source_path=raw_temporary_path,
            destination_path=destination,
        )

        if not is_existing_png(destination):
            raise RuntimeError(
                "最终文件不是有效 PNG"
            )

        return (
            "downloaded",
            destination,
            content_type,
        )

    except Exception as error:
        try:
            if (
                destination.exists()
                and not is_existing_png(destination)
            ):
                destination.unlink()
        except OSError:
            pass

        return (
            "failed",
            destination,
            str(error),
        )

    finally:
        if raw_temporary_path is not None:
            try:
                raw_temporary_path.unlink(
                    missing_ok=True
                )
            except OSError:
                pass


def download_character_images(
    card_page_title: str,
    image_urls: list[str],
    output_root: Path,
    workers: int,
    overwrite: bool,
) -> tuple[int, int, int]:
    """下载一个角色的全部卡面。"""
    folder_name = character_folder_name(
        card_page_title
    )

    character_directory = (
        output_root / folder_name
    )

    character_directory.mkdir(
        parents=True,
        exist_ok=True,
    )

    jobs = prepare_download_jobs(
        character_directory,
        image_urls,
    )

    downloaded = 0
    skipped = 0
    failed = 0

    with concurrent.futures.ThreadPoolExecutor(
        max_workers=workers
    ) as executor:
        future_map = {
            executor.submit(
                download_one_image,
                url,
                destination,
                overwrite,
            ): (url, destination)
            for url, destination in jobs
        }

        for future in concurrent.futures.as_completed(
            future_map
        ):
            try:
                status, destination, details = (
                    future.result()
                )

            except Exception as error:
                _, destination = future_map[future]

                failed += 1

                safe_print(
                    f"    [失败] {destination.name}: "
                    f"线程异常：{error}",
                    file=sys.stderr,
                )

                continue

            if status == "downloaded":
                downloaded += 1

                if (
                    details
                    and details != "image/png"
                ):
                    safe_print(
                        f"    [转换] {destination.name} "
                        f"({details} → image/png)"
                    )
                else:
                    safe_print(
                        f"    [下载] {destination.name}"
                    )

            elif status == "skipped":
                skipped += 1

            else:
                failed += 1

                safe_print(
                    f"    [失败] {destination.name}: "
                    f"{details}",
                    file=sys.stderr,
                )

    return downloaded, skipped, failed


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "下载 Project SEKAI Wiki "
            "全部角色卡面并转换为 PNG"
        )
    )

    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=Path("pjsk_cards"),
        help="输出根目录，默认：./pjsk_cards",
    )

    parser.add_argument(
        "--workers",
        type=int,
        default=4,
        help="同时下载的图片数量，默认：4",
    )

    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="覆盖已经存在的有效 PNG 文件",
    )

    parser.add_argument(
        "--expected-characters",
        type=int,
        default=26,
        help=(
            "预期角色数量，仅用于提示，默认：26"
        ),
    )

    return parser.parse_args()


def main() -> int:
    args = parse_arguments()

    if args.workers < 1:
        safe_print(
            "--workers 必须大于等于 1",
            file=sys.stderr,
        )
        return 2

    output_root: Path = (
        args.output
        .expanduser()
        .resolve()
    )

    output_root.mkdir(
        parents=True,
        exist_ok=True,
    )

    session = create_session()

    safe_print(
        "正在读取 Card List 页面……"
    )

    try:
        _, card_list_html = fetch_parsed_html(
            session,
            CARD_LIST_PAGE,
        )

    except Exception as error:
        safe_print(
            f"读取 Card List 失败：{error}",
            file=sys.stderr,
        )
        return 1

    card_pages = extract_character_card_pages(
        card_list_html
    )

    if not card_pages:
        safe_print(
            "没有找到任何角色 Cards 页面，"
            "Wiki 页面结构可能已发生变化。",
            file=sys.stderr,
        )
        return 1

    safe_print(
        f"发现 {len(card_pages)} 个角色页面。"
    )

    if (
        args.expected_characters > 0
        and len(card_pages)
        != args.expected_characters
    ):
        safe_print(
            "警告：发现的角色数量与预期不一致："
            f"实际 {len(card_pages)}，"
            f"预期 {args.expected_characters}。"
        )

        safe_print(
            "脚本仍将继续处理发现的全部角色页面。"
        )

    total_found = 0
    total_downloaded = 0
    total_skipped = 0
    total_failed = 0
    page_failed = 0

    for index, card_page_title in enumerate(
        card_pages,
        start=1,
    ):
        folder_name = character_folder_name(
            card_page_title
        )

        safe_print(
            f"\n[{index}/{len(card_pages)}] "
            f"{folder_name} — {card_page_title}"
        )

        try:
            _, character_html = fetch_parsed_html(
                session,
                card_page_title,
            )

            image_urls = extract_card_image_urls(
                character_html
            )

            if not image_urls:
                safe_print(
                    "  未找到卡面图片，"
                    "页面结构可能已发生变化。",
                    file=sys.stderr,
                )

                page_failed += 1
                continue

            total_found += len(image_urls)

            safe_print(
                f"  找到 {len(image_urls)} 张卡面。"
            )

            downloaded, skipped, failed = (
                download_character_images(
                    card_page_title=card_page_title,
                    image_urls=image_urls,
                    output_root=output_root,
                    workers=args.workers,
                    overwrite=args.overwrite,
                )
            )

            total_downloaded += downloaded
            total_skipped += skipped
            total_failed += failed

            safe_print(
                f"  完成：新下载 {downloaded}，"
                f"已存在 {skipped}，"
                f"失败 {failed}"
            )

        except Exception as error:
            page_failed += 1

            safe_print(
                f"  处理角色页面失败：{error}",
                file=sys.stderr,
            )

        time.sleep(PAGE_INTERVAL)

    safe_print(
        "\n========== 下载汇总 =========="
    )

    safe_print(
        f"输出目录：{output_root}"
    )

    safe_print(
        f"角色页面：{len(card_pages)}"
    )

    safe_print(
        f"发现图片：{total_found}"
    )

    safe_print(
        f"新下载：  {total_downloaded}"
    )

    safe_print(
        f"已跳过：  {total_skipped}"
    )

    safe_print(
        f"下载失败：{total_failed}"
    )

    safe_print(
        f"页面失败：{page_failed}"
    )

    if total_failed or page_failed:
        safe_print(
            "\n存在失败项目。重新运行脚本即可"
            "跳过成功文件并重试失败项目。"
        )
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())