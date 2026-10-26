import { setCanvasSize, shuffle } from './util.js';

const EXPRESSIONS = ['blink', 'smile', 'turn', 'surprise'];

export class FaceSim {
  constructor(canvas, { accent = '#d4a6ff', stage = 0 } = {}) {
    this.canvas = canvas;
    this.accent = accent;
    this.stage = stage;
    this.ctx = null;
    this.width = 0;
    this.height = 0;
    this.running = false;
    this.raf = 0;
    this.lastTime = 0;
    this.time = 0;
    this.current = 'neutral';
    this.previous = 'neutral';
    this.phaseLeft = 0;
    this.sequence = [];
    this.sequenceIndex = 0;
    this.stateChangedAt = 0;
    this.lastTargetAt = -10000;
    this.motes = Array.from({ length: 26 }, () => ({
      x: Math.random(),
      y: Math.random(),
      size: Math.random() * 1.5 + 0.3,
      alpha: Math.random() * 0.18 + 0.03,
    }));
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.canvas.parentElement || this.canvas);
    this.resize();
    this.buildSequence();
    this.loop = this.loop.bind(this);
  }

  setStage(stage) {
    this.stage = stage;
  }

  setAccent(accent) {
    this.accent = accent;
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const { ctx, width, height } = setCanvasSize(this.canvas, rect.width, rect.height);
    this.ctx = ctx;
    this.width = width;
    this.height = height;
    this.render();
  }

  buildSequence() {
    const order = shuffle(EXPRESSIONS);
    const neutral = Math.max(260, 420 - this.stage * 26);
    const expression = Math.max(560, 800 - this.stage * 38);
    const seq = [];
    for (const state of order) {
      seq.push({ state: 'neutral', duration: neutral });
      seq.push({ state, duration: expression });
    }
    seq.push({ state: 'neutral', duration: neutral });
    this.sequence = seq;
    this.sequenceIndex = 0;
    this.phaseLeft = seq[0].duration;
    this.setExpression('neutral', seq[0].duration);
  }

  setExpression(state, duration) {
    if (state !== this.current) {
      this.previous = this.current;
      this.current = state;
      this.stateChangedAt = performance.now();
      if (EXPRESSIONS.includes(state)) this.lastTargetAt = performance.now();
      if (EXPRESSIONS.includes(state)) this.targetGraceUntil = performance.now() + 250;
    }
    this.canvas.dataset.current = state;
    this.phaseLeft = duration;
  }

  matchesTarget(target, grace = 240) {
    return this.current === target || (this.previous === target && performance.now() - this.stateChangedAt < grace);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  destroy() {
    this.stop();
    this.resizeObserver.disconnect();
  }

  loop(now) {
    if (!this.running) return;
    const dt = Math.min(0.06, (now - this.lastTime) / 1000);
    this.lastTime = now;
    this.time += dt;
    this.phaseLeft -= dt * 1000;
    if (this.phaseLeft <= 0) {
      this.sequenceIndex = (this.sequenceIndex + 1) % this.sequence.length;
      if (this.sequenceIndex === 0) this.buildSequence();
      const next = this.sequence[this.sequenceIndex];
      this.setExpression(next.state, next.duration);
    }
    this.render();
    this.raf = requestAnimationFrame(this.loop);
  }

  render() {
    if (!this.ctx) return;
    const { ctx, width: w, height: h } = this;
    const s = Math.min(w, h);
    const state = this.current;
    const cx = w / 2;
    const cy = h * 0.52;
    const bob = Math.sin(this.time * 1.7) * 1.1;
    const breath = Math.sin(this.time * 1.25) * 1.6;
    const tilt = state === 'turn' ? -0.075 : state === 'smile' ? 0.018 : 0;
    const shift = state === 'turn' ? -s * 0.045 : 0;

    this.drawRoom(ctx, w, h, s);
    ctx.save();
    ctx.translate(0, bob);
    this.drawBody(ctx, cx + shift * 0.35, cy, s, breath);
    ctx.translate(cx + shift, cy);
    ctx.rotate(tilt);
    ctx.translate(-(cx + shift), -cy);

    this.drawBackHair(ctx, cx + shift, cy, s);
    this.drawFace(ctx, cx + shift, cy, s, state);
    this.drawHair(ctx, cx + shift, cy, s, state);
    this.drawFeatures(ctx, cx + shift, cy, s, state);
    this.drawLandmarks(ctx, cx + shift, cy, s);
    ctx.restore();

    this.drawNoise(ctx, w, h, s);
    this.drawCameraOverlay(ctx, w, h, s, cx + shift, cy, state);
  }

  drawRoom(ctx, w, h, s) {
    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, '#15211d');
    bg.addColorStop(0.5, '#0a100e');
    bg.addColorStop(1, '#040605');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    const glow = ctx.createRadialGradient(w * 0.25, h * 0.2, 0, w * 0.25, h * 0.2, s * 0.8);
    glow.addColorStop(0, 'rgba(163, 209, 184, 0.12)');
    glow.addColorStop(1, 'rgba(163, 209, 184, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = '#263d35';
    ctx.fillRect(w * 0.06, h * 0.16, s * 0.09, s * 0.28);
    ctx.fillStyle = '#1b2d27';
    ctx.fillRect(w * 0.82, h * 0.08, s * 0.12, s * 0.38);
    ctx.fillRect(w * 0.78, h * 0.4, s * 0.18, s * 0.08);

    const lamp = ctx.createRadialGradient(w * 0.19, h * 0.25, 0, w * 0.19, h * 0.25, s * 0.11);
    lamp.addColorStop(0, 'rgba(232, 211, 150, 0.35)');
    lamp.addColorStop(1, 'rgba(232, 211, 150, 0)');
    ctx.fillStyle = lamp;
    ctx.fillRect(w * 0.08, h * 0.15, s * 0.22, s * 0.22);
    ctx.restore();

    const floor = ctx.createLinearGradient(0, h * 0.72, 0, h);
    floor.addColorStop(0, 'rgba(4, 7, 5, 0)');
    floor.addColorStop(1, 'rgba(1, 2, 1, 0.8)');
    ctx.fillStyle = floor;
    ctx.fillRect(0, h * 0.68, w, h * 0.32);
  }

  drawBody(ctx, cx, cy, s, breath) {
    const shoulderY = cy + s * 0.34 + breath;
    ctx.save();
    const shirt = ctx.createLinearGradient(cx - s * 0.4, shoulderY, cx + s * 0.4, shoulderY + s * 0.4);
    shirt.addColorStop(0, '#1b2721');
    shirt.addColorStop(0.55, '#26352c');
    shirt.addColorStop(1, '#101713');
    ctx.fillStyle = shirt;
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.44, cy + s * 0.64);
    ctx.bezierCurveTo(cx - s * 0.4, cy + s * 0.36, cx - s * 0.2, cy + s * 0.29, cx - s * 0.11, cy + s * 0.28);
    ctx.lineTo(cx + s * 0.11, cy + s * 0.28);
    ctx.bezierCurveTo(cx + s * 0.22, cy + s * 0.29, cx + s * 0.41, cy + s * 0.37, cx + s * 0.44, cy + s * 0.64);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(142, 194, 164, 0.16)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.18, cy + s * 0.33);
    ctx.quadraticCurveTo(cx, cy + s * 0.4, cx + s * 0.18, cy + s * 0.33);
    ctx.stroke();

    const neck = ctx.createLinearGradient(cx, cy + s * 0.17, cx, cy + s * 0.35);
    neck.addColorStop(0, '#bb805e');
    neck.addColorStop(1, '#8f5d43');
    ctx.fillStyle = neck;
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.075, cy + s * 0.17);
    ctx.lineTo(cx + s * 0.075, cy + s * 0.17);
    ctx.lineTo(cx + s * 0.095, cy + s * 0.33);
    ctx.quadraticCurveTo(cx, cy + s * 0.37, cx - s * 0.095, cy + s * 0.33);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawBackHair(ctx, cx, cy, s) {
    ctx.save();
    const hair = ctx.createLinearGradient(cx, cy - s * 0.37, cx, cy + s * 0.26);
    hair.addColorStop(0, '#1f1713');
    hair.addColorStop(0.55, '#2b1e18');
    hair.addColorStop(1, '#120d0b');
    ctx.fillStyle = hair;
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.285, cy - s * 0.01);
    ctx.bezierCurveTo(cx - s * 0.34, cy - s * 0.38, cx + s * 0.28, cy - s * 0.46, cx + s * 0.315, cy - s * 0.06);
    ctx.bezierCurveTo(cx + s * 0.34, cy + s * 0.18, cx + s * 0.27, cy + s * 0.27, cx + s * 0.24, cy + s * 0.2);
    ctx.bezierCurveTo(cx + s * 0.31, cy + s * 0.02, cx + s * 0.22, cy - s * 0.25, cx + s * 0.05, cy - s * 0.27);
    ctx.bezierCurveTo(cx - s * 0.15, cy - s * 0.29, cx - s * 0.28, cy - s * 0.12, cx - s * 0.25, cy + s * 0.17);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawFace(ctx, cx, cy, s, state) {
    ctx.save();
    const skin = ctx.createRadialGradient(cx - s * 0.08, cy - s * 0.12, 0, cx, cy, s * 0.32);
    skin.addColorStop(0, '#ecc09b');
    skin.addColorStop(0.45, '#d8a077');
    skin.addColorStop(0.86, '#b57a58');
    skin.addColorStop(1, '#95613f');
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.245, cy - s * 0.08);
    ctx.bezierCurveTo(cx - s * 0.26, cy + s * 0.17, cx - s * 0.14, cy + s * 0.3, cx, cy + s * 0.31);
    ctx.bezierCurveTo(cx + s * 0.14, cy + s * 0.3, cx + s * 0.26, cy + s * 0.17, cx + s * 0.245, cy - s * 0.08);
    ctx.bezierCurveTo(cx + s * 0.24, cy - s * 0.32, cx - s * 0.24, cy - s * 0.32, cx - s * 0.245, cy - s * 0.08);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#b87c5b';
    ctx.beginPath();
    ctx.ellipse(cx - s * 0.256, cy + s * 0.02, s * 0.036, s * 0.06, -0.06, 0, Math.PI * 2);
    ctx.ellipse(cx + s * 0.256, cy + s * 0.02, s * 0.036, s * 0.06, 0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(81, 42, 31, 0.34)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(cx - s * 0.256, cy + s * 0.02, s * 0.035, s * 0.058, -0.06, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx + s * 0.256, cy + s * 0.02, s * 0.035, s * 0.058, 0.06, 0, Math.PI * 2);
    ctx.stroke();

    // soft shadows under the cheekbones and jaw
    const shadow = ctx.createLinearGradient(cx, cy + s * 0.12, cx, cy + s * 0.31);
    shadow.addColorStop(0, 'rgba(108, 58, 40, 0)');
    shadow.addColorStop(1, 'rgba(108, 58, 40, 0.22)');
    ctx.fillStyle = shadow;
    ctx.beginPath();
    ctx.ellipse(cx, cy + s * 0.19, s * 0.18, s * 0.12, 0, 0, Math.PI);
    ctx.fill();

    if (state === 'smile') {
      ctx.fillStyle = 'rgba(188, 82, 72, 0.15)';
      ctx.beginPath();
      ctx.ellipse(cx - s * 0.145, cy + s * 0.09, s * 0.048, s * 0.03, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + s * 0.145, cy + s * 0.09, s * 0.048, s * 0.03, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawHair(ctx, cx, cy, s, state) {
    ctx.save();
    const hair = ctx.createLinearGradient(cx - s * 0.2, cy - s * 0.36, cx + s * 0.23, cy - s * 0.02);
    hair.addColorStop(0, '#36251c');
    hair.addColorStop(0.6, '#211610');
    hair.addColorStop(1, '#17100c');
    ctx.fillStyle = hair;

    ctx.beginPath();
    ctx.moveTo(cx - s * 0.25, cy - s * 0.13);
    ctx.bezierCurveTo(cx - s * 0.27, cy - s * 0.39, cx + s * 0.25, cy - s * 0.42, cx + s * 0.255, cy - s * 0.12);
    ctx.bezierCurveTo(cx + s * 0.17, cy - s * 0.24, cx + s * 0.06, cy - s * 0.3, cx - s * 0.075, cy - s * 0.27);
    ctx.bezierCurveTo(cx - s * 0.15, cy - s * 0.26, cx - s * 0.21, cy - s * 0.21, cx - s * 0.25, cy - s * 0.13);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx - s * 0.25, cy - s * 0.14);
    ctx.bezierCurveTo(cx - s * 0.25, cy - s * 0.35, cx - s * 0.08, cy - s * 0.41, cx + s * 0.05, cy - s * 0.36);
    ctx.bezierCurveTo(cx - s * 0.01, cy - s * 0.34, cx - s * 0.09, cy - s * 0.25, cx - s * 0.055, cy - s * 0.18);
    ctx.bezierCurveTo(cx - s * 0.1, cy - s * 0.2, cx - s * 0.18, cy - s * 0.17, cx - s * 0.25, cy - s * 0.1);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(175, 121, 85, 0.3)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i += 1) {
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.19 + i * s * 0.038, cy - s * 0.33);
      ctx.quadraticCurveTo(cx - s * 0.14 + i * s * 0.048, cy - s * 0.29, cx - s * 0.16 + i * s * 0.05, cy - s * 0.24);
      ctx.stroke();
    }

    if (state === 'turn') {
      ctx.fillStyle = 'rgba(20, 13, 10, 0.7)';
      ctx.beginPath();
      ctx.ellipse(cx + s * 0.24, cy - s * 0.06, s * 0.04, s * 0.14, 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawFeatures(ctx, cx, cy, s, state) {
    const eyeY = cy - s * 0.055;
    const eyeDx = s * 0.118;
    const browY = cy - s * 0.12;

    ctx.save();
    ctx.strokeStyle = 'rgba(70, 38, 28, 0.72)';
    ctx.lineWidth = Math.max(1, s * 0.006);
    ctx.lineCap = 'round';

    // eyebrows
    ctx.beginPath();
    ctx.moveTo(cx - eyeDx - s * 0.052, browY);
    ctx.quadraticCurveTo(cx - eyeDx, browY - s * 0.022, cx - eyeDx + s * 0.052, browY - s * 0.004);
    ctx.moveTo(cx + eyeDx - s * 0.052, browY - s * 0.004);
    ctx.quadraticCurveTo(cx + eyeDx, browY - s * 0.022, cx + eyeDx + s * 0.052, browY);
    ctx.stroke();

    if (state === 'blink') {
      ctx.strokeStyle = 'rgba(55, 29, 21, 0.9)';
      ctx.lineWidth = Math.max(1.2, s * 0.009);
      ctx.beginPath();
      ctx.moveTo(cx - eyeDx - s * 0.047, eyeY);
      ctx.quadraticCurveTo(cx - eyeDx, eyeY + s * 0.014, cx - eyeDx + s * 0.047, eyeY);
      ctx.moveTo(cx + eyeDx - s * 0.047, eyeY);
      ctx.quadraticCurveTo(cx + eyeDx, eyeY + s * 0.014, cx + eyeDx + s * 0.047, eyeY);
      ctx.stroke();
    } else if (state === 'smile') {
      ctx.strokeStyle = 'rgba(55, 29, 21, 0.9)';
      ctx.lineWidth = Math.max(1.2, s * 0.008);
      ctx.beginPath();
      ctx.moveTo(cx - eyeDx - s * 0.044, eyeY + s * 0.005);
      ctx.quadraticCurveTo(cx - eyeDx, eyeY - s * 0.022, cx - eyeDx + s * 0.044, eyeY + s * 0.005);
      ctx.moveTo(cx + eyeDx - s * 0.044, eyeY + s * 0.005);
      ctx.quadraticCurveTo(cx + eyeDx, eyeY - s * 0.022, cx + eyeDx + s * 0.044, eyeY + s * 0.005);
      ctx.stroke();
    } else {
      const eyeRx = state === 'surprise' ? s * 0.05 : s * 0.044;
      const eyeRy = state === 'surprise' ? s * 0.038 : s * 0.027;
      for (const side of [-1, 1]) {
        const ex = cx + side * eyeDx;
        ctx.fillStyle = '#f1e4d4';
        ctx.beginPath();
        ctx.ellipse(ex, eyeY, eyeRx, eyeRy, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(73, 39, 28, 0.55)';
        ctx.lineWidth = Math.max(0.8, s * 0.004);
        ctx.stroke();

        const pupilShift = state === 'turn' ? -s * 0.012 : Math.sin(this.time * 0.9 + side) * s * 0.003;
        ctx.fillStyle = '#2c1c15';
        ctx.beginPath();
        ctx.arc(ex + pupilShift, eyeY, state === 'surprise' ? s * 0.021 : s * 0.017, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.beginPath();
        ctx.arc(ex + pupilShift - s * 0.005, eyeY - s * 0.006, s * 0.005, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // nose
    ctx.strokeStyle = 'rgba(111, 62, 43, 0.52)';
    ctx.lineWidth = Math.max(0.9, s * 0.0045);
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.014, cy - s * 0.02);
    ctx.quadraticCurveTo(cx - s * 0.022, cy + s * 0.075, cx + s * 0.01, cy + s * 0.085);
    ctx.stroke();
    ctx.fillStyle = 'rgba(111, 62, 43, 0.16)';
    ctx.beginPath();
    ctx.ellipse(cx + s * 0.006, cy + s * 0.09, s * 0.035, s * 0.014, 0, 0, Math.PI * 2);
    ctx.fill();

    const mouthY = cy + s * 0.18;
    if (state === 'smile') {
      ctx.fillStyle = '#6f332f';
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.068, mouthY - s * 0.008);
      ctx.quadraticCurveTo(cx, mouthY + s * 0.065, cx + s * 0.068, mouthY - s * 0.008);
      ctx.quadraticCurveTo(cx, mouthY + s * 0.018, cx - s * 0.068, mouthY - s * 0.008);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(84, 39, 37, 0.8)';
      ctx.lineWidth = Math.max(0.9, s * 0.004);
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.072, mouthY - s * 0.007);
      ctx.quadraticCurveTo(cx, mouthY + s * 0.073, cx + s * 0.072, mouthY - s * 0.007);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 244, 226, 0.64)';
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.045, mouthY + s * 0.014);
      ctx.quadraticCurveTo(cx, mouthY + s * 0.03, cx + s * 0.045, mouthY + s * 0.014);
      ctx.quadraticCurveTo(cx, mouthY + s * 0.024, cx - s * 0.045, mouthY + s * 0.014);
      ctx.fill();
    } else if (state === 'surprise') {
      ctx.fillStyle = '#5d2b2b';
      ctx.beginPath();
      ctx.ellipse(cx, mouthY + s * 0.012, s * 0.033, s * 0.042, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(104, 48, 46, 0.8)';
      ctx.lineWidth = Math.max(0.9, s * 0.004);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 235, 214, 0.35)';
      ctx.beginPath();
      ctx.ellipse(cx, mouthY + s * 0.032, s * 0.016, s * 0.01, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = 'rgba(101, 48, 43, 0.9)';
      ctx.lineWidth = Math.max(1, s * 0.006);
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.057, mouthY);
      ctx.quadraticCurveTo(cx, mouthY + s * 0.018, cx + s * 0.057, mouthY);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255, 220, 196, 0.18)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.028, mouthY + s * 0.007);
      ctx.quadraticCurveTo(cx, mouthY + s * 0.014, cx + s * 0.028, mouthY + s * 0.007);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawLandmarks(ctx, cx, cy, s) {
    const boxW = s * 0.57;
    const boxH = s * 0.69;
    const x = cx - boxW / 2;
    const y = cy - s * 0.35;
    const scan = y + ((this.time * 60) % boxH);
    const accent = this.accent;

    ctx.save();
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.44;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 5]);
    ctx.strokeRect(x, y, boxW, boxH);
    ctx.setLineDash([]);

    const corners = [
      [x, y, 1, 1],
      [x + boxW, y, -1, 1],
      [x, y + boxH, 1, -1],
      [x + boxW, y + boxH, -1, -1],
    ];
    ctx.globalAlpha = 0.95;
    for (const [px, py, dx, dy] of corners) {
      ctx.beginPath();
      ctx.moveTo(px, py + dy * 10);
      ctx.lineTo(px, py);
      ctx.lineTo(px + dx * 10, py);
      ctx.stroke();
    }

    const points = [
      [cx - s * 0.118, cy - s * 0.055],
      [cx + s * 0.118, cy - s * 0.055],
      [cx, cy + s * 0.09],
      [cx, cy + s * 0.18],
    ];
    ctx.globalAlpha = 0.6;
    for (const [px, py] of points) {
      ctx.beginPath();
      ctx.moveTo(px - 3, py);
      ctx.lineTo(px + 3, py);
      ctx.moveTo(px, py - 3);
      ctx.lineTo(px, py + 3);
      ctx.stroke();
    }

    ctx.globalAlpha = 0.36;
    ctx.beginPath();
    ctx.moveTo(x, scan);
    ctx.lineTo(x + boxW, scan);
    ctx.stroke();

    ctx.globalAlpha = 0.75;
    ctx.font = `5px "Space Mono", monospace`;
    ctx.fillStyle = accent;
    ctx.fillText('LIVENESS', x, y - 4);
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(72 + Math.sin(this.time) * 4)}.4%`, x + boxW, y - 4);
    ctx.restore();
  }

  drawNoise(ctx, w, h, s) {
    ctx.save();
    for (const mote of this.motes) {
      ctx.globalAlpha = mote.alpha;
      ctx.fillStyle = '#d7f3e5';
      ctx.fillRect(mote.x * w, mote.y * h, mote.size, mote.size);
    }
    ctx.globalAlpha = 0.035;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 3; i += 1) {
      const y = ((this.time * 25 + i * 93) % h);
      ctx.fillRect(0, y, w, 1);
    }
    ctx.restore();
  }

  drawCameraOverlay(ctx, w, h, s, cx, cy, state) {
    ctx.save();
    ctx.globalAlpha = 0.055;
    ctx.strokeStyle = this.accent;
    ctx.lineWidth = 1;
    const step = s * 0.075;
    for (let x = 0; x < w; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    if (state !== 'neutral') {
      ctx.globalAlpha = 0.22;
      ctx.strokeStyle = this.accent;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.38 + Math.sin(this.time * 4) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}
