// 進捗の保存・読み込み(localStorage)
// iOSのSafariはまれに未使用のWebデータを消去することがあるため、
// エクスポート/インポートでファイルへのバックアップができるようにしている。

import { STICKER_ALBUMS, findSticker } from "./data/stickers.js";

const PROGRESS_KEY = "manabi_progress_v1";
const STREAK_KEY = "manabi_streak_v1";

// 1日の目標(この数の文字を練習したら「きょうのもくひょう たっせい」)
export const DAILY_GOAL = 5;

// 「にがて」と判定する基準: 直近3回の平均点がこの点数より低い文字
export const WEAK_SCORE_THRESHOLD = 70;
const RECENT_COUNT = 3;

// シールは「がんばりポイント」をためると1枚もらえる。
// 良い出来ほど早くたまるので、ていねいに書くほど早くシールが増える。
export const STICKER_COST = 6;
const POINTS_BY_PRAISE = { perfect: 3, good: 2, ok: 1, retry: 0 };

// レア度の出やすさ(この順に抽選する)
const RARITY_ROLL = [
  { rarity: "super", chance: 0.05 },
  { rarity: "rare", chance: 0.2 }
];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(PROGRESS_KEY)) || {};
  } catch {
    return {};
  }
}

function saveProgress(progress) {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
}

function defaultStats() {
  return {
    lastDate: null,
    currentStreak: 0,
    longestStreak: 0,
    historyDates: [],
    stickers: [],              // 手に入れたシールのid
    stickerPoints: 0,          // 次のシールまでのがんばりポイント
    today: { date: null, charIds: [] } // きょう練習した文字
  };
}

export function loadStats() {
  let saved;
  try {
    saved = JSON.parse(localStorage.getItem(STREAK_KEY));
  } catch {
    saved = null;
  }
  // 古い保存データにも対応できるよう、足りない項目は既定値で埋める
  const stats = { ...defaultStats(), ...(saved || {}) };
  if (!stats.today || stats.today.date !== todayStr()) {
    stats.today = { date: todayStr(), charIds: [] };
  }
  // 以前のバージョンは絵文字そのものを保存していたため、idのものだけ残す
  stats.stickers = Array.isArray(stats.stickers)
    ? stats.stickers.filter((id) => findSticker(id))
    : [];
  if (typeof stats.stickerPoints !== "number") stats.stickerPoints = 0;
  return stats;
}

function saveStats(stats) {
  localStorage.setItem(STREAK_KEY, JSON.stringify(stats));
}

/** きょうの練習状況(ホーム画面の目標表示用) */
export function getTodayStatus() {
  const stats = loadStats();
  const count = stats.today.charIds.length;
  return { count, goal: DAILY_GOAL, achieved: count >= DAILY_GOAL };
}

/** シールずかんの状態(マイページ表示用) */
export function getStickerState() {
  const stats = loadStats();
  const owned = new Set(stats.stickers);
  const albums = STICKER_ALBUMS.map((album) => {
    const ownedCount = album.stickers.filter((s) => owned.has(s.id)).length;
    return {
      id: album.id,
      name: album.name,
      cover: album.cover,
      ownedCount,
      complete: ownedCount === album.stickers.length,
      stickers: album.stickers.map((s) => ({ ...s, owned: owned.has(s.id) }))
    };
  });
  const total = albums.reduce((n, a) => n + a.stickers.length, 0);
  const ownedTotal = albums.reduce((n, a) => n + a.ownedCount, 0);
  return {
    albums,
    total,
    ownedTotal,
    points: stats.stickerPoints,
    cost: STICKER_COST,
    allComplete: ownedTotal === total
  };
}

/** 直近の点数の平均(にがて判定に使う)。まだ練習していない文字は null */
function recentAverage(entry) {
  if (!entry || entry.attempts.length === 0) return null;
  const recent = entry.attempts.slice(-RECENT_COUNT);
  const sum = recent.reduce((acc, a) => acc + a.score, 0);
  return Math.round(sum / recent.length);
}

// いま集めているアルバム(そろっていない最初のアルバム)から1枚選ぶ
function drawSticker(ownedIds) {
  const owned = new Set(ownedIds);
  const album = STICKER_ALBUMS.find((a) => a.stickers.some((s) => !owned.has(s.id)));
  if (!album) return null; // ぜんぶ集めた

  const remaining = album.stickers.filter((s) => !owned.has(s.id));
  const roll = Math.random();
  let acc = 0;
  for (const { rarity, chance } of RARITY_ROLL) {
    acc += chance;
    if (roll < acc) {
      const candidates = remaining.filter((s) => s.rarity === rarity);
      if (candidates.length > 0) {
        const picked = candidates[Math.floor(Math.random() * candidates.length)];
        return { ...picked, albumId: album.id, albumName: album.name };
      }
      break; // そのレア度が残っていなければノーマルから選ぶ
    }
  }
  const normals = remaining.filter((s) => s.rarity === "normal");
  const pool = normals.length > 0 ? normals : remaining;
  const picked = pool[Math.floor(Math.random() * pool.length)];
  return { ...picked, albumId: album.id, albumName: album.name };
}

