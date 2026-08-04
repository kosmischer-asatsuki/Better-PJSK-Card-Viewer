#!/usr/bin/env python3
"""Cache Project SEKAI card attributes, rarities, and filter icons from Fandom."""

from __future__ import annotations

import argparse
import html
import json
import re
import urllib.parse
import urllib.request
import unicodedata
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path


API_URL = "https://projectsekai.fandom.com/api.php"
SOURCE_URL = "https://projectsekai.fandom.com/wiki/Card_List"
USER_AGENT = "PJSKLocalCardViewer/1.0 (offline metadata cache)"

CHARACTER_IDS = {
    "Hatsune Miku": "HatsuneMiku",
    "Kagamine Rin": "KagamineRin",
    "Kagamine Len": "KagamineLen",
    "Megurine Luka": "MegurineLuka",
    "MEIKO": "MEIKO",
    "KAITO": "KAITO",
    "Hoshino Ichika": "HoshinoIchika",
    "Tenma Saki": "TenmaSaki",
    "Mochizuki Honami": "MochizukiHonami",
    "Hinomori Shiho": "HinomoriShiho",
    "Hanasato Minori": "HanasatoMinori",
    "Kiritani Haruka": "KiritaniHaruka",
    "Momoi Airi": "MomoiAiri",
    "Hinomori Shizuku": "HinomoriShizuku",
    "Azusawa Kohane": "AzusawaKohane",
    "Shiraishi An": "ShiraishiAn",
    "Shinonome Akito": "ShinonomeAkito",
    "Aoyagi Toya": "AoyagiToya",
    "Tenma Tsukasa": "TenmaTsukasa",
    "Otori Emu": "OtoriEmu",
    "Kusanagi Nene": "KusanagiNene",
    "Kamishiro Rui": "KamishiroRui",
    "Yoisaki Kanade": "YoisakiKanade",
    "Asahina Mafuyu": "AsahinaMafuyu",
    "Shinonome Ena": "ShinonomeEna",
    "Akiyama Mizuki": "AkiyamaMizuki",
}

ICONS = {
    "attributes/cool.svg": "Cool.svg",
    "attributes/cute.svg": "Cute.svg",
    "attributes/happy.svg": "Happy.svg",
    "attributes/mysterious.svg": "Mysterious.svg",
    "attributes/pure.svg": "Pure.svg",
    "rarities/1-star.png": "Star untrained.png",
    "rarities/2-star.png": "Rarity2.png",
    "rarities/3-star.png": "Rarity3.png",
    "rarities/4-star.png": "Rarity4.png",
    "rarities/3-star-trained.png": "Star 3 trained.png",
    "rarities/4-star-trained.png": "Star 4 trained.png",
    "rarities/birthday.png": "Ribbon.png",
    "groups/virtual-singer.png": "Virtualsingerlogo.png",
    "groups/leo-need.png": "Leoneedlogo.png",
    "groups/more-more-jump.png": "Moremorejumplogo.png",
    "groups/vivid-bad-squad.png": "Vividbadsquadlogo.png",
    "groups/wonderlands-showtime.png": "Wonderlandsxswowtimelogo.png",
    "groups/nightcord.png": "25ji-logo.png",
}


def api_request(parameters: dict[str, str], post: bool = False) -> dict:
    encoded = urllib.parse.urlencode({**parameters, "format": "json", "formatversion": "2"}).encode()
    if post:
        request = urllib.request.Request(API_URL, data=encoded, headers={"User-Agent": USER_AGENT})
    else:
        request = urllib.request.Request(
            f"{API_URL}?{encoded.decode()}", headers={"User-Agent": USER_AGENT}
        )
    with urllib.request.urlopen(request, timeout=90) as response:
        return json.load(response)


