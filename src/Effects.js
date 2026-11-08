// Effects.js - Q版轻量化特效系统
import * as THREE from 'three';
import { randRange } from './Utils.js';

export class EffectsSystem {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.trails = [];
    this.speedLines = null;
    this.dustParticles = [];
    this.starParticles = [];
    this.trailMaterial = null;
    this._initTrailMaterial();
  }

  _initTrailMaterial() {
    this.trailMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
    });
  }

  // 速度线条 (屏幕空间)
  createSpeedLines(camera) {
    const geo = new THREE.BufferGeometry();
    const count = 40;
    const positions = new Float32Array(count * 6); // 每条线2个点
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 15 + Math.random() * 25;
      const x1 = Math.cos(angle) * r;
      const y1 = Math.sin(angle) * r;
      const x2 = x1 + Math.cos(angle) * 5;
      const y2 = y1 + Math.sin(angle) * 5;
      positions[i * 6] = x1; positions[i * 6 + 1] = y1; positions[i * 6 + 2] = -10;
      positions[i * 6 + 3] = x2; positions[i * 6 + 4] = y2; positions[i * 6 + 5] = -10;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
    this.speedLines = new THREE.LineSegments(geo, mat);
    camera.add(this.speedLines);
    this.speedLines.position.set(0, 0, -10);
    this.speedLines.visible = false;
  }

  updateSpeedLines(speed, maxSpeed, camera) {
    if (!this.speedLines) return;
    const ratio = Math.min(1, speed / maxSpeed);
    if (ratio > 0.5) {
      this.speedLines.visible = true;
      this.speedLines.material.opacity = (ratio - 0.5) * 0.8;
    } else {
      this.speedLines.visible = false;
    }
  }

  // 落地粉尘
  spawnDust(position) {
    const count = 12;
    for (let i = 0; i < count; i++) {
      const geo = new THREE.SphereGeometry(0.15 + Math.random() * 0.2, 6, 6);
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(0xDDD0C0).offsetHSL(0, 0, randRange(-0.1, 0.1)),
        transparent: true,
        opacity: 0.6,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(position);
      mesh.position.y += 0.1;
      const vel = new THREE.Vector3(
        randRange(-2, 2), randRange(0.5, 2.5), randRange(-2, 2)
      );
      this.scene.add(mesh);
      this.particles.push({
        mesh, vel, life: 0.6, maxLife: 0.6, scale: 1,
      });
    }
  }

  // 跳跃星光
  spawnStars(position) {
    const count = 8;
    for (let i = 0; i < count; i++) {
      const geo = new THREE.OctahedronGeometry(0.12, 0);
      const colors = [0xFFE66D, 0xFFB347, 0xFF6B9D, 0x4ECDC4];
      const mat = new THREE.MeshBasicMaterial({
        color: colors[i % colors.length],
        transparent: true,
        opacity: 1,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(position);
      mesh.position.y += 0.5;
      const vel = new THREE.Vector3(
        randRange(-3, 3), randRange(2, 5), randRange(-3, 3)
      );
      const rotVel = new THREE.Vector3(
        randRange(-5, 5), randRange(-5, 5), randRange(-5, 5)
      );
      this.scene.add(mesh);
      this.particles.push({
        mesh, vel, rotVel, life: 0.8, maxLife: 0.8, gravity: -8, scale: 1,
      });
    }
  }

  // 加速拖尾
  spawnTrail(position, direction) {
    const geo = new THREE.SphereGeometry(0.3, 6, 6);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xB0E0E6,
      transparent: true,
      opacity: 0.3,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(position);
    mesh.position.y += 0.3;
    this.scene.add(mesh);
    this.particles.push({
      mesh, vel: new THREE.Vector3(), life: 0.5, maxLife: 0.5, scale: 1, shrink: true,
    });
  }

  // 特技加分飘字
  spawnTrickText(position, text) {
    // 用Canvas纹理创建飘字
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.font = 'bold 36px "Comic Sans MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFE66D';
    ctx.strokeStyle = '#FF6B9D';
    ctx.lineWidth = 4;
    ctx.strokeText(text, 128, 32);
    ctx.fillText(text, 128, 32);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.position.copy(position);
    sprite.position.y += 2;
    sprite.scale.set(2, 0.5, 1);
    this.scene.add(sprite);
    this.particles.push({
      mesh: sprite, vel: new THREE.Vector3(0, 3, 0), life: 1.2, maxLife: 1.2, scale: 1, isText: true,
    });
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        if (p.mesh.geometry) p.mesh.geometry.dispose();
        if (p.mesh.material) {
          if (p.mesh.material.map) p.mesh.material.map.dispose();
          p.mesh.material.dispose();
        }
        this.particles.splice(i, 1);
        continue;
      }
      p.mesh.position.x += p.vel.x * dt;
      p.mesh.position.y += p.vel.y * dt;
      p.mesh.position.z += p.vel.z * dt;
      if (p.gravity) p.vel.y += p.gravity * dt;
      if (p.rotVel) {
        p.mesh.rotation.x += p.rotVel.x * dt;
        p.mesh.rotation.y += p.rotVel.y * dt;
        p.mesh.rotation.z += p.rotVel.z * dt;
      }
      const ratio = p.life / p.maxLife;
      if (p.mesh.material) p.mesh.material.opacity = ratio;
      if (p.shrink) p.mesh.scale.setScalar(ratio);
      if (p.isText) p.mesh.position.y += 2 * dt;
    }
  }

  clear() {
    this.particles.forEach(p => {
      this.scene.remove(p.mesh);
      if (p.mesh.geometry) p.mesh.geometry.dispose();
      if (p.mesh.material) {
        if (p.mesh.material.map) p.mesh.material.map.dispose();
        p.mesh.material.dispose();
      }
    });
    this.particles = [];
  }
}
