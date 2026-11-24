window.AeroStorage = (() => {
  const BEST_PREFIX = "aero_minesweeper_best_";
  const SOUND_KEY = "aero_minesweeper_sound";

  function getBest(diff) {
    try {
      const val = localStorage.getItem(BEST_PREFIX + diff);
      return val ? Number(val) : null;
    } catch {
      return null;
    }
  }

  function setBestIfBetter(diff, seconds) {
    try {
      const prev = getBest(diff);
      if (prev === null || seconds < prev) {
        localStorage.setItem(BEST_PREFIX + diff, String(seconds));
        return true;
      }
    } catch {
      // Игнорируем, если localStorage недоступен
    }
    return false;
  }

  function getSoundEnabled() {
    try {
      const val = localStorage.getItem(SOUND_KEY);
      return val === null ? true : val === "1";
    } catch {
      return true;
    }
  }

  function setSoundEnabled(enabled) {
    try {
      localStorage.setItem(SOUND_KEY, enabled ? "1" : "0");
    } catch {}
  }

  return { getBest, setBestIfBetter, getSoundEnabled, setSoundEnabled };
})();
