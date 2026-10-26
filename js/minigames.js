import { sound } from './audio.js';
import { FaceSim } from './face.js';
import { CAPTCHA_ALPHABET, FACE_TARGETS } from './data.js';
import {
  choice,
  clamp,
  mulberry32,
  rand,
  randInt,
  setCanvasSize,
  shuffle,
} from './util.js';

export function mountGame(type, host, api) {
  switch (type) {
    case 'text':
      return mountText(host, api);
    case 'image':
      return mountImage(host, api);
    case 'slider':
      return mountSlider(host, api);
    case 'math':
      return mountMath(host, api);
    case 'face':
      return mountFace(host, api);
    default:
      throw new Error(`Unknown CAPTCHA type: ${type}`);
  }
}

/* -------------------------------------------------------------------------- */
/*                                 TEXT CAPTCHA                               */
/* -------------------------------------------------------------------------- */

function randomToken(length) {
  let token = '';
  for (let i = 0; i < length; i += 1) token += choice(CAPTCHA_ALPHABET);
  return token;
}

function mountText(host, api) {
  const length = 5 + Math.min(api.stage, 2);
  const token = randomToken(length);
  const seed = `${randInt(1000, 9999)}-${randInt(100, 999)}`;
  let locked = false;
  let resizeObserver = null;
  let noiseTimer = 0;

  host.innerHTML = `
    <div class="mg mg--text">
      <div class="mg__head">
        <span class="mg__tag">${api.stageMeta.tag}</span>
        <h2>TYPE WHAT<br>YOU SEE.</h2>
        <p class="mg__copy">The characters are distorted, but not as much as your chances. Case sensitivity has been disabled as a courtesy.</p>
      </div>
      <div class="captcha-panel">
        <canvas class="captcha-canvas" id="captcha-canvas" role="img" aria-label="Distorted CAPTCHA text"></canvas>
        <div class="captcha-seed"><span>SEED ${seed}</span><span>NOISE: 87%</span></div>
      </div>
      <form id="text-form" autocomplete="off">
        <div class="text-entry">
          <input type="text" id="text-input" aria-label="Type the CAPTCHA text" maxlength="12" autocapitalize="characters" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="ENTER TEXT">
          <button class="btn" type="submit"><span>SUBMIT</span><b>↵</b></button>
        </div>
      </form>
      <div class="mg__feedback" id="text-feedback">HINT: IT IS PROBABLY LETTERS.</div>
      <div class="mg__actions">
        <span class="mg__status">ATTEMPTS LEFT: 3</span>
        <span class="mg__status">${length} CHARACTERS</span>
      </div>
    </div>
  `;

  const canvas = host.querySelector('#captcha-canvas');
  const form = host.querySelector('#text-form');
  const input = host.querySelector('#text-input');
  const feedback = host.querySelector('#text-feedback');
  canvas.dataset.answer = token;

  const draw = () => {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const { ctx, width, height } = setCanvasSize(canvas, rect.width, rect.height);
    const rng = mulberry32(Number(seed.replace('-', '')));

    ctx.fillStyle = '#0b0d0a';
    ctx.fillRect(0, 0, width, height);

    const wash = ctx.createLinearGradient(0, 0, width, height);
    wash.addColorStop(0, 'rgba(201, 255, 61, 0.055)');
    wash.addColorStop(0.45, 'rgba(255, 255, 255, 0)');
    wash.addColorStop(1, 'rgba(255, 90, 73, 0.04)');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, width, height);

    for (let i = 0; i < 12; i += 1) {
      ctx.strokeStyle = i % 3 === 0 ? 'rgba(201, 255, 61, 0.17)' : 'rgba(233, 228, 212, 0.12)';
      ctx.lineWidth = rng() * 1.2 + 0.3;
      ctx.beginPath();
      const y1 = rng() * height;
      const y2 = rng() * height;
      ctx.moveTo(-10, y1);
      ctx.bezierCurveTo(width * 0.3, rng() * height, width * 0.7, rng() * height, width + 10, y2);
      ctx.stroke();
    }

    for (let i = 0; i < 120; i += 1) {
      ctx.fillStyle = `rgba(233, 228, 212, ${rng() * 0.28})`;
      const size = rng() * 1.8 + 0.4;
      ctx.fillRect(rng() * width, rng() * height, size, size);
    }

    const fontSize = clamp(height * 0.42, 38, 56);
    const usable = width - 42;
    const step = usable / length;
    const chars = token.split('');
    const colors = ['#e9e4d4', '#c9ff3d', '#beb9aa', '#e9e4d4', '#c9ff3d'];

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    chars.forEach((char, index) => {
      const x = 21 + step * (index + 0.5) + (rng() - 0.5) * 7;
      const y = height * 0.54 + (rng() - 0.5) * 20;
      const rotation = (rng() - 0.5) * 0.5;
      const scaleX = 0.8 + rng() * 0.7;
      const scaleY = 0.8 + rng() * 0.35;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.scale(scaleX, scaleY);
      ctx.font = `700 ${fontSize}px "Space Mono", monospace`;
      ctx.fillStyle = colors[index % colors.length];
      ctx.shadowColor = index % 3 === 0 ? 'rgba(201, 255, 61, 0.22)' : 'transparent';
      ctx.shadowBlur = index % 3 === 0 ? 8 : 0;
      ctx.fillText(char, 0, 0);
      ctx.restore();
    });

    ctx.strokeStyle = 'rgba(10, 11, 9, 0.45)';
    for (let i = 0; i < 5; i += 1) {
      ctx.lineWidth = rand(0.5, 1.6);
      ctx.beginPath();
      const y = rand(height * 0.2, height * 0.8);
      ctx.moveTo(0, y);
      ctx.lineTo(width, y + rand(-12, 12));
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(201, 255, 61, 0.55)';
    ctx.lineWidth = 1;
    ctx.strokeRect(7, 7, width - 14, height - 14);
  };

  resizeObserver = new ResizeObserver(draw);
  resizeObserver.observe(canvas);
  draw();

  const setError = message => {
    feedback.textContent = message;
    feedback.classList.add('is-error');
    feedback.classList.remove('is-good');
  };

  form.addEventListener('submit', event => {
    event.preventDefault();
    if (locked) return;
    const answer = input.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!answer) {
      setError('TRANSCRIPTION REQUIRED. THE MACHINE IS NOT IMPRESSED.');
      input.focus();
      sound.wrong();
      return;
    }
    if (answer === token) {
      locked = true;
      input.disabled = true;
      form.querySelector('button').disabled = true;
      feedback.textContent = 'TRANSCRIPTION ACCEPTED. THIS WAS PROBABLY YOU.';
      feedback.classList.remove('is-error');
      feedback.classList.add('is-good');
      sound.correct();
      api.success();
    } else {
      input.value = '';
      input.focus();
      sound.strike();
      setError('TRANSCRIPTION MISMATCH. TRUST DAMAGED.');
      feedback.closest('.mg')?.classList.add('is-hit');
      const active = api.strike('TRANSCRIPTION MISMATCH');
      const panel = host.querySelector('.captcha-panel');
      panel?.classList.add('is-error');
      window.setTimeout(() => panel?.classList.remove('is-error'), 420);
      if (!active) locked = true;
      else {
        noiseTimer = window.setTimeout(() => {
          if (!locked) setError('TRY AGAIN. THE LETTERS HAVE NOT MOVED. YET.');
        }, 900);
      }
    }
  });

  input.addEventListener('input', () => {
    input.value = input.value.toUpperCase();
    sound.key();
    if (!feedback.classList.contains('is-error')) {
      feedback.textContent = 'HINT: IT IS PROBABLY LETTERS.';
    }
  });

  return () => {
    window.clearTimeout(noiseTimer);
    resizeObserver?.disconnect();
    locked = true;
  };
}

