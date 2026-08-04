#!/usr/bin/env python3
"""Download the 26 Project SEKAI character icons shown on Moegirl Wiki."""

from __future__ import annotations

import argparse
import html
import re
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path


PAGE_TITLE = "世界计划 缤纷舞台！ feat. 初音未来"
PAGE_URL = "https://mzh.moegirl.org.cn/" + urllib.parse.quote(PAGE_TITLE) + "?useskin=vector"
USER_AGENT = "PJSKLocalCardViewer/1.0 (character icon cache)"

ICON_FILES = {
    "Miku_btn.png": "HatsuneMiku",
    "Rin_btn.png": "KagamineRin",
    "Len_btn.png": "KagamineLen",
    "Luka_btn.png": "MegurineLuka",
    "Meiko_btn.png": "MEIKO",
    "Kaito_btn.png": "KAITO",
    "Ichika_btn.png": "HoshinoIchika",
    "Saki_btn.png": "TenmaSaki",
    "Honami_btn.png": "MochizukiHonami",
    "Shiho_btn.png": "HinomoriShiho",
    "Minori_btn.png": "HanasatoMinori",
    "Haruka_btn.png": "KiritaniHaruka",
    "Airi_btn.png": "MomoiAiri",
    "Shizuku_btn.png": "HinomoriShizuku",
    "Kohane_btn.png": "AzusawaKohane",
    "An_btn.png": "ShiraishiAn",
    "Akito_btn.png": "ShinonomeAkito",
    "Toya_btn.png": "AoyagiToya",
    "Tsukasa_btn.png": "TenmaTsukasa",
    "Emu_btn.png": "OtoriEmu",
    "Nene_btn.png": "KusanagiNene",
    "Rui_btn.png": "KamishiroRui",
    "Kanade_btn.png": "YoisakiKanade",
    "Mafuyu_btn.png": "AsahinaMafuyu",
    "Ena_btn.png": "ShinonomeEna",
    "Mizuki_btn.png": "AkiyamaMizuki",
}


def fetch_page() -> str:
    request = urllib.request.Request(PAGE_URL, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read().decode("utf-8", "replace")


def discover_icons(page_html: str) -> dict[str, str]:
    discovered: dict[str, str] = {}
    for match in re.finditer(r"<img\b[^>]*>", page_html, flags=re.IGNORECASE):
        tag = html.unescape(match.group(0))
        source = re.search(r'src="([^"]+)"', tag)
        if not source:
            continue
        url = source.group(1)
        filename_match = re.search(r"/([^/]+_btn\.png)(?:!|\?|$)", url, flags=re.IGNORECASE)
        if not filename_match:
            continue
        filename = filename_match.group(1)
        canonical = next((name for name in ICON_FILES if name.casefold() == filename.casefold()), None)
        if canonical and canonical not in discovered:
            discovered[canonical] = url.split("!", 1)[0].split("?", 1)[0]
    return discovered


def download_icon(filename: str, url: str, output: Path) -> Path:
    destination = output / f"{ICON_FILES[filename]}.png"
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Referer": PAGE_URL})
    with urllib.request.urlopen(request, timeout=60) as response:
        payload = response.read()
    if not payload.startswith(b"\x89PNG\r\n\x1a\n"):
        raise RuntimeError(f"{filename} did not return a PNG")
    destination.write_bytes(payload)
    return destination


def main() -> int:
    parser = argparse.ArgumentParser(description="缓存萌娘百科 PJSK 角色头像")
    parser.add_argument("--output", type=Path, default=Path("public/character-icons"))
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)

    discovered = discover_icons(fetch_page())
    missing = sorted(set(ICON_FILES) - set(discovered))
    if missing:
        raise SystemExit("未找到头像：" + ", ".join(missing))

    with ThreadPoolExecutor(max_workers=6) as executor:
        futures = {
            executor.submit(download_icon, filename, discovered[filename], args.output): filename
            for filename in ICON_FILES
        }
        for future in as_completed(futures):
            print(f"已缓存 {future.result().name}")

    print(f"完成：{len(ICON_FILES)} 个头像，来源 {PAGE_URL}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
