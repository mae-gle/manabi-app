"""
KanjiVG (https://kanjivg.tagaini.net/) から、ひらがな46文字の
「画ごとに分かれた書き順ベクターデータ」を取得して js/data/hiragana.js を生成する。

KanjiVG は Creative Commons Attribution-Share Alike 3.0 ライセンス。
生成されるデータファイルの先頭に出典表記を入れている。

使い方:
    python tools/fetch_kanjivg.py
"""
import os
import re
import time
import urllib.request

BASE_URL = "https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji/{:05x}.svg"
OUT_PATH = os.path.join(os.path.dirname(__file__), "..", "js", "data", "hiragana.js")

# (文字, ローマ字, 行, 五十音表の列)
CHARS = [
    ("あ", "a", "あ", 0), ("い", "i", "あ", 1), ("う", "u", "あ", 2),
    ("え", "e", "あ", 3), ("お", "o", "あ", 4),
    ("か", "ka", "か", 0), ("き", "ki", "か", 1), ("く", "ku", "か", 2),
    ("け", "ke", "か", 3), ("こ", "ko", "か", 4),
    ("さ", "sa", "さ", 0), ("し", "shi", "さ", 1), ("す", "su", "さ", 2),
    ("せ", "se", "さ", 3), ("そ", "so", "さ", 4),
    ("た", "ta", "た", 0), ("ち", "chi", "た", 1), ("つ", "tsu", "た", 2),
    ("て", "te", "た", 3), ("と", "to", "た", 4),
    ("な", "na", "な", 0), ("に", "ni", "な", 1), ("ぬ", "nu", "な", 2),
    ("ね", "ne", "な", 3), ("の", "no", "な", 4),
    ("は", "ha", "は", 0), ("ひ", "hi", "は", 1), ("ふ", "fu", "は", 2),
    ("へ", "he", "は", 3), ("ほ", "ho", "は", 4),
    ("ま", "ma", "ま", 0), ("み", "mi", "ま", 1), ("む", "mu", "ま", 2),
    ("め", "me", "ま", 3), ("も", "mo", "ま", 4),
    ("や", "ya", "や", 0), ("ゆ", "yu", "や", 2), ("よ", "yo", "や", 4),
    ("ら", "ra", "ら", 0), ("り", "ri", "ら", 1), ("る", "ru", "ら", 2),
    ("れ", "re", "ら", 3), ("ろ", "ro", "ら", 4),
    ("わ", "wa", "わ", 0), ("を", "wo", "わ", 4), ("ん", "n", "ん", 0),
]

PATH_RE = re.compile(r'<path\s+id="kvg:[0-9a-f]+-s(\d+)"[^>]*?\sd="([^"]+)"', re.S)


def fetch_paths(char):
    url = BASE_URL.format(ord(char))
    with urllib.request.urlopen(url, timeout=30) as res:
        svg = res.read().decode("utf-8")
    found = PATH_RE.findall(svg)
    if not found:
        raise RuntimeError(f"{char}: パスを抽出できませんでした")
    found.sort(key=lambda m: int(m[0]))  # 画数の順に並べる
    return [d.strip() for _, d in found]


def main():
    entries = []
    for char, romaji, row, col in CHARS:
        paths = fetch_paths(char)
        entries.append((char, romaji, row, col, paths))
        print(f"{char} ({romaji}): {len(paths)}画")
        time.sleep(0.15)  # 相手サーバーに負荷をかけないよう少し待つ

    lines = [
        "// ひらがな46文字の学習データ",
        "//",
        "// 書き順の線データ(paths)は KanjiVG に由来する。",
        "//   KanjiVG: https://kanjivg.tagaini.net/",
        "//   Copyright (C) 2009-2011 Ulrich Apel",
        "//   Licensed under Creative Commons Attribution-Share Alike 3.0",
        "//   https://creativecommons.org/licenses/by-sa/3.0/",
        "//",
        "// paths: 1画=1つのSVGパス文字列。配列の順序がそのまま書き順になる。",
        "//        座標系は KanjiVG の 109x109 (KVG_SIZE)。",
        "//        画面表示・お手本アニメーション・採点のすべてでこの同じ線を使うため、",
        "//        お手本とお手本アニメーションが必ず一致する。",
        "// row/col: 五十音表での位置(一覧画面をこの並びで表示する)",
        "//",
        "// カタカナ・漢字も同じ形式で追加できる(tools/fetch_kanjivg.py で生成)。",
        "",
        "export const KVG_SIZE = 109;",
        "",
        "export const HIRAGANA_DATA = [",
    ]
    for char, romaji, row, col, paths in entries:
        lines.append(f'  {{ id: "hiragana_{romaji}", char: "{char}", romaji: "{romaji}", row: "{row}", col: {col},')
        lines.append("    paths: [")
        for d in paths:
            lines.append(f'      "{d}",')
        lines.append("    ]},")
    lines.append("];")
    lines.append("")
    lines.append("// 五十音表の行の表示順(一覧画面をこの順で並べる)")
    lines.append('export const ROW_ORDER = ["あ","か","さ","た","な","は","ま","や","ら","わ","ん"];')
    lines.append("")

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f"\n生成しました: {OUT_PATH}")


if __name__ == "__main__":
    main()
