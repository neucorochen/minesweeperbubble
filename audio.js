window.AeroAudio = (() => {
  let ctx = null;
  let musicBus = null;
  let delayNode = null;

  let sfxEnabled = window.AeroStorage.getSoundEnabled();
  let musicEnabled = window.AeroStorage.getMusicEnabled();
  let musicTimer = null;
  let stepIndex = 0;

  // Аккорды Frutiger Aero: Fmaj7 -> G6 -> Em7 -> Am9
  const CHORDS = [
    [174.61, 220.00, 261.63, 329.63], // Fmaj7
    [196.00, 246.94, 293.66, 329.63], // G6
    [164.81, 196.00, 246.94, 293.66], // Em7
    [220.00, 261.63, 329.63, 392.00]  // Am7
  ];

  // Стеклянные ноты верхнего арпеджио (C-major / Lydian)
  const MELODY_PATTERN = [
    659.25, 0, 783.99, 987.77, 0, 783.99, 659.25, 0,
    587.33, 0, 783.99, 880.00, 0, 783.99, 587.33, 0,
    659.25, 0, 987.77, 1046.50, 0, 987.77, 783.99, 0,
    880.00, 0, 783.99, 659.25, 523.25, 0, 587.33, 0
  ];

  function getContext() {
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      ctx = new AudioCtx();
      setupMusicBus(ctx);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function setupMusicBus(audio) {
    musicBus = audio.createGain();
    musicBus.gain.value = 0.0001;
    musicBus.connect(audio.destination);

    // Мягкое «водное» эхо для атмосферы Frutiger Aero
    delayNode = audio.createDelay(1.0);
    delayNode.delayTime.value = 0.34;

    const feedback = audio.createGain();
    feedback.gain.value = 0.28;

    const echoFilter = audio.createBiquadFilter();
    echoFilter.type = "lowpass";
    echoFilter.frequency.value = 2100;

    delayNode.connect(echoFilter);
    echoFilter.connect(feedback);
    feedback.connect(delayNode);
    echoFilter.connect(musicBus);
  }

  // ==================== СИНТЕЗ ФОНОВОЙ МУЗЫКИ ====================
  function playPadChord(freqs, duration) {
    const audio = getContext();
    if (!audio || !musicBus) return;
    const now = audio.currentTime;

    freqs.forEach((freq, i) => {
      const osc = audio.createOscillator();
      const filter = audio.createBiquadFilter();
      const gain = audio.createGain();

      osc.type = i === 0 ? "sine" : "triangle";
      osc.frequency.setValueAtTime(freq, now);

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(1100, now);

      const peak = i === 0 ? 0.14 : 0.075;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(peak, now + 0.35);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(musicBus);

      osc.start(now);
      osc.stop(now + duration + 0.05);
    });
  }

  function playGlassPluck(freq) {
    const audio = getContext();
    if (!audio || !musicBus || !delayNode) return;
    const now = audio.currentTime;

    const osc = audio.createOscillator();
    const overtone = audio.createOscillator();
    const gain = audio.createGain();
    const overGain = audio.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now);

    // Хрустальный обертон на октаву выше
    overtone.type = "sine";
    overtone.frequency.setValueAtTime(freq * 2, now);
    overGain.gain.value = 0.22;

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.085, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.72);

    osc.connect(gain);
    overtone.connect(overGain);
    overGain.connect(gain);

    gain.connect(musicBus);
    gain.connect(delayNode);

    osc.start(now);
    overtone.start(now);
    osc.stop(now + 0.78);
    overtone.stop(now + 0.78);
  }

  function musicTick() {
    if (!musicEnabled) return;

    // Каждые 8 шагов берём новый мягкий аккорд
    if (stepIndex % 8 === 0) {
      const chordIdx = Math.floor(stepIndex / 8) % CHORDS.length;
      playPadChord(CHORDS[chordIdx], 2.75);
    }

    // Играем стеклянную ноту мелодии
    const note = MELODY_PATTERN[stepIndex % MELODY_PATTERN.length];
    if (note > 0) {
      playGlassPluck(note);
    }

    stepIndex = (stepIndex + 1) % MELODY_PATTERN.length;
  }

  function startMusic() {
    const audio = getContext();
    if (!audio || !musicBus) return;
    if (musicTimer !== null) return;

    const now = audio.currentTime;
    musicBus.gain.cancelScheduledValues(now);
    musicBus.gain.setValueAtTime(Math.max(musicBus.gain.value, 0.0001), now);
    musicBus.gain.linearRampToValueAtTime(0.28, now + 0.45);

    musicTick();
    musicTimer = setInterval(musicTick, 330);
  }

  function stopMusic() {
    if (musicTimer !== null) {
      clearInterval(musicTimer);
      musicTimer = null;
    }
    if (ctx && musicBus) {
      const now = ctx.currentTime;
      musicBus.gain.cancelScheduledValues(now);
      musicBus.gain.setValueAtTime(musicBus.gain.value, now);
      musicBus.gain.linearRampToValueAtTime(0.0001, now + 0.25);
    }
  }

  // ==================== ЗВУКОВЫЕ ЭФФЕКТЫ (SFX) ====================
  function tone(freqStart, freqEnd, duration, type = "sine", volume = 0.14, delay = 0) {
    if (!sfxEnabled) return;
    const audio = getContext();
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
    isEnabled: () => sfxEnabled,
    toggle() {
      sfxEnabled = !sfxEnabled;
      window.AeroStorage.setSoundEnabled(sfxEnabled);
      if (sfxEnabled) this.playPop(1.2);
      return sfxEnabled;
    },

    isMusicEnabled: () => musicEnabled,
    toggleMusic() {
      musicEnabled = !musicEnabled;
      window.AeroStorage.setMusicEnabled(musicEnabled);
      if (musicEnabled) startMusic();
      else stopMusic();
      return musicEnabled;
    },
    resumeMusicIfEnabled() {
      if (musicEnabled && musicTimer === null) {
        startMusic();
      }
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
      if (placed) tone(520, 790, 0.085, "triangle", 0.12);
      else tone(640, 410, 0.085, "triangle", 0.1);
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
