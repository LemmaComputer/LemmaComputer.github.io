#!/usr/bin/env python3
"""Crop/mask the raw LemmaComputer screenshots into public/shots/.

Privacy contract (locked with the user): remove personal identity — the
"one computer" account name in the sidebar, and the "one computer's browser"
label on the Trail screen — while keeping the product host and UI copy intact.
Strategy: crop off the left sidebar (which carries the account name) for every
shot, and paint a neutral mask over any identity that appears in the content
area. Output is downscaled to ~1600px wide.

Coordinates are in ORIGINAL pixel space. Masking happens before the crop, so
mask boxes use original coordinates too.
"""
import glob
import os
from PIL import Image, ImageDraw

SRC_DIR = "/Users/ttwj/Desktop/lemmacomputer-screenshots"
OUT_DIR = "/Users/ttwj/Documents/lemmacomputer/public/shots"
TARGET_W = 1600

# Left sidebar width in original px (~390 displayed * 1.49). Cropping here
# removes the "one computer" account chip at the sidebar's bottom-left.
SIDEBAR = 582

# Match each output slug to a source file by a unique timestamp substring.
# masks: list of (x0, y0, x1, y1) rectangles (original coords) painted paper-white
#        BEFORE cropping, to cover identity that sits in the content area.
# bottom_crop: optional original-y to cut the image at (drops rows below).
SHOTS = [
    {"slug": "workspaces", "match": "4.56.39"},
    {"slug": "agents", "match": "4.57.10"},
    {"slug": "access", "match": "4.56.59"},
    {"slug": "firewall", "match": "4.57.57"},
    {"slug": "approvals", "match": "4.58.45"},
    {
        # Trail: mask the whole device-identity subtitle line, which reads
        # "<account name>'s browser · did:key:z6Mkm…". Covering the entire run
        # (rather than just the name) avoids a dangling "…owser" fragment; the
        # two history rows below carry the section's meaning. Line ~y=684 orig,
        # spanning from just right of the card icon to past the did:key.
        "slug": "trail",
        "match": "4.58.56",
        "masks": [(945, 662, 1625, 708)],
    },
    {"slug": "schedules", "match": "4.57.36"},
]


def find_src(match: str) -> str:
    hits = [f for f in glob.glob(os.path.join(SRC_DIR, "*.png")) if match in f]
    if len(hits) != 1:
        raise SystemExit(f"Expected exactly one source for {match!r}, got {hits}")
    return hits[0]


def process(shot):
    src = find_src(shot["match"])
    im = Image.open(src).convert("RGB")
    w, h = im.size

    # Sample the sidebar background colour so masks blend with the surface.
    bg = im.getpixel((SIDEBAR + 40, 40))

    draw = ImageDraw.Draw(im)
    for box in shot.get("masks", []):
        draw.rectangle(box, fill=bg)

    bottom = shot.get("bottom_crop", h)
    im = im.crop((SIDEBAR, 0, w, bottom))

    # Downscale to target width, preserving aspect.
    cw, ch = im.size
    if cw > TARGET_W:
        nh = round(ch * TARGET_W / cw)
        im = im.resize((TARGET_W, nh), Image.LANCZOS)

    out = os.path.join(OUT_DIR, shot["slug"] + ".png")
    im.save(out, "PNG", optimize=True)
    print(f"{shot['slug']:12s} {im.size[0]}x{im.size[1]}  <- {os.path.basename(src)}")


os.makedirs(OUT_DIR, exist_ok=True)
for s in SHOTS:
    process(s)
print("done")
