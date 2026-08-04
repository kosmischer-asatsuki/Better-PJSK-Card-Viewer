#!/usr/bin/env python3
"""Cache Chinese, Japanese, and English card titles used by Sekai Viewer."""

from __future__ import annotations

import argparse
import json
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path


SOURCE_PAGE = "https://sekai.best/card"
USER_AGENT = "PJSKLocalCardViewer/1.0 (offline multilingual title cache)"
SOURCES = {
    "zh": "https://sekai-world.github.io/sekai-master-db-cn-diff/cards.json",
    "ja": "https://sekai-world.github.io/sekai-master-db-diff/cards.json",
    "en": "https://sekai-world.github.io/sekai-master-db-en-diff/cards.json",
}

CHARACTER_GAME_IDS = {
    "HoshinoIchika": 1, "TenmaSaki": 2, "MochizukiHonami": 3, "HinomoriShiho": 4,
    "HanasatoMinori": 5, "KiritaniHaruka": 6, "MomoiAiri": 7, "HinomoriShizuku": 8,
    "AzusawaKohane": 9, "ShiraishiAn": 10, "ShinonomeAkito": 11, "AoyagiToya": 12,
    "TenmaTsukasa": 13, "OtoriEmu": 14, "KusanagiNene": 15, "KamishiroRui": 16,
    "YoisakiKanade": 17, "AsahinaMafuyu": 18, "ShinonomeEna": 19, "AkiyamaMizuki": 20,
    "HatsuneMiku": 21, "KagamineRin": 22, "KagamineLen": 23, "MegurineLuka": 24,
    "MEIKO": 25, "KAITO": 26,
}


def master_rarity(local_rarity: str) -> str:
    if local_rarity == "birthday":
        return "rarity_birthday"
    return f"rarity_{local_rarity[0]}"


def match_sekai_id(card: dict, japanese_cards: list[dict]) -> int | None:
    wiki_number = card.get("wikiNumber")
    if not isinstance(wiki_number, int):
        return None
    baseline = wiki_number - 1
    character_id = CHARACTER_GAME_IDS.get(card.get("character"))
    rarity = master_rarity(str(card.get("rarity", "")))
    candidates: list[tuple[int, int]] = []
    for index in range(max(0, baseline - 10), min(len(japanese_cards), baseline + 11)):
        candidate = japanese_cards[index]
        if (
            candidate.get("characterId") == character_id
            and candidate.get("attr") == card.get("attribute")
            and candidate.get("cardRarityType") == rarity
        ):
            candidates.append((abs(index - baseline), int(candidate["id"])))
    return min(candidates)[1] if candidates else None


def fetch_cards(language: str, url: str) -> tuple[str, list[dict]]:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=120) as response:
        cards = json.load(response)
    return language, cards


def main() -> int:
    parser = argparse.ArgumentParser(description="缓存 Sekai Viewer 中、日、英卡面标题")
    parser.add_argument("--manifest", type=Path, default=Path("app/cards.json"))
    parser.add_argument("--output", type=Path, default=Path("data/card-titles.json"))
    parser.add_argument("--metadata", type=Path, default=Path("data/card-metadata.json"))
    args = parser.parse_args()

    cards = json.loads(args.manifest.read_text(encoding="utf-8"))
    localized: dict[str, dict[int, str]] = {}
    raw_cards: dict[str, list[dict]] = {}
    with ThreadPoolExecutor(max_workers=3) as executor:
        futures = {
            executor.submit(fetch_cards, language, url): language
            for language, url in SOURCES.items()
        }
        for future in as_completed(futures):
            language, language_cards = future.result()
            raw_cards[language] = language_cards
            localized[language] = {
                int(card["id"]): str(card["prefix"]).strip()
                for card in language_cards
                if card.get("id") is not None and str(card.get("prefix", "")).strip()
            }
            print(f"已读取 {language}：{len(localized[language])} 个标题")

    japanese_cards = sorted(raw_cards["ja"], key=lambda card: int(card["id"]))

    title_cache: dict[str, dict[str, str]] = {}
    missing_ids: set[int] = set()
    for card in cards:
        sekai_id = match_sekai_id(card, japanese_cards)
        if sekai_id is None:
            missing_ids.add(-1)
            titles = {"zh": card["title"], "ja": card["title"], "en": card["title"]}
        else:
            english = localized["en"].get(sekai_id, card["title"])
            titles = {
                "zh": localized["zh"].get(sekai_id, english),
                "ja": localized["ja"].get(sekai_id, english),
                "en": english,
            }
            if sekai_id not in localized["ja"]:
                missing_ids.add(sekai_id)
            title_cache[str(sekai_id)] = titles
            card["sekaiId"] = sekai_id
        card["titles"] = titles
        card["title"] = titles["en"]

    args.manifest.write_text(
        json.dumps(cards, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
    )
    if args.metadata.is_file():
        metadata = json.loads(args.metadata.read_text(encoding="utf-8"))
        for card in cards:
            cached = metadata.get("cards", {}).get(card["id"])
            if cached is not None:
                cached["sekaiId"] = card.get("sekaiId")
                cached["titles"] = card["titles"]
        args.metadata.write_text(
            json.dumps(metadata, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
        )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(
            {
                "version": 1,
                "source": SOURCE_PAGE,
                "dataSources": SOURCES,
                "updatedAt": datetime.now(timezone.utc).isoformat(),
                "cards": dict(sorted(title_cache.items(), key=lambda item: int(item[0]))),
            },
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        encoding="utf-8",
    )
    print(f"完成：{len(title_cache)} 张基础卡的中、日、英标题；未匹配 ID {len(missing_ids)} 个")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
