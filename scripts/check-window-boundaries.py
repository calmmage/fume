"""Measure the authored window surround before generating back-wall-only maps.

Run with the workspace Python (Pillow required). Original artwork is untouched.
The column median rejects wood grain, marble veins and Pixel's diagonal mullion.
The terminal bright-to-dark edge plus a sustained dark band identifies the wall.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path
from statistics import median

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
STYLES = ("wood", "stone", "pixel")


def measure(image):
    width, height = image.size
    profile = [median(sum(image.getpixel((x, y))) / 3
                      for y in range(height // 7, height // 2, 8))
               for x in range(width // 4)]
    edges = [x for x in range(width // 12, width // 5)
             if profile[x - 4] > 100 and profile[x + 4] < 80
             and profile[x - 4] - profile[x + 4] > 70]
    if not edges:
        raise AssertionError("Artwork has no confidently measured window-to-wall edge")
    edge = edges[-1] + 4
    start = next(x for x in range(edge, len(profile) - 16)
                 if max(profile[x:x + 16]) < 80)
    return start, {"terminalEdge": edges[-1], "wallStart": start,
                   "darkBandWidth": 16, "darkBandMaximum": max(profile[start:start + 16])}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--receipt")
    args = parser.parse_args()
    shader = (ROOT / "src/game/wgsl/composite.wgsl").read_text()
    loader = (ROOT / "src/game/materials.ts").read_text()
    back_uv = re.search(r"fn material_back_uv\([\s\S]*?\n\}", shader).group()
    original_crop = re.search(r"vec2f\((0\.\d+), 0\.0\) \+", back_uv)
    prefix = float(original_crop.group(1)) if original_crop else 0
    cropped = "`${style}-back-wall`" in loader
    rows = []
    for style in STYLES:
        source = ROOT / f"public/styles/{style}-room.webp"
        image = Image.open(source).convert("RGB")
        start, evidence = measure(image)
        destination = ROOT / f"public/styles/{style}-back-wall.webp"
        metadata = {"source": f"{style}-room.webp", "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
                    "sourceSize": list(image.size), "crop": [start, 0, image.width, image.height],
                    "method": "terminal bright-to-dark column edge followed by 16 dark columns",
                    "measurement": evidence, "kind": "lossless crop of incumbent generated artwork"}
        if args.write:
            image.crop(tuple(metadata["crop"])).save(destination, "WEBP", lossless=True)
            destination.with_suffix(".webp.json").write_text(json.dumps(metadata, indent=2) + "\n")
        first_sample = int(image.width * prefix) if not cropped else start
        exact = False
        if cropped and destination.exists():
            actual = Image.open(destination).convert("RGB")
            expected = image.crop((start, 0, image.width, image.height))
            exact = actual.size == expected.size and actual.tobytes() == expected.tobytes()
        rows.append({"style": style, **evidence, "firstSourceColumn": first_sample,
                     "excludedWindowPixels": first_sample >= start,
                     "exactLosslessCrop": exact, "pass": cropped and prefix == 0 and exact})
    receipt = {"measurementRows": [image.height // 7, image.height // 2, 8], "results": rows}
    print(json.dumps(receipt, indent=2))
    if args.receipt:
        Path(args.receipt).write_text(json.dumps(receipt, indent=2) + "\n")
    if not args.write and not all(row["pass"] for row in rows):
        raise SystemExit("FAIL: runtime back-wall maps still contain authored window pixels")


if __name__ == "__main__":
    main()
