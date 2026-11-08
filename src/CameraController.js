// CameraController.js - 双视角系统
import * as THREE from 'three';
import { clamp, damp, lerp, deg2rad } from './Utils.js';

export class CameraController {
  constructor(camera) {
    this.camera = camera;
    this.mode = 'third'; // 'third' | 'first'
    this.target = new THREE.Vector3();
    this.smoothedPos = new THREE.Vector3();
    this.smoothedLook = new THREE.Vector3();
    this.fov = 60;
    this.targetFov = 60;
    this.shakeIntensity = 0;
    this.shakeTime = 0;
    this.transitionTime = 0;
    this.transitioning = false;
    this.prevPos = new THREE.Vector3();
    this.prevLook = new THREE.Vector3();
    this.offset = new THREE.Vector3(0, 3, 6); // 第三人称偏移
    this.firstPersonOffset = new THREE.Vector3(0, 1.4, -0.1); // 第一人称偏移(头部)
    this.cameraOrbit = 0;
    this.cameraPitch = 0.3;
    this.initialized = false;
  }

  setTarget(pos) {
    this.target.copy(pos);
    if (!this.initialized) {
      this.smoothedPos.copy(this._computeThirdPerson(pos));
      this.smoothedLook.copy(pos);
      this.initialized = true;
    }
  }

  switchMode() {
    this.transitioning = true;
    this.transitionTime = 0;
    this.prevPos.copy(this.camera.position);
    this.prevLook.copy(this.smoothedLook);
    this.mode = this.mode === 'third' ? 'first' : 'third';
  }

  shake(intensity, duration) {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    this.shakeTime = duration;
  }

  update(dt, playerPos, playerRotY, speed, maxSpeed, headPos, orbit, pitch) {
    this.cameraOrbit = orbit;
    this.cameraPitch = pitch;

    if (this.transitioning) {
      this.transitionTime += dt;
      const t = clamp(this.transitionTime / 0.5, 0, 1);
      const smoothT = t * t * (3 - 2 * t); // smoothstep
      const targetPos = this.mode === 'third'
        ? this._computeThirdPerson(playerPos, playerRotY, speed, maxSpeed)
        : this._computeFirstPerson(headPos, playerRotY);
      this.camera.position.lerpVectors(this.prevPos, targetPos, smoothT);
      const targetLook = this.mode === 'third'
        ? playerPos.clone()
        : this._computeFirstPersonLook(headPos, playerRotY);
      this.smoothedLook.lerpVectors(this.prevLook, targetLook, smoothT);
      if (t >= 1) {
        this.transitioning = false;
      }
      return;
    }

    let desiredPos, desiredLook;
    if (this.mode === 'third') {
      desiredPos = this._computeThirdPerson(playerPos, playerRotY, speed, maxSpeed);
      desiredLook = playerPos.clone().add(new THREE.Vector3(0, 0.5, 0));
    } else {
      desiredPos = this._computeFirstPerson(headPos, playerRotY);
      desiredLook = this._computeFirstPersonLook(headPos, playerRotY);
    }

    // 平滑跟随
    const followL = this.mode === 'third' ? 5 : 15;
    this.smoothedPos.x = damp(this.smoothedPos.x, desiredPos.x, followL, dt);
    this.smoothedPos.y = damp(this.smoothedPos.y, desiredPos.y, followL, dt);
    this.smoothedPos.z = damp(this.smoothedPos.z, desiredPos.z, followL, dt);
    this.smoothedLook.x = damp(this.smoothedLook.x, desiredLook.x, followL, dt);
    this.smoothedLook.y = damp(this.smoothedLook.y, desiredLook.y, followL, dt);
    this.smoothedLook.z = damp(this.smoothedLook.z, desiredLook.z, followL, dt);

    // FOV - 高速拉远
    this.targetFov = 60 + (speed / maxSpeed) * 12;
    this.fov = damp(this.fov, this.targetFov, 3, dt);
    this.camera.fov = this.fov;
    this.camera.updateProjectionMatrix();

    // 镜头震动
    let shakeX = 0, shakeY = 0;
    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      const s = this.shakeIntensity * (this.shakeTime > 0 ? 1 : 0);
      shakeX = (Math.random() - 0.5) * s;
      shakeY = (Math.random() - 0.5) * s;
      if (this.shakeTime <= 0) this.shakeIntensity = 0;
    }

    this.camera.position.set(this.smoothedPos.x + shakeX, this.smoothedPos.y + shakeY, this.smoothedPos.z);
    this.camera.lookAt(this.smoothedLook);
  }

  _computeThirdPerson(playerPos, rotY, speed, maxSpeed) {
    // 后上方偏移，高速拉远
    const speedZoom = 1 + (speed / maxSpeed) * 0.3;
    const dist = this.offset.z * speedZoom;
    const height = this.offset.y;
    // 加入鼠标环绕
    const orbitAngle = rotY + Math.PI + this.cameraOrbit;
    const x = playerPos.x + Math.sin(orbitAngle) * dist;
    const z = playerPos.z + Math.cos(orbitAngle) * dist;
    const y = playerPos.y + height + this.cameraPitch * 2;
    return new THREE.Vector3(x, y, z);
  }

  _computeFirstPerson(headPos, rotY) {
    // 绑定骑手头部，加入鼠标视角
    const lookOffset = 0.3;
    const x = headPos.x;
    const y = headPos.y;
    const z = headPos.z;
    return new THREE.Vector3(x, y, z);
  }

  _computeFirstPersonLook(headPos, rotY) {
    // 视线方向 = 玩家朝向 + 鼠标偏移
    const angle = rotY + this.cameraOrbit;
    const lookDist = 10;
    const x = headPos.x + Math.sin(angle) * lookDist;
    const z = headPos.z + Math.cos(angle) * lookDist;
    const y = headPos.y + this.cameraPitch - 0.1 - lookDist * 0.02;
    return new THREE.Vector3(x, y, z);
  }
}
