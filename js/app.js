import { judge } from "./judge.js";
import { WritingCanvas } from "./canvas.js";
import { pointAt } from "./strokePaths.js";
import { SUBJECTS, COMING_SOON, ALL_CHARS, getSubject, charById } from "./subjects.js";
import {
  loadProgress, loadStats, recordResult, getReviewQueue, getWeakChars,
  getTodayStatus, getStickerState, exportBackup, importBackup, WEAK_SCORE_THRESHOLD
} from "./storage.js";
import { homeScreenHTML, listScreenHTML, writeScreenHTML, resultOverlayHTML, myPageHTML } from "./ui.js";

const root = document.getElementById("app");

const state = {
  subjectId: "hiragana",
  mode: "practice", // "practice" | "test"
  queue: [],
  queueIndex: 0,
  writingCanvas: null,
  lastScreen: "home"
};

// ---- 画面遷移 ----

function goHome() {
  state.lastScreen = "home";
  root.innerHTML = homeScreenHTML(getTodayStatus(), SUBJECTS, COMING_SOON);
  wireHome();
}

function goList() {
  state.lastScreen = "list";
  root.innerHTML = listScreenHTML(getSubject(state.subjectId), loadProgress(), state.mode);
  wireList();
}

function goMyPage() {
  state.lastScreen = "mypage";
  const weak = getWeakChars(ALL_CHARS).slice(0, 12);
  root.innerHTML = myPageHTML(loadStats(), weak, getStickerState(), WEAK_SCORE_THRESHOLD);
  wireMyPage();
}

function startQueue(ids, mode) {
  state.mode = mode;
  state.queue = ids;
  state.queueIndex = 0;
  openWriteScreen();
}

function openWriteScreen() {
  const charData = charById(state.queue[state.queueIndex]);
  root.innerHTML = writeScreenHTML(charData, state.mode, state.queueIndex, state.queue.length);
  const canvasEl = document.getElementById("writing-canvas");
  state.writingCanvas = new WritingCanvas(canvasEl, { showGuide: state.mode === "practice" });
  state.writingCanvas.setCharacter(charData);
  wireWrite(charData);
}

// ---- イベント配線 ----

function wireHome() {
  root.querySelector('[data-nav="mypage"]').addEventListener("click", goMyPage);
  root.querySelectorAll("[data-subject]").forEach((card) => {
    card.addEventListener("click", () => {
      state.subjectId = card.dataset.subject;
      goList();
    });
  });
  root.querySelector('[data-nav="review"]').addEventListener("click", () => {
    // ふくしゅうは教科をまたいで、にがてな文字から出題する
    const queue = getReviewQueue(ALL_CHARS).slice(0, 10).map((c) => c.id);
    startQueue(queue, "test");
  });
}

function wireList() {
  root.querySelector('[data-nav="home"]').addEventListener("click", goHome);
  root.querySelectorAll(".mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.mode = btn.dataset.mode;
      goList();
    });
  });
  root.querySelectorAll(".char-tile").forEach((tile) => {
    tile.addEventListener("click", () => startQueue([tile.dataset.char], state.mode));
  });
}

function wireWrite(charData) {
  root.querySelector('[data-nav="back"]').addEventListener("click", () => {
    state.lastScreen === "home" ? goHome() : goList();
  });
  root.querySelector('[data-action="speak"]').addEventListener("click", () => speak(charData.char));
  root.querySelector('[data-action="undo"]').addEventListener("click", () => state.writingCanvas.undoLastStroke());
  root.querySelector('[data-action="clear"]').addEventListener("click", () => state.writingCanvas.clear());
  const demoBtn = root.querySelector('[data-action="demo"]');
  if (demoBtn) demoBtn.addEventListener("click", () => state.writingCanvas.playDemo());
  root.querySelector('[data-action="submit"]').addEventListener("click", () => onSubmit(charData));
}

function onSubmit(charData) {
  const strokes = state.writingCanvas.getStrokes();
  if (strokes.length === 0) return;
  const result = judge(charData, strokes, state.mode);
  const reward = recordResult(charData.id, state.mode, result);
  showResult(result, charData, reward);
}

function showResult(result, charData, reward) {
  const overlay = document.createElement("div");
  overlay.innerHTML = resultOverlayHTML(result, charData, state.mode, reward);
  const node = overlay.firstElementChild;
  document.body.appendChild(node);

  playFeedbackSound(result.praiseLevel);
  if (result.praiseLevel === "perfect") launchConfetti(node.querySelector(".confetti-layer"));

  node.querySelector('[data-action="retry"]').addEventListener("click", () => {
    node.remove();
    state.writingCanvas.clear();
  });
  node.querySelector('[data-action="next"]').addEventListener("click", () => {
    node.remove();
    state.queueIndex++;
    if (state.queueIndex < state.queue.length) {
      openWriteScreen();
    } else {
      goList();
    }
  });
}

