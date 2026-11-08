// Track.js - Q版赛道系统
import * as THREE from 'three';
import { clamp, lerp, damp, deg2rad, randRange, pick } from './Utils.js';

// ==================== 赛道配置 ====================
export const TRACK_CONFIGS = [
  {
    name: '山林穿行',
    theme: 'forest',
    difficulty: '简单',
    colors: {
      ground: 0x6ABF69, groundDark: 0x4A8F49,
      rock: 0x9B8579, rockDark: 0x7A6B5E,
      accent: 0xFFE66D, tree: 0x4A9D5C, treeDark: 0x2E7D32,
      sky: 0x87CEEB, fog: 0xB0E0E6,
    },
    length: 200,
    width: 12,
    curves: 0.6,
    decorations: 'trees',
  },
  {
    name: '草地飞驰',
    theme: 'grass',
    difficulty: '中等',
    colors: {
      ground: 0x95E1A3, groundDark: 0x6BCB7E,
      rock: 0xC4A882, rockDark: 0xA68B6E,
      accent: 0xFF6B9D, tree: 0x66BB6A, treeDark: 0x388E3C,
      sky: 0x98D8C8, fog: 0xC8E6C9,
    },
    length: 220,
    width: 10,
    curves: 1.0,
    decorations: 'flowers',
  },
  {
    name: '浅岩坡道',
    theme: 'rock',
    difficulty: '较难',
    colors: {
      ground: 0xC9A86A, groundDark: 0xA8884E,
      rock: 0xB8A080, rockDark: 0x8E7B60,
      accent: 0xFFB347, tree: 0x8FBC8F, treeDark: 0x5D8B5D,
      sky: 0xDEB887, fog: 0xDDD0C0,
    },
    length: 250,
    width: 9,
    curves: 1.4,
    decorations: 'rocks',
  },
];

// ==================== 赛道类 ====================
export class Track {
  constructor(configIndex = 0) {
    this.config = TRACK_CONFIGS[configIndex];
    this.group = new THREE.Group();
    this.heightData = null;
    this.startPos = new THREE.Vector3(0, 5, 0);
    this.startDir = 0; // 朝向角度(弧度)
    this.finishPos = new THREE.Vector3(0, 0, -this.config.length);
    this.checkpoints = [];
    this.obstacles = [];
    this.ramps = [];
    this.decorations = [];
    this.terrainSize = 300;
    this.terrainSegs = 80;
    this.trackPoints = [];
    this._genTrackPoints();
    this._build();
  }

  // 生成赛道路径点
  _genTrackPoints() {
    const len = this.config.length;
    const segCount = 40;
    const curveFactor = this.config.curves;
    for (let i = 0; i <= segCount; i++) {
      const t = i / segCount;
      const z = -t * len;
      const x = Math.sin(t * Math.PI * curveFactor) * 15 + Math.sin(t * Math.PI * curveFactor * 2.5) * 5;
      const y = this._heightAtT(t);
      this.trackPoints.push({ x, y, z, t });
    }
    this.startPos.set(this.trackPoints[0].x, this.trackPoints[0].y + 0.5, this.trackPoints[0].z);
    this.finishPos.set(this.trackPoints[segCount].x, this.trackPoints[segCount].y + 0.5, this.trackPoints[segCount].z);
    // 朝向
    const next = this.trackPoints[1];
    this.startDir = Math.atan2(next.x - this.trackPoints[0].x, next.z - this.trackPoints[0].z);
  }

  // 沿路径的高度曲线 (从山顶到山脚)
  _heightAtT(t) {
    // 非线性下降：开始陡，后面缓
    const startH = 40;
    const endH = 0;
    const descent = 1 - Math.pow(1 - t, 1.5);
    return startH + (endH - startH) * descent;
  }

