// main.js - 入口文件
import * as THREE from 'three';
import { Game } from './Game.js';

// 等待DOM加载完成
window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game-canvas');
  if (!canvas) {
    console.error('Canvas not found!');
    return;
  }
  // 初始化游戏
  const game = new Game(canvas);
  // 暴露到window方便调试
  window.game = game;
  console.log('Q版山地速降单车 - 游戏启动成功!');
});
