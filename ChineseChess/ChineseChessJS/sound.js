class SoundEffects {
  constructor() {
    this.ctx = null;
    this.masterOut = null;
    this.distortionCurve = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        const comp = this.ctx.createDynamicsCompressor();
        comp.threshold.setValueAtTime(-8, this.ctx.currentTime);
        comp.knee.setValueAtTime(10, this.ctx.currentTime);
        comp.ratio.setValueAtTime(4, this.ctx.currentTime);
        comp.attack.setValueAtTime(0.008, this.ctx.currentTime);
        comp.release.setValueAtTime(0.12, this.ctx.currentTime);

        const makeup = this.ctx.createGain();
        makeup.gain.setValueAtTime(1.28, this.ctx.currentTime);
        comp.connect(makeup);
        makeup.connect(this.ctx.destination);
        this.masterOut = comp;
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  out() {
    return this.masterOut || (this.ctx ? this.ctx.destination : null);
  }

  getDistortionCurve(amount = 45) {
    if (this.distortionCurve && this._lastDistAmount === amount) return this.distortionCurve;
    const samples = 8192;
    const curve = new Float32Array(samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
    }
    this.distortionCurve = curve;
    this._lastDistAmount = amount;
    return curve;
  }

  createDistortionNode(amount = 45) {
    const shaper = this.ctx.createWaveShaper();
    shaper.curve = this.getDistortionCurve(amount);
    shaper.oversample = '2x';
    return shaper;
  }

  createNoiseBuffer(duration, decayPower = 1.4) {
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decayPower);
    }
    return buf;
  }

  playSelect() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const dest = this.out();

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(760, now);
    osc.frequency.exponentialRampToValueAtTime(1180, now + 0.05);
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.065);

    const overtone = this.ctx.createOscillator();
    const oGain = this.ctx.createGain();
    overtone.type = 'triangle';
    overtone.frequency.setValueAtTime(1520, now);
    overtone.frequency.exponentialRampToValueAtTime(2120, now + 0.04);
    oGain.gain.setValueAtTime(0.06, now);
    oGain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
    overtone.connect(oGain);
    oGain.connect(dest);
    overtone.start(now);
    overtone.stop(now + 0.05);
  }

  playHint() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const dest = this.out();
    const notes = [587.33, 880, 1174.66, 1760];
    notes.forEach((f, idx) => {
      const t0 = now + idx * 0.04;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t0);
      g.gain.setValueAtTime(0.12, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.34);
      osc.connect(g);
      g.connect(dest);
      osc.start(t0);
      osc.stop(t0 + 0.36);
    });
  }

  playIllegal() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const dest = this.out();
    [0, 0.08].forEach((delay, idx) => {
      const t0 = now + delay;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      const freq = idx === 0 ? 210 : 150;
      osc.frequency.setValueAtTime(freq, t0);
      osc.frequency.exponentialRampToValueAtTime(64, t0 + 0.09);
      gain.gain.setValueAtTime(0.24, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.095);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(t0);
      osc.stop(t0 + 0.10);
    });
  }

  playPickUp(color = 'r', isSubtle = false) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const dest = this.out();
    const isRed = color === 'r';
    const volScale = isSubtle ? 0.65 : 1.0;

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(0.036, 1.6);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(isRed ? 2100 : 2400, now);
    filter.frequency.exponentialRampToValueAtTime(isRed ? 3500 : 3900, now + 0.034);
    filter.Q.setValueAtTime(3.2, now);

    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.20 * volScale, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.036);
    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(dest);
    noise.start(now);
    noise.stop(now + 0.04);

    const stoneOsc = this.ctx.createOscillator();
    const stoneGain = this.ctx.createGain();
    stoneOsc.type = 'sine';
    stoneOsc.frequency.setValueAtTime(isRed ? 620 : 560, now);
    stoneOsc.frequency.exponentialRampToValueAtTime(isRed ? 1080 : 980, now + 0.048);
    stoneGain.gain.setValueAtTime(0.16 * volScale, now);
    stoneGain.gain.exponentialRampToValueAtTime(0.001, now + 0.052);
    stoneOsc.connect(stoneGain);
    stoneGain.connect(dest);
    stoneOsc.start(now);
    stoneOsc.stop(now + 0.056);
  }

  playMove(color = 'r', pieceType = 'p') {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const dest = this.out();
    const isRed = color === 'r';
    const isHeavy = pieceType === 'r' || pieceType === 'c' || pieceType === 'k';
    const weightMul = isHeavy ? 1.25 : 1.0;

    const triggerClack = (delay, intensity, pitchMul = 1.0) => {
      const t0 = now + delay;
      const snap = this.ctx.createBufferSource();
      snap.buffer = this.createNoiseBuffer(0.032, 2.0);

      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime((isRed ? 2600 : 2950) * pitchMul, t0);
      bp.Q.setValueAtTime(3.0, t0);

      const snapGain = this.ctx.createGain();
      snapGain.gain.setValueAtTime(0.55 * intensity * weightMul, t0);
      snapGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.03);
      snap.connect(bp);
      bp.connect(snapGain);
      snapGain.connect(dest);
      snap.start(t0);
      snap.stop(t0 + 0.034);

      const woodOsc = this.ctx.createOscillator();
      const woodGain = this.ctx.createGain();
      woodOsc.type = 'triangle';
      const woodFreq = (isRed ? 420 : 390) * pitchMul * (isHeavy ? 0.90 : 1.0);
      woodOsc.frequency.setValueAtTime(woodFreq, t0);
      woodOsc.frequency.exponentialRampToValueAtTime(woodFreq * 0.42, t0 + 0.075);
      woodGain.gain.setValueAtTime(0.42 * intensity * weightMul, t0);
      woodGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.08);
      woodOsc.connect(woodGain);
      woodGain.connect(dest);
      woodOsc.start(t0);
      woodOsc.stop(t0 + 0.085);
    };

    triggerClack(0, 1.0, 1.0);
    triggerClack(0.016, 0.45, 1.18);

    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(isHeavy ? 155 : 175, now);
    sub.frequency.exponentialRampToValueAtTime(48, now + 0.11);
    subGain.gain.setValueAtTime(0.38 * weightMul, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.115);
    sub.connect(subGain);
    subGain.connect(dest);
    sub.start(now);
    sub.stop(now + 0.12);
  }

  playAttackShatter() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const dest = this.out();

    const crackNoise = this.ctx.createBufferSource();
    crackNoise.buffer = this.createNoiseBuffer(0.055, 2.2);
    const crackFilter = this.ctx.createBiquadFilter();
    crackFilter.type = 'bandpass';
    crackFilter.frequency.setValueAtTime(3800, now);
    crackFilter.frequency.exponentialRampToValueAtTime(2200, now + 0.05);
    crackFilter.Q.setValueAtTime(1.8, now);
    const crackGain = this.ctx.createGain();
    crackGain.gain.setValueAtTime(1.15, now);
    crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
    crackNoise.connect(crackFilter);
    crackFilter.connect(crackGain);
    crackGain.connect(dest);
    crackNoise.start(now);
    crackNoise.stop(now + 0.06);

    const woodSnap = this.ctx.createOscillator();
    const woodSnapGain = this.ctx.createGain();
    woodSnap.type = 'triangle';
    woodSnap.frequency.setValueAtTime(720, now);
    woodSnap.frequency.exponentialRampToValueAtTime(210, now + 0.075);
    woodSnapGain.gain.setValueAtTime(0.85, now);
    woodSnapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    woodSnap.connect(woodSnapGain);
    woodSnapGain.connect(dest);
    woodSnap.start(now);
    woodSnap.stop(now + 0.085);

    const punchKick = this.ctx.createOscillator();
    const punchGain = this.ctx.createGain();
    punchKick.type = 'sine';
    punchKick.frequency.setValueAtTime(175, now);
    punchKick.frequency.exponentialRampToValueAtTime(48, now + 0.13);
    punchGain.gain.setValueAtTime(0.68, now);
    punchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    punchKick.connect(punchGain);
    punchGain.connect(dest);
    punchKick.start(now);
    punchKick.stop(now + 0.15);

    const slashAir = this.ctx.createBufferSource();
    slashAir.buffer = this.createNoiseBuffer(0.16, 1.3);
    const hpFilter = this.ctx.createBiquadFilter();
    hpFilter.type = 'bandpass';
    hpFilter.frequency.setValueAtTime(6200, now);
    hpFilter.frequency.exponentialRampToValueAtTime(2600, now + 0.15);
    hpFilter.Q.setValueAtTime(2.6, now);
    const slashGain = this.ctx.createGain();
    slashGain.gain.setValueAtTime(0.78, now);
    slashGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    slashAir.connect(hpFilter);
    hpFilter.connect(slashGain);
    slashGain.connect(dest);
    slashAir.start(now);
    slashAir.stop(now + 0.17);

    const bladeHarmonics = [1318.5, 1975.5, 2637.0, 3951.1];
    bladeHarmonics.forEach((f, idx) => {
      const t0 = now + idx * 0.004;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = idx === 0 ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(f * 1.08, t0);
      osc.frequency.exponentialRampToValueAtTime(f, t0 + 0.025);
      osc.frequency.exponentialRampToValueAtTime(f * 0.97, t0 + 0.24);
      g.gain.setValueAtTime(0.28 / (1 + idx * 0.35), t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.25);
      osc.connect(g);
      g.connect(dest);
      osc.start(t0);
      osc.stop(t0 + 0.26);
    });

    const jadeShards = [
      { delay: 0.014, freq: 3100, dur: 0.055, vol: 0.32 },
      { delay: 0.028, freq: 4400, dur: 0.050, vol: 0.28 },
      { delay: 0.045, freq: 5600, dur: 0.045, vol: 0.25 },
      { delay: 0.064, freq: 3800, dur: 0.055, vol: 0.22 },
      { delay: 0.088, freq: 6400, dur: 0.042, vol: 0.18 },
      { delay: 0.115, freq: 4900, dur: 0.048, vol: 0.15 }
    ];
    jadeShards.forEach(s => {
      const t0 = now + s.delay;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(s.freq, t0);
      osc.frequency.exponentialRampToValueAtTime(s.freq * 0.68, t0 + s.dur);
      g.gain.setValueAtTime(s.vol, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + s.dur);
      osc.connect(g);
      g.connect(dest);
      osc.start(t0);
      osc.stop(t0 + s.dur + 0.005);
    });
  }

  playCheck() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const dest = this.out();

    const unsheatheNoise = this.ctx.createBufferSource();
    unsheatheNoise.buffer = this.createNoiseBuffer(0.22, 1.1);
    const unsheatheFilter = this.ctx.createBiquadFilter();
    unsheatheFilter.type = 'bandpass';
    unsheatheFilter.frequency.setValueAtTime(2400, now);
    unsheatheFilter.frequency.exponentialRampToValueAtTime(6800, now + 0.09);
    unsheatheFilter.frequency.exponentialRampToValueAtTime(3200, now + 0.21);
    unsheatheFilter.Q.setValueAtTime(3.5, now);
    const unsheatheGain = this.ctx.createGain();
    unsheatheGain.gain.setValueAtTime(0.75, now);
    unsheatheGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    unsheatheNoise.connect(unsheatheFilter);
    unsheatheFilter.connect(unsheatheGain);
    unsheatheGain.connect(dest);
    unsheatheNoise.start(now);
    unsheatheNoise.stop(now + 0.23);

    const swordRing = [1174.66, 1760.0, 2637.0, 3520.0, 5274.0];
    swordRing.forEach((f, idx) => {
      const t0 = now + idx * 0.006;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = idx < 2 ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(f * 1.12, t0);
      osc.frequency.exponentialRampToValueAtTime(f, t0 + 0.035);
      osc.frequency.exponentialRampToValueAtTime(f * 0.98, t0 + 0.52);
      g.gain.setValueAtTime(0.26 / (1 + idx * 0.35), t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.54);
      osc.connect(g);
      g.connect(dest);
      osc.start(t0);
      osc.stop(t0 + 0.56);
    });

    const drumPunch = this.ctx.createOscillator();
    const drumGain = this.ctx.createGain();
    drumPunch.type = 'sine';
    drumPunch.frequency.setValueAtTime(165, now);
    drumPunch.frequency.exponentialRampToValueAtTime(46, now + 0.18);
    drumGain.gain.setValueAtTime(0.65, now);
    drumGain.gain.exponentialRampToValueAtTime(0.001, now + 0.20);
    drumPunch.connect(drumGain);
    drumGain.connect(dest);
    drumPunch.start(now);
    drumPunch.stop(now + 0.21);

    const brassChord = [293.66, 440.0, 587.33, 880.0];
    brassChord.forEach((f, idx) => {
      const t0 = now + 0.018 + idx * 0.012;
      const horn = this.ctx.createOscillator();
      const hFilter = this.ctx.createBiquadFilter();
      const hGain = this.ctx.createGain();
      horn.type = 'sawtooth';
      horn.frequency.setValueAtTime(f * 0.97, t0);
      horn.frequency.linearRampToValueAtTime(f, t0 + 0.045);
      hFilter.type = 'bandpass';
      hFilter.frequency.setValueAtTime(f * 2.5, t0);
      hFilter.Q.setValueAtTime(1.4, t0);
      hGain.gain.setValueAtTime(0.001, t0);
      hGain.gain.linearRampToValueAtTime(0.24 / (1 + idx * 0.2), t0 + 0.03);
      hGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.52);
      horn.connect(hFilter);
      hFilter.connect(hGain);
      hGain.connect(dest);
      horn.start(t0);
      horn.stop(t0 + 0.54);
    });
  }

  playVictorySeal(delayOffset = 0) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime + delayOffset;
    const dest = this.out();

    const stampCrack = this.ctx.createBufferSource();
    stampCrack.buffer = this.createNoiseBuffer(0.18, 1.5);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2800, now);
    bp.frequency.exponentialRampToValueAtTime(900, now + 0.16);
    bp.Q.setValueAtTime(2.0, now);
    const sGain = this.ctx.createGain();
    sGain.gain.setValueAtTime(0.82, now);
    sGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    stampCrack.connect(bp);
    bp.connect(sGain);
    sGain.connect(dest);
    stampCrack.start(now);
    stampCrack.stop(now + 0.19);

    const slamSub = this.ctx.createOscillator();
    const slamGain = this.ctx.createGain();
    slamSub.type = 'sine';
    slamSub.frequency.setValueAtTime(160, now);
    slamSub.frequency.exponentialRampToValueAtTime(36, now + 0.36);
    slamGain.gain.setValueAtTime(0.75, now);
    slamGain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    slamSub.connect(slamGain);
    slamGain.connect(dest);
    slamSub.start(now);
    slamSub.stop(now + 0.40);

    const chord = [293.66, 440.0, 587.33, 880.0, 1174.66, 1760.0];
    chord.forEach((f, i) => {
      const t0 = now + i * 0.018;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = i < 2 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(f, t0);
      gain.gain.setValueAtTime(i === 0 ? 0.26 : 0.15, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.95);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(t0);
      osc.stop(now + 0.98);
    });
  }

  playCheckmateVFXSound(vfxType) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const dest = this.out();

    const triggerNoiseBurst = (startDelay, duration, startFreq, endFreq, peakGain, filterType = 'bandpass') => {
      const t0 = now + startDelay;
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.createNoiseBuffer(duration, 1.1);
      const filter = this.ctx.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.setValueAtTime(startFreq, t0);
      filter.frequency.exponentialRampToValueAtTime(Math.max(80, endFreq), t0 + duration);
      filter.Q.setValueAtTime(2.2, t0);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.001, t0);
      gain.gain.linearRampToValueAtTime(peakGain, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(dest);
      noise.start(t0);
      noise.stop(t0 + duration + 0.02);
    };

    const riseOsc = this.ctx.createOscillator();
    const riseGain = this.ctx.createGain();
    riseOsc.type = 'sine';
    riseOsc.frequency.setValueAtTime(220, now + 0.04);
    riseOsc.frequency.exponentialRampToValueAtTime(1180, now + 0.62);
    riseGain.gain.setValueAtTime(0.02, now + 0.04);
    riseGain.gain.linearRampToValueAtTime(0.26, now + 0.56);
    riseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
    riseOsc.connect(riseGain);
    riseGain.connect(dest);
    riseOsc.start(now + 0.04);
    riseOsc.stop(now + 0.66);

    const impactT = now + 0.65;
    const subBoom = this.ctx.createOscillator();
    const subBoomGain = this.ctx.createGain();
    subBoom.type = 'sine';
    subBoom.frequency.setValueAtTime(175, impactT);
    subBoom.frequency.exponentialRampToValueAtTime(34, impactT + 0.45);
    subBoomGain.gain.setValueAtTime(0.78, impactT);
    subBoomGain.gain.exponentialRampToValueAtTime(0.001, impactT + 0.48);
    subBoom.connect(subBoomGain);
    subBoomGain.connect(dest);
    subBoom.start(impactT);
    subBoom.stop(impactT + 0.50);

    triggerNoiseBurst(0.65, 0.38, 4600, 420, 0.72, 'bandpass');

    if (
      vfxType === 'double_cannon' ||
      vfxType === 'horse_cannon' ||
      vfxType === 'heaven_earth_cannon' ||
      vfxType === 'chariot_cannon_clamp'
    ) {
      triggerNoiseBurst(1.05, 0.55, 4200, 240, 0.82, 'bandpass');
      triggerNoiseBurst(1.42, 0.55, 4800, 220, 0.85, 'bandpass');
    } else if (
      vfxType === 'iron_bolt' ||
      vfxType === 'smothered_palace' ||
      vfxType === 'smothered_kill' ||
      vfxType === 'stalemate_trap'
    ) {
      for (let i = 0; i < 4; i++) {
        const d = 0.92 + i * 0.11;
        const chain = this.ctx.createOscillator();
        const cGain = this.ctx.createGain();
        chain.type = 'triangle';
        chain.frequency.setValueAtTime(2200 + i * 320, now + d);
        chain.frequency.exponentialRampToValueAtTime(520, now + d + 0.14);
        cGain.gain.setValueAtTime(0.26, now + d);
        cGain.gain.exponentialRampToValueAtTime(0.001, now + d + 0.15);
        chain.connect(cGain);
        cGain.connect(dest);
        chain.start(now + d);
        chain.stop(now + d + 0.16);
      }
      triggerNoiseBurst(1.45, 0.52, 3200, 180, 0.78, 'bandpass');
    } else if (
      vfxType === 'trough_horse' ||
      vfxType === 'octagon_horse' ||
      vfxType === 'fishing_horse' ||
      vfxType === 'side_tiger' ||
      vfxType === 'standing_horse_chariot'
    ) {
      triggerNoiseBurst(1.02, 0.52, 4200, 380, 0.75, 'bandpass');
      const neigh = this.ctx.createOscillator();
      const nGain = this.ctx.createGain();
      neigh.type = 'sawtooth';
      neigh.frequency.setValueAtTime(640, now + 0.96);
      neigh.frequency.linearRampToValueAtTime(1240, now + 1.18);
      neigh.frequency.exponentialRampToValueAtTime(480, now + 1.62);
      nGain.gain.setValueAtTime(0.20, now + 0.96);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 1.65);
      neigh.connect(nGain);
      nGain.connect(dest);
      neigh.start(now + 0.96);
      neigh.stop(now + 1.68);
    } else if (vfxType === 'fishing_horse' || vfxType === 'frost_lotus_strike' || vfxType === 'sea_bottom_moon') {
      // 碧海漩涡与水中捞月浪涌音效
      triggerNoiseBurst(0.72, 0.85, 1800, 320, 0.78, 'bandpass');
      triggerNoiseBurst(1.38, 0.65, 3600, 480, 0.82, 'bandpass');
      [587.33, 880.0, 1174.66, 1760.0].forEach((freq, idx) => {
        const t0 = now + 0.88 + idx * 0.12;
        const chime = this.ctx.createOscillator();
        const cGain = this.ctx.createGain();
        chime.type = 'sine';
        chime.frequency.setValueAtTime(freq, t0);
        chime.frequency.exponentialRampToValueAtTime(freq * 1.02, t0 + 0.45);
        cGain.gain.setValueAtTime(0.16, t0);
        cGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.48);
        chime.connect(cGain);
        cGain.connect(dest);
        chime.start(t0);
        chime.stop(t0 + 0.50);
      });
    } else {
      triggerNoiseBurst(1.08, 0.55, 4800, 340, 0.75, 'bandpass');
    }

    this.playVictorySeal(2.52);
  }
}
