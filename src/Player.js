// Player.js - Q版角色与单车模型
import * as THREE from 'three';
import { clamp, lerp, damp, deg2rad } from './Utils.js';

export class PlayerModel {
  constructor() {
    this.group = new THREE.Group();
    this.bike = new THREE.Group();
    this.rider = new THREE.Group();
    this.wheelFront = null;
    this.wheelRear = null;
    this.body = null;
    this.head = null;
    this.leftArm = null;
    this.rightArm = null;
    this.leftLeg = null;
    this.rightLeg = null;
    this._buildBike();
    this._buildRider();
    this.group.add(this.bike);
    this.group.add(this.rider);
    // 状态
    this.wheelRot = 0;
    this.idleTime = 0;
    this.leanAngle = 0;
    this.targetLean = 0;
    this.airTilt = 0;
    this.targetAirTilt = 0;
    this.legPhase = 0;
    this.isAirborne = false;
    this.pedalSpeed = 0;
    // 头部高度位置（用于第一人称相机）
    this.headWorldPos = new THREE.Vector3();
  }

  // === 单车模型 ===
  _buildBike() {
    const wheelGeo = new THREE.TorusGeometry(0.42, 0.12, 8, 16);
    const tireMat = new THREE.MeshLambertMaterial({ color: 0x2A2A3A });
    const hubMat = new THREE.MeshLambertMaterial({ color: 0xCCCCCC });

    // 前轮
    this.wheelFront = new THREE.Group();
    const frontTire = new THREE.Mesh(wheelGeo, tireMat);
    const frontHub = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 12), hubMat);
    frontHub.rotation.x = deg2rad(90);
    this.wheelFront.add(frontTire);
    this.wheelFront.add(frontHub);
    this.wheelFront.position.set(0, 0.42, 0.6);
    this.bike.add(this.wheelFront);

    // 后轮
    this.wheelRear = new THREE.Group();
    const rearTire = new THREE.Mesh(wheelGeo, tireMat);
    const rearHub = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 12), hubMat);
    rearHub.rotation.x = deg2rad(90);
    this.wheelRear.add(rearTire);
    this.wheelRear.add(rearHub);
    this.wheelRear.position.set(0, 0.42, -0.6);
    this.bike.add(this.wheelRear);

    // 车架 - 圆角立方体
    const frameMat = new THREE.MeshLambertMaterial({ color: 0xFF6B9D });
    const frameGeo = new THREE.BoxGeometry(0.12, 0.12, 1.0);
    // 圆角效果用细分
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.position.set(0, 0.5, 0);
    this.bike.add(frame);

    // 座管
    const seatTube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8),
      new THREE.MeshLambertMaterial({ color: 0x2A2A3A })
    );
    seatTube.position.set(0, 0.62, -0.3);
    this.bike.add(seatTube);

    // 座椅
    const seat = new THREE.Mesh(
      new THREE.BoxGeometry(0.25, 0.08, 0.3),
      new THREE.MeshLambertMaterial({ color: 0x4ECDC4 })
    );
    seat.position.set(0, 0.78, -0.3);
    this.bike.add(seat);

    // 车把管
    const handleTube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.4, 8),
      new THREE.MeshLambertMaterial({ color: 0x2A2A3A })
    );
    handleTube.position.set(0, 0.75, 0.5);
    this.bike.add(handleTube);

    // 车把
    const handlebar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.5, 8),
      new THREE.MeshLambertMaterial({ color: 0xFFB347 })
    );
    handlebar.rotation.z = deg2rad(90);
    handlebar.position.set(0, 0.95, 0.5);
    this.bike.add(handlebar);

    // 前叉
    const forkL = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.55, 6),
      new THREE.MeshLambertMaterial({ color: 0x2A2A3A })
    );
    forkL.position.set(0.08, 0.55, 0.6);
    forkL.rotation.x = deg2rad(15);
    this.bike.add(forkL);
    const forkR = forkL.clone();
    forkR.position.x = -0.08;
    this.bike.add(forkR);

    // 脚踏曲柄
    this.crankL = new THREE.Group();
    const crankArmL = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.15, 0.04),
      new THREE.MeshLambertMaterial({ color: 0xCCCCCC })
    );
    this.crankL.add(crankArmL);
    this.crankL.position.set(0.08, 0.35, 0);
    this.bike.add(this.crankL);

    this.crankR = new THREE.Group();
    const crankArmR = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.15, 0.04),
      new THREE.MeshLambertMaterial({ color: 0xCCCCCC })
    );
    this.crankR.add(crankArmR);
    this.crankR.position.set(-0.08, 0.35, 0);
    this.bike.add(this.crankR);
  }

  // === 骑手模型 ===
  _buildRider() {
    // 身体 - 圆润胖嘟嘟
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x4ECDC4 });
    const bodyGeo = new THREE.CapsuleGeometry(0.2, 0.25, 4, 8);
    this.body = new THREE.Mesh(bodyGeo, bodyMat);
    this.body.position.set(0, 0.95, -0.2);
    this.rider.add(this.body);

    // 头 - 大头
    const headMat = new THREE.MeshLambertMaterial({ color: 0xFFE0BD });
    const headGeo = new THREE.SphereGeometry(0.28, 16, 16);
    this.head = new THREE.Mesh(headGeo, headMat);
    this.head.position.set(0, 1.4, -0.15);
    this.rider.add(this.head);

    // 头盔
    const helmetMat = new THREE.MeshLambertMaterial({ color: 0xFF6B9D });
    const helmetGeo = new THREE.SphereGeometry(0.3, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.55);
    this.helmet = new THREE.Mesh(helmetGeo, helmetMat);
    this.helmet.position.set(0, 1.4, -0.15);
    this.rider.add(this.helmet);

    // 头盔顶饰 - 小球
    const helmetTop = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 8, 8),
      new THREE.MeshLambertMaterial({ color: 0xFFE66D })
    );
    helmetTop.position.set(0, 1.68, -0.15);
    this.rider.add(helmetTop);

    // 眼睛
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x2A2A3A });
    const eyeGeo = new THREE.SphereGeometry(0.04, 8, 8);
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(0.1, 1.42, 0.1);
    this.rider.add(eyeL);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(-0.1, 1.42, 0.1);
    this.rider.add(eyeR);

    // 腮红
    const blushMat = new THREE.MeshBasicMaterial({ color: 0xFF9FAD, transparent: true, opacity: 0.5 });
    const blushGeo = new THREE.CircleGeometry(0.05, 8);
    const blushL = new THREE.Mesh(blushGeo, blushMat);
    blushL.position.set(0.16, 1.36, 0.08);
    blushL.rotation.y = deg2rad(-20);
    this.rider.add(blushL);
    const blushR = new THREE.Mesh(blushGeo, blushMat);
    blushR.position.set(-0.16, 1.36, 0.08);
    blushR.rotation.y = deg2rad(20);
    this.rider.add(blushR);

    // 手臂
    const armMat = new THREE.MeshLambertMaterial({ color: 0x4ECDC4 });
    const armGeo = new THREE.CapsuleGeometry(0.06, 0.2, 4, 6);
    this.rightArm = new THREE.Group();
    const armR = new THREE.Mesh(armGeo, armMat);
    this.rightArm.add(armR);
    this.rightArm.position.set(0.22, 1.05, 0.15);
    this.rightArm.rotation.x = deg2rad(-50);
    this.rider.add(this.rightArm);

    this.leftArm = new THREE.Group();
    const armL = new THREE.Mesh(armGeo, armMat);
    this.leftArm.add(armL);
    this.leftArm.position.set(-0.22, 1.05, 0.15);
    this.leftArm.rotation.x = deg2rad(-50);
    this.rider.add(this.leftArm);

    // 手
    const handMat = new THREE.MeshLambertMaterial({ color: 0xFFE0BD });
    const handGeo = new THREE.SphereGeometry(0.07, 8, 8);
    const handR = new THREE.Mesh(handGeo, handMat);
    handR.position.set(0, -0.15, 0);
    this.rightArm.add(handR);
    const handL = new THREE.Mesh(handGeo, handMat);
    handL.position.set(0, -0.15, 0);
    this.leftArm.add(handL);

    // 腿
    const legMat = new THREE.MeshLambertMaterial({ color: 0x2A2A3A });
    const legGeo = new THREE.CapsuleGeometry(0.07, 0.22, 4, 6);
    this.rightLeg = new THREE.Group();
    const legR = new THREE.Mesh(legGeo, legMat);
    this.rightLeg.add(legR);
    this.rightLeg.position.set(0.08, 0.7, -0.15);
    this.rider.add(this.rightLeg);

    this.leftLeg = new THREE.Group();
    const legL = new THREE.Mesh(legGeo, legMat);
    this.leftLeg.add(legL);
    this.leftLeg.position.set(-0.08, 0.7, -0.15);
    this.rider.add(this.leftLeg);

    // 鞋
    const shoeMat = new THREE.MeshLambertMaterial({ color: 0xFFB347 });
    const shoeGeo = new THREE.BoxGeometry(0.1, 0.06, 0.16);
    const shoeR = new THREE.Mesh(shoeGeo, shoeMat);
    shoeR.position.set(0, -0.18, 0.03);
    this.rightLeg.add(shoeR);
    const shoeL = new THREE.Mesh(shoeGeo, shoeMat);
    shoeL.position.set(0, -0.18, 0.03);
    this.leftLeg.add(shoeL);
  }

  // === 动画更新 ===
  update(dt, speed, isAirborne, steerInput, accelInput, brakeInput) {
    this.idleTime += dt;
    this.isAirborne = isAirborne;
    this.pedalSpeed = Math.abs(speed) * 1.5;

    // 轮子旋转
    this.wheelRot += this.pedalSpeed * dt;
    this.wheelFront.rotation.x = this.wheelRot;
    this.wheelRear.rotation.x = this.wheelRot;

    // 脚踏曲柄旋转
    this.crankL.rotation.x = this.wheelRot;
    this.crankR.rotation.x = this.wheelRot + Math.PI;

    // 腿部踩踏动画
    this.legPhase += this.pedalSpeed * dt;
    if (isAirborne) {
      // 空中收腿
      this.rightLeg.rotation.x = damp(this.rightLeg.rotation.x, deg2rad(20), 8, dt);
      this.leftLeg.rotation.x = damp(this.leftLeg.rotation.x, deg2rad(-10), 8, dt);
    } else {
      const legSwing = Math.sin(this.legPhase) * 0.3;
      this.rightLeg.rotation.x = damp(this.rightLeg.rotation.x, legSwing, 10, dt);
      this.leftLeg.rotation.x = damp(this.leftLeg.rotation.x, -legSwing, 10, dt);
    }

    // 身体前倾/后仰
    if (accelInput > 0) {
      this.targetLean = deg2rad(8);
    } else if (brakeInput > 0) {
      this.targetLean = deg2rad(-10);
    } else {
      this.targetLean = 0;
    }
    this.leanAngle = damp(this.leanAngle, this.targetLean, 6, dt);
    this.rider.rotation.x = this.leanAngle;

    // 转向倾斜
    this.bike.rotation.z = damp(this.bike.rotation.z, steerInput * deg2rad(8), 8, dt);
    this.rider.rotation.z = damp(this.rider.rotation.z, steerInput * deg2rad(5), 6, dt);

    // 空中摆动
    if (isAirborne) {
      this.targetAirTilt = steerInput * deg2rad(15);
      this.airTilt = damp(this.airTilt, this.targetAirTilt, 4, dt);
      this.group.rotation.z = this.airTilt;
      // 轻微晃动
      const wobble = Math.sin(this.idleTime * 3) * 0.03;
      this.rider.rotation.z += wobble;
    } else {
      this.airTilt = damp(this.airTilt, 0, 5, dt);
      this.group.rotation.z = this.airTilt;
    }

    // idle 轻微晃动
    if (Math.abs(speed) < 0.5) {
      const idleWobble = Math.sin(this.idleTime * 2) * 0.02;
      this.rider.rotation.z += idleWobble;
      this.head.position.y = 1.4 + Math.sin(this.idleTime * 2) * 0.01;
    }

    // 更新头部世界位置 (用于第一人称相机)
    this.head.getWorldPosition(this.headWorldPos);
  }

  // 获取头部位置 (第一人称用)
  getHeadPosition() {
    this.head.getWorldPosition(this.headWorldPos);
    return this.headWorldPos;
  }

  // 撞车动画
  crashAnimation(t) {
    // 简单的弹跳效果
    this.rider.position.y = Math.sin(t * 10) * 0.2 * Math.exp(-t * 3);
    this.rider.rotation.z = Math.sin(t * 8) * 0.3 * Math.exp(-t * 3);
  }

  resetAnimation() {
    this.rider.position.set(0, 0, 0);
    this.rider.rotation.set(0, 0, 0);
    this.leanAngle = 0;
    this.airTilt = 0;
    this.bike.rotation.z = 0;
  }
}
