/**
 * 西湖 · 一湖烟水 —— 装配入口
 */
import { WestLakeApp } from './core/app.js';
import { createTerrain } from './world/terrain.js';
import { createWater } from './world/water.js';
import { createCauseways } from './world/causeways.js';
import { createArchitecture } from './world/architecture.js';
import { createVegetation } from './world/vegetation.js';
import { createAtmosphere } from './world/atmosphere.js';
import { createUI } from './ui/ui.js';
import { VIEWS, VIEW_ORDER } from './core/contract.js';

const params = new URLSearchParams(location.search);
const quality = params.get('q') || 'high';
const startTime = params.has('t') ? Number(params.get('t')) : 0.72;
const startView = params.get('view') || 'hero';
const still = Number(params.get('still') || 0);

const boot = document.getElementById('boot');
const bar = document.getElementById('boot-bar');
const status = document.getElementById('boot-status');
const percent = document.getElementById('boot-percent');

function progress(v, text) {
  if (bar) bar.style.width = `${Math.round(v * 100)}%`;
  if (status && text) status.textContent = text;
  if (percent) percent.textContent = `${Math.round(v * 100)}%`;
}
function hideBoot() {
  boot.classList.add('is-done');
  document.body.classList.remove('is-loading');
  document.getElementById('ui').setAttribute('aria-hidden', 'false');
  setTimeout(() => { boot.style.display = 'none'; }, 1200);
}
const frameBreak = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

async function loadJSON(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.json();
}

async function bootApp() {
  const t0 = performance.now();
  window.__TIMINGS = {};
  progress(0.02, '正在研墨，铺开湖山…');
  const base = window.__DATA_BASE__ || './';
  const [data, grid] = await Promise.all([
    window.__WESTLAKE_DATA__ || loadJSON(base + 'data/westlake.json'),
    window.__TERRAIN_GRID__ || loadJSON(base + 'data/terrain-grid.json'),
  ]);
  window.__DATA = data;
  progress(0.10, '正在读湖岸、六桥与三岛…');
  await frameBreak();

  const app = new WestLakeApp({
    container: document.getElementById('stage'),
    quality,
    time: startTime,
  });
  await app.init();
  window.__app = app;
  window.__TIMINGS.app = Math.round(performance.now() - t0);
  progress(0.20, '正在铺展一万二千亩湖山…');
  await frameBreak();

  const terrain = createTerrain(app.scene, data, grid, quality);
  app.terrain = terrain;
  progress(0.44, '正在引入湖水与真实高程…');
  await frameBreak();

  const water = createWater(app.scene, data, quality);
  app.water = water;
  progress(0.55, '正在架起苏堤、白堤与六桥…');
  await frameBreak();

  const causeways = createCauseways(app.scene, data, terrain.heightAt);
  app.causeways = causeways;
  progress(0.70, '正在起塔、筑寺、点亭…');
  await frameBreak();

  const architecture = createArchitecture(app.scene, data, terrain.heightAt);
  app.architecture = architecture;
  progress(0.84, '正在植桃柳、种荷、放鹤…');
  await frameBreak();

  const vegetation = createVegetation(app.scene, data, terrain, quality);
  app.vegetation = vegetation;
  const atmosphere = createAtmosphere(app.scene, app);
  app.atmosphere = atmosphere;
  progress(0.92, '正在调试天光与水色…');
  await frameBreak();

  // 阴影：主要建筑和塔
  if (app.shadow) {
    for (const m of architecture.shadowCasters) app.shadow.addShadowCaster(m, true);
    for (const m of [app.architecture?.nodes?.leifeng, app.architecture?.nodes?.baochu]) {
      if (m) for (const cm of m.getChildMeshes()) { if (cm.material && cm.material !== app.materials.window) app.shadow.addShadowCaster(cm, false); }
    }
  }

  // 水面反射（只加入有视觉重量的一批）
  const reflect = [app.sky, terrain.terrain, ...terrain.ranges.mountains, ...(terrain.city.cityMeshes || [])];
  for (const m of architecture.root.getChildMeshes()) {
    if (reflect.length > 220) break;
    if (m.material && m.material !== app.materials.window && m.material !== app.materials.lantern) reflect.push(m);
  }
  water.addReflection(reflect);

  // 天空单独放在渲染组 0，其余景物组 1：确保天幕永远不会盖住地形。
  app.sky.renderingGroupId = 0;
  for (const m of app.scene.meshes) if (m !== app.sky) m.renderingGroupId = 1;

  app.updaters.push(
    (t, dt) => terrain.update(t, dt, app),
    (t, dt) => water.update(t, dt, app),
    (t, dt) => causeways.update(t, dt, app),
    (t, dt) => architecture.update(t, dt, app),
    (t, dt) => vegetation.update(t, dt, app),
    (t, dt) => atmosphere.update(t, dt, app),
  );

  const ui = createUI(app, data);
  app.ui = ui;
  window.__TIMINGS.world = Math.round(performance.now() - t0);
  window.__TIMINGS.meshes = app.scene.meshes.length;

  const initial = VIEWS[startView] ? startView : 'hero';
  app.setView(initial, true);
  if (!still && initial === 'hero') {
    // 电影感开场：从云端缓缓落到湖上
    app.camera.radius = 7800;
    app.camera.beta = 0.86;
    app.camera.alpha = 0.88;
    app.camera.target.set(0, 10, 500);
    app.setView('hero');
  }

  progress(1.0, '湖山已在眼前');
  if (still) app.stillAfter = still;
  window.__READY__ = true;
  hideBoot();
  app.start();
  setTimeout(() => {
    ui.toast('拖拽环绕 · 滚轮缩放 · 点击湖山阅读故事', 4600);
  }, 1300);

  window.addEventListener('beforeunload', () => app.stop());
  return app;
}

bootApp().catch((err) => {
  console.error('[boot] 西湖生成失败', err);
  progress(1.0, '湖山未能展开：' + (err?.message || err));
  if (status) status.style.color = '#ff8a7a';
  window.__BOOT_ERROR__ = String(err?.stack || err);
});
