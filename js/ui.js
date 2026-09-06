// 画面テンプレート(HTML文字列)をまとめたモジュール。
// ロジック(状態管理・イベント配線)は app.js が担当する。

import { RARITY_LABEL } from "./data/stickers.js";

export function homeScreenHTML(today, subjects, comingSoon) {
  // 「あと何文字で今日の目標か」を、数を数えられる1年生にも分かる丸で表示する
  const dots = Array.from({ length: today.goal }, (_, i) =>
    `<span class="goal-dot ${i < today.count ? "filled" : ""}">${i < today.count ? "⭐" : ""}</span>`
  ).join("");

  const subjectCards = subjects.map((s) => `
    <button class="subject-card active" data-subject="${s.id}">
      <span class="subject-emoji">${s.icon}</span>
      <span class="subject-name">${s.name}</span>
    </button>
  `).join("");

  const soonCards = comingSoon.map((s) => `
    <button class="subject-card disabled" disabled>
      <span class="subject-emoji">${s.icon}</span>
      <span class="subject-name">${s.name}</span>
      <span class="soon-badge">じゅんび中</span>
    </button>
  `).join("");

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
    ${subjectCards}
    ${soonCards}
  </section>
  <button class="review-cta" data-nav="review">📝 きょうのふくしゅうをする</button>
  `;
}

export function listScreenHTML(subject, progressMap, mode) {
  // 五十音表と同じ並び(5列×行)でグリッドを作る。文字が存在しないマスは空セルにする。
  const byPos = {};
  subject.data.forEach((c) => { byPos[`${c.row}_${c.col}`] = c; });

  const headerCells = subject.colLabels.map((v) => `<div class="col-label">${v}</div>`).join("");

  const bodyCells = subject.rowOrder.map((row) => {
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
    <h1>${subject.name}</h1>
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

export function resultOverlayHTML(result, charData, mode, reward) {
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

  // シールがもらえたとき / もらえるまであと何ポイントか
  let rewardHTML = "";
  if (reward.newSticker) {
    const s = reward.newSticker;
    rewardHTML = `
      <div class="sticker-reward ${s.rarity}">
        <div class="rarity-tag">${RARITY_LABEL[s.rarity]}</div>
        <div class="sticker-reward-emoji">${s.emoji}</div>
        <div class="sticker-reward-name">${s.name}</div>
        <div class="sticker-reward-text">「${s.albumName}」の シールを ゲット！</div>
      </div>`;
  } else if (reward.pointsToNext > 0) {
    rewardHTML = `<div class="sticker-progress">つぎのシールまで あと ${reward.pointsToNext}ポイント</div>`;
  }

  const albumHTML = reward.albumCompleted
    ? `<div class="album-complete">🎉 「${reward.albumCompleted}」ずかん コンプリート！</div>`
    : "";

  return `
  <div class="result-overlay ${result.praiseLevel}">
    <div class="result-card">
      <div class="result-emoji">${emoji}</div>
      <h2>${praiseText}</h2>
      <div class="score-display">${result.total}<span>てん</span></div>
      <div class="score-sub">かたち ${result.shapeScore}点 ・ じゅんばん ${result.orderScore}点</div>
      ${rewardHTML}
      ${albumHTML}
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

export function myPageHTML(stats, weakChars, stickerState, weakThreshold) {
  const albumsHTML = stickerState.albums.map((album) => `
    <div class="album ${album.complete ? "complete" : ""}">
      <div class="album-head">
        <span class="album-name">${album.cover} ${album.name}</span>
        <span class="count-badge">${album.ownedCount} / ${album.stickers.length}${album.complete ? " ✨" : ""}</span>
      </div>
      <div class="sticker-book">
        ${album.stickers.map((s) => s.owned
          ? `<span class="sticker got ${s.rarity}" title="${s.name}">
               <span class="sticker-emoji">${s.emoji}</span>
               <span class="sticker-name">${s.name}</span>
             </span>`
          : `<span class="sticker ${s.rarity === "super" ? "hint-super" : ""}">?</span>`
        ).join("")}
      </div>
    </div>
  `).join("");

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
    <h3>シールずかん <span class="count-badge">${stickerState.ownedTotal} / ${stickerState.total}</span></h3>
    <p class="muted">${stickerState.allComplete
      ? "ぜんぶ あつめたね！ すごい！"
      : `じょうずに かけると ポイントが たまって、${stickerState.cost}ポイントで シールが 1まい もらえるよ（いまは あと ${stickerState.cost - stickerState.points}ポイント）`}</p>
    <div class="albums">${albumsHTML}</div>
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
