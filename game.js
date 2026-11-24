(() => {
  const DIFFICULTIES = {
    easy:   { rows: 9,  cols: 9,  mines: 10, label: "новичок 9×9",  cellSize: 40 },
    medium: { rows: 14, cols: 14, mines: 30, label: "любитель 14×14", cellSize: 32 },
    hard:   { rows: 16, cols: 24, mines: 72, label: "профи 16×24",  cellSize: 28 }
  };

  // DOM-элементы
  const aeroWindow     = document.getElementById("aeroWindow");
  const boardEl        = document.getElementById("board");
  const boardOverlay   = document.getElementById("boardOverlay");
  const overlayTitle   = document.getElementById("overlayTitle");
  const overlaySub     = document.getElementById("overlaySub");
  const overlayRestart = document.getElementById("overlayRestart");
  const minesLeftEl    = document.getElementById("minesLeft");
  const timerEl        = document.getElementById("timer");
  const bestTimeEl     = document.getElementById("bestTime");
  const modeBadgeText  = document.getElementById("modeBadgeText");
  const btnModeToggle  = document.getElementById("btnModeToggle");
  const btnSound       = document.getElementById("btnSound");
  const btnRestart     = document.getElementById("btnRestart");
  const mascot         = document.getElementById("mascot");
  const mascotSpeech   = document.getElementById("mascotSpeech");
  const diffButtons    = document.querySelectorAll(".diff-btn");

  // Состояние игры
  let currentDiff = "easy";
  let rows = 9, cols = 9, totalMines = 10;
  let grid = [];
  let cellEls = [];
  let firstClick = true;
  let gameOver = false;
  let flagMode = false;
  let flagsCount = 0;
  let revealedCount = 0;
  let seconds = 0;
  let timerId = null;

  function say(text) {
    mascotSpeech.textContent = text;
    window.JellyPhysics.impulse(mascot, 2.2, -2.2);
  }

  function updateSoundButton() {
    btnSound.textContent = window.AeroAudio.isEnabled() ? "🔊 звук: вкл" : "🔇 звук: выкл";
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

  function initGame(diff = currentDiff) {
    currentDiff = diff;
    const cfg = DIFFICULTIES[diff];
    rows = cfg.rows;
    cols = cfg.cols;
    totalMines = cfg.mines;

    stopTimer();
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

  function toggleFlag(r, c) {
    if (gameOver) return;
    const cell = grid[r][c];
    if (cell.revealed) return;

    cell.flagged = !cell.flagged;
    flagsCount += cell.flagged ? 1 : -1;
    minesLeftEl.textContent = String(totalMines - flagsCount);

    const el = cellEls[r][c];
    el.classList.toggle("flagged", cell.flagged);
    el.textContent = cell.flagged ? "🚩" : "";

    window.JellyPhysics.impulse(el, 3.2, -3.2);
    window.AeroAudio.playFlag(cell.flagged);
  }

  function revealCell(r, c) {
    if (gameOver) return;
    const cell = grid[r][c];
    if (cell.flagged) return;

    // Chord-клик по уже открытой цифре
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

    // Каскадное BFS-открытие
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
        el.classList.add("revealed");
        if (cur.count > 0) {
          el.textContent = cur.count;
          el.classList.add(`n${cur.count}`);
        }
        window.JellyPhysics.impulse(el, -2.4, 2.4);
      }, wave * 22);

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

  function explode(hitR, hitC) {
    gameOver = true;
    stopTimer();
    window.AeroAudio.playBoom();

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c].mine) {
          const el = cellEls[r][c];
          el.classList.add("mine");
          if (r === hitR && c === hitC) el.classList.add("mine-exploded");
          el.textContent = "💣";
          window.JellyPhysics.impulse(el, 4, -4);
        }
      }
    }

    say("Ой-ой! Пузырёк лопнул 💥");
    overlayTitle.textContent = "Бум! Мина 💥";
    overlaySub.textContent = "Попробуй ещё разок — в следующий раз повезёт!";
    boardOverlay.classList.remove("hidden");
  }

  function checkWin() {
    if (revealedCount !== rows * cols - totalMines) return;
    gameOver = true;
    stopTimer();
    window.AeroAudio.playWin();

    const isRecord = window.AeroStorage.setBestIfBetter(currentDiff, seconds);
    updateBestDisplay();

    // Автоматически отмечаем оставшиеся мины флажками
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c].mine && !grid[r][c].flagged) {
          cellEls[r][c].classList.add("flagged");
          cellEls[r][c].textContent = "🚩";
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
    if (cell && !cell.classList.contains("revealed")) {
      window.JellyPhysics.setTarget(cell, 1.07, 1.07);
    }
  });

  boardEl.addEventListener("pointerout", (e) => {
    const cell = e.target.closest(".cell");
    if (cell) window.JellyPhysics.setTarget(cell, 1, 1);
  });

  boardEl.addEventListener("pointerdown", (e) => {
    const cell = e.target.closest(".cell");
    if (cell && !cell.classList.contains("revealed")) {
      window.JellyPhysics.impulse(cell, 2.8, -2.8);
    }
  });

  boardEl.addEventListener("click", (e) => {
    const cell = e.target.closest(".cell");
    if (!cell) return;
    const r = Number(cell.dataset.r);
    const c = Number(cell.dataset.c);
    if (flagMode) toggleFlag(r, c);
    else revealCell(r, c);
  });

  boardEl.addEventListener("contextmenu", (e) => {
    const cell = e.target.closest(".cell");
    if (!cell) return;
    e.preventDefault();
    toggleFlag(Number(cell.dataset.r), Number(cell.dataset.c));
  });

  // ==================== UI-КНОПКИ И ОКНО ====================
  diffButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      window.AeroAudio.playClick();
      initGame(btn.dataset.diff);
    });
  });

  btnModeToggle.addEventListener("click", () => {
    flagMode = !flagMode;
    btnModeToggle.textContent = flagMode ? "🚩 режим: флажок" : "💧 режим: открыть";
    window.AeroAudio.playClick();
  });

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
      "Жмяк! Я желейный! 🫧",
      "Свежий воздух Frutiger Aero~",
      "Нажимай на цифру, чтобы быстро открыть соседей!",
      "Удачи в разминировании! ✨"
    ];
    window.AeroAudio.playPop(1.3);
    say(phrases[Math.floor(Math.random() * phrases.length)]);
  });

  // Кнопки заголовка Windows 7
  document.getElementById("btnMin").addEventListener("click", () => {
    aeroWindow.classList.toggle("minimized");
    window.AeroAudio.playClick();
  });

  document.getElementById("btnMax").addEventListener("click", () => {
    aeroWindow.classList.remove("minimized");
    aeroWindow.classList.toggle("maximized");
    window.AeroAudio.playClick();
  });

  document.getElementById("btnClose").addEventListener("click", () => {
    window.JellyPhysics.impulse(aeroWindow, 1.4, -1.4);
    window.AeroAudio.playPop(0.75);
    say("Не закрывай меня, я ещё хочу поиграть! 🥺");
  });

  // Запуск
  window.JellyPhysics.attachUI();
  updateSoundButton();
  initGame("easy");
})();
