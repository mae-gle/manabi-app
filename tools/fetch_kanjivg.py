"""
KanjiVG (https://kanjivg.tagaini.net/) から、ひらがな・カタカナの
「画ごとに分かれた書き順ベクターデータ」を取得して js/data/*.js を生成する。

KanjiVG は Creative Commons Attribution-Share Alike 3.0 ライセンス。
生成されるデータファイルの先頭に出典表記を入れている。

使い方:
    python tools/fetch_kanjivg.py            # ひらがな・カタカナの両方
    python tools/fetch_kanjivg.py katakana   # カタカナだけ
"""
import os
import re
import sys
import time
import urllib.request

BASE_URL = "https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji/{:05x}.svg"
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "js", "data")

# 五十音表の並び: (ローマ字, 行番号, 列番号)
# ひらがなとカタカナで並びは共通なので、文字だけ差し替えて使う
LAYOUT = [
    ("a", 0, 0), ("i", 0, 1), ("u", 0, 2), ("e", 0, 3), ("o", 0, 4),
    ("ka", 1, 0), ("ki", 1, 1), ("ku", 1, 2), ("ke", 1, 3), ("ko", 1, 4),
    ("sa", 2, 0), ("shi", 2, 1), ("su", 2, 2), ("se", 2, 3), ("so", 2, 4),
    ("ta", 3, 0), ("chi", 3, 1), ("tsu", 3, 2), ("te", 3, 3), ("to", 3, 4),
    ("na", 4, 0), ("ni", 4, 1), ("nu", 4, 2), ("ne", 4, 3), ("no", 4, 4),
    ("ha", 5, 0), ("hi", 5, 1), ("fu", 5, 2), ("he", 5, 3), ("ho", 5, 4),
    ("ma", 6, 0), ("mi", 6, 1), ("mu", 6, 2), ("me", 6, 3), ("mo", 6, 4),
    ("ya", 7, 0), ("yu", 7, 2), ("yo", 7, 4),
    ("ra", 8, 0), ("ri", 8, 1), ("ru", 8, 2), ("re", 8, 3), ("ro", 8, 4),
    ("wa", 9, 0), ("wo", 9, 4),
    ("n", 10, 0),
]

SETS = {
    "hiragana": {
        "chars": "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん",
        "row_names": ["あ", "か", "さ", "た", "な", "は", "ま", "や", "ら", "わ", "ん"],
        "col_labels": ["あ", "い", "う", "え", "お"],
        "const": "HIRAGANA_DATA",
        "file": "hiragana.js",
        "label": "ひらがな",
    },
    "katakana": {
        "chars": "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン",
        "row_names": ["ア", "カ", "サ", "タ", "ナ", "ハ", "マ", "ヤ", "ラ", "ワ", "ン"],
        "col_labels": ["ア", "イ", "ウ", "エ", "オ"],
        "const": "KATAKANA_DATA",
        "file": "katakana.js",
        "label": "カタカナ",
    },
}

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


def build(kind):
    conf = SETS[kind]
    chars = list(conf["chars"])
    if len(chars) != len(LAYOUT):
        raise RuntimeError(f"{kind}: 文字数が並び表と一致しません")

    entries = []
    for char, (romaji, row_idx, col) in zip(chars, LAYOUT):
        paths = fetch_paths(char)
        entries.append((char, romaji, conf["row_names"][row_idx], col, paths))
        print(f"{char} ({romaji}): {len(paths)}画")
        time.sleep(0.15)  # 相手サーバーに負荷をかけないよう少し待つ

    lines = [
        f"// {conf['label']}46文字の学習データ",
        "//",
        "// 書き順の線データ(paths)は KanjiVG に由来する。",
        "//   KanjiVG: https://kanjivg.tagaini.net/",
        "//   Copyright (C) 2009-2011 Ulrich Apel",
        "//   Licensed under Creative Commons Attribution-Share Alike 3.0",
        "//   https://creativecommons.org/licenses/by-sa/3.0/",
        "//",
        "// paths: 1画=1つのSVGパス文字列。配列の順序がそのまま書き順になる。",
        "//        座標系は data/kvg.js の KVG_SIZE (109x109)。",
        "//        画面表示・お手本アニメーション・採点のすべてでこの同じ線を使うため、",
        "//        お手本とお手本アニメーションが必ず一致する。",
        "// row/col: 五十音表での位置(一覧画面をこの並びで表示する)",
        "//",
        "// このファイルは tools/fetch_kanjivg.py で生成しています(手で編集しない)。",
        "",
        f"export const {conf['const']} = [",
    ]
    for char, romaji, row, col, paths in entries:
        lines.append(f'  {{ id: "{kind}_{romaji}", char: "{char}", romaji: "{romaji}", row: "{row}", col: {col},')
        lines.append("    paths: [")
        for d in paths:
            lines.append(f'      "{d}",')
        lines.append("    ]},")
    lines.append("];")
    lines.append("")
    lines.append("// 五十音表の行・列の並び(一覧画面の表示に使う)")
    lines.append("export const ROW_ORDER = [" + ",".join(f'"{r}"' for r in conf["row_names"]) + "];")
    lines.append("export const COL_LABELS = [" + ",".join(f'"{c}"' for c in conf["col_labels"]) + "];")
    lines.append("")

    out_path = os.path.join(DATA_DIR, conf["file"])
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f"生成しました: {out_path}\n")


if __name__ == "__main__":
    targets = sys.argv[1:] or ["hiragana", "katakana"]
    for t in targets:
        build(t)
