// Physics.js - Q版轻量化物理系统
import * as THREE from 'three';
import { clamp, lerp, damp } from './Utils.js';

export class PhysicsSystem {
  constructor() {
    // 玩家物理状态
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.speed = 0; // 前进速度
    this.lateralVel = 0; // 横向速度
    this.airTime = 0; // 空中时间
    this.isAirborne = false;
    this.isCrashed = false;
    this.crashTimer = 0;
    this.groundHeight = 0;
    this.slopeAngle = 0; // 当前坡度角度
    this.steerAngle = 0; // 当前转向角
    this.rotationY = 0; // 朝向
    this.rotationZ = 0; // 翻滚(空中平衡)
    this.trickRotation = 0; // 空中特技旋转量
    this.onMud = false;

    // 参数 (Q版弱化物理)
    this.maxSpeed = 25; // 最大速度
    this.accelForce = 12; // 加速力
    this.brakeForce = 18; // 刹车力
    this.gravity = 25; // 重力
    this.airGravity = 18; // 空中重力(稍弱，Q版飘)
    this.friction = 0.5; // 地面摩擦
    this.turnRate = 80; // 转向速率
    this.airControlFactor = 0.3; // 空中控制力
    this.boostSlopeThreshold = deg2rad(3); // 坡度加速阈值
    this.crashAngleThreshold = deg2rad(55); // 摔车角度阈值
    this.jumpForce = 8; // 跳跃力
    this.jumpChargeMax = 1.5; // 蓄力跳最大倍率
    this.trickThreshold = deg2rad(90); // 特技判定阈值
  }

  // 初始化位置
  reset(startPos, startDir) {
    this.position.copy(startPos);
    this.velocity.set(0, 0, 0);
    this.speed = 0;
    this.lateralVel = 0;
    this.airTime = 0;
    this.isAirborne = false;
    this.isCrashed = false;
    this.crashTimer = 0;
    this.rotationY = startDir;
    this.rotationZ = 0;
    this.trickRotation = 0;
    this.steerAngle = 0;
  }

  // 主更新
  update(dt, input, track, playerModel) {
    if (this.isCrashed) {
      this.crashTimer += dt;
      if (playerModel) playerModel.crashAnimation(this.crashTimer);
      return;
    }

    // === 地面检测 ===
    this.groundHeight = track.getHeight(this.position.x, this.position.z);
    const heightAbove = this.position.y - this.groundHeight;

    // 判断是否在空中
    if (heightAbove > 0.3 && !input.jump) {
      this.isAirborne = true;
    } else if (heightAbove <= 0.05 && this.velocity.y <= 0) {
      this.isAirborne = false;
      // 落地处理
      if (this.airTime > 0.3) {
        this._onLand(playerModel, track);
      }
      this.airTime = 0;
      this.position.y = this.groundHeight;
      this.velocity.y = 0;
    }

    if (this.isAirborne) {
      this.airTime += dt;
      this._updateAir(dt, input, playerModel);
    } else {
      this._updateGround(dt, input, track, playerModel);
    }

    // === 障碍物碰撞 ===
    this._checkObstacles(track, playerModel);

    // === 赛道边界 ===
    this._checkTrackBounds(track);
  }

