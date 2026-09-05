// 画面テンプレート(HTML文字列)をまとめたモジュール。
// ロジック(状態管理・イベント配線)は app.js が担当する。

import { ROW_ORDER } from "./data/hiragana.js";

const COL_LABELS = ["あ", "い", "う", "え", "お"];

export function homeScreenHTML(today) {
  // 「あと何文字で今日の目標か」を、数を数えられる1年生にも分かる丸で表示する
  const dots = Array.from({ length: today.goal }, (_, i) =>
    `<span class="goal-dot ${i < today.count ? "filled" : ""}">${i < today.count ? "⭐" : ""}</span>`
  ).join("");

  return `
  <header class="topbar">
    <h1>まなびアプリ</h1>
    <button class="icon-btn" data-nav="mypage" aria-label="マイページ">🏅</button>
  </header>
  <section class="hero">
    <div class="goal-card ${today.achieved ? "achieved" : ""}">
      <div class="goal-title">${today.achieved
        ? "きょうの もくひょう たっせい！ すごい！"
        : `きょうは あと ${today.goal - today.count}もじ`}</div>
      <div class="goal-dots">${dots}</div>
    </div>
  </section>
  <section class="subject-grid">
    <button class="subject-card active" data-subject="hiragana">
      <span class="subject-emoji">あ</span>
      <span class="subject-name">ひらがな</span>
    </button>
    <button class="subject-card disabled" disabled>
      <span class="subject-emoji">ア</span>
      <span class="subject-name">カタカナ</span>
      <span class="soon-badge">じゅんび中</span>
    </button>
    <button class="subject-card disabled" disabled>
      <span class="subject-emoji">漢</span>
      <span class="subject-name">かんじ</span>
      <span class="soon-badge">じゅんび中</span>
    </button>
    <button class="subject-card disabled" disabled>
      <span class="subject-emoji">A</span>
      <span class="subject-name">えいご</span>
      <span class="soon-badge">じゅんび中</span>
    </button>
  </section>
  <button class="review-cta" data-nav="review">📝 きょうのふくしゅうをする</button>
  `;
}

export function listScreenHTML(chars, progressMap, mode) {
  // 五十音表と同じ並び(5列×行)でグリッドを作る。文字が存在しないマスは空セルにする。
  const byPos = {};
  chars.forEach((c) => { byPos[`${c.row}_${c.col}`] = c; });

  const headerCells = COL_LABELS.map((v) => `<div class="col-label">${v}</div>`).join("");

  const bodyCells = ROW_ORDER.map((row) => {
    let cells = "";
    for (let col = 0; col < 5; col++) {
      const c = byPos[`${row}_${col}`];
      cells += c ? tileHTML(c, progressMap[c.id]) : `<div class="char-tile-empty"></div>`;
    }
    return cells;
  }).join("");

  return `
  <header class="topbar">
    <button class="icon-btn" data-nav="home" aria-label="もどる">←</button>
    <h1>ひらがな</h1>
    <span></span>
  </header>
  <div class="mode-toggle">
    <button class="mode-btn ${mode === "practice" ? "active" : ""}" data-mode="practice">✏️ れんしゅう</button>
    <button class="mode-btn ${mode === "test" ? "active" : ""}" data-mode="test">📝 テスト</button>
  </div>
  <div class="legend">
    <span class="legend-item"><i class="swatch untried"></i>まだ</span>
    <span class="legend-item"><i class="swatch tried"></i>れんしゅうした</span>
    <span class="legend-item"><i class="swatch passed"></i>テストごうかく</span>
    <span class="legend-item"><i class="swatch mastered"></i>おぼえた</span>
  </div>
  <div class="char-list">
    <div class="gojuon-grid">${headerCells}${bodyCells}</div>
  </div>
  `;
}

function tileHTML(c, p) {
  const level = p ? p.masteryLevel : 0;
  const cls = ["untried", "tried", "passed", "mastered"][level] || "untried";
  return `<button class="char-tile ${cls}" data-char="${c.id}">
    <span class="char-tile-char">${c.char}</span>
    <span class="char-tile-romaji">${c.romaji}</span>
  </button>`;
}

