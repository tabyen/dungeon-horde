export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.22;
    master.connect(ctx.destination);
  }

  function beep(freq, dur, type = "square", vol = 0.4, slide = 0) {
    if (muted) return;
    ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, vol = 0.2) {
    if (muted) return;
    ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const n = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 900;
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(t);
  }

  return {
    unlock() {
      ensure();
      if (ctx && ctx.state === "suspended") ctx.resume();
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.22;
      return muted;
    },
    get muted() {
      return muted;
    },
    shoot() {
      beep(520, 0.05, "square", 0.12, -220);
    },
    hit() {
      beep(180, 0.07, "sawtooth", 0.16, -80);
      noise(0.05, 0.12);
    },
    gem() {
      beep(880, 0.07, "sine", 0.14, 200);
    },
    hurt() {
      beep(140, 0.18, "sawtooth", 0.28, -90);
      noise(0.12, 0.22);
    },
    level() {
      beep(440, 0.1, "square", 0.18, 0);
      setTimeout(() => beep(554, 0.1, "square", 0.18, 0), 80);
      setTimeout(() => beep(659, 0.18, "square", 0.2, 0), 160);
    },
    death() {
      beep(220, 0.4, "sawtooth", 0.3, -160);
      setTimeout(() => beep(110, 0.5, "triangle", 0.24, -40), 180);
    },
    pickup() {
      beep(660, 0.12, "sine", 0.18, 120);
    },
    descend() {
      beep(196, 0.2, "triangle", 0.2, -60);
      setTimeout(() => beep(147, 0.3, "triangle", 0.18, -40), 160);
    },
  };
}