def parse_list_page(page: str) -> list[dict[str, object]]:
    payload = api_request({"action": "parse", "page": page, "prop": "text"})
    parsed = payload["parse"]["text"]
    records: list[dict[str, object]] = []

    for row in re.findall(r"<tr[^>]*>(.*?)</tr>", parsed, flags=re.DOTALL | re.IGNORECASE):
        cells = re.findall(r"<td[^>]*>(.*?)</td>", row, flags=re.DOTALL | re.IGNORECASE)
        if len(cells) < 5:
            continue
        links = re.findall(r'<a\b[^>]*title="([^"]+)"[^>]*>', cells[2], flags=re.IGNORECASE)
        if len(links) < 2:
            continue
        filenames: list[tuple[str, bool]] = []
        for trained, cell in ((False, cells[3]), (True, cells[4])):
            image_names = re.findall(r'data-image-name="([^"]+\.png)"', cell, flags=re.IGNORECASE)
            if image_names:
                filename = urllib.parse.unquote(html.unescape(image_names[-1])).replace(" ", "_")
                filenames.append((filename, trained))
        if filenames:
            records.append({"page": html.unescape(links[0]), "files": filenames})
    return records


def discover_card_pages() -> tuple[list[str], list[dict[str, object]]]:
    payload = api_request({"action": "parse", "page": "Card List", "prop": "text"})
    parsed = payload["parse"]["text"]
    list_pages = list(dict.fromkeys(re.findall(r'href="/wiki/(Cards_[^"]+)"', parsed)))
    records: list[dict[str, object]] = []
    with ThreadPoolExecutor(max_workers=6) as executor:
        futures = {executor.submit(parse_list_page, page): page for page in list_pages}
        for future in as_completed(futures):
            page_records = future.result()
            records.extend(page_records)
            print(f"已读取 {futures[future]}：{len(page_records)} 张基础卡")
    return list_pages, records


def fetch_wikitext_batch(titles: list[str]) -> dict[str, str]:
    payload = api_request(
        {
            "action": "query",
            "prop": "revisions",
            "rvprop": "content",
            "rvslots": "main",
            "titles": "|".join(titles),
        },
        post=True,
    )
    result: dict[str, str] = {}
    for page in payload.get("query", {}).get("pages", []):
        revisions = page.get("revisions", [])
        if revisions:
            result[page["title"]] = revisions[0]["slots"]["main"]["content"]
    return result


def template_value(source: str, field: str) -> str | None:
    match = re.search(rf"^\|\s*{re.escape(field)}\s*=\s*(.*?)\s*$", source, flags=re.MULTILINE | re.IGNORECASE)
    return match.group(1).strip() if match else None


def build_metadata(records: list[dict[str, object]]) -> dict[str, dict[str, str]]:
    titles = sorted({str(record["page"]) for record in records})
    sources: dict[str, str] = {}
    batches = [titles[index:index + 40] for index in range(0, len(titles), 40)]
    with ThreadPoolExecutor(max_workers=6) as executor:
        futures = {executor.submit(fetch_wikitext_batch, batch): len(batch) for batch in batches}
        for future in as_completed(futures):
            sources.update(future.result())
            print(f"已读取 {len(sources)}/{len(titles)} 张卡片资料")

    metadata: dict[str, dict[str, str]] = {}
    skipped: list[str] = []
    for record in records:
        page = str(record["page"])
        source = sources.get(page, "")
        attribute = (template_value(source, "attribute") or "").lower()
        rarity_text = template_value(source, "rarity") or ""
        member = template_value(source, "member") or ""
        rarity_match = re.search(r"[1-5]", rarity_text)
        character_id = CHARACTER_IDS.get(member)
        if attribute not in {"cool", "cute", "happy", "mysterious", "pure"} or not rarity_match or not character_id:
            skipped.append(page)
            continue
        base_rarity = int(rarity_match.group())
        for filename, trained in record["files"]:  # type: ignore[assignment]
            if base_rarity == 5:
                rarity = "birthday"
            elif trained and base_rarity in {3, 4}:
                rarity = f"{base_rarity}-trained"
            else:
                rarity = str(base_rarity)
            metadata[f"{character_id}/{filename}"] = {"attribute": attribute, "rarity": rarity}

    if skipped:
        print(f"警告：{len(skipped)} 张基础卡缺少可识别资料")
    return metadata


