// 画面テンプレート(HTML文字列)をまとめたモジュール。
// ロジック(状態管理・イベント配線)は app.js が担当する。

export function homeScreenHTML(streak) {
  return `
  <header class="topbar">
    <h1>まなびアプリ</h1>
    <button class="icon-btn" data-nav="mypage" aria-label="マイページ">🏅</button>
  </header>
  <section class="hero">
    <div class="streak-pill">🔥 ${streak.currentStreak}にち れんぞく</div>
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
  const rows = {};
  chars.forEach((c) => {
    rows[c.row] = rows[c.row] || [];
    rows[c.row].push(c);
  });

  const rowsHTML = Object.entries(rows).map(([row, items]) => `
    <div class="char-row">
      <div class="row-label">${row}行</div>
      <div class="char-grid">
        ${items.map((c) => tileHTML(c, progressMap[c.id])).join("")}
      </div>
    </div>
  `).join("");

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
  <div class="char-list">${rowsHTML}</div>
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
    <button class="icon-btn" data-action="speak" aria-label="よみあげ">🔊</button>
  </header>
  ${total > 1 ? `<div class="progress-bar"><div class="progress-fill" style="width:${(index / total) * 100}%"></div></div>` : ""}
  <div class="write-stage">
    <canvas id="writing-canvas" class="writing-canvas"></canvas>
  </div>
  <div class="write-toolbar">
    <button class="tool-btn" data-action="undo">↩ ひとつもどす</button>
    <button class="tool-btn" data-action="clear">🗑 やりなおし</button>
    ${mode === "practice" ? `<button class="tool-btn" data-action="demo">👀 おてほん</button>` : ""}
    <button class="tool-btn primary" data-action="submit">✅ できた！</button>
  </div>
  `;
}

export function resultOverlayHTML(result, charData, mode) {
  const praiseText = {
    perfect: "パーフェクト！すごいね！",
    good: "じょうずにかけたね！",
    ok: "おしい！もうすこし！",
    retry: "だいじょうぶ、もういちどれんしゅうしよう！"
  }[result.praiseLevel];

  const emoji = { perfect: "🌟", good: "😊", ok: "🙂", retry: "💪" }[result.praiseLevel];

  const mistakesHTML = result.mistakes.length === 0
    ? `<p class="no-mistake">まちがいなし！</p>`
    : `<ul class="mistake-list">${result.mistakes.map((m) => `<li>${m.message}</li>`).join("")}</ul>`;

  return `
  <div class="result-overlay ${result.praiseLevel}">
    <div class="result-card">
      <div class="result-emoji">${emoji}</div>
      <h2>${praiseText}</h2>
      <div class="score-display">${result.total}<span>てん</span></div>
      <div class="score-sub">かたち ${result.shapeScore}点 ・ じゅんばん ${result.orderScore}点</div>
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

export function myPageHTML(streak, weakChars) {
  const weakHTML = weakChars.length
    ? weakChars.map((c) => `<span class="weak-chip">${c.char}</span>`).join("")
    : `<p class="muted">にがてな文字はまだないよ</p>`;

  return `
  <header class="topbar">
    <button class="icon-btn" data-nav="home" aria-label="もどる">←</button>
    <h1>マイページ</h1>
    <span></span>
  </header>
  <section class="mypage-stats">
    <div class="stat-box"><div class="stat-num">${streak.currentStreak}</div><div class="stat-label">れんぞく日数</div></div>
    <div class="stat-box"><div class="stat-num">${streak.longestStreak}</div><div class="stat-label">さいちょう記録</div></div>
    <div class="stat-box"><div class="stat-num">⭐${streak.stamps}</div><div class="stat-label">シール</div></div>
  </section>
  <section class="mypage-section">
    <h3>にがてな文字</h3>
    <div class="weak-chips">${weakHTML}</div>
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
