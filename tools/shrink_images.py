"""Copy the Humidor design images into the site and shrink any copy over 1 MB.

    python -I tools/shrink_images.py

Source: handoff/2026-10-24-humidor/design/img/ (never modified; RAY's ruling 4 keeps it raw).
Output: assets/humidor/ (cigars/, logos/, icons/, plant-primings.jpg, salomon-outline-crop.png).
avatars/ is skipped: the repo already has assets/avatars/. The pack's hank-oink.png lives elsewhere and is
not copied either; the site uses the repo's own assets/hank-oink.png (R11).

Every run rebuilds each output from the raw source, so it is safe to re-run. Names and formats never change
(R12): a file over the limit is resized to a long edge of at most 1600 px and re-saved in its own format.
PNG saves with optimize=True, then quantises to 256 colours (alpha kept) if still too big. JPEG saves at
quality 82 and steps down to 70. Exits 1 if any output is still over the limit.
"""
import shutil
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'handoff' / '2026-10-24-humidor' / 'design' / 'img'
DST = ROOT / 'assets' / 'humidor'
ITEMS = ['cigars', 'logos', 'icons', 'plant-primings.jpg', 'salomon-outline-crop.png']
LIMIT = 1_000_000        # bytes; under both 1 MB and 1 MiB, so `find -size +1M` agrees
LONG_EDGE = 1600


def files():
    for item in ITEMS:
        p = SRC / item
        if p.is_dir():
            yield from sorted(f for f in p.rglob('*') if f.is_file())
        elif p.is_file():
            yield p
        else:
            sys.exit(f'missing source: {p}')


def shrink(src, out):
    img = Image.open(src)
    img.load()
    if max(img.size) > LONG_EDGE:
        img.thumbnail((LONG_EDGE, LONG_EDGE), Image.Resampling.LANCZOS)
    ext = src.suffix.lower()
    if ext == '.png':
        img.save(out, 'PNG', optimize=True)
        if out.stat().st_size > LIMIT:
            alpha = img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info)
            base = img.convert('RGBA' if alpha else 'RGB')
            method = Image.Quantize.FASTOCTREE if alpha else Image.Quantize.MEDIANCUT
            base.quantize(colors=256, method=method).save(out, 'PNG', optimize=True)
    elif ext in ('.jpg', '.jpeg'):
        rgb = img.convert('RGB') if img.mode not in ('RGB', 'L') else img
        for q in (82, 78, 74, 70):
            rgb.save(out, 'JPEG', quality=q, optimize=True, progressive=True)
            if out.stat().st_size <= LIMIT:
                break
    elif ext == '.webp':
        for q in (82, 78, 74, 70):
            img.save(out, 'WEBP', quality=q)
            if out.stat().st_size <= LIMIT:
                break
    else:
        shutil.copyfile(src, out)   # e.g. SVG: nothing to re-encode; reported below if still too big


def main():
    over = []
    total = 0
    for src in files():
        out = DST / src.relative_to(SRC)
        out.parent.mkdir(parents=True, exist_ok=True)
        before = src.stat().st_size
        if before > LIMIT:
            shrink(src, out)
            note = 'shrunk'
        else:
            shutil.copyfile(src, out)
            note = 'copied'
        after = out.stat().st_size
        total += after
        if after > LIMIT:
            over.append(out)
        if note == 'shrunk':
            print(f'{note}  {out.relative_to(ROOT)}  {before:,} -> {after:,} bytes')
    print(f'assets/humidor total: {total:,} bytes')
    for o in over:
        print(f'STILL OVER {LIMIT:,} bytes: {o.relative_to(ROOT)}', file=sys.stderr)
    return 1 if over else 0


if __name__ == '__main__':
    sys.exit(main())
