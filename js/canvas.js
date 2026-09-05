// 書き込みキャンバス
// ・ユーザーの筆跡(ポインタ座標)を正規化座標(0-100)で記録
// ・練習モード用: 薄い文字ガイド、書き順番号、お手本アニメーション
// ・Apple Pencilの筆圧にも対応(pointer eventsのpressureを利用)

export class WritingCanvas {
  constructor(canvasEl, { showGuide = true } = {}) {
    this.canvas = canvasEl;
    this.ctx = canvasEl.getContext("2d");
    this.showGuide = showGuide;
    this.charData = null;
    this.userStrokes = [];
    this.currentStroke = null;
    this.isDemoPlaying = false;

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

  render() {
    const ctx = this.ctx;
    const s = this.size;
    ctx.clearRect(0, 0, s, s);

    // 背景
    ctx.fillStyle = "#fffdf7";
    ctx.fillRect(0, 0, s, s);

    // マス目(十字の補助線)
    ctx.strokeStyle = "#f0e6d2";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(s / 2, 0); ctx.lineTo(s / 2, s);
    ctx.moveTo(0, s / 2); ctx.lineTo(s, s / 2);
    ctx.stroke();
    ctx.strokeStyle = "#f7f0e0";
    ctx.strokeRect(1, 1, s - 2, s - 2);

    if (this.charData && this.showGuide) {
      // 薄いお手本文字
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = "#8a7654";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `${s * 0.75}px "Hiragino Mincho ProN", "Hiragino Kaku Gothic ProN", sans-serif`;
      ctx.fillText(this.charData.char, s / 2, s / 2 + s * 0.02);
      ctx.restore();

      // 書き順番号(各画の開始点)
      this.charData.strokes.forEach((stroke, i) => {
        const done = i < this.userStrokes.length;
        const p = this._px({ x: stroke[0][0], y: stroke[0][1] });
        ctx.beginPath();
        ctx.arc(p.x, p.y, s * 0.045, 0, Math.PI * 2);
        ctx.fillStyle = done ? "#c9e4c5" : "#ffb35c";
        ctx.fill();
        ctx.fillStyle = "#5a4a2f";
        ctx.font = `bold ${s * 0.05}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(i + 1), p.x, p.y);
      });
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
    ctx.beginPath();
    const p0 = this._px(stroke[0]);
    ctx.moveTo(p0.x, p0.y);
    for (let i = 1; i < stroke.length; i++) {
      const p = this._px(stroke[i]);
      const pressure = stroke[i].pressure ?? 0.5;
      ctx.lineWidth = this.size * (0.03 + pressure * 0.035);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
    }
  }

  // お手本アニメーション再生(練習モードの「お手本を見る」ボタン用)
  async playDemo() {
    if (!this.charData || this.isDemoPlaying) return;
    this.isDemoPlaying = true;
    const savedStrokes = this.userStrokes;
    this.userStrokes = [];
    this._demoDoneStrokes = [];

    for (const stroke of this.charData.strokes) {
      const steps = 24;
      const animated = [];
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const pt = interpolatePolyline(stroke, t);
        animated.push({ x: pt.x, y: pt.y, pressure: 0.6 });
        this.userStrokes = [...this._demoDoneStrokes, animated];
        this.render();
        await sleep(16);
      }
      this._demoDoneStrokes = [...(this._demoDoneStrokes || []), animated];
      await sleep(180);
    }
    await sleep(300);
    this._demoDoneStrokes = [];
    this.userStrokes = savedStrokes;
    this.isDemoPlaying = false;
    this.render();
  }
}

function interpolatePolyline(points, t) {
  const segCount = points.length - 1;
  const segLen = 1 / segCount;
  let segIdx = Math.min(Math.floor(t / segLen), segCount - 1);
  const localT = (t - segIdx * segLen) / segLen;
  const [x1, y1] = points[segIdx];
  const [x2, y2] = points[segIdx + 1];
  return { x: x1 + (x2 - x1) * localT, y: y1 + (y2 - y1) * localT };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
