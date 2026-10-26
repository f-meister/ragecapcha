import { STAGES, INTRO, FINAL_STORY, FAIL_TAUNTS, BOT_LEADERBOARD } from './data.js';
import { mountGame } from './minigames.js';
import { sound } from './audio.js';
import {
  $,
  $$,
  choice,
  escapeHtml,
  formatScore,
  makeUid,
  randomAlias,
  safeStorage,
  sanitizeAlias,
  Typewriter,
} from './util.js';

const STORAGE_BOARD = 'ragecapcha.board.v1';
const STORAGE_ALIAS = 'ragecapcha.alias.v1';
const STORAGE_MUTED = 'ragecapcha.muted.v1';
const MAX_BOARD = 40;

const screens = {
  start: $('#screen-start'),
  intro: $('#screen-intro'),
  game: $('#screen-game'),
  cutscene: $('#screen-cutscene'),
  gameover: $('#screen-gameover'),
  victory: $('#screen-victory'),
};

const stageHost = $('#game-stage');
const timerEl = $('#timer');
const timerValue = $('#timer-value');
const timerFill = $('#timer-fill');
const timerGlow = $('#timer-glow');
const resultOverlay = $('#result-overlay');
const cutScene = $('#screen-cutscene');
const gameScreen = $('#screen-game');
const pauseOverlay = $('#pause-overlay');

class RageCapcha {
  constructor() {
    this.storage = safeStorage();
    this.run = null;
    this.currentStage = null;
    this.cleanup = null;
    this.typewriter = null;
    this.cutAction = null;
    this.roundLocked = true;
    this.runOver = false;
    this.paused = false;
    this.timerRunning = false;
    this.remaining = 0;
    this.timerDuration = 0;
    this.lastFrame = 0;
    this.raf = 0;
    this.lastTickSecond = 99;
    this.transitionTimer = 0;
    this.hitTimer = 0;
    this.recordedEntryId = null;

    this.tick = this.tick.bind(this);
    this.init();
  }

  init() {
    this.loadBoard();
    this.bindGlobal();
    this.updateSoundButtons();
    this.setAlias(this.storage.getItem(STORAGE_ALIAS) || randomAlias());
    this.updateBest();
    this.updateBoard(this.$('#over-board'), this.$('#over-board-count'), null);

    const muted = this.storage.getItem(STORAGE_MUTED) === '1';
    sound.setMuted(muted);
    this.updateSoundButtons();
  }

  $(selector) {
    return document.querySelector(selector);
  }

