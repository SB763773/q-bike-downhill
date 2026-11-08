// Utils.js - 工具函数
export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (t) => t * t * (3 - 2 * t);
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));

export const randRange = (min, max) => min + Math.random() * (max - min);
export const randInt = (min, max) => Math.floor(randRange(min, max + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export const deg2rad = (d) => (d * Math.PI) / 180;
export const rad2deg = (r) => (r * 180) / Math.PI;

// 平滑曲线 - Catmull-Rom spline 插值
export function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
    z: 0.5 * ((2 * p1.z) + (-p0.z + p2.z) * t + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3),
  };
}

// 格式化时间 mm:ss.cc
export function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const c = Math.floor((seconds * 100) % 100);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${c.toString().padStart(2, '0')}`;
}

// 获取高度图某点高度
export function heightAt(x, z, heightFn) {
  if (typeof heightFn === 'function') return heightFn(x, z);
  return 0;
}

