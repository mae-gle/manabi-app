// 書き順パス(SVGパス文字列)を扱うための共通ヘルパー。
//
// 文字データは KanjiVG 由来のSVGパス(109x109座標系)で持っている。
// 「画面のお手本」「なぞりアニメーション」「採点」がすべてこの同じパスを使うため、
// 見た目と判定が食い違うことがない。

import { KVG_SIZE } from "./data/kvg.js";

const path2dCache = new Map();
const svgPathCache = new Map();
let svgHost = null;

// getTotalLength/getPointAtLength を使うため、画面外に置いた<svg>にパスを入れておく
function ensureHost() {
  if (!svgHost) {
    svgHost = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svgHost.setAttribute("width", "0");
    svgHost.setAttribute("height", "0");
    svgHost.setAttribute("aria-hidden", "true");
    svgHost.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;";
    document.body.appendChild(svgHost);
  }
  return svgHost;
}

function svgPathEl(d) {
  let el = svgPathCache.get(d);
  if (!el) {
    el = document.createElementNS("http://www.w3.org/2000/svg", "path");
    el.setAttribute("d", d);
    ensureHost().appendChild(el);
    svgPathCache.set(d, el);
  }
  return el;
}

/** Canvasで描画するためのPath2D(座標系は109x109のまま) */
export function path2d(d) {
  let p = path2dCache.get(d);
  if (!p) {
    p = new Path2D(d);
    path2dCache.set(d, p);
  }
  return p;
}

/** 109x109座標系での画の長さ(破線アニメーションに使う) */
export function pathLength(d) {
  return svgPathEl(d).getTotalLength();
}

/** 画の途中の点を 0-100 の正規化座標で返す (t: 0=書きはじめ, 1=書きおわり) */
export function pointAt(d, t) {
  const el = svgPathEl(d);
  const p = el.getPointAtLength(el.getTotalLength() * t);
  return { x: (p.x / KVG_SIZE) * 100, y: (p.y / KVG_SIZE) * 100 };
}

/** 画の書きはじめ・書きおわりの点(0-100座標)。書き順・向きの判定に使う */
export function startEndOf(d) {
  return { start: pointAt(d, 0), end: pointAt(d, 1) };
}