  // === 地形高度函数 (给物理用) ===
  getHeight(x, z) {
    // 找到最近的赛道点
    const t = clamp(-z / this.config.length, 0, 1);
    // 插值找到赛道中心的x和y
    const segIdx = t * (this.trackPoints.length - 1);
    const i0 = Math.floor(segIdx);
    const i1 = Math.min(i0 + 1, this.trackPoints.length - 1);
    const frac = segIdx - i0;
    const trackX = lerp(this.trackPoints[i0].x, this.trackPoints[i1].x, frac);
    const trackY = lerp(this.trackPoints[i0].y, this.trackPoints[i1].y, frac);
    // 赛道宽度内，高度贴近赛道
    const dx = x - trackX;
    const distFromTrack = Math.abs(dx);
    const trackWidth = this.config.width;
    // 赛道两侧有缓坡
    let height;
    if (distFromTrack < trackWidth * 0.5) {
      // 赛道上：基本是赛道高度，加少量颠簸
      const bump = Math.sin(x * 0.5) * Math.cos(z * 0.3) * 0.15;
      height = trackY + bump;
    } else {
      // 赛道外：随距离升高，形成山谷
      const slope = (distFromTrack - trackWidth * 0.5) * 0.5;
      const noise = Math.sin(x * 0.08) * Math.cos(z * 0.06) * 3;
      height = trackY + slope + noise;
    }
    // 起点之前保持平地
    if (z > 5) height = this.trackPoints[0].y + (z - 0) * 0.05;
    // 终点之后平地
    if (z < -this.config.length - 5) height = 0;
    return height;
  }

  // 获取赛道方向 (用于物理和相机)
  getTrackDirection(z) {
    const t = clamp(-z / this.config.length, 0, 1);
    const segIdx = t * (this.trackPoints.length - 1);
    const i0 = Math.floor(segIdx);
    const i1 = Math.min(i0 + 1, this.trackPoints.length - 1);
    const p0 = this.trackPoints[i0];
    const p1 = this.trackPoints[i1];
    const dir = new THREE.Vector3(p1.x - p0.x, 0, p1.z - p0.z).normalize();
    return dir;
  }

  // 获取最近存档点
  getNearestCheckpoint(pos) {
    let nearest = this.checkpoints[0] || this.startPos.clone();
    let minDist = Infinity;
    for (const cp of this.checkpoints) {
      const d = pos.distanceTo(cp.pos);
      if (d < minDist && cp.pos.z > pos.z - 5) {
        minDist = d;
        nearest = cp.pos;
      }
    }
    return nearest;
  }

  // ==================== 构建赛道 ====================
  _build() {
    this._buildTerrain();
    this._buildTrackSurface();
    this._buildCheckpoints();
    this._buildRamps();
    this._buildObstacles();
    this._buildDecorations();
    this._buildStartFinish();
    this._buildClouds();
  }

  // 地形网格
  _buildTerrain() {
    const size = this.terrainSize;
    const segs = this.terrainSegs;
    const geo = new THREE.PlaneGeometry(size, size * 1.5, segs, Math.floor(segs * 1.5));
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = [];
    const c = this.config.colors;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = this.getHeight(x, z);
      pos.setY(i, h);
      // 顶点颜色
      const t = clamp(-z / this.config.length, 0, 1);
      const dx = x - this._trackXAt(z);
      const distFromTrack = Math.abs(dx);
      if (distFromTrack < this.config.width * 0.5) {
        // 赛道上 - 较亮的地面色
        const col = new THREE.Color(c.ground);
        colors.push(col.r, col.g, col.b);
      } else {
        // 赛道外 - 较暗
        const col = new THREE.Color(c.groundDark);
        col.offsetHSL(0, 0, (h - this._trackYAt(z)) * 0.005);
        colors.push(col.r, col.g, col.b);
      }
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.z = -size * 0.4;
    this.group.add(mesh);
  }

  _trackXAt(z) {
    const t = clamp(-z / this.config.length, 0, 1);
    const segIdx = t * (this.trackPoints.length - 1);
    const i0 = Math.floor(segIdx);
    const i1 = Math.min(i0 + 1, this.trackPoints.length - 1);
    const frac = segIdx - i0;
    return lerp(this.trackPoints[i0].x, this.trackPoints[i1].x, frac);
  }