  _updateGround(dt, input, track, playerModel) {
    // 前进方向
    const forward = new THREE.Vector3(Math.sin(this.rotationY), 0, Math.cos(this.rotationY));

    // === 坡度机制 ===
    // 计算前方坡度
    const lookAhead = 0.5;
    const aheadX = this.position.x + forward.x * lookAhead;
    const aheadZ = this.position.z + forward.z * lookAhead;
    const aheadY = track.getHeight(aheadX, aheadZ);
    this.slopeAngle = Math.atan2(aheadY - this.groundHeight, lookAhead);

    // 下坡加速 / 上坡减速
    const slopeBoost = Math.sin(this.slopeAngle) * this.gravity * 0.8;
    this.speed += slopeBoost * dt;

    // 加速输入
    if (input.accel > 0) {
      this.speed += this.accelForce * input.accel * dt;
      if (playerModel && Math.random() < 0.1) {
        // 踩踏音效由外部触发
      }
    }
    // 刹车
    if (input.brake > 0) {
      this.speed -= this.brakeForce * input.brake * dt;
    }
    // 摩擦
    this.speed *= (1 - this.friction * dt);

    // 限速
    this.speed = clamp(this.speed, -5, this.maxSpeed);

    // === 转向 ===
    // 高速降低转向幅度
    const speedFactor = clamp(1 - Math.abs(this.speed) / this.maxSpeed * 0.5, 0.5, 1);
    const turnAmount = input.steer * this.turnRate * speedFactor * dt;
    this.rotationY += turnAmount * (this.speed >= 0 ? 1 : -1) * 0.017453;
    this.steerAngle = damp(this.steerAngle, input.steer * 30, 8, dt);

    // === 泥地打滑 ===
    this.onMud = false;
    for (const obs of track.obstacles) {
      if (obs.isMud) {
        const d = this.position.distanceTo(obs.pos);
        if (d < obs.radius) {
          this.onMud = true;
          // 轻微打滑 - 增加横向漂移
          this.lateralVel += input.steer * 3 * dt;
          break;
        }
      }
    }
    this.lateralVel *= (1 - 3 * dt); // 横向阻尼

    // === 跳跃 ===
    if (input.jump) {
      this.isAirborne = true;
      this.velocity.y = this.jumpForce * input.jumpPower;
      this.airTime = 0;
    }

    // === 应用位移 ===
    const moveDir = new THREE.Vector3(Math.sin(this.rotationY), 0, Math.cos(this.rotationY));
    this.position.x += moveDir.x * this.speed * dt;
    this.position.z += moveDir.z * this.speed * dt;
    // 横向漂移
    const right = new THREE.Vector3(Math.cos(this.rotationY), 0, -Math.sin(this.rotationY));
    this.position.x += right.x * this.lateralVel * dt;
    this.position.z += right.z * this.lateralVel * dt;

    // 跟随地面高度
    this.position.y = this.groundHeight;

    // 更新模型
    if (playerModel) {
      playerModel.group.position.copy(this.position);
      playerModel.group.rotation.y = this.rotationY;
    }
  }

  _updateAir(dt, input, playerModel) {
    // 重力
    this.velocity.y -= this.airGravity * dt;

    // 空中控制 (弱化版)
    const airControl = this.airControlFactor;
    // 前进速度缓慢衰减
    this.speed *= (1 - 0.15 * dt);
    // 转向 (空中微调)
    this.rotationY += input.steer * this.turnRate * airControl * 0.017453 * dt;

    // 空中姿态调整 (AD调整翻滚)
    this.rotationZ += input.steer * 2 * dt;
    this.trickRotation += Math.abs(input.steer * 2 * dt);

    // 下压 (S)
    if (input.brake > 0) {
      this.velocity.y -= 5 * dt; // 下压加速
    }

    // 应用位移
    const moveDir = new THREE.Vector3(Math.sin(this.rotationY), 0, Math.cos(this.rotationY));
    this.position.x += moveDir.x * this.speed * dt;
    this.position.z += moveDir.z * this.speed * dt;
    this.position.y += this.velocity.y * dt;

    // 更新模型
    if (playerModel) {
      playerModel.group.position.copy(this.position);
      playerModel.group.rotation.y = this.rotationY;
    }
  }

  _onLand(playerModel, track) {
    // 检查落地角度
    const landAngle = Math.abs(this.rotationZ);
    if (landAngle > this.crashAngleThreshold) {
      // 摔车
      this._crash(playerModel);
      return;
    }
    // 平稳落地 - 特技加分
    if (this.trickRotation > this.trickThreshold) {
      // 有特技
    }
    // 重置空中状态
    this.rotationZ = 0;
    // 落地效果
  }

  _crash(playerModel) {
    this.isCrashed = true;
    this.crashTimer = 0;
    this.speed = 0;
    this.velocity.set(0, 0, 0);
  }

  _checkObstacles(track, playerModel) {
    for (const obs of track.obstacles) {
      if (obs.isMud) continue; // 泥地不打碰撞
      const d = this.position.distanceTo(obs.pos);
      if (d < obs.radius + 0.5) {
        // 碰撞 - 轻弹开 + 减速
        const pushDir = this.position.clone().sub(obs.pos).normalize();
        this.position.x += pushDir.x * 0.3;
        this.position.z += pushDir.z * 0.3;
        this.speed *= 0.5;
        this.lateralVel += pushDir.x * 2;
        break;
      }
    }
  }

  _checkTrackBounds(track) {
    // 不太需要严格限制，赛道两侧有缓坡
  }

  // 获取特技得分
  getTrickScore() {
    let score = 0;
    if (this.trickRotation > this.trickThreshold) {
      score = Math.floor(this.trickRotation / this.trickThreshold) * 50;
    }
    if (this.airTime > 1.0 && !this.isCrashed) {
      score += 30; // 长时间滞空加分
    }
    return score;
  }

  // 检查是否到达终点
  checkFinish(track) {
    return this.position.z < track.finishPos.z + 3 && this.position.distanceTo(new THREE.Vector3(track.finishPos.x, this.position.y, track.finishPos.z)) < 5;
  }
}

function deg2rad(d) { return d * Math.PI / 180; }