function wireMyPage() {
  root.querySelector('[data-nav="home"]').addEventListener("click", goHome);
  root.querySelector('[data-action="export"]').addEventListener("click", exportBackup);
  root.querySelector("#import-file").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      await importBackup(file);
      alert("読み込みが完了しました");
      goMyPage();
    } catch {
      alert("読み込みに失敗しました");
    }
  });
}

// ---- 読み上げ(TTS) ----

function speak(char) {
  if (!("speechSynthesis" in window)) return;
  const utter = new SpeechSynthesisUtterance(char);
  utter.lang = "ja-JP";
  utter.rate = 0.8;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
}

// ---- 効果音(Web Audio APIで生成、音声ファイル不要) ----

let audioCtx;
function playFeedbackSound(level) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const notesByLevel = {
      perfect: [523.25, 659.25, 783.99, 1046.5],
      good: [523.25, 659.25, 783.99],
      ok: [523.25, 587.33],
      retry: [392.0]
    };
    const notes = notesByLevel[level] || notesByLevel.ok;
    notes.forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.frequency.value = freq;
      osc.type = "sine";
      const start = audioCtx.currentTime + i * 0.12;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.2, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(start);
      osc.stop(start + 0.3);
    });
  } catch {
    // 音声再生に失敗しても学習に支障がないよう無視する
  }
}

// ---- 紙吹雪演出 ----

function launchConfetti(container) {
  if (!container) return;
  const colors = ["#ff6b6b", "#ffd93d", "#6bcB77", "#4d96ff", "#ff9f5a"];
  for (let i = 0; i < 40; i++) {
    const piece = document.createElement("div");
    piece.className = "confetti-piece";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[i % colors.length];
    piece.style.animationDelay = `${Math.random() * 0.4}s`;
    piece.style.animationDuration = `${1.2 + Math.random() * 0.8}s`;
    container.appendChild(piece);
  }
  setTimeout(() => container.remove(), 2200);
}

// ---- 起動 ----
// URLの#で画面や状態を直接開ける(動作確認用。通常の利用では使わない)

function subjectOfChar(id) {
  const found = SUBJECTS.find((s) => s.data.some((c) => c.id === id));
  return found ? found.id : "hiragana";
}

// お手本の線をなぞった「理想的な筆跡」を作る(動作確認用)
function sampleIdealStrokes(charData) {
  return charData.paths.map((d) => {
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const p = pointAt(d, i / 24);
      pts.push({ x: p.x, y: p.y, pressure: 0.5 });
    }
    return pts;
  });
}

// 判定エンジンの動作確認用(#test=文字ID:good|bad|shift)
function debugAutoSubmit(id, quality) {
  const charData = charById(id);
  if (!charData) return;
  state.subjectId = subjectOfChar(id);
  startQueue([id], "practice");
  requestAnimationFrame(() => {
    const base = sampleIdealStrokes(charData);
    let strokes = base;
    if (quality === "bad") {
      strokes = [...base].reverse(); // 書き順を逆にする
    } else if (quality === "shift") {
      // 形は正しいが、小さめ・右下寄りに書いた場合(位置ずれ補正の確認用)
      strokes = base.map((s) => s.map((p) => ({ ...p, x: p.x * 0.75 + 22, y: p.y * 0.75 + 18 })));
    }
    state.writingCanvas.userStrokes = strokes;
    state.writingCanvas.render();
    setTimeout(() => onSubmit(charData), 80);
  });
}

// お手本の見た目確認用(#preview=文字ID[:描き終えた画数:途中の画の進み具合])
function debugPreview(arg) {
  const [id, doneStr, progressStr] = arg.split(":");
  const charData = charById(id);
  if (!charData) return;
  state.subjectId = subjectOfChar(id);
  startQueue([id], "practice");
  requestAnimationFrame(() => {
    state.writingCanvas.demoState = {
      doneCount: doneStr !== undefined ? Number(doneStr) : charData.paths.length,
      progress: progressStr !== undefined ? Number(progressStr) : 0
    };
    state.writingCanvas.render();
  });
}

function bootFromHash() {
  const hash = location.hash.replace("#", "");
  if (hash === "mypage") { goMyPage(); return true; }
  if (hash === "list" || hash.startsWith("list=")) {
    if (hash.startsWith("list=")) state.subjectId = hash.replace("list=", "");
    goList();
    return true;
  }
  if (hash.startsWith("preview=")) { debugPreview(hash.replace("preview=", "")); return true; }
  if (hash.startsWith("test=")) {
    const [id, quality] = hash.replace("test=", "").split(":");
    debugAutoSubmit(id, quality);
    return true;
  }
  if (hash.startsWith("write=")) {
    const [id, mode] = hash.replace("write=", "").split(":");
    if (charById(id)) {
      state.subjectId = subjectOfChar(id);
      startQueue([id], mode === "test" ? "test" : "practice");
      return true;
    }
  }
  return false;
}

if (!bootFromHash()) goHome();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}
