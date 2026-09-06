// 判定エンジン
// ユーザーが描いたストローク(座標配列)を、お手本データと比較して
// 「書き順・向きが合っているか」「形が正しく書けているか」を採点する。
//
// 形の判定は、画面に薄く表示しているお手本と同じ線データ(KanjiVG由来のSVGパス)を
// 基準マスクとして使う。見えているお手本＝採点の基準なので、
// 「ちゃんとなぞったのに減点される」ということが起きない。

import { KVG_SIZE } from "./data/kvg.js";
import { path2d, startEndOf, pointAt } from "./strokePaths.js";

const GRID = 100; // 正規化座標の一辺
const RASTER_SIZE = 160; // 形状比較用オフスクリーンキャンバスの解像度(px)
const DILATE_PASSES = 4; // お手本マスクを太らせる回数(許容範囲の広さ)
const STROKE_WIDTH_RATIO = 0.085; // 描画線の太さ(RASTER_SIZEに対する比率)
const TOLERANCE = 26; // 書きはじめ・書きおわりの位置の許容距離(0-100グリッド上)

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// --- 位置・大きさのずれの補正 -------------------------------------------
// テストモードではお手本が出ないため、書いた文字が多少ずれたり小さくなったりする。
// 形そのものが正しければ褒めてあげたいので、書いた文字全体の位置と大きさを
// お手本に合わせてから採点する(極端な補正はしないよう倍率に上限をつけている)。

const refBoxCache = new Map();

function boundsOf(points) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  points.forEach((p) => {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  });
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY,
    cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}

function referenceBounds(paths) {
  const key = paths.join("|");
  if (!refBoxCache.has(key)) {
    const pts = [];
    paths.forEach((d) => {
      for (let i = 0; i <= 40; i++) pts.push(pointAt(d, i / 40));
    });
    refBoxCache.set(key, boundsOf(pts));
  }
  return refBoxCache.get(key);
}

function alignToReference(userStrokes, paths) {
  const all = userStrokes.flat();
  if (all.length < 2) return userStrokes;
  const ub = boundsOf(all);
  if (ub.w < 8 && ub.h < 8) return userStrokes; // 点のような入力は補正しない

  const rb = referenceBounds(paths);
  const rawScale = Math.max(rb.w, rb.h) / Math.max(ub.w, ub.h, 1);
  const scale = Math.min(Math.max(rawScale, 0.7), 1.6);

  return userStrokes.map((stroke) =>
    stroke.map((p) => ({
      ...p,
      x: rb.cx + (p.x - ub.cx) * scale,
      y: rb.cy + (p.y - ub.cy) * scale
    }))
  );
}

function toPx(pt, size) {
  return { x: (pt.x / GRID) * size, y: (pt.y / GRID) * size };
}

function blankMaskCanvas(size) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = "#fff";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  return { canvas, ctx };
}

// お手本の線を白で描いたマスク画像を作る
function buildReferenceMask(paths, size) {
  const { ctx } = blankMaskCanvas(size);
  const scale = size / KVG_SIZE;
  ctx.save();
  ctx.scale(scale, scale);
  ctx.lineWidth = (size * STROKE_WIDTH_RATIO) / scale;
  paths.forEach((d) => ctx.stroke(path2d(d)));
  ctx.restore();
  return ctx.getImageData(0, 0, size, size).data;
}

// ユーザーの筆跡を白黒ラスターに変換
function rasterizeUserStrokes(strokes, size) {
  const { ctx } = blankMaskCanvas(size);
  ctx.lineWidth = size * STROKE_WIDTH_RATIO;
  strokes.forEach((stroke) => {
    if (stroke.length < 2) return;
    ctx.beginPath();
    const p0 = toPx(stroke[0], size);
    ctx.moveTo(p0.x, p0.y);
    for (let i = 1; i < stroke.length; i++) {
      const p = toPx(stroke[i], size);
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  });
  return ctx.getImageData(0, 0, size, size).data;
}

// マスクを指定回数だけ膨張させる(許容誤差を持たせるため)
function dilate(src, size, passes) {
  for (let p = 0; p < passes; p++) {
    const dst = new Uint8ClampedArray(src.length);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        let on = src[i] > 128;
        if (!on) {
          for (let dy = -1; dy <= 1 && !on; dy++) {
            for (let dx = -1; dx <= 1 && !on; dx++) {
              const nx = x + dx, ny = y + dy;
              if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
              if (src[(ny * size + nx) * 4] > 128) on = true;
            }
          }
        }
        const v = on ? 255 : 0;
        dst[i] = dst[i + 1] = dst[i + 2] = v;
        dst[i + 3] = 255;
      }
    }
    src = dst;
  }
  return src;
}