  _trackYAt(z) {
    const t = clamp(-z / this.config.length, 0, 1);
    const segIdx = t * (this.trackPoints.length - 1);
    const i0 = Math.floor(segIdx);
    const i1 = Math.min(i0 + 1, this.trackPoints.length - 1);
    const frac = segIdx - i0;
    return lerp(this.trackPoints[i0].y, this.trackPoints[i1].y, frac);
  }

  // 赛道表面 (视觉路径)
  _buildTrackSurface() {
    const c = this.config.colors;
    // 赛道路面 - 沿路径的条带
    const points = this.trackPoints.map(p => new THREE.Vector3(p.x, p.y + 0.05, p.z));
    const curve = new THREE.CatmullRomCurve3(points);
    const segments = 100;
    const trackWidth = this.config.width * 0.8;
    const positions = [];
    const indices = [];
    const colors = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const point = curve.getPoint(t);
      const tangent = curve.getTangent(t);
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
      const left = point.clone().add(normal.clone().multiplyScalar(-trackWidth * 0.5));
      const right = point.clone().add(normal.clone().multiplyScalar(trackWidth * 0.5));
      positions.push(left.x, left.y, left.z);
      positions.push(right.x, right.y, right.z);
      // 颜色 - 中间亮，边缘暗
      const col = new THREE.Color(c.accent).lerp(new THREE.Color(c.ground), 0.3);
      colors.push(col.r, col.g, col.b);
      colors.push(col.r, col.g, col.b);
    }
    for (let i = 0; i < segments; i++) {
      indices.push(i * 2, i * 2 + 1, i * 2 + 2);
      indices.push(i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    this.group.add(mesh);

    // 赛道边缘线 (彩色)
    const edgeGeo = new THREE.BufferGeometry();
    const edgeLPos = [];
    const edgeRPos = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const point = curve.getPoint(t);
      const tangent = curve.getTangent(t);
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
      const left = point.clone().add(normal.clone().multiplyScalar(-trackWidth * 0.5 - 0.2));
      const right = point.clone().add(normal.clone().multiplyScalar(trackWidth * 0.5 + 0.2));
      edgeLPos.push(left.x, left.y + 0.02, left.z);
      edgeRPos.push(right.x, right.y + 0.02, right.z);
    }
    const edgeLGeo = new THREE.BufferGeometry();
    edgeLGeo.setAttribute('position', new THREE.Float32BufferAttribute(edgeLPos, 3));
    const edgeLMat = new THREE.LineBasicMaterial({ color: c.accent, linewidth: 3 });
    this.group.add(new THREE.Line(edgeLGeo, edgeLMat));
    const edgeRGeo = new THREE.BufferGeometry();
    edgeRGeo.setAttribute('position', new THREE.Float32BufferAttribute(edgeRPos, 3));
    const edgeRMat = new THREE.LineBasicMaterial({ color: c.accent, linewidth: 3 });
    this.group.add(new THREE.Line(edgeRGeo, edgeRMat));
  }

  // 检查点 (存档点)
  _buildCheckpoints() {
    const cpCount = 5;
    for (let i = 1; i < cpCount; i++) {
      const t = i / cpCount;
      const idx = Math.floor(t * (this.trackPoints.length - 1));
      const p = this.trackPoints[idx];
      this.checkpoints.push({
        pos: new THREE.Vector3(p.x, p.y + 0.5, p.z),
        passed: false,
        index: i,
      });
      // 视觉 - 弧形门
      const gateGeo = new THREE.TorusGeometry(this.config.width * 0.5, 0.15, 6, 12, Math.PI);
      const gateMat = new THREE.MeshLambertMaterial({ color: this.config.colors.accent, transparent: true, opacity: 0.6 });
      const gate = new THREE.Mesh(gateGeo, gateMat);
      gate.position.set(p.x, p.y + 0.1, p.z);
      gate.rotation.x = -Math.PI / 2;
      this.group.add(gate);
    }
  }