/* -------------------------------------------------------------------------- */
/*                                IMAGE CAPTCHA                               */
/* -------------------------------------------------------------------------- */

const DECOY_TYPES = ['pedestrian', 'bus', 'hydrant', 'bicycle', 'mailbox', 'cone', 'streetlamp'];

function objectMarkup(type, x, y, scale, rotation) {
  let body = '';
  switch (type) {
    case 'traffic':
      body = `
        <ellipse cx="0" cy="36" rx="15" ry="3.6" fill="rgba(0,0,0,.4)"/>
        <rect x="-1.8" y="4" width="3.6" height="33" fill="#2b302a"/>
        <rect x="-12.5" y="-32" width="25" height="3.5" rx="1" fill="#141813"/>
        <rect x="-10.5" y="-29" width="21" height="34" rx="3.5" fill="#151a14" stroke="#6f7567" stroke-width="1"/>
        <path d="M-12 -29h24l-1.8-4h-20.4z" fill="#0b0d0a"/>
        <circle cx="0" cy="-22" r="7.8" fill="rgba(255,73,58,.17)"/>
        <circle cx="0" cy="-22" r="4.5" fill="#ff4b3b"/>
        <circle cx="0" cy="-11" r="7.8" fill="rgba(255,184,61,.12)"/>
        <circle cx="0" cy="-11" r="4.5" fill="#4b4630"/>
        <circle cx="0" cy="0" r="7.8" fill="rgba(107,255,124,.13)"/>
        <circle cx="0" cy="0" r="4.5" fill="#2d4630"/>
        <rect x="-6.5" y="-25.5" width="13" height="1.2" fill="#0a0c09" opacity=".7"/>
        <rect x="-8.5" y="-6" width="17" height="2" fill="#3a4037"/>
      `;
      break;
    case 'pedestrian':
      body = `
        <ellipse cx="0" cy="35" rx="11" ry="3" fill="rgba(0,0,0,.38)"/>
        <rect x="-1.5" y="7" width="3" height="28" fill="#31362f"/>
        <rect x="-8" y="-22" width="16" height="32" rx="2.5" fill="#141914" stroke="#656b5f" stroke-width="1"/>
        <rect x="-6" y="-19.5" width="12" height="27" rx="1" fill="#0a0d0a"/>
        <circle cx="0" cy="-11" r="4.5" fill="rgba(255,174,60,.28)"/>
        <path d="M0 -15v8M0 -11l-4 3M0 -7l-3 5M0 -7l4 5M0 -15l4 2M0 -15l-4 2" stroke="#ffb347" stroke-width="1.4" stroke-linecap="round" fill="none"/>
      `;
      break;
    case 'bus':
      body = `
        <ellipse cx="0" cy="17" rx="28" ry="4" fill="rgba(0,0,0,.4)"/>
        <rect x="-25" y="-16" width="50" height="27" rx="3" fill="#d9a72d" stroke="#7a5f1f" stroke-width="1"/>
        <rect x="-21" y="-12" width="20" height="10" rx="1" fill="#263d38"/>
        <rect x="2" y="-12" width="18" height="10" rx="1" fill="#263d38"/>
        <rect x="-21" y="-2" width="42" height="2" fill="#f3d071" opacity=".65"/>
        <rect x="-9" y="-16" width="3" height="27" fill="#8d6b21" opacity=".5"/>
        <circle cx="-15" cy="12" r="5" fill="#171b17"/>
        <circle cx="15" cy="12" r="5" fill="#171b17"/>
        <circle cx="-15" cy="12" r="2" fill="#5b6259"/>
        <circle cx="15" cy="12" r="2" fill="#5b6259"/>
      `;
      break;
    case 'hydrant':
      body = `
        <ellipse cx="0" cy="15" rx="12" ry="3" fill="rgba(0,0,0,.4)"/>
        <path d="M-8 12V-9c0-4 3-7 8-7s8 3 8 7v21z" fill="#b53a2d" stroke="#6e1f19" stroke-width="1"/>
        <rect x="-12" y="-1" width="24" height="5" rx="2" fill="#d14c3a"/>
        <rect x="-5" y="-18" width="10" height="4" rx="2" fill="#8f2a20"/>
        <circle cx="0" cy="-20" r="3" fill="#d14c3a"/>
        <circle cx="0" cy="16" r="7" fill="#211812" opacity=".6"/>
      `;
      break;
    case 'bicycle':
      body = `
        <ellipse cx="0" cy="16" rx="22" ry="3" fill="rgba(0,0,0,.35)"/>
        <circle cx="-11" cy="5" r="9" fill="none" stroke="#d5ded2" stroke-width="1.8"/>
        <circle cx="11" cy="5" r="9" fill="none" stroke="#d5ded2" stroke-width="1.8"/>
        <path d="M-11 5l6-10h10l6 10M-5 -5l5 10h11M6 -5h9M-3 -10h7" fill="none" stroke="#88978a" stroke-width="1.6" stroke-linecap="round"/>
        <path d="M1 -16h5" stroke="#d5ded2" stroke-width="2"/>
      `;
      break;
    case 'mailbox':
      body = `
        <ellipse cx="0" cy="17" rx="14" ry="3" fill="rgba(0,0,0,.4)"/>
        <rect x="-2" y="5" width="4" height="13" fill="#2b2e28"/>
        <rect x="-10" y="-13" width="20" height="20" rx="3" fill="#2f5d78" stroke="#1c394a" stroke-width="1"/>
        <rect x="-6" y="-8" width="12" height="2" fill="#0c1418"/>
        <path d="M-10 -13h20l-4 -5h-12z" fill="#3e7795"/>
      `;
      break;
    case 'cone':
      body = `
        <ellipse cx="0" cy="14" rx="10" ry="2.8" fill="rgba(0,0,0,.35)"/>
        <path d="M-7 12L-2 -14h4L7 12z" fill="#e16631" stroke="#7c2f15" stroke-width="1"/>
        <path d="M-5.5 4h11M-3.5 -5h7" stroke="#f4e8d2" stroke-width="3"/>
        <rect x="-9" y="11" width="18" height="3" fill="#c65022"/>
      `;
      break;
    case 'streetlamp':
      body = `
        <ellipse cx="0" cy="36" rx="12" ry="3" fill="rgba(0,0,0,.36)"/>
        <rect x="-1.6" y="-13" width="3.2" height="49" fill="#30362e"/>
        <path d="M0 -13q0 -13 12 -13h3" fill="none" stroke="#444c41" stroke-width="2.6"/>
        <path d="M11 -26h9l3 7h-15z" fill="#b8ae8b"/>
        <circle cx="15" cy="-21" r="6" fill="rgba(255,219,143,.2)"/>
        <circle cx="15" cy="-21" r="2.3" fill="#ffe2a2"/>
      `;
      break;
    default:
      break;
  }
  return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${scale.toFixed(2)}) rotate(${rotation.toFixed(1)})">${body}</g>`;
}

