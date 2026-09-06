// 教科(ひらがな・カタカナ…)の定義をまとめたモジュール。
// 新しい教科を追加するときは、データファイルを作ってこの配列に足すだけでよい。

import { HIRAGANA_DATA, ROW_ORDER as HIRA_ROWS, COL_LABELS as HIRA_COLS } from "./data/hiragana.js";
import { KATAKANA_DATA, ROW_ORDER as KATA_ROWS, COL_LABELS as KATA_COLS } from "./data/katakana.js";

export const SUBJECTS = [
  {
    id: "hiragana",
    name: "ひらがな",
    icon: "あ",
    data: HIRAGANA_DATA,
    rowOrder: HIRA_ROWS,
    colLabels: HIRA_COLS
  },
  {
    id: "katakana",
    name: "カタカナ",
    icon: "ア",
    data: KATAKANA_DATA,
    rowOrder: KATA_ROWS,
    colLabels: KATA_COLS
  }
];

// これから追加する予定の教科(ホーム画面に「じゅんび中」として並べる)
export const COMING_SOON = [
  { id: "kanji", name: "かんじ", icon: "漢" },
  { id: "english", name: "えいご", icon: "A" }
];

export function getSubject(id) {
  return SUBJECTS.find((s) => s.id === id) || SUBJECTS[0];
}

/** すべての教科の文字(ふくしゅう・にがて判定は教科をまたいで行う) */
export const ALL_CHARS = SUBJECTS.flatMap((s) => s.data);

export function charById(id) {
  return ALL_CHARS.find((c) => c.id === id) || null;
}
