export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function rand(min, max) {
  return min + Math.random() * (max - min);
}

export function randInt(min, max) {
  return Math.floor(rand(min, max + 1));
}

export function choice(items) {
  return items[Math.floor(Math.random() * items.length)];
}

export function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function formatScore(score) {
  return Math.max(0, Math.round(score)).toLocaleString('en-US');
}

export function pad(value, length = 2) {
  return String(value).padStart(length, '0');
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function sanitizeAlias(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, 14);
}

export function randomAlias() {
  const suffixes = ['404', '000', 'X', '77', '13', '42'];
  const names = ['SUBJECT', 'APPLICANT', 'ANON', 'UNIT'];
  return `${choice(names)}_${choice(suffixes)}`;
}

export function safeStorage() {
  try {
    const test = '__ragecapcha_test__';
    window.localStorage.setItem(test, '1');
    window.localStorage.removeItem(test);
    return window.localStorage;
  } catch {
    const memory = new Map();
    return {
      getItem: key => (memory.has(key) ? memory.get(key) : null),
      setItem: (key, value) => memory.set(key, String(value)),
      removeItem: key => memory.delete(key),
    };
  }
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeUid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function setCanvasSize(canvas, cssWidth, cssHeight) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  canvas.width = Math.max(1, Math.round(cssWidth * dpr));
  canvas.height = Math.max(1, Math.round(cssHeight * dpr));
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, width: cssWidth, height: cssHeight, dpr };
}

export class Typewriter {
  constructor(container, lines, { speed = 12, linePause = 160, onDone = null } = {}) {
    this.container = container;
    this.lines = lines;
    this.speed = speed;
    this.linePause = linePause;
    this.onDone = onDone;
    this.timer = null;
    this.lineIndex = 0;
    this.charIndex = 0;
    this.nodes = [];
    this.finished = false;
    this.container.innerHTML = '';
    this.container.setAttribute('aria-busy', 'true');

    for (const line of lines) {
      const p = document.createElement('p');
      p.dataset.text = line;
      p.textContent = '';
      this.container.append(p);
      this.nodes.push(p);
    }

    this.cursor = document.createElement('span');
    this.cursor.className = 'cursor';
    this.cursor.setAttribute('aria-hidden', 'true');
    this.nodes[0]?.append(this.cursor);
    this.timer = window.setTimeout(() => this.step(), 180);
  }

  step() {
    if (this.finished) return;
    const line = this.lines[this.lineIndex];
    if (line === undefined) {
      this.finish();
      return;
    }
    const node = this.nodes[this.lineIndex];
    this.charIndex += 1;
    node.textContent = line.slice(0, this.charIndex);
    if (this.cursor.parentNode !== node) node.append(this.cursor);
    node.classList.add('is-visible');

    if (this.charIndex >= line.length) {
      this.lineIndex += 1;
      this.charIndex = 0;
      this.cursor.remove();
      if (this.lineIndex >= this.lines.length) {
        this.finish();
        return;
      }
      const nextNode = this.nodes[this.lineIndex];
      nextNode.append(this.cursor);
      this.timer = window.setTimeout(() => this.step(), this.linePause);
      return;
    }

    const pause = /[.,!?]/.test(line[this.charIndex - 1] || '') ? this.speed * 4 : this.speed;
    this.timer = window.setTimeout(() => this.step(), pause);
  }

  finish() {
    if (this.finished) return;
    this.finished = true;
    window.clearTimeout(this.timer);
    this.nodes.forEach((node, index) => {
      node.textContent = this.lines[index];
      node.classList.add('is-visible');
    });
    this.cursor?.remove();
    this.container.setAttribute('aria-busy', 'false');
    this.onDone?.();
  }

  destroy() {
    this.finished = true;
    window.clearTimeout(this.timer);
    this.cursor?.remove();
  }
}
