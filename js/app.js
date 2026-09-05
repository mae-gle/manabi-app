import { HIRAGANA_DATA } from "./data/hiragana.js";
import { judge } from "./judge.js";
import { WritingCanvas } from "./canvas.js";
import { pointAt } from "./strokePaths.js";
import { loadProgress, recordResult, getReviewQueue, exportBackup, importBackup } from "./storage.js";
import { homeScreenHTML, listScreenHTML, writeScreenHTML, resultOverlayHTML, myPageHTML } from "./ui.js";
import { loadStreak } from "./storage.js";

const root = document.getElementById("app");

const state = {
  mode: "practice", // "practice" | "test"
  queue: [],
  queueIndex: 0,
  writingCanvas: null,
  lastScreen: "home"
};

function charById(id) {
  return HIRAGANA_DATA.find((c) => c.id === id);
}

// ---- 画面遷移 ----

function goHome() {
  state.lastScreen = "home";
  root.innerHTML = homeScreenHTML(loadStreak());
  wireHome();
}

function goList() {
  state.lastScreen = "list";
  const progress = loadProgress();
  root.innerHTML = listScreenHTML(HIRAGANA_DATA, progress, state.mode);
  wireList();
}

function goMyPage() {
  state.lastScreen = "mypage";
  const streak = loadStreak();
  const progress = loadProgress();
  const weak = getReviewQueue(HIRAGANA_DATA).slice(0, 8).filter((c) => progress[c.id]);
  root.innerHTML = myPageHTML(streak, weak);
  wireMyPage();
}

function startQueue(ids, mode) {
  state.mode = mode;
  state.queue = ids;
  state.queueIndex = 0;
  openWriteScreen();
}

function openWriteScreen() {
  const id = state.queue[state.queueIndex];
  const charData = charById(id);
  root.innerHTML = writeScreenHTML(charData, state.mode, state.queueIndex, state.queue.length);
  const canvasEl = document.getElementById("writing-canvas");
  state.writingCanvas = new WritingCanvas(canvasEl, { showGuide: state.mode === "practice" });
  state.writingCanvas.setCharacter(charData);
  wireWrite(charData);
}

// ---- イベント配線 ----

function wireHome() {
  root.querySelector('[data-nav="mypage"]').addEventListener("click", goMyPage);
  root.querySelector('[data-subject="hiragana"]').addEventListener("click", goList);
  root.querySelector('[data-nav="review"]').addEventListener("click", () => {
    const queue = getReviewQueue(HIRAGANA_DATA).slice(0, 10).map((c) => c.id);
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
    tile.addEventListener("click", () => {
      startQueue([tile.dataset.char], state.mode);
    });
  });
}

function wireWrite(charData) {
  root.querySelector('[data-nav="back"]').addEventListener("click", () => {
    state.lastScreen === "home" ? goHome() : goList();
  });
  root.querySelector('[data-action="speak"]').addEventListener("click", () => speak(charData.romaji, charData.char));
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
  recordResult(charData.id, state.mode, result);
  showResult(result, charData);
}

function showResult(result, charData) {
  const overlay = document.createElement("div");
  overlay.innerHTML = resultOverlayHTML(result, charData, state.mode);
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

function speak(romaji, char) {
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
// URLの#list, #write=文字ID:practice|test で直接その画面を開ける
// (動作確認用。通常の利用では使わない)
function bootFromHash() {
  const hash = location.hash.replace("#", "");
  if (hash === "list") { goList(); return true; }
  if (hash === "mypage") { goMyPage(); return true; }
  if (hash.startsWith("write=")) {
    const [id, mode] = hash.replace("write=", "").split(":");
    if (charById(id)) { startQueue([id], mode === "test" ? "test" : "practice"); return true; }
  }
  return false;
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

// 判定エンジンの動作確認用(#test=文字ID:good|bad)。通常利用では使わない。
function debugAutoSubmit(id, quality) {
  const charData = charById(id);
  if (!charData) return;
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

// お手本の見た目確認用(#preview=文字ID[:描き終えた画数:途中の画の進み具合])。
// 例) #preview=hiragana_a:1:0.5 → 1画目まで完了し、2画目を半分描いた状態
function debugPreviewSmoothed(arg) {
  const [id, doneStr, progressStr] = arg.split(":");
  const charData = charById(id);
  if (!charData) return;
  startQueue([id], "practice");
  requestAnimationFrame(() => {
    state.writingCanvas.demoState = {
      doneCount: doneStr !== undefined ? Number(doneStr) : charData.paths.length,
      progress: progressStr !== undefined ? Number(progressStr) : 0
    };
    state.writingCanvas.render();
  });
}

function bootFromHashOrTest() {
  const hash = location.hash.replace("#", "");
  if (hash.startsWith("preview=")) {
    debugPreviewSmoothed(hash.replace("preview=", ""));
    return true;
  }
  if (hash.startsWith("test=")) {
    const [id, quality] = hash.replace("test=", "").split(":");
    debugAutoSubmit(id, quality);
    return true;
  }
  return bootFromHash();
}

if (!bootFromHashOrTest()) goHome();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}