  // 跳台
  _buildRamps() {
    const rampCount = 6 + this.config.difficulty.length;
    for (let i = 0; i < rampCount; i++) {
      const t = 0.15 + (i / rampCount) * 0.7;
      const idx = Math.floor(t * (this.trackPoints.length - 1));
      const p = this.trackPoints[idx];
      const offset = randRange(-this.config.width * 0.25, this.config.width * 0.25);
      const ramp = this._createRamp(p.x + offset, p.y, p.z, randRange(0, Math.PI));
      this.group.add(ramp);
      this.ramps.push({ pos: new THREE.Vector3(p.x + offset, p.y, p.z), mesh: ramp });
    }
  }

  _createRamp(x, y, z, rot) {
    const grp = new THREE.Group();
    // 斜面板
    const rampGeo = new THREE.BoxGeometry(2.5, 0.2, 2);
    const rampMat = new THREE.MeshLambertMaterial({ color: this.config.colors.accent });
    const ramp = new THREE.Mesh(rampGeo, rampMat);
    ramp.position.set(0, 0.5, 0);
    ramp.rotation.x = deg2rad(-15);
    grp.add(ramp);
    // 支撑
    const supGeo = new THREE.BoxGeometry(2.5, 0.5, 0.5);
    const supMat = new THREE.MeshLambertMaterial({ color: 0x8B7355 });
    const sup = new THREE.Mesh(supGeo, supMat);
    sup.position.set(0, 0.25, 0.75);
    grp.add(sup);
    grp.position.set(x, y + 0.05, z);
    grp.rotation.y = rot;
    return grp;
  }

  // 障碍物
  _buildObstacles() {
    const obsCount = 5 + Math.floor(this.config.curves * 3);
    for (let i = 0; i < obsCount; i++) {
      const t = 0.2 + (i / obsCount) * 0.6;
      const idx = Math.floor(t * (this.trackPoints.length - 1));
      const p = this.trackPoints[idx];
      const offset = randRange(-this.config.width * 0.3, this.config.width * 0.3);
      const rock = this._createRock(randRange(0.4, 0.8));
      rock.position.set(p.x + offset, p.y + 0.1, p.z);
      this.group.add(rock);
      this.obstacles.push({ pos: new THREE.Vector3(p.x + offset, p.y, p.z), radius: 0.5, mesh: rock });
    }
    // 弯道处加泥地 (打滑)
    const mudCount = 3;
    for (let i = 0; i < mudCount; i++) {
      const t = 0.25 + (i / mudCount) * 0.5;
      const idx = Math.floor(t * (this.trackPoints.length - 1));
      const p = this.trackPoints[idx];
      const mud = new THREE.Mesh(
        new THREE.CircleGeometry(randRange(2, 3.5), 16),
        new THREE.MeshLambertMaterial({ color: 0x8B7355, transparent: true, opacity: 0.6 })
      );
      mud.rotation.x = -Math.PI / 2;
      mud.position.set(p.x, p.y + 0.06, p.z);
      this.group.add(mud);
      this.obstacles.push({ pos: new THREE.Vector3(p.x, p.y, p.z), radius: 3, isMud: true, mesh: mud });
    }
    // 木桥
    const bridgeT = 0.5;
    const bIdx = Math.floor(bridgeT * (this.trackPoints.length - 1));
    const bp = this.trackPoints[bIdx];
    const bridge = this._createBridge();
    bridge.position.set(bp.x, bp.y + 0.05, bp.z);
    // 旋转使其与赛道方向对齐
    const dir = this.getTrackDirection(bp.z);
    bridge.rotation.y = Math.atan2(dir.x, dir.z);
    this.group.add(bridge);
  }

