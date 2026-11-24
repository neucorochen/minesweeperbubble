window.JellyPhysics = (() => {
  const springs = new Map();
  let rafId = null;
  let lastTime = 0;

  const STIFFNESS = 300;
  const DAMPING = 14;

  function getState(el) {
    let s = springs.get(el);
    if (!s) {
      s = { sx: 1, sy: 1, vx: 0, vy: 0, tx: 1, ty: 1 };
      springs.set(el, s);
    }
    return s;
  }

  function startLoop() {
    if (rafId !== null) return;
    lastTime = performance.now();
    rafId = requestAnimationFrame(tick);
  }

  function tick(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.033);
    lastTime = now;

    for (const [el, s] of springs.entries()) {
      const ax = (s.tx - s.sx) * STIFFNESS - s.vx * DAMPING;
      const ay = (s.ty - s.sy) * STIFFNESS - s.vy * DAMPING;

      s.vx += ax * dt;
      s.vy += ay * dt;
      s.sx += s.vx * dt;
      s.sy += s.vy * dt;

      const settled =
        Math.abs(s.tx - s.sx) < 0.0015 &&
        Math.abs(s.ty - s.sy) < 0.0015 &&
        Math.abs(s.vx) < 0.01 &&
        Math.abs(s.vy) < 0.01;

      if (settled) {
        if (s.tx === 1 && s.ty === 1) {
          el.style.transform = "";
          springs.delete(el);
        } else {
          s.sx = s.tx;
          s.sy = s.ty;
          s.vx = 0;
          s.vy = 0;
          el.style.transform = `scale(${s.sx.toFixed(4)}, ${s.sy.toFixed(4)})`;
        }
      } else {
        el.style.transform = `scale(${s.sx.toFixed(4)}, ${s.sy.toFixed(4)})`;
      }
    }

    if (springs.size > 0) {
      rafId = requestAnimationFrame(tick);
    } else {
      rafId = null; // Засыпаем, пока нет активных пружин
    }
  }

  function impulse(el, vx, vy) {
    if (!el) return;
    const s = getState(el);
    s.vx += vx;
    s.vy += vy;
    startLoop();
  }

  function setTarget(el, tx, ty) {
    if (!el) return;
    const s = getState(el);
    s.tx = tx;
    s.ty = ty;
    startLoop();
  }

  function attachUI(selector = ".jelly-ui") {
    document.querySelectorAll(selector).forEach((el) => {
      el.addEventListener("pointerenter", () => setTarget(el, 1.05, 1.05));
      el.addEventListener("pointerleave", () => setTarget(el, 1, 1));
      el.addEventListener("pointerdown", () => {
        setTarget(el, 0.94, 0.94);
        impulse(el, 2.6, -2.6);
      });
      el.addEventListener("pointerup", () => {
        setTarget(el, 1.05, 1.05);
        impulse(el, -1.8, 1.8);
      });
    });
  }

  function ripple(cellsGrid, rows, cols, originR, originC) {
    const radius = 3;
    for (let r = Math.max(0, originR - radius); r <= Math.min(rows - 1, originR + radius); r++) {
      for (let c = Math.max(0, originC - radius); c <= Math.min(cols - 1, originC + radius); c++) {
        const dist = Math.hypot(r - originR, c - originC);
        if (dist === 0 || dist > radius) continue;
        const el = cellsGrid[r]?.[c];
        if (!el) continue;
        const strength = (1 - dist / (radius + 0.6)) * 3.4;
        setTimeout(() => impulse(el, strength, -strength), dist * 35);
      }
    }
  }

  return { impulse, setTarget, attachUI, ripple };
})();
