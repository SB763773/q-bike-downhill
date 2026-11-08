// UIManager.js - UI界面管理
import { formatTime } from './Utils.js';

export class UIManager {
  constructor() {
    this.elements = {
      mainMenu: document.getElementById('main-menu'),
      trackSelect: document.getElementById('track-select'),
      howToPlay: document.getElementById('how-to-play'),
      hud: document.getElementById('hud'),
      pauseMenu: document.getElementById('pause-menu'),
      results: document.getElementById('results-screen'),
      countdown: document.getElementById('countdown'),
      countdownText: document.getElementById('countdown-text'),
      loading: document.getElementById('loading-screen'),
      hudTime: document.getElementById('hud-time'),
      hudScore: document.getElementById('hud-score'),
      hudSpeed: document.getElementById('hud-speed'),
      speedBar: document.getElementById('speed-bar'),
      hudTrickText: document.getElementById('hud-trick-text'),
      resultsTime: document.getElementById('results-time'),
      resultsScore: document.getElementById('results-score'),
      resultsBest: document.getElementById('results-best'),
      newRecord: document.getElementById('new-record-row'),
    };
    this.callbacks = {};
    this._bindEvents();
  }

  on(action, cb) { this.callbacks[action] = cb; }

  _bindEvents() {
    document.querySelectorAll('[data-action]').forEach(el => {
      el.addEventListener('click', () => {
        const action = el.dataset.action;
        if (this.callbacks[action]) this.callbacks[action]();
      });
    });
    document.querySelectorAll('.track-card').forEach(el => {
      el.addEventListener('click', () => {
        const track = parseInt(el.dataset.track);
        if (this.callbacks['select-track']) this.callbacks['select-track'](track);
      });
    });
    document.getElementById('pause-btn').addEventListener('click', () => {
      if (this.callbacks['pause']) this.callbacks['pause']();
    });
  }

  showScreen(name) {
    const screens = ['mainMenu', 'trackSelect', 'howToPlay', 'pauseMenu', 'results'];
    screens.forEach(s => this.elements[s].classList.add('hidden'));
    this.elements.hud.classList.add('hidden');
    this.elements.countdown.classList.add('hidden');
    if (name === 'main') this.elements.mainMenu.classList.remove('hidden');
    else if (name === 'trackSelect') this.elements.trackSelect.classList.remove('hidden');
    else if (name === 'howToPlay') this.elements.howToPlay.classList.remove('hidden');
    else if (name === 'pause') this.elements.pauseMenu.classList.remove('hidden');
    else if (name === 'results') this.elements.results.classList.remove('hidden');
  }

  showHUD() {
    this.elements.hud.classList.remove('hidden');
    this.elements.mainMenu.classList.add('hidden');
    this.elements.loading.classList.add('hidden');
  }

  showLoading() {
    this.elements.loading.classList.remove('hidden');
  }

  hideLoading() {
    this.elements.loading.classList.add('hidden');
  }

  updateHUD(time, score, speed, maxSpeed) {
    this.elements.hudTime.textContent = formatTime(time);
    this.elements.hudScore.textContent = score;
    const kmh = Math.round(Math.abs(speed) * 3.6);
    this.elements.hudSpeed.textContent = `${kmh} km/h`;
    const ratio = Math.min(1, Math.abs(speed) / maxSpeed);
    this.elements.speedBar.style.width = `${ratio * 100}%`;
  }

  showTrickText(text) {
    this.elements.hudTrickText.textContent = text;
    this.elements.hudTrickText.classList.remove('show');
    void this.elements.hudTrickText.offsetWidth;
    this.elements.hudTrickText.classList.add('show');
    setTimeout(() => this.elements.hudTrickText.classList.remove('show'), 1500);
  }

  startCountdown(onComplete) {
    let count = 3;
    this.elements.countdown.classList.remove('hidden');
    const tick = () => {
      if (count > 0) {
        this.elements.countdownText.textContent = count;
        this.elements.countdownText.style.animation = 'none';
        void this.elements.countdownText.offsetWidth;
        this.elements.countdownText.style.animation = 'countPulse 1s ease';
        if (this.callbacks['countdownBeep']) this.callbacks['countdownBeep']();
        count--;
        setTimeout(tick, 1000);
      } else {
        this.elements.countdownText.textContent = 'GO!';
        this.elements.countdownText.style.animation = 'none';
        void this.elements.countdownText.offsetWidth;
        this.elements.countdownText.style.animation = 'countPulse 1s ease';
        if (this.callbacks['countdownGo']) this.callbacks['countdownGo']();
        setTimeout(() => {
          this.elements.countdown.classList.add('hidden');
          onComplete();
        }, 800);
      }
    };
    tick();
  }

  showResults(time, score, bestTime, isNewRecord) {
    this.elements.resultsTime.textContent = formatTime(time);
    this.elements.resultsScore.textContent = score;
    if (bestTime !== null) {
      this.elements.resultsBest.textContent = formatTime(bestTime);
    } else {
      this.elements.resultsBest.textContent = '无';
    }
    this.elements.newRecord.style.display = isNewRecord ? 'flex' : 'none';
    this.showScreen('results');
  }
}
