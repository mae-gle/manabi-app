// 書き込みキャンバス
// ・ユーザーの筆跡(ポインタ座標)を正規化座標(0-100)で記録
// ・練習モード用: 薄いお手本、書き順番号、なぞりアニメーション
// ・Apple Pencilの筆圧にも対応(pointer eventsのpressureを利用)
//
// お手本・アニメーションは文字データのSVGパスをそのまま描いているので、
// 「薄く表示されているお手本」と「アニメーションの動き」は必ず一致する。

import { KVG_SIZE } from "./data/kvg.js";
import { path2d, pathLength, pointAt } from "./strokePaths.js";

// お手本の線・なぞりアニメーション・自分で書く線は、すべて同じ太さにそろえる
// (なぞる場所と書いた線の太さが違うと、ずれているように見えてしまうため)
const LINE_WIDTH_RATIO = 0.085;

export class WritingCanvas {
  constructor(canvasEl, { showGuide = true } = {}) {
    this.canvas = canvasEl;
    this.ctx = canvasEl.getContext("2d");
    this.showGuide = showGuide;
    this.charData = null;
    this.userStrokes = [];
    this.currentStroke = null;
    this.isDemoPlaying = false;
    this.demoState = null; // { doneCount, progress }

    this._resize();
    window.addEventListener("resize", () => this._resize());

    canvasEl.addEventListener("pointerdown", (e) => this._onDown(e));
    canvasEl.addEventListener("pointermove", (e) => this._onMove(e));
    window.addEventListener("pointerup", (e) => this._onUp(e));
    canvasEl.addEventListener("pointercancel", (e) => this._onUp(e));
    canvasEl.style.touchAction = "none";
  }

