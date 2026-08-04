#!/usr/bin/env python3
"""Build the browser manifest from ./pjsk_cards and resolve stable wiki image URLs."""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path


API_URL = "https://projectsekai.fandom.com/api.php"
USER_AGENT = "PJSKCardViewer/1.0 (personal gallery manifest builder)"

FOLDER_TO_WIKI = {
    "AkiyamaMizuki": "Akiyama_Mizuki",
    "AoyagiToya": "Aoyagi_Toya",
    "AsahinaMafuyu": "Asahina_Mafuyu",
    "AzusawaKohane": "Azusawa_Kohane",
    "HanasatoMinori": "Hanasato_Minori",
    "HatsuneMiku": "Hatsune_Miku",
    "HinomoriShiho": "Hinomori_Shiho",
    "HinomoriShizuku": "Hinomori_Shizuku",
    "HoshinoIchika": "Hoshino_Ichika",
    "KagamineLen": "Kagamine_Len",
    "KagamineRin": "Kagamine_Rin",
    "KAITO": "KAITO",
    "KamishiroRui": "Kamishiro_Rui",
    "KiritaniHaruka": "Kiritani_Haruka",
    "KusanagiNene": "Kusanagi_Nene",
    "MegurineLuka": "Megurine_Luka",
    "MEIKO": "MEIKO",
    "MochizukiHonami": "Mochizuki_Honami",
    "MomoiAiri": "Momoi_Airi",
    "OtoriEmu": "Otori_Emu",
    "ShinonomeAkito": "Shinonome_Akito",
    "ShinonomeEna": "Shinonome_Ena",
    "ShiraishiAn": "Shiraishi_An",
    "TenmaSaki": "Tenma_Saki",
    "TenmaTsukasa": "Tenma_Tsukasa",
    "YoisakiKanade": "Yoisaki_Kanade",
}


def normalized_file_title(value: str) -> str:
    value = urllib.parse.unquote(value).replace(" ", "_")
    return value.casefold()


def fetch_batch(names: list[str]) -> dict[str, str]:
    params = urllib.parse.urlencode(
        {
            "action": "query",
            "prop": "imageinfo",
            "iiprop": "url",
            "redirects": "1",
            "format": "json",
            "formatversion": "2",
            "titles": "|".join(f"File:{name}" for name in names),
        }
    )
    request = urllib.request.Request(
        f"{API_URL}?{params}",
        headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
    )

    last_error: Exception | None = None
    for attempt in range(4):
        try:
            with urllib.request.urlopen(request, timeout=45) as response:
                payload = json.load(response)
            result: dict[str, str] = {}
            for page in payload.get("query", {}).get("pages", []):
                info = page.get("imageinfo") or []
                if page.get("missing") or not info:
                    continue
                title = page.get("title", "")
                if title.lower().startswith("file:"):
                    title = title[5:]
                result[normalized_file_title(title)] = info[0]["url"]
            return result
        except Exception as error:  # pragma: no cover - network retry path
            last_error = error
            time.sleep(1.5 * (attempt + 1))

    raise RuntimeError(f"Wiki image lookup failed: {last_error}")


def local_filename_from_wiki_title(title: str) -> str:
    if title.lower().startswith("file:"):
        title = title[5:]
    stem = Path(title).stem
    stem = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", stem).rstrip(". ")
    return f"{stem}.png"


def fetch_character_images(folder: str) -> dict[str, str]:
    page_title = f"{FOLDER_TO_WIKI[folder]}/Cards"
    continuation: str | None = None
    result: dict[str, str] = {}

    while True:
        params = {
            "action": "query",
            "generator": "images",
            "gimlimit": "max",
            "prop": "imageinfo",
            "iiprop": "url",
            "format": "json",
            "formatversion": "2",
            "titles": page_title,
        }
        if continuation:
            params["gimcontinue"] = continuation
        request = urllib.request.Request(
            f"{API_URL}?{urllib.parse.urlencode(params)}",
            headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
        )
        with urllib.request.urlopen(request, timeout=45) as response:
            payload = json.load(response)

        for page in payload.get("query", {}).get("pages", []):
            info = page.get("imageinfo") or []
            if not info:
                continue
            result[normalized_file_title(local_filename_from_wiki_title(page.get("title", "")))] = info[0]["url"]

        continuation = payload.get("continue", {}).get("gimcontinue")
        if not continuation:
            return result


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--cards", type=Path, default=Path("pjsk_cards"))
    parser.add_argument("--output", type=Path, default=Path("app/cards.json"))
    args = parser.parse_args()

    cards_root = args.cards.resolve()
    files = sorted(cards_root.glob("*/*.png"), key=lambda path: str(path).casefold())
    if not files:
        raise SystemExit(f"No PNG cards found under {cards_root}")

    unique_names = sorted({path.name for path in files}, key=str.casefold)
    batches = [unique_names[index : index + 45] for index in range(0, len(unique_names), 45)]
    resolved: dict[str, str] = {}

    with ThreadPoolExecutor(max_workers=6) as executor:
        futures = [executor.submit(fetch_batch, batch) for batch in batches]
        for future in as_completed(futures):
            resolved.update(future.result())

    missing_folders = {
        path.parent.name
        for path in files
        if normalized_file_title(path.name) not in resolved
    }
    if missing_folders:
        with ThreadPoolExecutor(max_workers=6) as executor:
            futures = {
                executor.submit(fetch_character_images, folder): folder
                for folder in sorted(missing_folders)
            }
            for future in as_completed(futures):
                resolved.update(future.result())

    cards = []
    missing = []
    for path in files:
        remote_url = resolved.get(normalized_file_title(path.name))
        if not remote_url:
            missing.append(f"{path.parent.name}/{path.name}")
            continue

        stem = path.stem
        trained = stem.endswith("_T")
        clean_stem = stem[:-2] if trained else stem
        title = " ".join(clean_stem.replace("_", " ").split())
        cards.append(
            {
                "id": f"{path.parent.name}/{path.name}",
                "character": path.parent.name,
                "filename": path.name,
                "title": title,
                "trained": trained,
                "imageUrl": remote_url,
            }
        )

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(cards, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    print(f"cards={len(cards)} resolved={len(resolved)} missing={len(missing)}")
    if missing:
        print("Missing local files:")
        for item in missing[:30]:
            print(f"  {item}")
        return 1
    return 0


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    raise SystemExit(main())
