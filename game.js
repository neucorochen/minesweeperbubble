(() => {
  const DIFFICULTIES = {
    easy:   { rows: 9,  cols: 9,  mines: 10, label: "новичок 9×9",    cellSize: 42 },
    medium: { rows: 14, cols: 14, mines: 30, label: "любитель 14×14", cellSize: 33 },
    hard:   { rows: 16, cols: 24, mines: 72, label: "профи 16×24",    cellSize: 28 }
  };

  // Глянцевый Frutiger Aero флажок
  const FLAG_SVG = `
    <svg class="cell-icon" viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="flagGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#fff4b8"/>
          <stop offset="45%" stop-color="#ff5e4d"/>
          <stop offset="100%" stop-color="#c9182b"/>
        </linearGradient>
        <linearGradient id="poleGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#ffffff"/>
          <stop offset="55%" stop-color="#bfeaff"/>
          <stop offset="100%" stop-color="#4ba8e0"/>
        </linearGradient>
      </defs>
      <ellipse cx="26" cy="55" rx="14" ry="4" fill="rgba(160,40,15,0.28)"/>
      <rect x="20" y="10" width="6" height="44" rx="3" fill="url(#poleGrad)" stroke="#ffffff" stroke-width="1.5"/>
      <circle cx="23" cy="10" r="4.5" fill="#fff7cc" stroke="#ffffff" stroke-width="1.5"/>
      <path d="M25 13 C36 10, 44 18, 54 15 C51 23, 52 29, 54 35 C44 38, 36 30, 25 34 Z"
            fill="url(#flagGrad)" stroke="#ffffff" stroke-width="2" stroke-linejoin="round"/>
      <path d="M29 17 C36 15, 42 19, 48 18" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="2.5" stroke-linecap="round"/>
    </svg>`;

  // Глянцевая мина-пузырёк
  const MINE_SVG = `
    <svg class="cell-icon" viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <radialGradient id="mineGrad" cx="35%" cy="30%" r="65%">
          <stop offset="0%" stop-color="#ffb8c6"/>
          <stop offset="40%" stop-color="#5a183b"/>
          <stop offset="100%" stop-color="#1b0918"/>
        </radialGradient>
      </defs>
      <g stroke="#2a0d22" stroke-width="4.5" stroke-linecap="round">
        <line x1="32" y1="7" x2="32" y2="57"/>
        <line x1="7" y1="32" x2="57" y2="32"/>
        <line x1="14" y1="14" x2="50" y2="50"/>
        <line x1="50" y1="14" x2="14" y2="50"/>
      </g>
      <circle cx="32" cy="32" r="17" fill="url(#mineGrad)" stroke="#ffd6e0" stroke-width="2"/>
      <ellipse cx="26" cy="24" rx="5.5" ry="3.2" transform="rotate(-28 26 24)" fill="rgba(255,255,255,0.82)"/>
    </svg>`;

  // DOM-элементы
  const aeroWindow      = document.getElementById("aeroWindow");
  const boardPanel      = document.getElementById("boardPanel");
  const fxCanvas        = document.getElementById("fxCanvas");
  const fxCtx           = fxCanvas.getContext("2d");
  const boardEl         = document.getElementById("board");
  const boardOverlay    = document.getElementById("boardOverlay");
  const overlayTitle    = document.getElementById("overlayTitle");
  const overlaySub      = document.getElementById("overlaySub");
  const overlayRestart  = document.getElementById("overlayRestart");
  const minesLeftEl     = document.getElementById("minesLeft");
  const timerEl         = document.getElementById("timer");
  const bestTimeEl      = document.getElementById("bestTime");
  const modeBadgeText   = document.getElementById("modeBadgeText");
  const btnSwapControls = document.getElementById("btnSwapControls");
  const controlsHint    = document.getElementById("controlsHint");
  const btnMusic        = document.getElementById("btnMusic");
  const btnSound        = document.getElementById("btnSound");
  const btnRestart      = document.getElementById("btnRestart");
  const mascot          = document.getElementById("mascot");
  const mascotSpeech    = document.getElementById("mascotSpeech");
  const diffButtons     = document.querySelectorAll(".diff-btn");

  // Состояние игры
  let currentDiff = "easy";
  let rows = 9, cols = 9, totalMines = 10;
  let grid = [];
  let cellEls = [];
  let firstClick = true;
  let gameOver = false;
  let swapControls = false; // false: ЛКМ открыть, ПКМ флаг | true: наоборот
  let flagsCount = 0;
  let revealedCount = 0;
  let seconds = 0;
  let timerId = null;
  let sessionId = 0;

  // ==================== ЧАСТИЦЫ ЛОПАНИЯ ЖЕЛЕ ====================
  let particles = [];
  let fxRafId = null;

  function resizeFxCanvas() {
    const rect = boardPanel.getBoundingClientRect();
    fxCanvas.width = rect.width;
    fxCanvas.height = rect.height;
  }

  function spawnPopBurst(x, y, isMine = false) {
    const colors = isMine
      ? ["#ff6b81", "#ffd166", "#ff4757", "#ffffff"]
      : ["#70d6ff", "#a0f0ff", "#38b6ff", "#ffffff"];

    // Расходящееся кольцо пузырька
    particles.push({
      type: "ring",
      x, y,
      r: 6,
      maxR: isMine ? 34 : 24,
      alpha: 0.9,
      color: isMine ? "#ff8fa3" : "#b8f2ff"
    });

    // Желейные капельки
    const count = isMine ? 9 : 5;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.6;
      const speed = (isMine ? 2.6 : 1.6) + Math.random() * 2.8;
      particles.push({
        type: "drop",
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.2,
        r: (isMine ? 4.5 : 3.2) + Math.random() * 3.5,
        alpha: 1,
        color: colors[i % colors.length]
      });
    }

    if (!fxRafId) fxRafId = requestAnimationFrame(renderFx);
  }

  function renderFx() {
    fxCtx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      if (p.type === "ring") {
        p.r += 2.2;
        p.alpha -= 0.065;
        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }
        fxCtx.save();
        fxCtx.globalAlpha = p.alpha;
        fxCtx.strokeStyle = p.color;
        fxCtx.lineWidth = 2.5;
        fxCtx.beginPath();
        fxCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        fxCtx.stroke();
        fxCtx.restore();
      } else {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.14;
        p.alpha -= 0.028;
        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }
        fxCtx.save();
        fxCtx.globalAlpha = p.alpha;
        fxCtx.fillStyle = p.color;
        fxCtx.beginPath();
        fxCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        fxCtx.fill();
        fxCtx.fillStyle = "rgba(255,255,255,0.85)";
        fxCtx.beginPath();
        fxCtx.arc(p.x - p.r * 0.3, p.y - p.r * 0.3, p.r * 0.32, 0, Math.PI * 2);
        fxCtx.fill();
        fxCtx.restore();
      }
    }

    if (particles.length > 0) {
      fxRafId = requestAnimationFrame(renderFx);
    } else {
      fxRafId = null;
    }
  }

  // ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================
  function say(text) {
    mascotSpeech.textContent = text;
    window.JellyPhysics.impulse(mascot, 2.8, -2.8);
  }

  function updateSoundButton() {
    btnSound.textContent = window.AeroAudio.isEnabled() ? "🔊 звук: вкл" : "🔇 звук: выкл";
  }

  function updateMusicButton() {
    if (!btnMusic) return;
    const on = window.AeroAudio.isMusicEnabled();
    btnMusic.textContent = on ? "🎵 музыка: вкл" : "🎵 музыка: выкл";
    btnMusic.classList.toggle("active", on);
  }

  function updateControlsUI() {
    if (swapControls) {
      btnSwapControls.textContent = "🔄 ЛКМ: флаг · ПКМ: открыть";
      btnSwapControls.classList.remove("aero-btn-green");
      btnSwapControls.classList.add("aero-btn-swapped");
      controlsHint.innerHTML =
        "ЛКМ — поставить флажок<br />ПКМ — открыть клетку<br />ПКМ по цифре — открыть вокруг";
    } else {
      btnSwapControls.textContent = "🔄 ЛКМ: открыть · ПКМ: флаг";
      btnSwapControls.classList.remove("aero-btn-swapped");
      btnSwapControls.classList.add("aero-btn-green");
      controlsHint.innerHTML =
        "ЛКМ — открыть клетку<br />ПКМ — поставить флажок<br />ЛКМ по цифре — открыть вокруг";
    }
  }

  function updateBestDisplay() {
    const best = window.AeroStorage.getBest(currentDiff);
    bestTimeEl.textContent = best !== null ? `${best}с` : "—";
  }

  function startTimer() {
    if (timerId) return;
    timerId = setInterval(() => {
      seconds++;
      timerEl.textContent = String(Math.min(seconds, 999)).padStart(3, "0");
    }, 1000);
  }

  function stopTimer() {
    clearInterval(timerId);
    timerId = null;
  }

  // ==================== ИНИЦИАЛИЗАЦИЯ ====================
  function initGame(diff = currentDiff) {
    sessionId++;
    currentDiff = diff;
    const cfg = DIFFICULTIES[diff];
    rows = cfg.rows;
    cols = cfg.cols;
    totalMines = cfg.mines;

    stopTimer();
    window.JellyPhysics.reset();
    particles = [];
    fxCtx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);
    aeroWindow.classList.remove("shaking");

    firstClick = true;
    gameOver = false;
    flagsCount = 0;
    revealedCount = 0;
    seconds = 0;

    timerEl.textContent = "000";
    minesLeftEl.textContent = String(totalMines);
    modeBadgeText.textContent = cfg.label;
    boardOverlay.classList.add("hidden");
    updateBestDisplay();

    diffButtons.forEach((b) => b.classList.toggle("active", b.dataset.diff === diff));

    boardEl.style.setProperty("--cols", cols);
    boardEl.style.setProperty("--cell-size", `${cfg.cellSize}px`);
    boardEl.innerHTML = "";

    grid = [];
    cellEls = [];
    const fragment = document.createDocumentFragment();

    for (let r = 0; r < rows; r++) {
      grid[r] = [];
      cellEls[r] = [];
      for (let c = 0; c < cols; c++) {
        grid[r][c] = { mine: false, revealed: false, flagged: false, count: 0 };
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "cell";
        btn.dataset.r = r;
        btn.dataset.c = c;
        btn.setAttribute("aria-label", `Клетка ${r + 1}, ${c + 1}`);
        cellEls[r][c] = btn;
        fragment.appendChild(btn);
      }
    }

    boardEl.appendChild(fragment);
    resizeFxCanvas();
    say("Кликай смелее — первый ход всегда безопасен!");
  }

  function placeMines(safeR, safeC) {
    let placed = 0;
    while (placed < totalMines) {
      const r = Math.floor(Math.random() * rows);
      const c = Math.floor(Math.random() * cols);
      if (grid[r][c].mine) continue;
      if (Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1) continue;
      grid[r][c].mine = true;
      placed++;
    }

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c].mine) continue;
        let count = 0;
        forEachNeighbor(r, c, (nr, nc) => {
          if (grid[nr][nc].mine) count++;
        });
        grid[r][c].count = count;
      }
    }
  }

  function forEachNeighbor(r, c, fn) {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) fn(nr, nc);
      }
    }
  }

  // ==================== ИГРОВЫЕ ДЕЙСТВИЯ ====================
  function toggleFlag(r, c) {
    if (gameOver) return;
    const cell = grid[r][c];
    if (cell.revealed) return;

    cell.flagged = !cell.flagged;
    flagsCount += cell.flagged ? 1 : -1;
    minesLeftEl.textContent = String(totalMines - flagsCount);

    const el = cellEls[r][c];
    el.classList.toggle("flagged", cell.flagged);
    el.innerHTML = cell.flagged ? FLAG_SVG : "";

    window.JellyPhysics.impulse(el, 4.2, -4.2);
    window.AeroAudio.playFlag(cell.flagged);
  }

  function revealCell(r, c) {
    if (gameOver) return;
    const cell = grid[r][c];
    if (cell.flagged) return;

    if (cell.revealed) {
      if (cell.count > 0) chordReveal(r, c);
      return;
    }

    if (firstClick) {
      firstClick = false;
      placeMines(r, c);
      startTimer();
    }

    if (cell.mine) {
      explode(r, c);
      return;
    }

    const mySession = sessionId;
    const queue = [[r, c, 0]];
    const visited = new Set([`${r},${c}`]);
    let openedNow = 0;

    while (queue.length > 0) {
      const [cr, cc, wave] = queue.shift();
      const cur = grid[cr][cc];
      if (cur.revealed || cur.flagged || cur.mine) continue;

      cur.revealed = true;
      revealedCount++;
      openedNow++;

      const el = cellEls[cr][cc];
      setTimeout(() => {
        if (mySession !== sessionId) return;
        el.classList.add("revealed");
        if (cur.count > 0) {
          el.textContent = cur.count;
          el.classList.add(`n${cur.count}`);
        }
        window.JellyPhysics.impulse(el, -3.2, 3.2);
      }, wave * 24);

      if (cur.count === 0) {
        forEachNeighbor(cr, cc, (nr, nc) => {
          const key = `${nr},${nc}`;
          if (!visited.has(key) && !grid[nr][nc].revealed && !grid[nr][nc].flagged) {
            visited.add(key);
            queue.push([nr, nc, wave + 1]);
          }
        });
      }
    }

    window.JellyPhysics.ripple(cellEls, rows, cols, r, c);
    if (openedNow > 4) {
      window.AeroAudio.playCascade(openedNow);
      say("Ого, какой чистый каскад! ✨");
    } else {
      window.AeroAudio.playPop(1 + Math.random() * 0.25);
    }

    checkWin();
  }

  function chordReveal(r, c) {
    let adjFlags = 0;
    forEachNeighbor(r, c, (nr, nc) => {
      if (grid[nr][nc].flagged) adjFlags++;
    });
    if (adjFlags !== grid[r][c].count) return;

    forEachNeighbor(r, c, (nr, nc) => {
      if (!grid[nr][nc].revealed && !grid[nr][nc].flagged) {
        revealCell(nr, nc);
      }
    });
  }

  // ==================== ТРЯСКА И ЛОПАНИЕ ВСЕГО ПОЛЯ ====================
  function explode(hitR, hitC) {
    const mySession = sessionId;
    gameOver = true;
    stopTimer();
    resizeFxCanvas();
    window.AeroAudio.playBoom();

    aeroWindow.classList.remove("shaking");
    void aeroWindow.offsetWidth;
    aeroWindow.classList.add("shaking");

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c].mine) {
          const el = cellEls[r][c];
          el.classList.remove("flagged");
          el.classList.add("mine");
          if (r === hitR && c === hitC) el.classList.add("mine-exploded");
          el.innerHTML = MINE_SVG;
          window.JellyPhysics.impulse(el, 5, -5);
        }
      }
    }

    say("Ой-ой! Всё поле лопнуло! 💥");

    const panelRect = boardPanel.getBoundingClientRect();
    let maxDelay = 0;
    let popCounter = 0;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const dist = Math.hypot(r - hitR, c - hitC);
        const delay = 220 + dist * 42 + Math.random() * 35;
        if (delay > maxDelay) maxDelay = delay;

        const el = cellEls[r][c];
        const isMine = grid[r][c].mine;

        setTimeout(() => {
          if (mySession !== sessionId) return;
          const rect = el.getBoundingClientRect();
          const cx = rect.left - panelRect.left + rect.width / 2;
          const cy = rect.top - panelRect.top + rect.height / 2;

          el.classList.add("popping");
          spawnPopBurst(cx, cy, isMine);

          if (popCounter++ % 3 === 0) {
            window.AeroAudio.playBoardPop(popCounter);
          }
        }, delay);
      }
    }

    setTimeout(() => {
      if (mySession !== sessionId) return;
      overlayTitle.textContent = "Бум! Поле лопнуло 💥";
      overlaySub.textContent = "Попробуй ещё разок — в следующий раз повезёт!";
      boardOverlay.classList.remove("hidden");
    }, maxDelay + 340);
  }

  function checkWin() {
    if (revealedCount !== rows * cols - totalMines) return;
    gameOver = true;
    stopTimer();
    window.AeroAudio.playWin();

    const isRecord = window.AeroStorage.setBestIfBetter(currentDiff, seconds);
    updateBestDisplay();

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c].mine && !grid[r][c].flagged) {
          cellEls[r][c].classList.add("flagged");
          cellEls[r][c].innerHTML = FLAG_SVG;
        }
      }
    }
    minesLeftEl.textContent = "0";

    say(isRecord ? "Новый рекорд! Ты легенда! 🏆" : "Чистая победа! 🫧");
    overlayTitle.textContent = isRecord ? "Новый рекорд! 🏆" : "Победа! 🫧";
    overlaySub.textContent = `Время: ${seconds} сек.`;
    boardOverlay.classList.remove("hidden");
  }

  // ==================== ДЕЛЕГИРОВАНИЕ СОБЫТИЙ НА ПОЛЕ ====================
  boardEl.addEventListener("pointerover", (e) => {
    const cell = e.target.closest(".cell");
    if (cell && !cell.classList.contains("revealed") && !gameOver) {
      window.JellyPhysics.setTarget(cell, 1.09, 1.09);
      window.JellyPhysics.impulse(cell, 1.1, -1.1);
    }
  });

  boardEl.addEventListener("pointerout", (e) => {
    const cell = e.target.closest(".cell");
    if (cell) window.JellyPhysics.setTarget(cell, 1, 1);
  });

  boardEl.addEventListener("pointerdown", (e) => {
    const cell = e.target.closest(".cell");
    if (cell && !cell.classList.contains("revealed") && !gameOver) {
      window.JellyPhysics.impulse(cell, 3.8, -3.8);
    }
  });

  // ЛКМ
  boardEl.addEventListener("click", (e) => {
    const cell = e.target.closest(".cell");
    if (!cell) return;
    const r = Number(cell.dataset.r);
    const c = Number(cell.dataset.c);
    if (swapControls) toggleFlag(r, c);
    else revealCell(r, c);
  });

  // ПКМ
  boardEl.addEventListener("contextmenu", (e) => {
    const cell = e.target.closest(".cell");
    if (!cell) return;
    e.preventDefault();
    const r = Number(cell.dataset.r);
    const c = Number(cell.dataset.c);
    if (swapControls) revealCell(r, c);
    else toggleFlag(r, c);
  });

  // ==================== UI-КНОПКИ И ОКНО ====================
  diffButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      window.AeroAudio.playClick();
      initGame(btn.dataset.diff);
    });
  });

  btnSwapControls.addEventListener("click", () => {
    swapControls = !swapControls;
    updateControlsUI();
    window.AeroAudio.playClick();
    say(swapControls ? "Теперь ЛКМ ставит флажки, а ПКМ открывает!" : "Вернули классику: ЛКМ открывает, ПКМ — флажки!");
  });

  if (btnMusic) {
    btnMusic.addEventListener("click", () => {
      window.AeroAudio.toggleMusic();
      updateMusicButton();
      window.AeroAudio.playClick();
    });
  }

  // Автозапуск музыки при первом клике, если она была включена в прошлый раз
  document.addEventListener("pointerdown", () => {
    window.AeroAudio.resumeMusicIfEnabled();
  }, { once: true });

  btnSound.addEventListener("click", () => {
    window.AeroAudio.toggle();
    updateSoundButton();
  });

  btnRestart.addEventListener("click", () => {
    window.AeroAudio.playClick();
    initGame(currentDiff);
  });

  overlayRestart.addEventListener("click", () => {
    window.AeroAudio.playClick();
    initGame(currentDiff);
  });

  mascot.addEventListener("click", () => {
    const phrases = [
      "Жмяк! Желейное настроение! 🫧",
      "Свежий воздух Frutiger Aero~",
      "Кликай по цифре, чтобы быстро открыть соседей!",
      "Удачи в разминировании! ✨"
    ];
    window.AeroAudio.playPop(1.3);
    say(phrases[Math.floor(Math.random() * phrases.length)]);
  });

  document.getElementById("btnMin").addEventListener("click", () => {
    aeroWindow.classList.toggle("minimized");
    window.AeroAudio.playClick();
  });

  document.getElementById("btnMax").addEventListener("click", () => {
    aeroWindow.classList.remove("minimized");
    aeroWindow.classList.toggle("maximized");
    window.AeroAudio.playClick();
    setTimeout(resizeFxCanvas, 260);
  });

  document.getElementById("btnClose").addEventListener("click", () => {
    window.JellyPhysics.impulse(aeroWindow, 1.8, -1.8);
    window.AeroAudio.playPop(0.75);
    say("Не закрывай меня, я ещё хочу поиграть! 🥺");
  });

  window.addEventListener("resize", resizeFxCanvas);

  // Запуск
  window.JellyPhysics.attachUI();
  updateSoundButton();
  updateMusicButton();
  updateControlsUI();
  initGame("easy");
})();