function tileSvg(uid, isTarget, seed, decoyType, targetType) {
  const rng = mulberry32(seed);
  const palettes = [
    { sky: ['#778c7c', '#d0b174'], building: ['#34423c', '#26312c', '#3c4a42'], lit: '#f2ca7e', road: '#282e28' },
    { sky: ['#6e8196', '#c89a74'], building: ['#3b4246', '#2b3236', '#4a5052'], lit: '#f0b76c', road: '#2b2e2e' },
    { sky: ['#9c876d', '#d8b17d'], building: ['#41433c', '#30332e', '#4b4c40'], lit: '#f5d38f', road: '#2c2c26' },
    { sky: ['#657f7d', '#b2a17f'], building: ['#2f3b39', '#222c2b', '#3c4743'], lit: '#e7d29a', road: '#242926' },
  ];
  const p = palettes[Math.floor(rng() * palettes.length)];
  const horizon = 68 + rng() * 16;
  const moonX = 20 + rng() * 80;
  const moonY = 14 + rng() * 22;

  let markup = `
    <svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="sky${uid}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${p.sky[0]}"/><stop offset="1" stop-color="${p.sky[1]}"/>
        </linearGradient>
        <linearGradient id="road${uid}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${p.road}"/><stop offset="1" stop-color="#151915"/>
        </linearGradient>
        <radialGradient id="vignette${uid}" cx="50%" cy="45%" r="70%">
          <stop offset="45%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity=".48"/>
        </radialGradient>
        <filter id="grain${uid}">
          <feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="2" stitchTiles="stitch"/>
          <feColorMatrix type="saturate" values="0"/>
        </filter>
      </defs>
      <rect width="120" height="120" fill="url(#sky${uid})"/>
      <circle cx="${moonX.toFixed(1)}" cy="${moonY.toFixed(1)}" r="8.5" fill="#f1d9a1" opacity=".42"/>
      <circle cx="${moonX.toFixed(1)}" cy="${moonY.toFixed(1)}" r="18" fill="#f1d9a1" opacity=".05"/>
      <path d="M0 ${horizon.toFixed(1)}h120" stroke="rgba(20,25,21,.22)" stroke-width="1"/>
  `;

  let cursor = -8;
  while (cursor < 126) {
    const w = 12 + rng() * 24;
    const h = 14 + rng() * 48;
    const top = horizon - h;
    const color = p.building[Math.floor(rng() * p.building.length)];
    markup += `<rect x="${cursor.toFixed(1)}" y="${top.toFixed(1)}" width="${w.toFixed(1)}" height="${(h + 1).toFixed(1)}" fill="${color}"/>`;
    const cols = Math.max(1, Math.floor(w / 7));
    const rows = Math.max(1, Math.floor(h / 9));
    for (let cx = 0; cx < cols; cx += 1) {
      for (let ry = 0; ry < rows; ry += 1) {
        if (rng() > 0.56) {
          const lit = rng() > 0.48 ? p.lit : '#6d7667';
          markup += `<rect x="${(cursor + 3 + cx * 7).toFixed(1)}" y="${(top + 5 + ry * 9).toFixed(1)}" width="2.4" height="3.2" fill="${lit}" opacity="${(0.25 + rng() * 0.5).toFixed(2)}"/>`;
        }
      }
    }
    if (rng() > 0.6) {
      markup += `<rect x="${(cursor + w / 2).toFixed(1)}" y="${(top - 6).toFixed(1)}" width="1" height="6" fill="${color}"/><circle cx="${(cursor + w / 2).toFixed(1)}" cy="${(top - 7).toFixed(1)}" r="1" fill="#ff6b52"/>`;
    }
    cursor += w + 2 + rng() * 4;
  }

  markup += `
      <rect y="${horizon.toFixed(1)}" width="120" height="${(120 - horizon).toFixed(1)}" fill="url(#road${uid})"/>
      <path d="M0 ${(horizon + 7).toFixed(1)}h120" stroke="rgba(10,13,11,.45)" stroke-width="1"/>
      <path d="M-10 ${(horizon + 26).toFixed(1)}L130 ${(horizon + 21).toFixed(1)}" stroke="rgba(225,212,176,.12)" stroke-width="1"/>
      <path d="M6 ${(horizon + 3).toFixed(1)}h7M39 ${(horizon + 3).toFixed(1)}h5M84 ${(horizon + 3).toFixed(1)}h8" stroke="rgba(230,211,160,.2)" stroke-width="1"/>
  `;

  if (rng() > 0.64) {
    markup += `<path d="M${(10 + rng() * 18).toFixed(1)} ${horizon.toFixed(1)}l-3-17 3-9 3 9z" fill="rgba(20,33,26,.68)"/><path d="M${(10 + rng() * 18).toFixed(1)} ${(horizon - 20).toFixed(1)}l-8 9h16z" fill="rgba(20,33,26,.58)"/>`;
  }

  if (isTarget) {
    const tx = 43 + rng() * 30;
    const ty = 82 + rng() * 18;
    const scale = 0.92 + rng() * 0.28;
    markup += objectMarkup(targetType, tx, ty, scale, rng() * 8 - 4);
    if (rng() > 0.4) {
      const x = rng() > 0.5 ? 12 + rng() * 14 : 94 + rng() * 16;
      markup += objectMarkup(decoyType, x, 102 + rng() * 8, 0.55 + rng() * 0.2, rng() * 14 - 7);
    }
  } else {
    const count = rng() > 0.55 ? 2 : 1;
    for (let i = 0; i < count; i += 1) {
      const x = 17 + rng() * 86;
      const y = 88 + rng() * 20;
      markup += objectMarkup(i === 0 ? decoyType : choice(DECOY_TYPES), x, y, 0.56 + rng() * 0.3, rng() * 16 - 8);
    }
  }

  markup += `
      <rect width="120" height="120" fill="url(#vignette${uid})"/>
      <rect width="120" height="120" filter="url(#grain${uid})" opacity=".1" style="mix-blend-mode:overlay"/>
    </svg>
  `;
  return markup;
}