function formScore(paths, userStrokes) {
  const size = RASTER_SIZE;
  const refMask = buildReferenceMask(paths, size);
  const dilatedRef = dilate(refMask, size, DILATE_PASSES);
  const userInk = rasterizeUserStrokes(userStrokes, size);
  const dilatedUser = dilate(userInk, size, DILATE_PASSES);

  let userOn = 0, userOnAndRef = 0, refOn = 0, refOnAndUser = 0;
  for (let i = 0; i < userInk.length; i += 4) {
    if (userInk[i] > 128) {
      userOn++;
      if (dilatedRef[i] > 128) userOnAndRef++; // 描いた場所がお手本の許容範囲内か
    }
    if (refMask[i] > 128) {
      refOn++;
      if (dilatedUser[i] > 128) refOnAndUser++; // お手本の場所がちゃんと埋まっているか
    }
  }
  const precision = userOn > 0 ? userOnAndRef / userOn : 0; // はみ出していないか
  const recall = refOn > 0 ? refOnAndUser / refOn : 0; // 書き足りない部分がないか
  if (precision + recall === 0) return 0;
  return Math.round(((2 * precision * recall) / (precision + recall)) * 100);
}

// 1画ごとの書きはじめ・書きおわりを、お手本の各画と比較して
// 「順番・向き」が合っているかを判定する
function strokeOrderCheck(paths, userStrokes) {
  const mistakes = [];

  if (userStrokes.length < paths.length) {
    mistakes.push({ type: "missing", strokeOrder: userStrokes.length + 1,
      message: `${kakume(userStrokes.length + 1)}が たりないよ` });
  } else if (userStrokes.length > paths.length) {
    mistakes.push({ type: "extra", strokeOrder: paths.length + 1,
      message: "かくすうが おおいよ" });
  }

  const matchCount = Math.min(paths.length, userStrokes.length);
  for (let i = 0; i < matchCount; i++) {
    const usr = userStrokes[i];
    if (!usr || usr.length < 2) continue;
    const { start: expStart, end: expEnd } = startEndOf(paths[i]);
    const usrStart = usr[0];
    const usrEnd = usr[usr.length - 1];

    const startEndOk = dist(usrStart, expStart) <= TOLERANCE && dist(usrEnd, expEnd) <= TOLERANCE;
    const reversedOk = dist(usrStart, expEnd) <= TOLERANCE && dist(usrEnd, expStart) <= TOLERANCE;

    if (startEndOk) {
      continue; // この画はOK
    } else if (reversedOk) {
      mistakes.push({ type: "direction", strokeOrder: i + 1,
        message: `${kakume(i + 1)}は ぎゃくむきかもしれないよ` });
    } else {
      mistakes.push({ type: "order", strokeOrder: i + 1,
        message: `${kakume(i + 1)}の かきはじめのばしょを たしかめよう` });
    }
  }
  return mistakes;
}

// 「1画目」を1年生でも読めるようふりがな付きで表示する
function kakume(n) {
  return `${n}<ruby>画目<rt>かくめ</rt></ruby>`;
}

/**
 * @param {object} charData - HIRAGANA_DATA の1文字分
 * @param {Array<Array<{x:number,y:number}>>} userStrokes - ユーザーが描いたストローク
 * @param {"practice"|"test"} mode
 */
export function judge(charData, userStrokes, mode = "practice") {
  const paths = charData.paths;
  const aligned = alignToReference(userStrokes, paths);
  const mistakes = strokeOrderCheck(paths, aligned);
  const shape = formScore(paths, aligned);

  const orderRatio = 1 - Math.min(mistakes.length, paths.length) / paths.length;
  const orderScore = Math.round(orderRatio * 100);

  // テストモードは形をやや厳しめに、練習モードは書き順をやや厳しめに重み付け
  const weights = mode === "test" ? { order: 0.35, shape: 0.65 } : { order: 0.5, shape: 0.5 };
  const total = Math.round(orderScore * weights.order + shape * weights.shape);

  if (shape < 55) {
    mistakes.push({ type: "shape", strokeOrder: null, message: "かたちを もうすこし なぞってみよう" });
  }

  let praiseLevel;
  if (total >= 88) praiseLevel = "perfect";
  else if (total >= 70) praiseLevel = "good";
  else if (total >= 50) praiseLevel = "ok";
  else praiseLevel = "retry";

  return {
    total,
    shapeScore: shape,
    orderScore,
    mistakes,
    praiseLevel,
    pass: total >= (mode === "test" ? 70 : 60)
  };
}
