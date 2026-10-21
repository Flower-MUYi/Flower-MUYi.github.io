/*************************************************************************
 * WEB AUDIO SYNTHESIZER (No external audio files needed)
 *************************************************************************/
class SoundEffects {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playSelect() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(560, now);
    osc.frequency.exponentialRampToValueAtTime(740, now + 0.045);
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.055);
  }

  playIllegal() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    [0, 0.085].forEach((delay, idx) => {
      const t0 = now + delay;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      const freq = idx === 0 ? 195 : 155;
      osc.frequency.setValueAtTime(freq, t0);
      osc.frequency.exponentialRampToValueAtTime(75, t0 + 0.07);
      gain.gain.setValueAtTime(0.22, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.075);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.08);
    });
  }

  playPickUp(color = 'r', isSubtle = false) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const isRed = color === 'r';
    const volScale = isSubtle ? 0.65 : 1.0;

    const noiseLen = Math.floor(this.ctx.sampleRate * 0.032);
    const noiseBuf = this.ctx.createBuffer(1, noiseLen, this.ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < noiseLen; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.sin((i / noiseLen) * Math.PI);
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuf;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(isRed ? 1650 : 2150, now);
    filter.frequency.exponentialRampToValueAtTime(isRed ? 2600 : 3400, now + 0.03);
    filter.Q.setValueAtTime(3.2, now);

    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.18 * volScale, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.032);
    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.ctx.destination);
    noise.start(now);
    noise.stop(now + 0.035);

    const rimOsc = this.ctx.createOscillator();
    const rimGain = this.ctx.createGain();
    rimOsc.type = 'triangle';
    const startF = isRed ? 390 : 460;
    const endF = isRed ? 680 : 820;
    rimOsc.frequency.setValueAtTime(startF, now);
    rimOsc.frequency.exponentialRampToValueAtTime(endF, now + 0.042);
    rimGain.gain.setValueAtTime(0.16 * volScale, now);
    rimGain.gain.exponentialRampToValueAtTime(0.001, now + 0.048);
    rimOsc.connect(rimGain);
    rimGain.connect(this.ctx.destination);
    rimOsc.start(now);
    rimOsc.stop(now + 0.05);

    const bodyOsc = this.ctx.createOscillator();
    const bodyGain = this.ctx.createGain();
    bodyOsc.type = 'sine';
    bodyOsc.frequency.setValueAtTime(210, now);
    bodyOsc.frequency.exponentialRampToValueAtTime(285, now + 0.038);
    bodyGain.gain.setValueAtTime(0.11 * volScale, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.042);
    bodyOsc.connect(bodyGain);
    bodyGain.connect(this.ctx.destination);
    bodyOsc.start(now);
    bodyOsc.stop(now + 0.045);
  }

  playMove(color = 'r', pieceType = 'p') {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const isRed = color === 'r';
    const isHeavy = pieceType === 'r' || pieceType === 'c' || pieceType === 'k';
    const weightMul = isHeavy ? 1.18 : 1.0;

    const triggerStrike = (delay, intensity, pitchShift = 1.0) => {
      const t0 = now + delay;
      const snapLen = Math.floor(this.ctx.sampleRate * 0.024);
      const snapBuf = this.ctx.createBuffer(1, snapLen, this.ctx.sampleRate);
      const sData = snapBuf.getChannelData(0);
      for (let i = 0; i < snapLen; i++) {
        sData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / snapLen, 1.8);
      }
      const snapNoise = this.ctx.createBufferSource();
      snapNoise.buffer = snapBuf;

      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime((isRed ? 2100 : 2650) * pitchShift, t0);
      bp.Q.setValueAtTime(4.0, t0);

      const snapGain = this.ctx.createGain();
      snapGain.gain.setValueAtTime(0.42 * intensity * weightMul, t0);
      snapGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.022);

      snapNoise.connect(bp);
      bp.connect(snapGain);
      snapGain.connect(this.ctx.destination);
      snapNoise.start(t0);
      snapNoise.stop(t0 + 0.025);

      const woodOsc = this.ctx.createOscillator();
      const woodGain = this.ctx.createGain();
      woodOsc.type = 'triangle';
      const woodFreq = (isRed ? 370 : 410) * pitchShift * (isHeavy ? 0.92 : 1.0);
      woodOsc.frequency.setValueAtTime(woodFreq, t0);
      woodOsc.frequency.exponentialRampToValueAtTime(woodFreq * 0.48, t0 + 0.065);
      woodGain.gain.setValueAtTime(0.34 * intensity * weightMul, t0);
      woodGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.07);
      woodOsc.connect(woodGain);
      woodGain.connect(this.ctx.destination);
      woodOsc.start(t0);
      woodOsc.stop(t0 + 0.075);

      const ringOsc = this.ctx.createOscillator();
      const ringGain = this.ctx.createGain();
      ringOsc.type = 'sine';
      const ringFreq = (isRed ? 1120 : 1480) * pitchShift;
      ringOsc.frequency.setValueAtTime(ringFreq, t0);
      ringOsc.frequency.exponentialRampToValueAtTime(ringFreq * 0.65, t0 + 0.032);
      ringGain.gain.setValueAtTime(0.14 * intensity, t0);
      ringGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.035);
      ringOsc.connect(ringGain);
      ringGain.connect(this.ctx.destination);
      ringOsc.start(t0);
      ringOsc.stop(t0 + 0.038);
    };

    triggerStrike(0, 1.0, 1.0);
    triggerStrike(0.021, 0.48, 1.12);

    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(isHeavy ? 135 : 150, now);
    subOsc.frequency.exponentialRampToValueAtTime(42, now + 0.11);
    subGain.gain.setValueAtTime(0.38 * weightMul, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.115);
    subOsc.connect(subGain);
    subGain.connect(this.ctx.destination);
    subOsc.start(now);
    subOsc.stop(now + 0.12);
  }

  playAttackShatter() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.22);
    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);

    for (let i = 0; i < 5; i++) {
      const delay = i * 0.028;
      const ping = this.ctx.createOscillator();
      const pGain = this.ctx.createGain();
      ping.type = 'sine';
      ping.frequency.setValueAtTime(900 + Math.random() * 1400, now + delay);
      ping.frequency.exponentialRampToValueAtTime(400 + Math.random() * 400, now + delay + 0.12);
      pGain.gain.setValueAtTime(0.1, now + delay);
      pGain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.13);
      ping.connect(pGain);
      pGain.connect(this.ctx.destination);
      ping.start(now + delay);
      ping.stop(now + delay + 0.14);
    }
  }

  playCheck() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const freqs = [440, 554.37, 659.25];
    freqs.forEach((f, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now + idx * 0.06);
      gain.gain.setValueAtTime(0.18, now + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.45);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.46);
    });
  }

  playVictorySeal() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const chord = [220, 329.63, 440, 659.25];
    chord.forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = i === 0 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(f, now + i * 0.04);
      gain.gain.setValueAtTime(i === 0 ? 0.25 : 0.14, now + i * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.1);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + i * 0.04);
      osc.stop(now + 1.15);
    });
  }

  playCheckmateVFXSound(vfxType) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const createNoiseBurst = (startDelay, duration, startFreq, endFreq, peakGain) => {
      const bufferSize = Math.floor(this.ctx.sampleRate * duration);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 0.7);
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(startFreq, now + startDelay);
      filter.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), now + startDelay + duration);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.001, now + startDelay);
      gain.gain.linearRampToValueAtTime(peakGain, now + startDelay + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + startDelay + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      noise.start(now + startDelay);
      noise.stop(now + startDelay + duration);
    };

    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(135, now + 0.15);
    sub.frequency.exponentialRampToValueAtTime(22, now + 1.45);
    subGain.gain.setValueAtTime(0.55, now + 0.15);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
    sub.connect(subGain);
    subGain.connect(this.ctx.destination);
    sub.start(now + 0.15);
    sub.stop(now + 1.55);

    if (vfxType === 'cannon_barrage' || vfxType === 'horse_cannon' || vfxType === 'double_cannon' || vfxType === 'heaven_earth') {
      for (let i = 0; i < 3; i++) {
        const d = i * 0.11;
        const whistle = this.ctx.createOscillator();
        const wGain = this.ctx.createGain();
        whistle.type = 'sine';
        whistle.frequency.setValueAtTime(920 - i * 120, now + d);
        whistle.frequency.exponentialRampToValueAtTime(140, now + d + 0.34);
        wGain.gain.setValueAtTime(0.14, now + d);
        wGain.gain.exponentialRampToValueAtTime(0.001, now + d + 0.35);
        whistle.connect(wGain);
        wGain.connect(this.ctx.destination);
        whistle.start(now + d);
        whistle.stop(now + d + 0.36);
      }
      createNoiseBurst(0.28, 1.35, 1800, 65, 0.65);
    } else if (vfxType === 'double_lightning' || vfxType === 'royal_gaze') {
      createNoiseBurst(0.02, 1.4, 3800, 110, 0.6);
      for (let i = 0; i < 8; i++) {
        const delay = i * 0.065;
        const spark = this.ctx.createOscillator();
        const sGain = this.ctx.createGain();
        spark.type = 'sawtooth';
        spark.frequency.setValueAtTime(2200 - i * 190, now + delay);
        spark.frequency.exponentialRampToValueAtTime(85, now + delay + 0.22);
        sGain.gain.setValueAtTime(0.2, now + delay);
        sGain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.23);
        spark.connect(sGain);
        sGain.connect(this.ctx.destination);
        spark.start(now + delay);
        spark.stop(now + delay + 0.24);
      }
    } else {
      const ringFreqs = [1046.5, 1318.5, 1567.98, 2093.0];
      ringFreqs.forEach((f, idx) => {
        const blade = this.ctx.createOscillator();
        const bGain = this.ctx.createGain();
        blade.type = 'triangle';
        blade.frequency.setValueAtTime(f, now + 0.12);
        blade.frequency.exponentialRampToValueAtTime(f * 0.98, now + 1.2);
        bGain.gain.setValueAtTime(0.12 / (idx + 1), now + 0.12);
        bGain.gain.exponentialRampToValueAtTime(0.001, now + 1.25);
        blade.connect(bGain);
        bGain.connect(this.ctx.destination);
        blade.start(now + 0.12);
        blade.stop(now + 1.3);
      });
      createNoiseBurst(0.16, 1.1, 2400, 80, 0.55);
    }
    this.playVictorySeal();
  }
}