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


# --- Claude-in-a-VM desktop shots -------------------------------------------
# Two proof shots of Claude running inside a LemmaComputer workspace, kept as the
# FULL Ubuntu desktop — the OS top bar ("Applications | Claude"), the purple
# wallpaper, the launcher icons, and the browser chrome all stay in frame. The
# desktop IS the point: it shows the reader that all of this runs in a real VM,
# not a cropped app screenshot. We keep the whole frame and only paint over the
# one piece of identity that appears: the workspace UUID in the Firefox URL bar
# of the browser shot. The "onecomputer.metech.dev" host stays visible.
#
#   claude-desktop-vm  <- claude-screenshot-1  (Claude Desktop window; no URL
#                         bar, no UUID → nothing to mask, keep whole frame)
#   claude-browser-vm  <- claude-screenshot-2  (browser at onecomputer.metech.dev;
#                         mask ONLY the "/workspaces/<uuid>/?…" run in the URL bar)
#
# The URL-bar mask box was measured against the real 2660x1600 frame: the pill
# background is near-white (253,253,253); the box starts just right of ".dev/"
# and ends just left of the trailing toolbar icons, clearing the UUID + query
# while leaving the host and the page below untouched.
DESKTOP_SHOTS = [
    {"src": "/Users/ttwj/Desktop/claude-screenshot-1.png", "slug": "claude-desktop-vm"},
    {
        "src": "/Users/ttwj/Desktop/claude-screenshot-2.png",
        "slug": "claude-browser-vm",
        "masks": [(628, 8, 2210, 74)],
        "mask_fill": (253, 253, 253),
    },
]


def process_desktop(shot):
    im = Image.open(shot["src"]).convert("RGB")
    draw = ImageDraw.Draw(im)
    fill = shot.get("mask_fill", (253, 253, 253))
    for box in shot.get("masks", []):
        draw.rectangle(box, fill=fill)
    cw, ch = im.size
    if cw > TARGET_W:
        nh = round(ch * TARGET_W / cw)
        im = im.resize((TARGET_W, nh), Image.LANCZOS)
    out = os.path.join(OUT_DIR, shot["slug"] + ".png")
    im.save(out, "PNG", optimize=True)
    print(f"{shot['slug']:16s} {im.size[0]}x{im.size[1]}  <- {os.path.basename(shot['src'])}")


for shot in DESKTOP_SHOTS:
    if os.path.exists(shot["src"]):
        process_desktop(shot)
    else:
        print(f"{shot['slug']:16s} skipped (source not present: {shot['src']})")

print("done")
