// Game.js - 游戏主逻辑，整合所有系统
import * as THREE from 'three';
import { PlayerModel } from './Player.js';
import { Track } from './Track.js';
import { PhysicsSystem } from './Physics.js';
import { Controls } from './Controls.js';
import { CameraController } from './CameraController.js';
import { EffectsSystem } from './Effects.js';
import { AudioManager } from './AudioManager.js';
import { UIManager } from './UIManager.js';
import { clamp, damp, deg2rad, randRange } from './Utils.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    // Three.js
    this.scene = null;
    this.renderer = null;
    this.camera = null;
    // 游戏系统
    this.player = null;
    this.track = null;
    this.physics = null;
    this.controls = null;
    this.camController = null;
    this.effects = null;
    this.audio = null;
    this.ui = null;
    // 游戏状态
    this.state = 'menu'; // menu | loading | countdown | playing | paused | results
    this.gameMode = 'time-trial'; // time-trial | free-ride
    this.trackIndex = 0;
    // 计时与计分
    this.timer = 0;
    this.score = 0;
    this.bestTime = null;
    this.isStarted = false;
    this.isFinished = false;
    // 踩踏音效计时
    this.pedalSoundTimer = 0;
    // 空中特技追踪
    this.wasAirborne = false;
    this.trickAccumulated = 0;
    this.crashCooldown = 0;
    // 上次位置(用于漂移检测)
    this.lastPos = new THREE.Vector3();

    this._initThree();
    this._initSystems();
    this._setupLights();
    this._setupUI();
    this._animate = this._animate.bind(this);
    this.clock = new THREE.Clock();
    this._animate();
  }

  _initThree() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87CEEB);
    this.scene.fog = new THREE.Fog(0xB0E0E6, 50, 180);

    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500);
    this.camera.position.set(0, 10, 10);

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  _initSystems() {
    this.audio = new AudioManager();
    this.effects = new EffectsSystem(this.scene);
    this.controls = new Controls(this.canvas);
    this.camController = new CameraController(this.camera);
    this.effects.createSpeedLines(this.camera);
    this.ui = new UIManager();
  }

  _setupLights() {
    // 环境光
    const ambient = new THREE.AmbientLight(0xFFFFFF, 0.7);
    this.scene.add(ambient);
    // 方向光 (太阳)
    const sun = new THREE.DirectionalLight(0xFFFFCC, 0.8);
    sun.position.set(30, 50, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 200;
    sun.shadow.camera.left = -80;
    sun.shadow.camera.right = 80;
    sun.shadow.camera.top = 80;
    sun.shadow.camera.bottom = -80;
    sun.shadow.bias = -0.001;
    this.scene.add(sun);
    // 补光 (天空色)
    const fill = new THREE.HemisphereLight(0x87CEEB, 0x6ABF69, 0.4);
    this.scene.add(fill);
  }

  _setupUI() {
    this.ui.on('time-trial', () => {
      this.audio.init(); this.audio.resume();
      this.audio.selectClick();
      this.gameMode = 'time-trial';
      this.ui.showScreen('trackSelect');
    });
    this.ui.on('free-ride', () => {
      this.audio.init(); this.audio.resume();
      this.audio.selectClick();
      this.gameMode = 'free-ride';
      this.ui.showScreen('trackSelect');
    });
    this.ui.on('how-to-play', () => {
      this.audio.init(); this.audio.resume();
      this.audio.selectClick();
      this.ui.showScreen('howToPlay');
    });
    this.ui.on('back-to-menu', () => {
      this.audio.selectClick();
      this.ui.showScreen('main');
    });
    this.ui.on('select-track', (index) => {
      this.audio.selectClick();
      this.trackIndex = index;
      this._startGame();
    });
    this.ui.on('pause', () => this._pause());
    this.ui.on('resume', () => this._resume());
    this.ui.on('restart', () => {
      this.audio.selectClick();
      this._startGame();
    });
    this.ui.on('quit-to-menu', () => {
      this.audio.selectClick();
      this.audio.stopMusic();
      this._cleanupTrack();
      this.state = 'menu';
      this.ui.showScreen('main');
    });
    this.ui.on('countdownBeep', () => this.audio.countdownBeep());
    this.ui.on('countdownGo', () => {
      this.audio.countdownGo();
      this.audio.startMusic();
    });
  }

  // ==================== 游戏流程 ====================
  _startGame() {
    this._cleanupTrack();
    this.ui.showLoading();
    this.state = 'loading';

    // 延迟一帧确保loading显示
    requestAnimationFrame(() => {
      // 创建赛道
      this.track = new Track(this.trackIndex);
      this.scene.add(this.track.group);
      // 更新天空和雾
      this.scene.background = new THREE.Color(this.track.config.colors.sky);
      this.scene.fog = new THREE.Fog(this.track.config.colors.fog, 50, 200);
      // 创建玩家
      this.player = new PlayerModel();
      this.scene.add(this.player.group);
      // 初始化物理
      this.physics = new PhysicsSystem();
      this.physics.reset(this.track.startPos, this.track.startDir);
      this.player.group.position.copy(this.track.startPos);
      this.player.group.rotation.y = this.track.startDir;
      // 相机
      this.camController.mode = 'third';
      this.camController.initialized = false;
      this.camController.setTarget(this.player.group.position);
      // 重置状态
      this.timer = 0;
      this.score = 0;
      this.isStarted = false;
      this.isFinished = false;
      this.wasAirborne = false;
      this.trickAccumulated = 0;
      this.crashCooldown = 0;
      // 加载最佳记录
      this.bestTime = this._loadBestTime();

      this.ui.hideLoading();
      this.ui.showHUD();

      // 倒计时
      this.state = 'countdown';
      this.ui.startCountdown(() => {
        this.state = 'playing';
        this.isStarted = true;
      });
    });
  }

  _pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.ui.showScreen('pause');
    this.audio.stopMusic();
  }

  _resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.ui.showHUD();
    this.audio.startMusic();
  }

  _cleanupTrack() {
    if (this.track) {
      this.scene.remove(this.track.group);
      this.track.group.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
          } else {
            if (child.material.map) child.material.map.dispose();
            child.material.dispose();
          }
        }
      });
      this.track = null;
    }
    if (this.player) {
      this.scene.remove(this.player.group);
      this.player.group.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
      this.player = null;
    }
    if (this.effects) this.effects.clear();
    this.physics = null;
  }

  // ==================== 主循环 ====================
  _animate() {
    requestAnimationFrame(this._animate);
    const dt = Math.min(this.clock.getDelta(), 0.05);

    if (this.state === 'playing') {
      this._updatePlaying(dt);
    } else if (this.state === 'countdown') {
      // 倒计时期间也更新相机
      if (this.player && this.camController) {
        const headPos = this.player.getHeadPosition();
        this.camController.update(dt, this.player.group.position, this.physics.rotationY,
          Math.abs(this.physics.speed), this.physics.maxSpeed, headPos,
          this.controls.cameraOrbit, this.controls.cameraPitch);
      }
      if (this.player) {
        this.player.update(dt, 0, false, 0, 0, 0);
      }
    }

    // 更新特效
    if (this.effects) this.effects.update(dt);

    this.renderer.render(this.scene, this.camera);
  }

  _updatePlaying(dt) {
    // 更新输入
    this.controls.update(dt);

    // 处理特殊按键
    if (this.controls.input.switchCamera) {
      this.camController.switchMode();
      this.audio.selectClick();
    }
    if (this.controls.input.reset) {
      this._resetToCheckpoint();
      this.audio.crash();
    }
    if (this.controls.input.pause) {
      this._pause();
      return;
    }

    // 更新物理
    this.physics.update(dt, this.controls.input, this.track, this.player);

    // 更新玩家模型动画
    this.player.update(dt, this.physics.speed, this.physics.isAirborne,
      this.controls.input.steer, this.controls.input.accel, this.controls.input.brake);

    // 计时
    this.timer += dt;

    // 踩踏音效
    if (this.controls.input.accel > 0 && this.physics.speed > 0.5) {
      this.pedalSoundTimer += dt;
      const interval = 0.3 / (1 + this.physics.speed * 0.2);
      if (this.pedalSoundTimer > interval) {
        this.pedalSoundTimer = 0;
        this.audio.pedal();
      }
    }
    // 刹车音效
    if (this.controls.input.brake > 0 && this.physics.speed > 1 && !this._brakeSoundPlayed) {
      this.audio.brake();
      this._brakeSoundPlayed = true;
    }
    if (this.controls.input.brake === 0) this._brakeSoundPlayed = false;

    // 跳跃音效
    if (this.controls.input.jump && !this.physics.isAirborne) {
      this.audio.jump();
      this.effects.spawnStars(this.player.group.position);
    }

    // 空中→落地检测
    if (this.wasAirborne && !this.physics.isAirborne) {
      this._onLand();
    }
    this.wasAirborne = this.physics.isAirborne;

    // 空中拖尾
    if (this.physics.isAirborne && this.physics.airTime > 0.1) {
      if (Math.random() < 0.3) {
        this.effects.spawnTrail(this.player.group.position);
      }
    }
    // 加速拖尾
    if (this.physics.speed > 15 && Math.random() < 0.2) {
      this.effects.spawnTrail(this.player.group.position);
    }

    // 检查点检测
    for (const cp of this.track.checkpoints) {
      if (!cp.passed && this.physics.position.distanceTo(cp.pos) < 4) {
        cp.passed = true;
        this.audio.checkpoint();
      }
    }

    // 摔车处理
    if (this.physics.isCrashed) {
      this.crashCooldown += dt;
      if (this.crashCooldown > 1.5) {
        this._resetToCheckpoint();
        this.audio.crash();
      }
    } else {
      this.crashCooldown = 0;
    }

    // 终点检测
    if (this.physics.checkFinish(this.track) && !this.isFinished) {
      this._onFinish();
    }

    // 更新相机
    const headPos = this.player.getHeadPosition();
    this.camController.update(dt, this.player.group.position, this.physics.rotationY,
      Math.abs(this.physics.speed), this.physics.maxSpeed, headPos,
      this.controls.cameraOrbit, this.controls.cameraPitch);

    // 更新速度线条
    this.effects.updateSpeedLines(Math.abs(this.physics.speed), this.physics.maxSpeed, this.camera);

    // 更新HUD
    this.ui.updateHUD(this.timer, this.score, this.physics.speed, this.physics.maxSpeed);

    // 第一人称速度模糊效果
    if (this.camController.mode === 'first' && this.physics.speed > 15) {
      // 通过FOV变化体现
    }
  }

  _onLand() {
    this.audio.land();
    this.effects.spawnDust(this.player.group.position);
    this.camController.shake(0.3, 0.2);

    // 特技得分
    if (this.physics.trickRotation > deg2rad(90)) {
      const trickScore = Math.floor(this.physics.trickRotation / deg2rad(90)) * 50;
      this.score += trickScore;
      this.audio.trick();
      this.ui.showTrickText(`特技 +${trickScore}!`);
      this.effects.spawnTrickText(this.player.group.position, `+${trickScore}`);
    } else if (this.physics.airTime > 0.8) {
      this.score += 20;
      this.audio.trick();
      this.ui.showTrickText('平稳落地 +20!');
    }
    this.physics.trickRotation = 0;
  }

  _onFinish() {
    this.isFinished = true;
    this.state = 'results';
    this.audio.finish();
    this.audio.stopMusic();
    // 自由滑行不记时间
    if (this.gameMode === 'free-ride') {
      this.ui.elements.resultsTitle.textContent = '自由滑行结束！';
    } else {
      this.ui.elements.resultsTitle.textContent = '通关！';
    }
    const isNewRecord = this.gameMode === 'time-trial' && (this.bestTime === null || this.timer < this.bestTime);
    if (isNewRecord) {
      this.bestTime = this.timer;
      this._saveBestTime(this.timer);
    }
    this.ui.showResults(this.timer, this.score, this.bestTime, isNewRecord);
  }

  _resetToCheckpoint() {
    const cp = this.track.getNearestCheckpoint(this.physics.position);
    this.physics.reset(cp, this.track.startDir);
    this.player.resetAnimation();
    this.crashCooldown = 0;
    this.physics.isCrashed = false;
  }

  // ==================== 本地存储 ====================
  _loadBestTime() {
    const key = `qbike_best_${this.trackIndex}`;
    const val = localStorage.getItem(key);
    return val ? parseFloat(val) : null;
  }

  _saveBestTime(time) {
    const key = `qbike_best_${this.trackIndex}`;
    localStorage.setItem(key, time.toString());
  }
}
