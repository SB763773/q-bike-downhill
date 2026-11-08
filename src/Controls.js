// Controls.js - WASD操控系统
export class Controls {
  constructor(canvas) {
    this.canvas = canvas;
    // 输入状态
    this.keys = {};
    this.mouse = { x: 0, y: 0, dx: 0, dy: 0, locked: false };
    // 输出状态 (给物理和相机用)
    this.input = {
      accel: 0,
      brake: 0,
      steer: 0,
      jump: false,
      jumpPower: 1,
      switchCamera: false,
      reset: false,
      pause: false,
    };
    // 跳跃蓄力
    this.jumpChargeTime = 0;
    this.isCharging = false;
    // 相机控制
    this.cameraOrbit = 0; // 水平旋转
    this.cameraPitch = 0.3; // 俯仰
    // 事件
    this._bindEvents();
  }

  _bindEvents() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      // 防止空格滚动
      if (['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });
    // 鼠标
    this.canvas.addEventListener('click', () => {
      if (!this.mouse.locked) {
        this.canvas.requestPointerLock?.();
      }
    });
    document.addEventListener('pointerlockchange', () => {
      this.mouse.locked = document.pointerLockElement === this.canvas;
    });
    document.addEventListener('mousemove', (e) => {
      if (this.mouse.locked) {
        this.mouse.dx += e.movementX;
        this.mouse.dy += e.movementY;
      }
    });
  }

  update(dt) {
    // === 按键映射 ===
    this.input.accel = this.keys['KeyW'] ? 1 : 0;
    this.input.brake = this.keys['KeyS'] ? 1 : 0;
    let steer = 0;
    if (this.keys['KeyA']) steer -= 1;
    if (this.keys['KeyD']) steer += 1;
    this.input.steer = steer;

    // 跳跃 (蓄力)
    if (this.keys['Space'] && !this.isCharging) {
      this.isCharging = true;
      this.jumpChargeTime = 0;
    }
    if (this.keys['Space'] && this.isCharging) {
      this.jumpChargeTime += dt;
      this.jumpChargeTime = Math.min(this.jumpChargeTime, 0.4);
    }
    if (!this.keys['Space'] && this.isCharging) {
      this.input.jump = true;
      this.input.jumpPower = 1 + this.jumpChargeTime * 1.5;
      this.isCharging = false;
      this.jumpChargeTime = 0;
    } else {
      this.input.jump = false;
      this.input.jumpPower = 1;
    }

    // 视角切换 (C)
    this.input.switchCamera = this._justPressed('KeyC');
    // 重置 (R)
    this.input.reset = this._justPressed('KeyR');
    // 暂停 (ESC)
    this.input.pause = this._justPressed('Escape');

    // 鼠标视角
    const sensitivity = 0.003;
    this.cameraOrbit -= this.mouse.dx * sensitivity;
    this.cameraPitch = Math.max(-0.3, Math.min(0.8, this.cameraPitch - this.mouse.dy * sensitivity));
    this.mouse.dx = 0;
    this.mouse.dy = 0;
  }

  _justPressed(code) {
    if (this.keys[code]) {
      this.keys[code] = false; // 消费一次
      return true;
    }
    return false;
  }

  reset() {
    this.keys = {};
    this.input = { accel: 0, brake: 0, steer: 0, jump: false, jumpPower: 1, switchCamera: false, reset: false, pause: false };
    this.mouse.dx = 0;
    this.mouse.dy = 0;
  }
}