  _createRock(size) {
    const geo = new THREE.DodecahedronGeometry(size, 0);
    // 随机变形使其更圆润
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setXYZ(i, pos.getX(i) * randRange(0.8, 1.2), pos.getY(i) * randRange(0.6, 1.0), pos.getZ(i) * randRange(0.8, 1.2));
    }
    geo.computeVertexNormals();
    const mat = new THREE.MeshLambertMaterial({ color: this.config.colors.rock, flatShading: true });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  _createBridge() {
    const grp = new THREE.Group();
    // 桥面板
    const deckGeo = new THREE.BoxGeometry(this.config.width * 0.9, 0.15, 4);
    const deckMat = new THREE.MeshLambertMaterial({ color: 0xC4A265 });
    const deck = new THREE.Mesh(deckGeo, deckMat);
    deck.position.y = 0.3;
    grp.add(deck);
    // 桥栏
    for (let side of [-1, 1]) {
      const railGeo = new THREE.BoxGeometry(this.config.width * 0.9, 0.1, 0.1);
      const railMat = new THREE.MeshLambertMaterial({ color: 0xA88B4E });
      const rail = new THREE.Mesh(railGeo, railMat);
      rail.position.set(0, 0.55, side * (this.config.width * 0.45));
      grp.add(rail);
      // 栏杆柱
      for (let z = -1.8; z <= 1.8; z += 0.9) {
        const post = new THREE.Mesh(
          new THREE.BoxGeometry(0.08, 0.45, 0.08),
          railMat
        );
        post.position.set(0, 0.35, z);
        post.position.x = side * (this.config.width * 0.45);
        grp.add(post);
      }
    }
    return grp;
  }

  // 装饰物
  _buildDecorations() {
    const deco = this.config.decorations;
    if (deco === 'trees') this._addTrees();
    if (deco === 'flowers') this._addFlowers();
    if (deco === 'rocks') this._addRocks();
    // 所有赛道都加一些
    this._addTrees(0.3);
    this._addFlowers(0.3);
  }

  _addTrees(density = 1) {
    const count = Math.floor(30 * density);
    for (let i = 0; i < count; i++) {
      const x = randRange(-this.terrainSize * 0.45, this.terrainSize * 0.45);
      const z = randRange(-this.config.length - 10, 10);
      const trackX = this._trackXAt(z);
      if (Math.abs(x - trackX) < this.config.width * 0.6) continue;
      const y = this.getHeight(x, z);
      if (y < -2) continue;
      const tree = this._createTree();
      tree.position.set(x, y, z);
      const s = randRange(0.7, 1.3);
      tree.scale.set(s, s, s);
      tree.rotation.y = randRange(0, Math.PI * 2);
      this.group.add(tree);
    }
  }

