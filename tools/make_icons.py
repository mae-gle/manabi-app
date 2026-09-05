"""
アプリアイコンを生成するスクリプト(依存ライブラリ不要、Python標準ライブラリのみ)。
オレンジの背景に、白い一筆書きの曲線(なぞり書きをイメージ)を描く簡単なアイコン。

再生成する場合:
    python tools/make_icons.py
"""
import struct
import zlib
import os

BG = (255, 159, 90)      # --accent
STROKE = (255, 255, 255)
TIP = (232, 130, 58)     # --accent-dark

SIZES = [180, 192, 512]
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "icons")


def make_pixels(size):
    px = [[BG for _ in range(size)] for _ in range(size)]

    def set_px(x, y, color):
        if 0 <= x < size and 0 <= y < size:
            px[y][x] = color

    def filled_circle(cx, cy, r, color):
        r2 = r * r
        for y in range(int(cy - r), int(cy + r) + 1):
            for x in range(int(cx - r), int(cx + r) + 1):
                if (x - cx) ** 2 + (y - cy) ** 2 <= r2:
                    set_px(x, y, color)

    def quad_bezier(p0, p1, p2, steps=120):
        pts = []
        for i in range(steps + 1):
            t = i / steps
            x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t ** 2 * p2[0]
            y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t ** 2 * p2[1]
            pts.append((x, y))
        return pts

    w = size
    stroke_r = w * 0.075
    # なぞり書きの曲線(ゆるいS字)
    p0 = (w * 0.22, w * 0.62)
    p1 = (w * 0.5, w * 0.18)
    p2 = (w * 0.5, w * 0.5)
    p3 = (w * 0.5, w * 0.82)
    p4 = (w * 0.8, w * 0.38)

    for (a, b, c) in [(p0, p1, p2), (p2, p3, p4)]:
        for (x, y) in quad_bezier(a, b, c):
            filled_circle(x, y, stroke_r, STROKE)

    # 書き始めの点(濃いオレンジの丸)
    filled_circle(p0[0], p0[1], stroke_r * 0.9, TIP)

    return px


def write_png(path, px, size):
    def chunk(tag, data):
        return (struct.pack(">I", len(data)) + tag + data +
                struct.pack(">I", zlib.crc32(tag + data) & 0xffffffff))

    raw = bytearray()
    for y in range(size):
        raw.append(0)  # filter: none
        for x in range(size):
            r, g, b = px[y][x]
            raw += bytes((r, g, b))

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)
    idat = zlib.compress(bytes(raw), 9)

    with open(path, "wb") as f:
        f.write(sig)
        f.write(chunk(b"IHDR", ihdr))
        f.write(chunk(b"IDAT", idat))
        f.write(chunk(b"IEND", b""))


if __name__ == "__main__":
    os.makedirs(OUT_DIR, exist_ok=True)
    for s in SIZES:
        pixels = make_pixels(s)
        out_path = os.path.join(OUT_DIR, f"icon-{s}.png")
        write_png(out_path, pixels, s)
        print(f"wrote {out_path}")