  _resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.size = rect.width; // 正方形想定
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.width * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.render();
  }

  _toNorm(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
  }

  _onDown(e) {
    if (this.isDemoPlaying) return;
    this.canvas.setPointerCapture(e.pointerId);
    const p = this._toNorm(e.clientX, e.clientY);
    this.currentStroke = [{ ...p, pressure: e.pressure || 0.5 }];
    this.render();
  }

  _onMove(e) {
    if (!this.currentStroke) return;
    const p = this._toNorm(e.clientX, e.clientY);
    this.currentStroke.push({ ...p, pressure: e.pressure || 0.5 });
    this.render();
  }

  _onUp() {
    if (!this.currentStroke) return;
    if (this.currentStroke.length >= 2) {
      this.userStrokes.push(this.currentStroke);
    }
    this.currentStroke = null;
    this.render();
    if (this.onStrokeEnd) this.onStrokeEnd(this.userStrokes.length);
  }

  setCharacter(charData) {
    this.charData = charData;
    this.clear();
  }

  clear() {
    this.userStrokes = [];
    this.currentStroke = null;
    this.render();
  }

  undoLastStroke() {
    this.userStrokes.pop();
    this.render();
  }

  getStrokes() {
    return this.userStrokes;
  }

  _px(pt) {
    return { x: (pt.x / 100) * this.size, y: (pt.y / 100) * this.size };
  }

  // 文字データのSVGパスを1画ぶん描く。progressを1未満にすると途中まで描かれる
  _strokeRefPath(d, { color, width, progress = 1 }) {
    if (progress <= 0) return;
    const ctx = this.ctx;
    const scale = this.size / KVG_SIZE;
    ctx.save();
    ctx.scale(scale, scale);
    ctx.strokeStyle = color;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = width / scale;
    if (progress < 1) {
      const len = pathLength(d);
      ctx.setLineDash([len, len]);
      ctx.lineDashOffset = len * (1 - progress);
    }
    ctx.stroke(path2d(d));
    ctx.restore();
  }

  // 書き順番号は、書きはじめの点を隠さないよう「線が来る向きの反対側」にずらして置く。
  // 書きはじめの位置そのものは小さな点で示す。
  _drawStrokeNumber(d, index) {
    const ctx = this.ctx;
    const s = this.size;
    const start = pointAt(d, 0);
    const ahead = pointAt(d, 0.15);

    let dx = ahead.x - start.x;
    let dy = ahead.y - start.y;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;

    const offset = 9; // 0-100座標での距離
    const bx = Math.min(Math.max(start.x - dx * offset, 7), 93);
    const by = Math.min(Math.max(start.y - dy * offset, 7), 93);

    const done = index < this.userStrokes.length;
    const badge = this._px({ x: bx, y: by });
    const dot = this._px(start);

    // 書きはじめの点
    ctx.beginPath();
    ctx.arc(dot.x, dot.y, s * 0.014, 0, Math.PI * 2);
    ctx.fillStyle = done ? "#8cba86" : "#e8823a";
    ctx.fill();

    // 番号
    ctx.beginPath();
    ctx.arc(badge.x, badge.y, s * 0.037, 0, Math.PI * 2);
    ctx.fillStyle = done ? "#c9e4c5" : "#ffb35c";
    ctx.fill();
    ctx.fillStyle = "#5a4a2f";
    ctx.font = `bold ${s * 0.042}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(index + 1), badge.x, badge.y);
  }

  render() {
    const ctx = this.ctx;
    const s = this.size;
    if (!s) return;
    ctx.clearRect(0, 0, s, s);

    // 背景
    ctx.fillStyle = "#fffdf7";
    ctx.fillRect(0, 0, s, s);

    // マス目(十字の補助線)
    ctx.strokeStyle = "#f0e6d2";
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(s / 2, 0); ctx.lineTo(s / 2, s);
    ctx.moveTo(0, s / 2); ctx.lineTo(s, s / 2);
    ctx.stroke();
    ctx.strokeStyle = "#f7f0e0";
    ctx.strokeRect(1, 1, s - 2, s - 2);

    const paths = this.charData ? this.charData.paths : [];

    if (this.charData && this.showGuide) {
      // 薄いお手本(なぞる線)
      paths.forEach((d) => {
        this._strokeRefPath(d, { color: "#e7dcc6", width: s * LINE_WIDTH_RATIO });
      });
    }

    // なぞりアニメーション(お手本ボタン)
    if (this.demoState) {
      const { doneCount, progress } = this.demoState;
      paths.forEach((d, i) => {
        if (i < doneCount) {
          this._strokeRefPath(d, { color: "#ffb35c", width: s * LINE_WIDTH_RATIO });
        } else if (i === doneCount && progress > 0) {
          this._strokeRefPath(d, { color: "#ff9f5a", width: s * LINE_WIDTH_RATIO, progress });
        }
      });
    }

    // 書き順番号
    if (this.charData && this.showGuide) {
      paths.forEach((d, i) => this._drawStrokeNumber(d, i));
    }

    // ユーザーの筆跡
    ctx.strokeStyle = "#3b5bdb";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    this.userStrokes.forEach((stroke) => this._drawStroke(stroke));
    if (this.currentStroke) this._drawStroke(this.currentStroke);
  }

  _drawStroke(stroke) {
    if (stroke.length < 2) return;
    const ctx = this.ctx;
    ctx.setLineDash([]);
    ctx.beginPath();
    const p0 = this._px(stroke[0]);
    ctx.moveTo(p0.x, p0.y);
    for (let i = 1; i < stroke.length; i++) {
      const p = this._px(stroke[i]);
      // 筆圧で多少の強弱はつけつつ、標準の筆圧(0.5)でお手本と同じ太さになるようにする
      const pressure = stroke[i].pressure ?? 0.5;
      ctx.lineWidth = this.size * LINE_WIDTH_RATIO * (0.75 + pressure * 0.5);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
    }
  }

  // お手本アニメーション再生(1画ずつ、実際の書き順の線をなぞって見せる)
  async playDemo() {
    if (!this.charData || this.isDemoPlaying) return;
    this.isDemoPlaying = true;
    const paths = this.charData.paths;

    for (let i = 0; i < paths.length; i++) {
      const len = pathLength(paths[i]);
      const duration = Math.max(600, Math.min(1800, len * 14)); // 長い画ほどゆっくり
      const startTime = performance.now();
      await new Promise((resolve) => {
        const step = (now) => {
          const t = Math.min(1, (now - startTime) / duration);
          this.demoState = { doneCount: i, progress: t };
          this.render();
          if (t < 1) requestAnimationFrame(step);
          else resolve();
        };
        requestAnimationFrame(step);
      });
      this.demoState = { doneCount: i + 1, progress: 0 };
      this.render();
      await sleep(280); // 次の画に移る前に少し止める
    }

    await sleep(700);
    this.demoState = null;
    this.isDemoPlaying = false;
    this.render();
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