// 1回の練習/テスト結果を記録し、習熟度・記録・シールを更新する
export function recordResult(charId, mode, result) {
  const progress = loadProgress();
  const entry = progress[charId] || { attempts: [], bestScore: 0, masteryLevel: 0, lastPracticed: null };

  entry.attempts.push({
    mode, date: todayStr(), score: result.total, mistakes: result.mistakes
  });
  if (entry.attempts.length > 20) entry.attempts = entry.attempts.slice(-20); // 保存量を制限
  entry.bestScore = Math.max(entry.bestScore, result.total);
  entry.lastPracticed = todayStr();

  // 習熟度(一覧のタイルの色): 一度ついた色は日付が変わっても戻らない
  //   0=まだ / 1=れんしゅうした / 2=テストごうかく / 3=しっかり おぼえた
  const goodTestCount = entry.attempts.filter((a) => a.mode === "test" && a.score >= 80).length;
  if (goodTestCount >= 2) entry.masteryLevel = 3;
  else if (goodTestCount >= 1) entry.masteryLevel = 2;
  else entry.masteryLevel = Math.max(entry.masteryLevel, 1);

  progress[charId] = entry;
  saveProgress(progress);

  // 学習カレンダー/連続記録/きょうの練習数の更新
  const stats = loadStats();
  const today = todayStr();
  if (stats.lastDate !== today) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    stats.currentStreak = stats.lastDate === yesterday ? stats.currentStreak + 1 : 1;
    stats.longestStreak = Math.max(stats.longestStreak, stats.currentStreak);
    stats.historyDates.push(today);
    stats.lastDate = today;
  }
  if (!stats.today.charIds.includes(charId)) stats.today.charIds.push(charId);

  // がんばりポイントをためて、たまったらシールを1枚もらえる
  stats.stickerPoints += POINTS_BY_PRAISE[result.praiseLevel] || 0;
  let newSticker = null;
  let albumCompleted = null;
  if (stats.stickerPoints >= STICKER_COST) {
    const drawn = drawSticker(stats.stickers);
    if (drawn) {
      stats.stickerPoints -= STICKER_COST;
      stats.stickers.push(drawn.id);
      newSticker = drawn;
      const album = STICKER_ALBUMS.find((a) => a.id === drawn.albumId);
      if (album && album.stickers.every((s) => stats.stickers.includes(s.id))) {
        albumCompleted = album.name;
      }
    } else {
      stats.stickerPoints = STICKER_COST; // ぜんぶ集めたらそれ以上たまらない
    }
  }
  saveStats(stats);

  return {
    progress: entry,
    stats,
    newSticker,
    albumCompleted,
    pointsToNext: Math.max(0, STICKER_COST - stats.stickerPoints)
  };
}

/**
 * にがてな文字 = 練習したことがあり、直近3回の平均点が70点未満の文字。
 * 点数の低い順に返す(理由が分かるよう平均点も一緒に返す)。
 */
export function getWeakChars(allChars) {
  const progress = loadProgress();
  return allChars
    .map((c) => ({ char: c, avg: recentAverage(progress[c.id]) }))
    .filter((x) => x.avg !== null && x.avg < WEAK_SCORE_THRESHOLD)
    .sort((a, b) => a.avg - b.avg);
}

/**
 * 「きょうのふくしゅう」の出題順。
 * 1) にがてな文字(点数の低い順) → 2) まだ練習していない文字 → 3) まだ習得していない文字
 */
export function getReviewQueue(allChars) {
  const progress = loadProgress();
  const weak = getWeakChars(allChars).map((x) => x.char);
  const weakIds = new Set(weak.map((c) => c.id));

  const untried = allChars.filter((c) => !progress[c.id]);
  const notMastered = allChars.filter(
    (c) => progress[c.id] && !weakIds.has(c.id) && progress[c.id].masteryLevel < 3
  );

  return [...weak, ...untried, ...notMastered];
}

export function exportBackup() {
  const data = {
    exportedAt: new Date().toISOString(),
    progress: loadProgress(),
    stats: loadStats()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `manabi-backup-${todayStr()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function importBackup(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (data.progress) saveProgress(data.progress);
        // stats は旧バージョンでは streak という名前で保存していた
        const stats = data.stats || data.streak;
        if (stats) saveStats(stats);
        resolve(data);
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}