def loose_filename_key(filename: str) -> tuple[str, bool]:
    stem = Path(filename).stem
    trained = stem.endswith("_T")
    if trained:
        stem = stem[:-2]
    normalized = unicodedata.normalize("NFKC", stem).casefold()
    return "".join(character for character in normalized if character.isalnum()), trained


def add_local_filename_aliases(
    metadata: dict[str, dict[str, str]], manifest: Path
) -> tuple[list[dict], int]:
    if not manifest.is_file():
        return [], 0
    cards = json.loads(manifest.read_text(encoding="utf-8"))
    lookup: dict[tuple[str, str, bool], list[dict[str, str]]] = {}
    for card_id, values in metadata.items():
        character, filename = card_id.split("/", 1)
        loose, trained = loose_filename_key(filename)
        lookup.setdefault((character, loose, trained), []).append(values)

    aliases = 0
    for card in cards:
        if card["id"] in metadata:
            continue
        loose, trained = loose_filename_key(card["filename"])
        candidates = lookup.get((card["character"], loose, trained), [])
        if len(candidates) == 1:
            metadata[card["id"]] = candidates[0]
            aliases += 1
    return cards, aliases


def fetch_icon_urls() -> dict[str, str]:
    payload = api_request(
        {
            "action": "query",
            "prop": "imageinfo",
            "iiprop": "url",
            "titles": "|".join(f"File:{name}" for name in ICONS.values()),
        },
        post=True,
    )
    urls: dict[str, str] = {}
    for page in payload.get("query", {}).get("pages", []):
        info = page.get("imageinfo", [])
        if info:
            urls[page["title"].removeprefix("File:")] = info[0]["url"]
    return urls


def download_icons(output: Path) -> None:
    urls = fetch_icon_urls()
    missing = sorted(set(ICONS.values()) - set(urls))
    if missing:
        raise RuntimeError("未找到图标：" + ", ".join(missing))

    def download(relative: str, wiki_name: str) -> Path:
        destination = output / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        request = urllib.request.Request(urls[wiki_name], headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(request, timeout=90) as response:
            destination.write_bytes(response.read())
        return destination

    with ThreadPoolExecutor(max_workers=6) as executor:
        futures = {executor.submit(download, relative, name): relative for relative, name in ICONS.items()}
        for future in as_completed(futures):
            print(f"已缓存图标 {future.result().as_posix()}")


def main() -> int:
    parser = argparse.ArgumentParser(description="缓存 Fandom PJSK 卡片资料与筛选图标")
    parser.add_argument("--metadata", type=Path, default=Path("data/card-metadata.json"))
    parser.add_argument("--icons", type=Path, default=Path("public/filter-icons"))
    parser.add_argument("--manifest", type=Path, default=Path("app/cards.json"))
    args = parser.parse_args()

    _, records = discover_card_pages()
    metadata = build_metadata(records)
    cards, aliases = add_local_filename_aliases(metadata, args.manifest)
    if aliases:
        print(f"已识别 {aliases} 个 Windows 文件名别名")
    download_icons(args.icons)

    payload = {
        "version": 1,
        "source": SOURCE_URL,
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "cards": dict(sorted(metadata.items())),
    }
    args.metadata.parent.mkdir(parents=True, exist_ok=True)
    args.metadata.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    if cards:
        matched = 0
        for card in cards:
            wiki = metadata.get(card["id"])
            if wiki:
                card.update(wiki)
                matched += 1
        args.manifest.write_text(json.dumps(cards, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print(f"本地清单匹配：{matched}/{len(cards)} 张卡面")

    print(f"完成：{len(metadata)} 条卡面资料，{len(ICONS)} 个图标；来源 {SOURCE_URL}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
