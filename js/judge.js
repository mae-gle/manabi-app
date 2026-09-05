// 判定エンジン
// ユーザーが描いたストローク(座標配列)を、お手本データと比較して
// 「書き順・向きが合っているか」「形が正しく書けているか」を採点する。
//
// 形の正誤チェックは、端末が実際に描画する日本語フォントのグリフを
// 基準マスクとして使うことで、手作業で厳密な形状データを作らなくても
// 精度の高い判定ができるようにしている。

const GRID = 100; // 正規化座標の一辺
const RASTER_SIZE = 160; // 形状比較用オフスクリーンキャンバスの解像度(px)
const DILATE_PASSES = 3; // お手本マスクを太らせる回数(許容範囲の広さ)
const STROKE_WIDTH_RATIO = 0.09; // 描画線の太さ(RASTER_SIZEに対する比率)

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// 正規化座標(0-100)をラスターcanvasのpxに変換
function toPx(pt, size) {
  return { x: (pt.x / GRID) * size, y: (pt.y / GRID) * size };
}

// お手本文字のマスク(黒地に白でグリフを描画)を作る
function buildGlyphMask(char, size) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${Math.floor(size * 0.82)}px "Hiragino Mincho ProN", "Hiragino Kaku Gothic ProN", sans-serif`;
  ctx.fillText(char, size / 2, size / 2 + size * 0.03);
  return ctx.getImageData(0, 0, size, size);
}

// マスクを指定回数だけ膨張させる(許容誤差を持たせるため)
function dilate(imageData, size, passes) {
  let src = imageData.data;
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
              const ni = (ny * size + nx) * 4;
              if (src[ni] > 128) on = true;
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

// ユーザーの筆跡を白黒ラスターに変換
function rasterizeUserStrokes(strokes, size) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = "#fff";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
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

function formScore(char, userStrokes) {
  const size = RASTER_SIZE;
  const rawMask = buildGlyphMask(char, size).data;
  const dilatedMask = dilate({ data: rawMask }, size, DILATE_PASSES);
  const userInk = rasterizeUserStrokes(userStrokes, size);
  const dilatedUserInk = dilate({ data: userInk }, size, DILATE_PASSES);

  let userOn = 0, userOnAndRef = 0, refOn = 0, refOnAndUser = 0;
  for (let i = 0; i < userInk.length; i += 4) {
    const uOn = userInk[i] > 128;
    const rOn = rawMask[i] > 128;
    const uDilOn = dilatedUserInk[i] > 128;
    const rDilOn = dilatedMask[i] > 128;
    if (uOn) {
      userOn++;
      if (rDilOn) userOnAndRef++; // 描いた場所がお手本の許容範囲内か
    }
    if (rOn) {
      refOn++;
      if (uDilOn) refOnAndUser++; // お手本の場所がちゃんと埋まっているか
    }
  }
  const precision = userOn > 0 ? userOnAndRef / userOn : 0; // はみ出していないか
  const recall = refOn > 0 ? refOnAndUser / refOn : 0; // 書き足りない部分がないか
  if (precision + recall === 0) return 0;
  const f1 = (2 * precision * recall) / (precision + recall);
  return Math.round(f1 * 100);
}

// 1画ごとの始点・終点を、お手本の各画と比較して
// 「順番・向き」が合っているかを判定する
function strokeOrderCheck(expectedStrokes, userStrokes) {
  const mistakes = [];
  const n = Math.max(expectedStrokes.length, userStrokes.length);
  const TOLERANCE = 26; // 0-100グリッド上での許容距離

  if (userStrokes.length < expectedStrokes.length) {
    mistakes.push({ type: "missing", strokeOrder: userStrokes.length + 1,
      message: `${userStrokes.length + 1}画目が足りないよ` });
  } else if (userStrokes.length > expectedStrokes.length) {
    mistakes.push({ type: "extra", strokeOrder: expectedStrokes.length + 1,
      message: "画数が多いよ" });
  }

  const matchCount = Math.min(expectedStrokes.length, userStrokes.length);
  for (let i = 0; i < matchCount; i++) {
    const exp = expectedStrokes[i];
    const usr = userStrokes[i];
    if (!usr || usr.length < 2) continue;
    const expStart = { x: exp[0][0], y: exp[0][1] };
    const expEnd = { x: exp[exp.length - 1][0], y: exp[exp.length - 1][1] };
    const usrStart = usr[0];
    const usrEnd = usr[usr.length - 1];

    const startEndOk = dist(usrStart, expStart) <= TOLERANCE && dist(usrEnd, expEnd) <= TOLERANCE;
    const reversedOk = dist(usrStart, expEnd) <= TOLERANCE && dist(usrEnd, expStart) <= TOLERANCE;

    if (startEndOk) {
      continue; // この画はOK
    } else if (reversedOk) {
      mistakes.push({ type: "direction", strokeOrder: i + 1,
        message: `${i + 1}画目は逆向きに書いているかも` });
    } else {
      mistakes.push({ type: "order", strokeOrder: i + 1,
        message: `${i + 1}画目の書きはじめの場所を確認しよう` });
    }
  }
  return mistakes;
}

/**
 * @param {object} charData - HIRAGANA_DATA の1文字分
 * @param {Array<Array<{x:number,y:number}>>} userStrokes - ユーザーが描いたストローク
 * @param {"practice"|"test"} mode
 */
export function judge(charData, userStrokes, mode = "practice") {
  const orderMistakes = strokeOrderCheck(charData.strokes, userStrokes);
  const shape = formScore(charData.char, userStrokes);

  const orderRatio = 1 - Math.min(orderMistakes.length, charData.strokes.length) / charData.strokes.length;
  const orderScore = Math.round(orderRatio * 100);

  // テストモードは形をやや厳しめに、練習モードは書き順をやや厳しめに重み付け
  const weights = mode === "test" ? { order: 0.35, shape: 0.65 } : { order: 0.5, shape: 0.5 };
  const total = Math.round(orderScore * weights.order + shape * weights.shape);

  if (shape < 55 && !orderMistakes.some((m) => m.type === "shape")) {
    orderMistakes.push({ type: "shape", strokeOrder: null, message: "形をもう少しなぞってみよう" });
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
    mistakes: orderMistakes,
    praiseLevel,
    pass: total >= (mode === "test" ? 70 : 60)
  };
}