export function writeScreenHTML(charData, mode, index, total) {
  return `
  <header class="topbar">
    <button class="icon-btn" data-nav="back" aria-label="もどる">←</button>
    <h1>${mode === "practice" ? "✏️ れんしゅう" : "📝 テスト"}</h1>
    <span></span>
  </header>
  ${total > 1 ? `<div class="progress-bar"><div class="progress-fill" style="width:${(index / total) * 100}%"></div></div>` : ""}
  <div class="write-stage">
    <canvas id="writing-canvas" class="writing-canvas"></canvas>
    <button class="speak-btn" data-action="speak" aria-label="よみあげ">🔊 きいてみる</button>
  </div>
  <div class="write-toolbar">
    <button class="tool-btn" data-action="undo">↩ ひとつもどす</button>
    <button class="tool-btn" data-action="clear">🗑 やりなおし</button>
    ${mode === "practice" ? `<button class="tool-btn" data-action="demo">👀 おてほん</button>` : ""}
    <button class="tool-btn primary" data-action="submit">✅ できた！</button>
  </div>
  `;
}

export function resultOverlayHTML(result, charData, mode, newSticker) {
  const praiseText = {
    perfect: "パーフェクト！すごいね！",
    good: "じょうずにかけたね！",
    ok: "おしい！もうすこし！",
    retry: "だいじょうぶ、もういちどれんしゅうしよう！"
  }[result.praiseLevel];

  const emoji = { perfect: "🌟", good: "😊", ok: "🙂", retry: "💪" }[result.praiseLevel];

  const mistakesHTML = result.mistakes.length === 0
    ? `<p class="no-mistake">まちがいなし！</p>`
    : `<ul class="mistake-list">${result.mistakes.map((m) => `<li>✏️ ${m.message}</li>`).join("")}</ul>`;

  return `
  <div class="result-overlay ${result.praiseLevel}">
    <div class="result-card">
      <div class="result-emoji">${emoji}</div>
      <h2>${praiseText}</h2>
      <div class="score-display">${result.total}<span>てん</span></div>
      <div class="score-sub">かたち ${result.shapeScore}点 ・ じゅんばん ${result.orderScore}点</div>
      ${newSticker ? `<div class="sticker-reward">
        <div class="sticker-reward-emoji">${newSticker}</div>
        <div class="sticker-reward-text">あたらしい シールを ゲット！</div>
      </div>` : ""}
      ${mistakesHTML}
      <div class="result-actions">
        <button class="tool-btn" data-action="retry">🔁 もういちど</button>
        <button class="tool-btn primary" data-action="next">つぎへ →</button>
      </div>
    </div>
    ${result.praiseLevel === "perfect" ? `<div class="confetti-layer"></div>` : ""}
  </div>
  `;
}

export function myPageHTML(stats, weakChars, allStickers, weakThreshold) {
  const owned = new Set(stats.stickers);
  const stickerHTML = allStickers
    .map((s) => owned.has(s)
      ? `<span class="sticker got">${s}</span>`
      : `<span class="sticker">?</span>`)
    .join("");

  const weakHTML = weakChars.length
    ? weakChars.map(({ char, avg }) =>
        `<span class="weak-chip">${char.char}<i>${avg}てん</i></span>`).join("")
    : `<p class="muted">にがてな文字はまだないよ。この調子！</p>`;

  return `
  <header class="topbar">
    <button class="icon-btn" data-nav="home" aria-label="もどる">←</button>
    <h1>マイページ</h1>
    <span></span>
  </header>
  <section class="mypage-section">
    <h3>シールずかん <span class="count-badge">${owned.size} / ${allStickers.length}</span></h3>
    <p class="muted">「じょうず」いじょうで かけたら、あたらしいシールが 1まい もらえるよ</p>
    <div class="sticker-book">${stickerHTML}</div>
  </section>
  <section class="mypage-section">
    <h3>にがてな文字</h3>
    <p class="muted">さいきん3かいの へいきんが ${weakThreshold}てん より ひくい文字です</p>
    <div class="weak-chips">${weakHTML}</div>
  </section>
  <section class="mypage-section">
    <h3>おうちの方へ</h3>
    <div class="mypage-stats">
      <div class="stat-box"><div class="stat-num">${stats.currentStreak}</div><div class="stat-label">連続日数</div></div>
      <div class="stat-box"><div class="stat-num">${stats.longestStreak}</div><div class="stat-label">最長記録</div></div>
      <div class="stat-box"><div class="stat-num">${stats.historyDates.length}</div><div class="stat-label">学習した日数</div></div>
    </div>
  </section>
  <section class="mypage-section">
    <h3>バックアップ</h3>
    <p class="muted">きせつがえや機種変更にそなえて、ときどきバックアップしましょう。</p>
    <div class="backup-actions">
      <button class="tool-btn" data-action="export">⬇ 書き出す</button>
      <label class="tool-btn" for="import-file">⬆ 読み込む</label>
      <input type="file" id="import-file" accept="application/json" hidden>
    </div>
  </section>
  `;
}