  bindGlobal() {
    $$('.sound-button').forEach(button => {
      button.addEventListener('click', () => {
        sound.unlock();
        const muted = sound.toggle();
        this.storage.setItem(STORAGE_MUTED, muted ? '1' : '0');
        this.updateSoundButtons();
      });
    });

    $('#begin').addEventListener('click', () => this.startFromLobby());
    $('#alias').addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        this.startFromLobby();
      }
    });
    $('#intro-continue').addEventListener('click', () => {
      this.typewriter?.finish();
      this.beginStage(0);
    });
    $('#cut-continue').addEventListener('click', () => {
      this.typewriter?.finish();
      this.cutAction?.();
    });
    $('#pause-button').addEventListener('click', () => this.pause());
    $('#resume-button').addEventListener('click', () => this.resume());
    $('#abandon-button').addEventListener('click', () => {
      this.hidePause();
      this.failRun('abandon');
    });
    $('#over-retry').addEventListener('click', () => this.retry());
    $('#win-retry').addEventListener('click', () => this.retry());
    $('#over-menu').addEventListener('click', () => this.returnToLobby());
    $('#win-menu').addEventListener('click', () => this.returnToLobby());

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.isPlaying() && !this.paused) this.pause();
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && this.isPlaying() && !this.roundLocked) {
        if (this.paused) this.resume();
        else this.pause();
      }
    });
  }

  setAlias(value) {
    const alias = sanitizeAlias(value) || randomAlias();
    const input = $('#alias');
    input.value = alias;
    this.alias = alias;
  }

  startFromLobby() {
    sound.unlock();
    const input = $('#alias');
    this.alias = sanitizeAlias(input.value) || randomAlias();
    input.value = this.alias;
    this.storage.setItem(STORAGE_ALIAS, this.alias);
    this.startRun();
  }

  resetRunState() {
    this.stopTimer();
    this.destroyMiniGame();
    this.hidePause();
    this.hideResult();
    this.typewriter?.destroy();
    this.typewriter = null;
    this.runOver = false;
    this.roundLocked = true;
    this.paused = false;
    this.cancelTransitions();
    gameScreen.classList.remove('is-hit');
  }

  startRun() {
    this.cancelTransitions();
    this.resetRunState();
    this.run = {
      id: makeUid(),
      alias: this.alias,
      stageIndex: 0,
      strikes: 0,
      score: 0,
      history: [],
      completed: false,
      failed: false,
      startedAt: Date.now(),
      recorded: false,
      finalShown: false,
    };
    this.runOver = false;
    this.roundLocked = true;
    this.recordedEntryId = null;
    this.updateTrust();
    $('#intro-alias').textContent = this.run.alias;
    screenAccent(screens.intro, STAGES[0].accent);
    this.showScreen('intro');
    this.showIntroStory();
  }

  showIntroStory() {
    this.typewriter?.destroy();
    const lines = INTRO.lines.map(line => line.replaceAll('{{alias}}', this.run.alias));
    this.typewriter = new Typewriter($('#intro-lines'), lines, {
      speed: 11,
      linePause: 220,
    });
  }

  showScreen(name) {
    Object.entries(screens).forEach(([key, screen]) => {
      const active = key === name;
      screen.classList.toggle('is-active', active);
      screen.setAttribute('aria-hidden', String(!active));
      screen.inert = !active;
      if (active) screen.scrollTop = 0;
    });
    if (name === 'game') stageHost.scrollTop = 0;
    if (name === 'gameover') screens.gameover.querySelector('.end-scroll').scrollTop = 0;
    if (name === 'victory') screens.victory.querySelector('.end-scroll').scrollTop = 0;
  }

  beginStage(index) {
    if (!this.run || this.runOver) return;
    this.cancelTransitions();
    this.destroyMiniGame();
    this.hidePause();
    this.roundLocked = false;
    this.paused = false;
    this.run.stageIndex = index;
    this.currentStage = STAGES[index];
    const meta = this.currentStage;

    screenAccent(gameScreen, meta.accent);
    screenAccent(screens.gameover, 'var(--red)');
    screenAccent(cutScene, meta.accent);
    $('#hud-stage-num').textContent = meta.number;
    $('#hud-stage-name').textContent = meta.name;
    $('#hud-stage-code').textContent = meta.tag;
    $('#hud-foot').textContent = `STAGE ${meta.number} // ${meta.name}`;
    this.updateTrust();
    this.updateTimer(meta.duration, meta.duration);
    this.hideResult();

    this.showScreen('game');
    sound.stageStart();

    const api = {
      stage: index,
      duration: meta.duration,
      stageMeta: meta,
      alias: this.run.alias,
      success: () => this.completeStage(),
      strike: reason => this.addStrike(reason),
      isActive: () => !this.roundLocked && !this.runOver,
    };

    requestAnimationFrame(() => {
      if (!this.run || this.runOver) return;
      stageHost.innerHTML = '';
      try {
        this.cleanup = mountGame(meta.type, stageHost, api) || null;
      } catch (error) {
        console.error('CAPTCHA failed to initialize:', error);
        stageHost.innerHTML = '<div class="mg"><div class="mg__head"><span class="mg__tag">SYSTEM ERROR</span><h2>THE CAPTCHA<br>BROKE ITSELF.</h2><p class="mg__copy">This is somehow your fault.</p></div></div>';
        window.setTimeout(() => this.failRun('trust'), 600);
        return;
      }
      this.startTimer(meta.duration);
    });
  }

  startTimer(duration) {
    this.stopTimer();
    this.remaining = duration;
    this.timerDuration = duration;
    this.lastTickSecond = 99;
    this.timerRunning = true;
    this.lastFrame = performance.now();
    this.updateTimer(duration, duration);
    this.raf = requestAnimationFrame(this.tick);
  }

  stopTimer() {
    this.timerRunning = false;
    cancelAnimationFrame(this.raf);
  }

  tick(now) {
    if (!this.timerRunning || this.roundLocked || this.paused || this.runOver) return;
    const dt = Math.min(0.12, Math.max(0, (now - this.lastFrame) / 1000));
    this.lastFrame = now;
    this.remaining = Math.max(0, this.remaining - dt);
    this.updateTimer(this.remaining, this.timerDuration);

    if (this.remaining <= 10) {
      const second = Math.ceil(this.remaining);
      if (second < this.lastTickSecond) {
        this.lastTickSecond = second;
        if (second > 0) sound.tick(second <= 5);
      }
    }

    if (this.remaining <= 0) {
      this.failRun('timeout');
      return;
    }
    this.raf = requestAnimationFrame(this.tick);
  }

  updateTimer(remaining, duration) {
    const ratio = duration > 0 ? clamp(remaining / duration, 0, 1) : 0;
    timerValue.textContent = Math.max(0, remaining).toFixed(1);
    timerFill.style.width = `${ratio * 100}%`;
    timerGlow.style.left = `calc(${ratio * 100}% - 8px)`;
    timerEl.classList.toggle('is-urgent', remaining <= 10 && remaining > 0);
  }

  addStrike(reason) {
    if (this.roundLocked || this.runOver || !this.run) return false;
    this.run.strikes = Math.min(3, this.run.strikes + 1);
    this.updateTrust();
    this.flashHit();
    if (this.run.strikes >= 3) {
      this.roundLocked = true;
      this.stopTimer();
      window.setTimeout(() => this.failRun('trust'), 240);
      return false;
    }
    return true;
  }

  updateTrust() {
    const strikes = this.run?.strikes || 0;
    const pips = $$('#trust-pips i');
    pips.forEach((pip, index) => {
      pip.classList.toggle('is-lost', index < strikes);
    });
    const meter = $('#trust-meter');
    meter.classList.toggle('is-low', strikes >= 2);
    meter.setAttribute('aria-label', `Trust remaining: ${Math.max(0, 3 - strikes)} of 3`);
  }

  flashHit() {
    window.clearTimeout(this.hitTimer);
    gameScreen.classList.remove('is-hit');
    void gameScreen.offsetWidth;
    gameScreen.classList.add('is-hit');
    this.hitTimer = window.setTimeout(() => gameScreen.classList.remove('is-hit'), 400);
  }

  completeStage() {
    if (this.roundLocked || this.runOver || !this.run) return;
    this.roundLocked = true;
    this.stopTimer();
    const stage = this.currentStage;
    const timeLeft = Math.max(0, this.remaining);
    const base = 500;
    const timeBonus = Math.round(timeLeft * 30);
    const trustBonus = Math.max(0, 3 - this.run.strikes) * 100;
    const stageScore = base + timeBonus + trustBonus;
    const result = {
      stageScore,
      base,
      timeBonus,
      trustBonus,
      timeLeft,
      stage,
    };
    this.run.score += stageScore;
    this.run.history.push(result);
    this.showResult(true, stageScore);
    sound.correct();
    window.clearTimeout(this.transitionTimer);
    this.transitionTimer = window.setTimeout(() => this.showStageCutscene(result), 1100);
  }

  showResult(success, stageScore) {
    resultOverlay.classList.toggle('is-failed', !success);
    resultOverlay.classList.toggle('is-visible', true);
    $('#result-kicker').textContent = success ? 'HUMANITY DETECTED' : 'OBJECTIVE FAILED';
    $('#result-main').textContent = success ? 'VERIFIED' : 'TERMINATED';
    $('#result-sub').textContent = success ? `+${formatScore(stageScore)} PTS` : 'TRUST WILL NOT BE REFUNDED';
  }

  hideResult() {
    resultOverlay.classList.remove('is-visible', 'is-failed');
  }

  showStageCutscene(result) {
    if (!this.run || this.runOver) return;
    this.destroyMiniGame();
    const stage = result.stage;
    screenAccent(cutScene, stage.accent);
    $('#cut-eyebrow').textContent = `STAGE ${stage.number} CLEARED // ${stage.name}`;
    $('#cut-progress').textContent = `STAGE ${stage.number} / 05`;
    $('#cut-glyph').textContent = stage.short;
    $('#cut-title').innerHTML = stage.storyTitle;
    $('#cut-score').textContent = `+${formatScore(result.stageScore)}`;
    $('#cut-time').textContent = `+${formatScore(result.timeBonus)}`;
    $('#cut-trust').textContent = `+${formatScore(result.trustBonus)}`;
    $('.cutscene__award').classList.remove('is-hidden');
    $('#cut-continue span').textContent = 'CONTINUE';
    $('#cut-note').textContent = 'TAP CONTINUE TO SIGN THE REPORT.';
    const story = stage.story.map(line => line.replaceAll('{{alias}}', this.run.alias));
    this.typewriter?.destroy();
    this.typewriter = new Typewriter($('#cut-lines'), story, { speed: 9, linePause: 190 });
    this.showScreen('cutscene');
    sound.cutscene();
    this.cutAction = () => {
      if (this.run.stageIndex >= STAGES.length - 1) this.showFinalStory();
      else this.beginStage(this.run.stageIndex + 1);
    };
  }

  showFinalStory() {
    if (!this.run || this.runOver) return;
    this.destroyMiniGame();
    this.run.finalShown = true;
    screenAccent(cutScene, 'var(--acid)');
    $('#cut-eyebrow').textContent = 'ALL STAGES COMPLETE // HUMANITY PENDING';
    $('#cut-progress').textContent = 'FINAL REPORT';
    $('#cut-glyph').textContent = 'OK';
    $('#cut-title').innerHTML = FINAL_STORY.title;
    $('.cutscene__award').classList.add('is-hidden');
    $('#cut-continue span').textContent = 'COLLECT CERTIFICATE';
    $('#cut-note').textContent = 'THE MACHINE IS PRINTING. DO NOT CELEBRATE YET.';
    const story = FINAL_STORY.lines.map(line => line.replaceAll('{{alias}}', this.run.alias));
    this.typewriter?.destroy();
    this.typewriter = new Typewriter($('#cut-lines'), story, { speed: 9, linePause: 190 });
    this.showScreen('cutscene');
    sound.cutscene();
    this.cutAction = () => this.completeRun();
  }

  failRun(cause) {
    if (!this.run || this.runOver) return;
    if (this.roundLocked && cause !== 'trust' && cause !== 'timeout') return;
    this.runOver = true;
    this.roundLocked = true;
    this.stopTimer();
    this.hidePause();
    this.run.failed = true;
    this.run.failCause = cause;
    this.run.failedStage = this.run.stageIndex + 1;
    sound.gameover();
    this.showResult(false, 0);
    $('#result-kicker').textContent = 'OBJECTIVE FAILED';
    $('#result-main').textContent = 'TERMINATED';
    $('#result-sub').textContent = cause === 'timeout'
      ? 'VERIFICATION WINDOW EXPIRED'
      : cause === 'abandon'
        ? 'APPLICANT ABANDONED VERIFICATION'
        : 'TRUST DEPLETED // THREE STRIKES';
    window.clearTimeout(this.transitionTimer);
    this.transitionTimer = window.setTimeout(() => this.showGameOver(cause), 1250);
  }

  showGameOver(cause) {
    this.destroyMiniGame();
    this.hideResult();
    const entry = this.recordRun(false);
    const board = this.getBoard();
    const rank = board.findIndex(item => item.id === entry.id) + 1;
    const stageReached = Math.min(5, this.run.failedStage || this.run.stageIndex + 1);
    const reasonText = cause === 'timeout'
      ? 'VERIFICATION WINDOW EXPIRED'
      : cause === 'abandon'
        ? 'APPLICANT ABANDONED VERIFICATION'
        : 'TRUST DEPLETED // THREE STRIKES';
    $('#over-reason').textContent = reasonText;
    $('#over-taunt').textContent = choice(FAIL_TAUNTS[cause] || FAIL_TAUNTS.trust);
    $('#over-score').textContent = formatScore(this.run.score);
    $('#over-stage').textContent = `${stageReached}/5`;
    $('#over-rank').textContent = rank > 0 ? `#${String(rank).padStart(2, '0')}` : '#--';
    $('#over-alias').textContent = this.run.alias;
    this.updateBoard($('#over-board'), $('#over-board-count'), entry.id);
    this.showScreen('gameover');
    this.updateBest();
  }

  completeRun() {
    if (!this.run || this.runOver) return;
    this.runOver = true;
    this.roundLocked = true;
    this.stopTimer();
    this.destroyMiniGame();
    this.run.completed = true;
    this.run.score += 2500;
    const entry = this.recordRun(true);
    const board = this.getBoard();
    const rank = board.findIndex(item => item.id === entry.id) + 1;
    const trustRemaining = Math.max(0, 3 - this.run.strikes);
    const date = new Date();
    const dateString = date.toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    }).toUpperCase();
    const certNumber = `VRD-${this.run.alias.replace(/[^A-Z0-9]/g, '').slice(0, 3).padStart(3, 'X')}-${String(date.getTime()).slice(-4)}`;

    $('#win-alias').textContent = this.run.alias;
    $('#win-alias-foot').textContent = this.run.alias;
    $('#win-cert').textContent = certNumber;
    $('#win-date').textContent = dateString;
    $('#win-score').textContent = formatScore(this.run.score);
    $('#win-score-stat').textContent = formatScore(this.run.score);
    $('#win-trust').textContent = `${trustRemaining}/3`;
    $('#win-rank').textContent = rank > 0 ? `#${String(rank).padStart(2, '0')}` : '#--';
    this.updateBoard($('#win-board'), $('#win-board-count'), entry.id);
    this.showScreen('victory');
    sound.victory();
    this.updateBest();
  }

  async retry() {
    this.cancelTransitions();
    this.destroyMiniGame();
    this.hidePause();
    this.stopTimer();
    this.hideResult();
    this.runOver = false;
    this.roundLocked = true;
    this.paused = false;
    this.alias = this.run?.alias || this.alias;
    this.setAlias(this.alias);
    window.setTimeout(() => this.startRun(), 80);
  }

  returnToLobby() {
    this.cancelTransitions();
    this.destroyMiniGame();
    this.hidePause();
    this.stopTimer();
    this.hideResult();
    this.typewriter?.destroy();
    this.run = null;
    this.currentStage = null;
    this.runOver = true;
    this.roundLocked = true;
    this.paused = false;
    this.updateBest();
    this.showScreen('start');
    sound.click();
  }

  pause() {
    if (!this.isPlaying() || this.roundLocked || this.paused) return;
    this.paused = true;
    cancelAnimationFrame(this.raf);
    pauseOverlay.hidden = false;
  }

  resume() {
    if (!this.paused) return;
    this.paused = false;
    pauseOverlay.hidden = true;
    if (this.timerRunning && !this.roundLocked) {
      this.lastFrame = performance.now();
      this.raf = requestAnimationFrame(this.tick);
    }
  }

  hidePause() {
    this.paused = false;
    pauseOverlay.hidden = true;
  }

  isPlaying() {
    return Boolean(this.run && !this.runOver && screens.game.classList.contains('is-active'));
  }

  destroyMiniGame() {
    try {
      this.cleanup?.();
    } catch (error) {
      console.error(error);
    }
    this.cleanup = null;
  }

  cancelTransitions() {
    window.clearTimeout(this.transitionTimer);
    window.clearTimeout(this.hitTimer);
    this.hideResult();
  }

  recordRun(cleared) {
    if (!this.run || this.run.recorded) return this.getBoard().find(entry => entry.id === this.run?.id) || { id: 'missing', score: this.run?.score || 0 };
    this.run.recorded = true;
    const entry = {
      id: this.run.id,
      name: this.run.alias,
      score: Math.round(this.run.score),
      stage: cleared ? 5 : Math.min(5, this.run.failedStage || this.run.stageIndex + 1),
      cleared,
      timestamp: Date.now(),
    };
    const board = this.getBoard();
    board.push(entry);
    board.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.stage !== a.stage) return b.stage - a.stage;
      return a.timestamp - b.timestamp;
    });
    this.recordedEntryId = entry.id;
    this.saveBoard(board.slice(0, MAX_BOARD));
    this.updateBest();
    return entry;
  }

  loadBoard() {
    let board = null;
    try {
      const raw = this.storage.getItem(STORAGE_BOARD);
      if (raw) board = JSON.parse(raw);
    } catch {
      board = null;
    }
    if (!Array.isArray(board) || !board.length) {
      board = BOT_LEADERBOARD.map(entry => ({ ...entry, timestamp: 0 }));
      this.saveBoard(board);
      return;
    }
    const valid = board.filter(entry => (
      entry
      && typeof entry.id === 'string'
      && typeof entry.name === 'string'
      && Number.isFinite(Number(entry.score))
      && Number.isFinite(Number(entry.stage))
    )).map(entry => ({
      ...entry,
      name: sanitizeAlias(entry.name) || 'UNKNOWN',
      score: Math.max(0, Math.round(Number(entry.score))),
      stage: Math.max(1, Math.min(5, Math.round(Number(entry.stage)))),
      cleared: Boolean(entry.cleared),
      timestamp: Number(entry.timestamp) || 0,
    }));
    if (!valid.length) {
      const seeded = BOT_LEADERBOARD.map(entry => ({ ...entry, timestamp: 0 }));
      this.saveBoard(seeded);
      return;
    }
    valid.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.stage !== a.stage) return b.stage - a.stage;
      return a.timestamp - b.timestamp;
    });
    this.saveBoard(valid.slice(0, MAX_BOARD));
  }

  getBoard() {
    try {
      const raw = this.storage.getItem(STORAGE_BOARD);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  saveBoard(board) {
    try {
      this.storage.setItem(STORAGE_BOARD, JSON.stringify(board.slice(0, MAX_BOARD)));
    } catch {
      // The machine does not apologize for storage failures.
    }
  }

  updateBest() {
    const board = this.getBoard();
    const best = board[0]?.score || 0;
    const node = $('#best-score');
    if (node) node.textContent = `BEST ${formatScore(best)}`;
  }

  updateBoard(container, countNode, highlightId) {
    if (!container) return;
    const board = this.getBoard();
    let display = board.slice(0, 7);
    const highlightIndex = board.findIndex(entry => entry.id === highlightId);
    if (highlightIndex >= 7) display = [...board.slice(0, 6), board[highlightIndex]];
    container.innerHTML = display.map(entry => {
      const rank = board.findIndex(item => item.id === entry.id) + 1;
      const classes = [
        'board-row',
        rank <= 3 ? 'is-podium' : '',
        entry.id === highlightId ? 'is-you' : '',
      ].filter(Boolean).join(' ');
      return `
        <div class="${classes}">
          <span class="board-row__rank">${String(rank).padStart(2, '0')}</span>
          <span class="board-row__name" title="${escapeHtml(entry.name)}">${escapeHtml(entry.name)}</span>
          <span class="board-row__score">${formatScore(entry.score)}</span>
          <span class="board-row__stage">${entry.stage}/5</span>
        </div>
      `;
    }).join('');
    if (countNode) countNode.textContent = `${board.length} APPLICANT${board.length === 1 ? '' : 'S'}`;
  }

  updateSoundButtons() {
    $$('.sound-button').forEach(button => {
      if (button.classList.contains('icon-button')) {
        button.textContent = sound.muted ? '✕' : '♪';
        button.setAttribute('aria-label', sound.muted ? 'Enable sound' : 'Mute sound');
        button.setAttribute('aria-pressed', String(!sound.muted));
      } else {
        button.textContent = sound.muted ? 'SOUND: OFF' : 'SOUND: ON';
        button.setAttribute('aria-label', sound.muted ? 'Enable sound' : 'Mute sound');
        button.setAttribute('aria-pressed', String(!sound.muted));
      }
    });
  }
}

function screenAccent(screen, accent) {
  if (screen) screen.style.setProperty('--accent', accent);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

const game = new RageCapcha();
window.__ragecapcha = game;

if (new URLSearchParams(window.location.search).has('debug')) {
  window.__ragecapcha.debug = {
    game,
    stage: index => game.beginStage(index),
    win: () => {
      if (!game.run) game.startRun();
      game.run.stageIndex = 4;
      game.completeRun();
    },
    fail: cause => {
      if (!game.run) game.startRun();
      game.run.stageIndex = 1;
      game.run.score = 1800;
      game.failRun(cause || 'timeout');
    },
  };
}