function mountImage(host, api) {
  const targetType = 'traffic';
  const targetCount = 4;
  const indices = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  const targetIndices = new Set(indices.slice(0, targetCount));
  const selected = new Set();
  let locked = false;
  let resetTimer = 0;

  const targetIcon = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true">
      <rect x="7" y="3" width="10" height="16" rx="2"/><circle cx="12" cy="7" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="11" r="1.2"/><circle cx="12" cy="15" r="1.2"/><path d="M12 19v3"/>
    </svg>
  `;

  host.innerHTML = `
    <div class="mg mg--image">
      <div class="mg__head">
        <span class="mg__tag">${api.stageMeta.tag}</span>
        <h2>SELECT ALL<br><em>TRAFFIC LIGHTS.</em></h2>
        <p class="mg__copy">Nine photographs. Four traffic lights. One of them believes it is a pedestrian signal. Choose correctly.</p>
      </div>
      <div class="image-prompt">${targetIcon}<span>SELECT EVERY SQUARE CONTAINING A <b>TRAFFIC LIGHT</b>. INCLUDING THE DAMAGED ONES.</span></div>
      <div class="image-board" id="image-board"></div>
      <div class="mg__feedback" id="image-feedback">0 OF 4 SELECTED. PROBABLY.</div>
      <div class="mg__actions">
        <span class="mg__status" id="image-count">0 SELECTED</span>
        <button class="btn" type="button" id="image-verify" disabled><span>VERIFY</span><b>→</b></button>
      </div>
    </div>
  `;

  const board = host.querySelector('#image-board');
  const feedback = host.querySelector('#image-feedback');
  const countLabel = host.querySelector('#image-count');
  const verify = host.querySelector('#image-verify');

  board.innerHTML = Array.from({ length: 9 }, (_, index) => {
    const isTarget = targetIndices.has(index);
    const seed = randInt(1000, 999999) + index * 137;
    const decoy = choice(DECOY_TYPES);
    return `
      <button type="button" class="img-tile" aria-pressed="false" aria-label="Image tile ${index + 1}" data-index="${index}" data-target="${isTarget}">
        ${tileSvg(`${seed}${index}`, isTarget, seed, decoy, targetType)}
      </button>
    `;
  }).join('');
  board.dataset.targets = targetCount;

  const update = () => {
    countLabel.textContent = `${selected.size} SELECTED`;
    verify.disabled = selected.size === 0 || locked;
    feedback.classList.remove('is-error', 'is-good');
    feedback.textContent = selected.size === targetCount
      ? 'FOUR SELECTED. THE MACHINE IS SUSPICIOUSLY IMPRESSED.'
      : `${selected.size} OF ${targetCount} SELECTED. PROBABLY.`;
  };

  board.addEventListener('click', event => {
    const tile = event.target.closest('.img-tile');
    if (!tile || locked) return;
    const index = Number(tile.dataset.index);
    if (selected.has(index)) selected.delete(index);
    else selected.add(index);
    tile.setAttribute('aria-pressed', String(selected.has(index)));
    sound.click();
    update();
  });

  verify.addEventListener('click', () => {
    if (locked) return;
    const correct = selected.size === targetIndices.size
      && [...selected].every(index => targetIndices.has(index));
    if (correct) {
      locked = true;
      verify.disabled = true;
      feedback.textContent = 'CLASSIFICATION ACCEPTED. FOUR FOR FOUR.';
      feedback.classList.add('is-good');
      sound.correct();
      api.success();
      return;
    }

    sound.strike();
    board.classList.add('is-error');
    feedback.textContent = 'CLASSIFICATION ERROR. TRUST DAMAGED. REVIEW YOUR CHOICES.';
    feedback.classList.add('is-error');
    selected.forEach(index => {
      const tile = board.querySelector(`[data-index="${index}"]`);
      tile?.classList.add('is-wrong');
    });
    window.clearTimeout(resetTimer);
    resetTimer = window.setTimeout(() => {
      board.classList.remove('is-error');
      board.querySelectorAll('.is-wrong').forEach(tile => tile.classList.remove('is-wrong'));
    }, 420);
    const active = api.strike('IMAGE CLASSIFICATION ERROR');
    if (!active) locked = true;
  });

  update();

  return () => {
    locked = true;
    window.clearTimeout(resetTimer);
  };
}

/* -------------------------------------------------------------------------- */
/*                               SLIDER CAPTCHA                               */
/* -------------------------------------------------------------------------- */

function jigsawPath(ctx, x, y, size) {
  const tab = size * 0.19;
  const s = size;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + s * 0.36, y);
  ctx.bezierCurveTo(x + s * 0.33, y + tab, x + s * 0.49, y + tab, x + s * 0.46, y);
  ctx.lineTo(x + s, y);
  ctx.lineTo(x + s, y + s * 0.36);
  ctx.bezierCurveTo(x + s + tab, y + s * 0.33, x + s + tab, y + s * 0.55, x + s, y + s * 0.52);
  ctx.lineTo(x + s, y + s);
  ctx.lineTo(x + s * 0.6, y + s);
  ctx.bezierCurveTo(x + s * 0.57, y + s + tab, x + s * 0.41, y + s + tab, x + s * 0.44, y + s);
  ctx.lineTo(x, y + s);
  ctx.lineTo(x, y + s * 0.56);
  ctx.bezierCurveTo(x - tab, y + s * 0.53, x - tab, y + s * 0.31, x, y + s * 0.34);
  ctx.closePath();
}

function drawSliderScene(ctx, w, h) {
  const horizon = h * 0.58;

  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, '#0a252a');
  sky.addColorStop(0.55, '#1d4a48');
  sky.addColorStop(1, '#d19b70');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  const sunX = w * 0.22;
  const sunY = h * 0.26;
  const sunGlow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, w * 0.2);
  sunGlow.addColorStop(0, 'rgba(255, 225, 163, 0.65)');
  sunGlow.addColorStop(0.18, 'rgba(255, 203, 128, 0.28)');
  sunGlow.addColorStop(1, 'rgba(255, 203, 128, 0)');
  ctx.fillStyle = sunGlow;
  ctx.fillRect(0, 0, w, h * 0.7);
  ctx.fillStyle = '#f6dda4';
  ctx.beginPath();
  ctx.arc(sunX, sunY, w * 0.045, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#143837';
  ctx.beginPath();
  ctx.moveTo(0, horizon);
  ctx.lineTo(0, horizon * 0.64);
  ctx.lineTo(w * 0.09, horizon * 0.44);
  ctx.lineTo(w * 0.16, horizon * 0.63);
  ctx.lineTo(w * 0.25, horizon * 0.32);
  ctx.lineTo(w * 0.36, horizon * 0.68);
  ctx.lineTo(w * 0.45, horizon * 0.5);
  ctx.lineTo(w * 0.55, horizon * 0.71);
  ctx.lineTo(w * 0.66, horizon * 0.35);
  ctx.lineTo(w * 0.77, horizon * 0.66);
  ctx.lineTo(w * 0.87, horizon * 0.46);
  ctx.lineTo(w, horizon * 0.6);
  ctx.lineTo(w, horizon);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#0f2b2c';
  ctx.beginPath();
  ctx.moveTo(0, horizon);
  ctx.lineTo(0, horizon * 0.85);
  ctx.lineTo(w * 0.15, horizon * 0.68);
  ctx.lineTo(w * 0.27, horizon * 0.88);
  ctx.lineTo(w * 0.4, horizon * 0.7);
  ctx.lineTo(w * 0.54, horizon * 0.9);
  ctx.lineTo(w * 0.68, horizon * 0.68);
  ctx.lineTo(w * 0.83, horizon * 0.87);
  ctx.lineTo(w, horizon * 0.7);
  ctx.lineTo(w, horizon);
  ctx.closePath();
  ctx.fill();

  const water = ctx.createLinearGradient(0, horizon, 0, h);
  water.addColorStop(0, '#071a1c');
  water.addColorStop(0.6, '#061112');
  water.addColorStop(1, '#030707');
  ctx.fillStyle = water;
  ctx.fillRect(0, horizon, w, h - horizon);

  ctx.strokeStyle = 'rgba(238, 191, 126, 0.18)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 12; i += 1) {
    const y = horizon + 8 + i * (h - horizon) / 14;
    ctx.beginPath();
    const spread = 10 + i * 1.2;
    const offset = Math.sin(i * 1.7) * 12;
    ctx.moveTo(sunX - spread + offset, y);
    ctx.lineTo(sunX + spread + offset, y);
    ctx.stroke();
  }

  // bridge silhouette
  const deckY = h * 0.69;
  ctx.strokeStyle = '#080f0e';
  ctx.fillStyle = '#080f0e';
  ctx.lineWidth = Math.max(3, h * 0.022);
  ctx.beginPath();
  ctx.moveTo(-w * 0.02, deckY);
  ctx.quadraticCurveTo(w * 0.5, deckY - h * 0.04, w * 1.02, deckY);
  ctx.stroke();

  ctx.lineWidth = Math.max(1.2, h * 0.008);
  ctx.strokeStyle = '#0a1614';
  const cableY = h * 0.36;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.46);
  ctx.quadraticCurveTo(w * 0.5, cableY, w, h * 0.46);
  ctx.stroke();

  for (let i = 1; i < 16; i += 1) {
    const x = (w / 16) * i;
    const y = h * 0.46 - Math.sin((i / 16) * Math.PI) * (h * 0.1);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, deckY - Math.sin((i / 16) * Math.PI) * h * 0.015);
    ctx.stroke();
  }

  ctx.fillStyle = '#091412';
  ctx.fillRect(w * 0.46, h * 0.29, w * 0.025, deckY - h * 0.29);
  ctx.fillRect(w * 0.71, h * 0.35, w * 0.018, deckY - h * 0.35);

  // tiny human silhouette on the bridge
  ctx.fillStyle = '#050a09';
  const px = w * 0.54;
  const py = deckY - h * 0.012;
  ctx.beginPath();
  ctx.arc(px, py - h * 0.048, h * 0.012, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(px - h * 0.008, py - h * 0.036, h * 0.016, h * 0.037);

  ctx.strokeStyle = 'rgba(240, 210, 158, 0.16)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.44);
  ctx.lineTo(w, h * 0.3);
  ctx.stroke();

  // film grain
  const grain = mulberry32(7781);
  ctx.fillStyle = 'rgba(235, 220, 191, 0.1)';
  for (let i = 0; i < 90; i += 1) {
    ctx.fillRect(grain() * w, grain() * h, 1, 1);
  }
}

function mountSlider(host, api) {
  const targetPercent = rand(57, 69);
  const tolerance = 8;
  let locked = false;
  let piecePercent = clamp(targetPercent - rand(19, 30), 8, 90);
  let resizeObserver = null;
  let canvas = null;
  let range = null;
  let offsetLabel = null;
  let feedback = null;
  let targetX = 0;
  let targetY = 0;
  let pieceSize = 0;
  let canvasW = 0;
  let canvasH = 0;
  let ctx = null;

  host.innerHTML = `
    <div class="mg mg--slider">
      <div class="mg__head">
        <span class="mg__tag">${api.stageMeta.tag}</span>
        <h2>REBUILD THE<br>BROKEN BRIDGE.</h2>
        <p class="mg__copy">Drag the fragment until it fits. The system cannot verify humanity, but it can verify geometry.</p>
      </div>
      <div class="slider-wrap" id="slider-wrap">
        <canvas class="slider-canvas" id="slider-canvas" role="img" aria-label="Broken bridge with a movable puzzle fragment"></canvas>
        <div class="slider-control">
          <span>←</span>
          <input class="slider-range" id="slider-range" type="range" min="0" max="1000" value="${Math.round(piecePercent * 10)}" step="1" aria-label="Align the broken bridge fragment">
          <span>→</span>
        </div>
        <div class="slider-meta"><span>ALIGNMENT</span><b id="slider-offset">OFFSET 000 PX</b></div>
      </div>
      <div class="mg__feedback" id="slider-feedback">TOLERANCE: ${tolerance} PX. THE MACHINE HAS VERY STEADY HANDS.</div>
      <div class="mg__actions">
        <span class="mg__status">DRAG THE FRAGMENT</span>
        <button class="btn" type="button" id="slider-verify"><span>LOCK IN</span><b>→</b></button>
      </div>
    </div>
  `;

  canvas = host.querySelector('#slider-canvas');
  range = host.querySelector('#slider-range');
  offsetLabel = host.querySelector('#slider-offset');
  feedback = host.querySelector('#slider-feedback');
  canvas.dataset.target = String(targetPercent);

  const draw = () => {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const size = setCanvasSize(canvas, rect.width, rect.height);
    ctx = size.ctx;
    canvasW = size.width;
    canvasH = size.height;
    const w = canvasW;
    const h = canvasH;
    targetX = (targetPercent / 100) * w;
    targetY = h * 0.34;
    pieceSize = Math.min(w * 0.28, h * 0.43);
    const pieceX = (piecePercent / 100) * w;
    const diff = Math.abs(piecePercent - targetPercent) / 100 * w;
    const aligned = diff <= tolerance;

    drawSliderScene(ctx, w, h);

    // darkened missing piece
    jigsawPath(ctx, targetX, targetY, pieceSize);
    ctx.save();
    ctx.fillStyle = 'rgba(1, 4, 4, 0.72)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(100, 232, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.restore();

    // target corner markers
    ctx.save();
    ctx.strokeStyle = aligned ? '#c9ff3d' : '#64e8ff';
    ctx.globalAlpha = 0.8;
    ctx.lineWidth = 1.2;
    const mark = 9;
    const corners = [
      [targetX, targetY, 1, 1],
      [targetX + pieceSize, targetY, -1, 1],
      [targetX, targetY + pieceSize, 1, -1],
      [targetX + pieceSize, targetY + pieceSize, -1, -1],
    ];
    for (const [x, y, dx, dy] of corners) {
      ctx.beginPath();
      ctx.moveTo(x, y + dy * mark);
      ctx.lineTo(x, y);
      ctx.lineTo(x + dx * mark, y);
      ctx.stroke();
    }
    ctx.restore();

    // the movable piece
    const offset = pieceX - targetX;
    ctx.save();
    ctx.translate(offset, 0);
    jigsawPath(ctx, targetX, targetY, pieceSize);
    ctx.save();
    ctx.clip();
    drawSliderScene(ctx, w, h);
    ctx.restore();
    ctx.strokeStyle = aligned ? '#c9ff3d' : 'rgba(233, 228, 212, 0.9)';
    ctx.lineWidth = aligned ? 2 : 1.2;
    ctx.shadowColor = aligned ? 'rgba(201, 255, 61, 0.65)' : 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = aligned ? 12 : 5;
    jigsawPath(ctx, targetX, targetY, pieceSize);
    ctx.stroke();
    ctx.restore();

    // grip marks inside the piece
    ctx.save();
    ctx.strokeStyle = 'rgba(233, 228, 212, 0.3)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.moveTo(pieceX - 5 + i * 3, targetY + pieceSize + 10);
      ctx.lineTo(pieceX - 5 + i * 3, targetY + pieceSize + 15);
      ctx.stroke();
    }
    ctx.restore();

    offsetLabel.textContent = aligned ? 'ALIGNED' : `OFFSET ${String(Math.round(diff)).padStart(3, '0')} PX`;
    offsetLabel.style.color = aligned ? '#c9ff3d' : '';
    host.querySelector('.slider-wrap')?.classList.toggle('is-aligned', aligned);
  };

  resizeObserver = new ResizeObserver(draw);
  resizeObserver.observe(canvas);
  draw();

  range.addEventListener('input', () => {
    if (locked) return;
    piecePercent = Number(range.value) / 10;
    sound.key();
    draw();
  });

  host.querySelector('#slider-verify').addEventListener('click', () => {
    if (locked) return;
    const diff = Math.abs(piecePercent - targetPercent) / 100 * canvasW;
    if (diff <= tolerance) {
      locked = true;
      range.disabled = true;
      piecePercent = targetPercent;
      range.value = String(Math.round(piecePercent * 10));
      draw();
      feedback.textContent = 'ALIGNMENT ACCEPTED. THE BRIDGE IS WHOLE. PROBABLY.';
      feedback.classList.add('is-good');
      sound.correct();
      api.success();
    } else {
      sound.strike();
      feedback.textContent = `MISALIGNED BY ${Math.round(diff)} PX. TRUST DAMAGED.`;
      feedback.classList.add('is-error');
      const wrap = host.querySelector('.slider-wrap');
      wrap.classList.add('is-error');
      window.setTimeout(() => wrap.classList.remove('is-error'), 420);
      const active = api.strike('SPATIAL ALIGNMENT ERROR');
      if (!active) locked = true;
    }
  });

  return () => {
    locked = true;
    resizeObserver?.disconnect();
  };
}

/* -------------------------------------------------------------------------- */
/*                                 MATH CAPTCHA                               */
/* -------------------------------------------------------------------------- */

function makeMathProblem(stage) {
  const a = randInt(6, 16);
  const b = randInt(3, 9);
  const c = randInt(3, 8);
  const d = randInt(2, 9);
  if (stage <= 0) {
    return { expression: `${a} + ${b}`, answer: a + b };
  }
  if (stage === 1) {
    return { expression: `${a} + ${b} − ${c}`, answer: a + b - c };
  }
  if (stage === 2) {
    return { expression: `${a} × ${b} + ${c}`, answer: a * b + c };
  }
  if (stage === 3) {
    return { expression: `(${a} + ${b}) × ${c}`, answer: (a + b) * c };
  }
  return { expression: `${a} × ${b} − ${c} × ${d}`, answer: a * b - c * d };
}

function mountMath(host, api) {
  const problem = makeMathProblem(api.stage);
  let answer = '';
  let locked = false;
  let shakeTimer = 0;

  host.innerHTML = `
    <div class="mg mg--math">
      <div class="mg__head">
        <span class="mg__tag">${api.stageMeta.tag}</span>
        <h2>DO THE<br>ARITHMETIC.</h2>
        <p class="mg__copy">No calculators. Calculators are considered cheating. You are the calculator now.</p>
      </div>
      <div class="math-panel" id="math-panel" data-answer="${problem.answer}">
        <div class="math-expression">${problem.expression} = ?</div>
        <div class="math-answer"><span>YOUR ANSWER</span><strong id="math-display" class="is-empty">_</strong></div>
        <div class="keypad" id="math-keypad">
          ${[7, 8, 9, 4, 5, 6, 1, 2, 3].map(n => `<button type="button" data-key="${n}">${n}</button>`).join('')}
          <button type="button" data-key="clear">CLR</button>
          <button type="button" data-key="0">0</button>
          <button type="button" data-key="del">DEL</button>
        </div>
      </div>
      <div class="mg__feedback" id="math-feedback">TIP: PEMDAS IS A HUMAN CONSTRUCT. USE IT ANYWAY.</div>
      <div class="mg__actions">
        <span class="mg__status">NUMERIC INPUT ONLY</span>
        <button class="btn" type="button" id="math-submit"><span>SUBMIT</span><b>↵</b></button>
      </div>
    </div>
  `;

  const display = host.querySelector('#math-display');
  const feedback = host.querySelector('#math-feedback');
  const panel = host.querySelector('#math-panel');
  const submit = host.querySelector('#math-submit');
  const keypad = host.querySelector('#math-keypad');

  const update = () => {
    display.textContent = answer || '_';
    display.classList.toggle('is-empty', !answer);
  };

  const press = key => {
    if (locked) return;
    sound.key();
    if (key === 'del') answer = answer.slice(0, -1);
    else if (key === 'clear') answer = '';
    else if (answer.length < 6) answer += key;
    update();
  };

  const submitAnswer = () => {
    if (locked) return;
    if (!answer) {
      feedback.textContent = 'EMPTY ANSWERS ARE NOT ARITHMETIC.';
      feedback.classList.add('is-error');
      sound.wrong();
      return;
    }
    if (Number(answer) === problem.answer) {
      locked = true;
      keypad.querySelectorAll('button').forEach(button => { button.disabled = true; });
      submit.disabled = true;
      feedback.textContent = 'ARITHMETIC ACCEPTED. THIS PROVES ALMOST NOTHING.';
      feedback.classList.remove('is-error');
      feedback.classList.add('is-good');
      sound.correct();
      api.success();
    } else {
      answer = '';
      update();
      sound.strike();
      feedback.textContent = 'WRONG. TRUST DAMAGED. THE NUMBERS ARE DISAPPOINTED.';
      feedback.classList.add('is-error');
      panel.classList.add('is-error');
      window.clearTimeout(shakeTimer);
      shakeTimer = window.setTimeout(() => panel.classList.remove('is-error'), 420);
      const active = api.strike('ARITHMETIC ERROR');
      if (!active) locked = true;
    }
  };

  keypad.addEventListener('click', event => {
    const button = event.target.closest('button[data-key]');
    if (!button || button.disabled) return;
    press(button.dataset.key);
  });
  submit.addEventListener('click', submitAnswer);

  const onKey = event => {
    if (locked) return;
    if (/^\d$/.test(event.key)) {
      event.preventDefault();
      press(event.key);
    } else if (event.key === 'Backspace') {
      event.preventDefault();
      press('del');
    } else if (event.key === 'Enter') {
      event.preventDefault();
      submitAnswer();
    } else if (event.key === 'Escape') {
      press('clear');
    }
  };
  window.addEventListener('keydown', onKey);
  update();

  return () => {
    locked = true;
    window.clearTimeout(shakeTimer);
    window.removeEventListener('keydown', onKey);
  };
}

/* -------------------------------------------------------------------------- */
/*                                 FACE CAPTCHA                               */
/* -------------------------------------------------------------------------- */

function faceIcon(target) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${target.icon}</svg>`;
}

