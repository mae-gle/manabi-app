// 進捗の保存・読み込み(localStorage)
// iOSのSafariはまれに未使用のWebデータを消去することがあるため、
// エクスポート/インポートでファイルへのバックアップができるようにしている。

const PROGRESS_KEY = "manabi_progress_v1";
const STREAK_KEY = "manabi_streak_v1";

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

export function loadStreak() {
  try {
    return JSON.parse(localStorage.getItem(STREAK_KEY)) || {
      lastDate: null, currentStreak: 0, longestStreak: 0, historyDates: [], stamps: 0
    };
  } catch {
    return { lastDate: null, currentStreak: 0, longestStreak: 0, historyDates: [], stamps: 0 };
  }
}

function saveStreak(streak) {
  localStorage.setItem(STREAK_KEY, JSON.stringify(streak));
}

// 1回の練習/テスト結果を記録し、習熟度・連続記録を更新する
export function recordResult(charId, mode, result) {
  const progress = loadProgress();
  const entry = progress[charId] || { attempts: [], bestScore: 0, masteryLevel: 0, lastPracticed: null };

  entry.attempts.push({
    mode, date: todayStr(), score: result.total, mistakes: result.mistakes
  });
  if (entry.attempts.length > 20) entry.attempts = entry.attempts.slice(-20); // 保存量を制限
  entry.bestScore = Math.max(entry.bestScore, result.total);
  entry.lastPracticed = todayStr();

  // 習熟度: テストで高得点を2回以上取ったら「習得」とみなす
  const goodTestCount = entry.attempts.filter((a) => a.mode === "test" && a.score >= 80).length;
  if (goodTestCount >= 2) entry.masteryLevel = 3;
  else if (goodTestCount >= 1) entry.masteryLevel = 2;
  else if (entry.attempts.length > 0) entry.masteryLevel = 1;

  progress[charId] = entry;
  saveProgress(progress);

  // 学習カレンダー/連続記録の更新
  const streak = loadStreak();
  const today = todayStr();
  if (streak.lastDate !== today) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    streak.currentStreak = streak.lastDate === yesterday ? streak.currentStreak + 1 : 1;
    streak.longestStreak = Math.max(streak.longestStreak, streak.currentStreak);
    streak.historyDates.push(today);
    streak.lastDate = today;
  }
  if (result.praiseLevel === "perfect" || result.praiseLevel === "good") streak.stamps += 1;
  saveStreak(streak);

  return { progress: entry, streak };
}

// 苦手な文字(習熟度が低い/間違いが多い)を優先して返す
export function getReviewQueue(allChars) {
  const progress = loadProgress();
  return allChars
    .map((c) => {
      const p = progress[c.id];
      const weakness = !p ? 1 : p.masteryLevel === 3 ? 0 : (4 - p.masteryLevel) + (p.attempts.slice(-3).filter(a => a.score < 70).length);
      return { char: c, weakness };
    })
    .sort((a, b) => b.weakness - a.weakness)
    .map((x) => x.char);
}

export function exportBackup() {
  const data = {
    exportedAt: new Date().toISOString(),
    progress: loadProgress(),
    streak: loadStreak()
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
        if (data.streak) saveStreak(data.streak);
        resolve(data);
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}
