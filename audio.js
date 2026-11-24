window.AeroAudio = (() => {
  let ctx = null;
  let enabled = window.AeroStorage.getSoundEnabled();

  function ensureContext() {
    if (!enabled) return null;
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      ctx = new AudioCtx();
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function tone(freqStart, freqEnd, duration, type = "sine", volume = 0.14, delay = 0) {
    const audio = ensureContext();
    if (!audio) return;

    const now = audio.currentTime + delay;
    const osc = audio.createOscillator();
    const gain = audio.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), now + duration);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(audio.destination);

    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  return {
    isEnabled: () => enabled,
    toggle() {
      enabled = !enabled;
      window.AeroStorage.setSoundEnabled(enabled);
      if (enabled) this.playPop(1.2);
      return enabled;
    },
    playPop(pitch = 1) {
      tone(340 * pitch, 720 * pitch, 0.09, "sine", 0.14);
    },
    playCascade(step) {
      const mult = 1 + Math.min(step, 10) * 0.08;
      tone(380 * mult, 780 * mult, 0.075, "sine", 0.09);
    },
    playBoardPop(step = 0) {
      const pitch = 0.85 + (step % 7) * 0.12;
      tone(290 * pitch, 820 * pitch, 0.065, "sine", 0.085);
    },
    playFlag(placed) {
      if (placed) {
        tone(520, 790, 0.085, "triangle", 0.12);
      } else {
        tone(640, 410, 0.085, "triangle", 0.1);
      }
    },
    playClick() {
      tone(440, 610, 0.06, "sine", 0.1);
    },
    playWin() {
      [523, 659, 784, 1046].forEach((freq, i) => {
        tone(freq, freq * 1.04, 0.18, "sine", 0.13, i * 0.09);
      });
    },
    playBoom() {
      tone(210, 42, 0.42, "sawtooth", 0.17);
      tone(135, 36, 0.48, "triangle", 0.22, 0.02);
      tone(520, 120, 0.18, "sine", 0.14, 0.04);
    }
  };
})();