function mountFace(host, api) {
  let target = choice(FACE_TARGETS);
  let lastTarget = target.key;
  let captures = 0;
  let locked = false;
  let accepts = true;
  let acceptTimer = 0;
  let sim = null;
  let flashTimer = 0;

  host.innerHTML = `
    <div class="mg mg--face">
      <div class="mg__head">
        <span class="mg__tag">${api.stageMeta.tag}</span>
        <h2>MATCH THE<br>EXPRESSION.</h2>
        <p class="mg__copy">The camera will cycle through expressions. Capture the subject three times when they match the target.</p>
      </div>
      <div class="face-brief">
        <div class="face-target">
          <div class="face-target__icon" id="face-target-icon">${faceIcon(target)}</div>
          <div class="face-target__copy">
            <span>TARGET EXPRESSION</span>
            <strong id="face-target-label">${target.label}</strong>
          </div>
        </div>
        <div class="face-captures">
          <span>CAPTURES</span>
          <div class="face-captures__pips" id="face-pips"><i></i><i></i><i></i></div>
        </div>
      </div>
      <div class="face-camera" id="face-camera" data-target="${target.key}">
        <canvas id="face-canvas" role="img" aria-label="Simulated subject inside a liveness camera"></canvas>
        <div class="face-cam__corner face-cam__corner--tl"></div>
        <div class="face-cam__corner face-cam__corner--tr"></div>
        <div class="face-cam__corner face-cam__corner--bl"></div>
        <div class="face-cam__corner face-cam__corner--br"></div>
        <div class="face-cam__scan"></div>
        <div class="face-cam__top">
          <span class="face-cam__rec"><i></i> REC · LIVE</span>
          <span>SUBJECT 404</span>
        </div>
        <div class="face-cam__bottom">
          <span class="face-cam__id">LIVENESS v3.7<br>NO FILTERS · NO MERCY</span>
          <span class="face-cam__status" id="face-status">AWAITING<br>EXPRESSION</span>
        </div>
      </div>
      <div class="mg__feedback" id="face-feedback">WAIT FOR THE SUBJECT TO MATCH. THEN CAPTURE. DO NOT OVERTHINK IT.</div>
      <div class="capture-row">
        <div class="capture-hint">CAPTURE 3 MATCHES.<br>MISTAKES COST TRUST.</div>
        <button class="btn" type="button" id="face-capture"><span>CAPTURE</span><b>◎</b></button>
      </div>
    </div>
  `;

  const canvas = host.querySelector('#face-canvas');
  const camera = host.querySelector('#face-camera');
  const targetLabel = host.querySelector('#face-target-label');
  const targetIcon = host.querySelector('#face-target-icon');
  const pips = Array.from(host.querySelectorAll('#face-pips i'));
  const feedback = host.querySelector('#face-feedback');
  const status = host.querySelector('#face-status');
  const capture = host.querySelector('#face-capture');

  sim = new FaceSim(canvas, { accent: api.stageMeta.accent, stage: api.stage });
  sim.start();

  const updatePips = () => {
    pips.forEach((pip, index) => pip.classList.toggle('is-on', index < captures));
  };

  const newTarget = (first = false) => {
    if (first) {
      target = choice(FACE_TARGETS);
    } else {
      let next = choice(FACE_TARGETS);
      while (next.key === lastTarget) next = choice(FACE_TARGETS);
      target = next;
    }
    lastTarget = target.key;
    targetLabel.textContent = target.label;
    targetIcon.innerHTML = faceIcon(target);
    camera.dataset.target = target.key;
    status.innerHTML = 'AWAITING<br>EXPRESSION';
    camera.classList.remove('is-success', 'is-fail');
    accepts = false;
    window.clearTimeout(acceptTimer);
    acceptTimer = window.setTimeout(() => { accepts = true; }, 440);
  };

  capture.addEventListener('click', () => {
    if (locked || !accepts) return;
    const matched = sim.matchesTarget(target.key, 260);
    if (matched) {
      captures += 1;
      updatePips();
      sound.match();
      camera.classList.remove('is-fail');
      camera.classList.add('is-success');
      status.innerHTML = 'MATCH<br>LOCKED';
      feedback.textContent = `EXPRESSION MATCHED. ${captures} OF 3 CAPTURES CONFIRMED.`;
      feedback.classList.remove('is-error');
      feedback.classList.add('is-good');
      window.clearTimeout(flashTimer);
      flashTimer = window.setTimeout(() => camera.classList.remove('is-success'), 420);
      if (captures >= 3) {
        locked = true;
        capture.disabled = true;
        sim.stop();
        api.success();
        return;
      }
      newTarget();
    } else {
      sound.strike();
      camera.classList.remove('is-success');
      camera.classList.add('is-fail');
      status.innerHTML = 'MISMATCH<br>LOGGED';
      feedback.textContent = 'EXPRESSION MISMATCH. TRUST DAMAGED. THE SUBJECT LOOKS SMUG.';
      feedback.classList.add('is-error');
      feedback.classList.remove('is-good');
      window.clearTimeout(flashTimer);
      flashTimer = window.setTimeout(() => camera.classList.remove('is-fail'), 420);
      const active = api.strike('EXPRESSION MISMATCH');
      if (!active) {
        locked = true;
        sim.stop();
      }
    }
  });

  newTarget(true);
  updatePips();

  return () => {
    locked = true;
    sim?.destroy();
    window.clearTimeout(acceptTimer);
    window.clearTimeout(flashTimer);
  };
}