  _createTree() {
    const c = this.config.colors;
    const grp = new THREE.Group();
    // 树干
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.18, 0.8, 6),
      new THREE.MeshLambertMaterial({ color: 0x8B6B47 })
    );
    trunk.position.y = 0.4;
    grp.add(trunk);
    // 树冠 - 多层圆锥
    const treeCol = pick([c.tree, c.treeDark, 0x558B2F]);
    for (let i = 0; i < 3; i++) {
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(0.8 - i * 0.15, 0.7, 6),
        new THREE.MeshLambertMaterial({ color: treeCol, flatShading: true })
      );
      cone.position.y = 0.8 + i * 0.4;
      grp.add(cone);
    }
    return grp;
  }

  _addFlowers(density = 1) {
    const count = Math.floor(40 * density);
    const flowerColors = [0xFF6B9D, 0xFFE66D, 0xFFB347, 0xC9B6E4, 0xFFFFFF];
    for (let i = 0; i < count; i++) {
      const x = randRange(-this.terrainSize * 0.4, this.terrainSize * 0.4);
      const z = randRange(-this.config.length - 5, 5);
      const trackX = this._trackXAt(z);
      if (Math.abs(x - trackX) < this.config.width * 0.4) continue;
      const y = this.getHeight(x, z);
      if (y < -1) continue;
      const flower = this._createFlower(pick(flowerColors));
      flower.position.set(x, y, z);
      const s = randRange(0.5, 0.9);
      flower.scale.set(s, s, s);
      this.group.add(flower);
    }
  }

  _createFlower(color) {
    const grp = new THREE.Group();
    // 花茎
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.3, 4),
      new THREE.MeshLambertMaterial({ color: 0x4A9D5C })
    );
    stem.position.y = 0.15;
    grp.add(stem);
    // 花瓣
    const petalMat = new THREE.MeshLambertMaterial({ color });
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      const petal = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 6, 6),
        petalMat
      );
      petal.position.set(Math.cos(angle) * 0.08, 0.3, Math.sin(angle) * 0.08);
      petal.scale.set(1, 0.5, 1);
      grp.add(petal);
    }
    // 花心
    const center = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 6, 6),
      new THREE.MeshLambertMaterial({ color: 0xFFE66D })
    );
    center.position.y = 0.3;
    grp.add(center);
    return grp;
  }

  _addRocks(density = 1) {
    const count = Math.floor(25 * density);
    for (let i = 0; i < count; i++) {
      const x = randRange(-this.terrainSize * 0.45, this.terrainSize * 0.45);
      const z = randRange(-this.config.length - 10, 10);
      const trackX = this._trackXAt(z);
      if (Math.abs(x - trackX) < this.config.width * 0.6) continue;
      const y = this.getHeight(x, z);
      if (y < -1) continue;
      const rock = this._createRock(randRange(0.3, 1.0));
      rock.position.set(x, y, z);
      const s = randRange(0.8, 2.0);
      rock.scale.set(s, s * 0.7, s);
      rock.rotation.set(randRange(0, 1), randRange(0, Math.PI * 2), randRange(0, 1));
      this.group.add(rock);
    }
  }

  // 起终点
  _buildStartFinish() {
    const c = this.config.colors;
    // 起点门
    const startGate = this._createGate(c.accent, 'START');
    startGate.position.set(this.startPos.x, this.startPos.y, this.startPos.z);
    startGate.rotation.y = this.startDir;
    this.group.add(startGate);
    // 终点门
    const finishGate = this._createGate(c.accent, 'GOAL');
    finishGate.position.set(this.finishPos.x, this.finishPos.y, this.finishPos.z);
    this.group.add(finishGate);
  }

  _createGate(color, label) {
    const grp = new THREE.Group();
    const matCol = new THREE.MeshLambertMaterial({ color });
    // 两根柱子
    for (let side of [-1, 1]) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.15, 3.5, 8),
        matCol
      );
      post.position.set(side * (this.config.width * 0.45), 1.75, 0);
      grp.add(post);
      // 柱顶小球
      const ball = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 8, 8),
        new THREE.MeshLambertMaterial({ color: 0xFFE66D })
      );
      ball.position.set(side * (this.config.width * 0.45), 3.6, 0);
      grp.add(ball);
    }
    // 横梁
    const beam = new THREE.Mesh(
      new THREE.BoxGeometry(this.config.width * 0.9 + 0.3, 0.25, 0.15),
      matCol
    );
    beam.position.y = 3.4;
    grp.add(beam);
    // 文字
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 256, 64);
    ctx.font = 'bold 40px "Comic Sans MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText(label, 128, 32);
    const tex = new THREE.CanvasTexture(canvas);
    const labelMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(this.config.width * 0.8, 0.4),
      new THREE.MeshBasicMaterial({ map: tex })
    );
    labelMesh.position.set(0, 3.4, 0.1);
    grp.add(labelMesh);
    return grp;
  }

  // 云朵
  _buildClouds() {
    const cloudCount = 12;
    for (let i = 0; i < cloudCount; i++) {
      const cloud = this._createCloud();
      cloud.position.set(
        randRange(-this.terrainSize * 0.4, this.terrainSize * 0.4),
        randRange(20, 40),
        randRange(-this.config.length, 0)
      );
      const s = randRange(0.5, 1.5);
      cloud.scale.set(s, s, s);
      this.group.add(cloud);
    }
  }

  _createCloud() {
    const grp = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
    const ballCount = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < ballCount; i++) {
      const r = randRange(1, 2);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 8), mat);
      ball.position.set(randRange(-1.5, 1.5), randRange(-0.3, 0.5), randRange(-0.5, 0.5));
      grp.add(ball);
    }
    return grp;
  }
}
