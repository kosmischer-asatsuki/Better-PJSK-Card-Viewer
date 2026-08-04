#!/usr/bin/env python3
"""Prepare an offline manifest and lightweight thumbnails from ./pjsk_cards."""

from __future__ import annotations

import argparse
import json
import os
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

try:
    from PIL import Image, ImageOps
except ImportError as error:  # pragma: no cover - setup guidance
    raise SystemExit("缺少 Pillow。请先运行：python -m pip install pillow") from error


Image.MAX_IMAGE_PIXELS = None
print_lock = threading.Lock()


def card_record(path: Path) -> dict[str, object]:
    stem = path.stem
    trained = stem.endswith("_T")
    clean_stem = stem[:-2] if trained else stem
    return {
        "id": f"{path.parent.name}/{path.name}",
        "character": path.parent.name,
        "filename": path.name,
        "title": " ".join(clean_stem.replace("_", " ").split()),
        "trained": trained,
    }


def make_thumbnail(source: Path, cards_root: Path, thumbs_root: Path, width: int) -> str:
    relative = source.relative_to(cards_root).with_suffix(".webp")
    destination = thumbs_root / relative
    destination.parent.mkdir(parents=True, exist_ok=True)

    if destination.is_file() and destination.stat().st_mtime >= source.stat().st_mtime:
        return "skipped"

    temporary = destination.with_suffix(".webp.tmp")
    try:
        with Image.open(source) as opened:
            image = ImageOps.exif_transpose(opened)
            target_height = max(1, round(image.height * width / image.width))
            image = image.resize((width, target_height), Image.Resampling.LANCZOS).convert("RGB")
            image.save(temporary, format="WEBP", quality=74, method=5)
        temporary.replace(destination)
        return "created"
    finally:
        temporary.unlink(missing_ok=True)


def main() -> int:
    parser = argparse.ArgumentParser(description="生成本地 PJSK 卡面清单与缩略图")
    parser.add_argument("--cards", type=Path, default=Path("pjsk_cards"))
    parser.add_argument("--thumbs", type=Path, default=Path("pjsk_thumbs"))
    parser.add_argument("--manifest", type=Path, default=Path("app/cards.json"))
    parser.add_argument("--width", type=int, default=720)
    parser.add_argument("--workers", type=int, default=min(8, os.cpu_count() or 4))
    args = parser.parse_args()

    cards_root = args.cards.resolve()
    thumbs_root = args.thumbs.resolve()
    files = sorted(cards_root.glob("*/*.png"), key=lambda path: str(path).casefold())
    if not files:
        raise SystemExit(f"没有在 {cards_root} 下找到 PNG 卡面")

    records = [card_record(path) for path in files]
    args.manifest.parent.mkdir(parents=True, exist_ok=True)
    args.manifest.write_text(
        json.dumps(records, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )

    created = 0
    skipped = 0
    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as executor:
        futures = {
            executor.submit(make_thumbnail, path, cards_root, thumbs_root, args.width): path
            for path in files
        }
        for index, future in enumerate(as_completed(futures), start=1):
            status = future.result()
            if status == "created":
                created += 1
            else:
                skipped += 1
            if index % 100 == 0 or index == len(files):
                with print_lock:
                    print(f"缩略图进度 {index}/{len(files)}", flush=True)

    print(
        f"完成：卡面 {len(records)}，新缩略图 {created}，已存在 {skipped}，"
        f"清单 {args.manifest.resolve()}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
