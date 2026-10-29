/**
 * 西湖 UI：题签、十景、时间、天气、导览、信息卡、声音。
 */
import { B } from '../core/utils.js';
import { VIEWS, VIEW_ORDER, INFO, SCENES } from '../core/contract.js';

const HOTSPOTS = [
  { key: 'leifeng', name: '雷峰塔', pos: [2, 82, 1790] },
  { key: 'baochu', name: '保俶塔', pos: [-156, 72, -1480] },
  { key: 'santan', name: '三潭印月', pos: [-503, 6, 1167] },
  { key: 'duanqiao', name: '断桥', pos: [195, 8, -1209] },
  { key: 'sudi', name: '苏堤', pos: [-1000, 8, 600] },
  { key: 'huxinting', name: '湖心亭', pos: [-516, 8, 168] },
  { key: 'jingci', name: '净慈寺', pos: [-64, 20, 2097] },
  { key: 'gushan', name: '孤山', pos: [-689, 34, -442] },
];

export function createUI(app, data) {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const ui = $('#ui');
  const caption = {
    index: $('#cap-index'), total: $('#cap-total'), en: $('#cap-en'), name: $('#cap-name'),
    desc: $('#cap-desc'), coord: $('#cap-coord'),
  };
  const slider = $('#time-slider');
  const timeName = $('#time-name');
  const timeHour = $('#time-hour');
  const timeSun = $('#time-sun');
  const toastEl = $('#toast');
  let toastTimer = 0;
  let timeTimer = 0;
  let tourTimer = 0;
  let tourIndex = 0;
  let tourActive = false;
  let tourPaused = false;
  let audio = null;
  let labelsOn = true;

  function toast(text, ms = 3200) {
    const span = toastEl.querySelector('span');
    span.textContent = text;
    toastEl.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-show'), ms);
  }

  function setCaption(view, name) {
    const v = VIEWS[name] || VIEWS.hero;
    const idx = Math.max(0, VIEW_ORDER.indexOf(name)) + 1;
    caption.index.textContent = String(idx).padStart(2, '0');
    caption.total.textContent = String(VIEW_ORDER.length).padStart(2, '0');
    caption.en.textContent = v.en;
    caption.name.textContent = v.name;
    caption.desc.textContent = v.desc;
    caption.coord.textContent = name === 'aerial' ? '30°14′N · 120°08′E · 海拔 2,850 m' : '30°14′N · 120°08′E · 杭州';
    $$('.nav-item').forEach((b) => b.classList.toggle('is-active', b.dataset.view === name));
    $$('.index-list button').forEach((b) => b.classList.remove('is-active'));
    const scene = SCENES.find((s) => s.view === name);
    if (scene) {
      const b = document.querySelector(`.index-list button[data-scene="${scene.key}"]`);
      if (b) b.classList.add('is-active');
    }
  }

  function goView(name) {
    app.setView(name);
    stopTourIfManual();
    closeInfo();
  }

  function closeInfo() { $('#info-card').hidden = true; }
  function openInfo(key) {
    const info = INFO[key];
    if (!info) return;
    $('#info-index').textContent = 'NO. ' + (Object.keys(INFO).indexOf(key) + 1).toString().padStart(2, '0');
    $('#info-roof').textContent = info.roof;
    $('#info-name').textContent = info.name;
    $('#info-en').textContent = info.en;
    $('#info-sub').textContent = info.sub;
    $('#info-year').textContent = info.year;
    $('#info-height').textContent = info.height;
    $('#info-body').textContent = info.body;
    $('#info-fact').textContent = info.fact;
    $('#info-tags').innerHTML = info.tags.map((t) => `<span>${t}</span>`).join('');
    $('#info-card').hidden = false;
  }

  function pickInfo(meta) {
    if (!meta) return closeInfo();
    if (meta.key === 'water') return closeInfo();
    const map = {
      '雷峰塔': 'leifeng', '保俶塔': 'baochu', '断桥': 'duanqiao', '锦带桥': 'baidi',
      '苏堤': 'sudi', '白堤': 'baidi', '三潭印月': 'santan', '湖心亭': 'huxinting',
      '阮公墩': 'ruangong', '孤山': 'gushan', '净慈寺': 'jingci', '城隍阁': 'chenghuang',
      '六和塔': 'liuhe', '曲院风荷': 'quyuan', '花港观鱼': 'huagang', '柳浪闻莺': 'liulang',
      '平湖秋月': 'pinghu', '小瀛洲 · 三潭印月': 'santan', '小瀛洲': 'xiaoyingzhou',
    };
    const key = INFO[meta.key] ? meta.key : map[meta.name] || (INFO[meta.key] ? meta.key : null);
    if (key) openInfo(key);
  }

  // —— 时间 ——
  function setTime(t, animate = false) {
    if (animate) app.setTimeAnimated(t);
    else { app.setTime(t); updateTimeUI(); }
  }
  function updateTimeUI() {
    const p = app.palette;
    if (!p) return;
    timeName.textContent = p.label;
    timeHour.textContent = p.hour;
    slider.value = String(app.time);
    const pct = Math.max(0, Math.min(1, app.time));
    timeSun.style.left = `${8 + pct * 84}%`;
    const preset = [0.10, 0.24, 0.42, 0.72, 0.93];
    $$('.time-presets button').forEach((b, i) => b.classList.toggle('is-active', Math.abs(Number(b.dataset.time) - app.time) < 0.015));
  }
  slider.addEventListener('input', () => {
    stopTimePlay();
    app.setTime(Number(slider.value));
    updateTimeUI();
  });
  $$('.time-presets button').forEach((b) => b.addEventListener('click', () => {
    stopTimePlay();
    setTime(Number(b.dataset.time), true);
    updateTimeUI();
  }));
  function toggleTimePlay() {
    const btn = $('#btn-timeplay');
    if (timeTimer) { stopTimePlay(); return; }
    btn.setAttribute('aria-pressed', 'true');
    timeTimer = setInterval(() => {
      let t = (app.time + 0.00075) % 1;
      app.setTime(t);
      updateTimeUI();
    }, 40);
  }
  function stopTimePlay() {
    if (timeTimer) clearInterval(timeTimer);
    timeTimer = 0;
    $('#btn-timeplay').setAttribute('aria-pressed', 'false');
  }
  $('#btn-timeplay').addEventListener('click', toggleTimePlay);

  // —— 视角 ——
  $$('.nav-item').forEach((b) => b.addEventListener('click', () => goView(b.dataset.view)));
  $$('.index-list button').forEach((b) => {
    b.addEventListener('click', () => {
      const scene = SCENES.find((s) => s.key === b.dataset.scene);
      if (!scene) return;
      if (scene.key === 'quyuan') { openInfo('quyuan'); app.setView('sudi'); return; }
      if (scene.key === 'huagang') { openInfo('huagang'); app.setView('nanping'); return; }
      if (scene.key === 'pinghu') { openInfo('pinghu'); app.setView('gushan'); return; }
      if (scene.key === 'shuangfeng') { openInfo('shaungfeng'); app.setView('aerial'); return; }
      if (scene.key === 'liulang') { openInfo('liulang'); app.setView('liulang'); return; }
      goView(scene.view);
      if (INFO[scene.key]) openInfo(scene.key);
    });
  });
  $('#btn-home').addEventListener('click', () => { goView('hero'); toast('已回到西湖全景', 2200); });
  $('#btn-zoomin').addEventListener('click', () => { app.camera.radius = Math.max(30, app.camera.radius * 0.78); });
  $('#btn-zoomout').addEventListener('click', () => { app.camera.radius = Math.min(12000, app.camera.radius * 1.28); });
  $('#btn-reset').addEventListener('click', () => goView('hero'));

  // —— 天气 / 图层 / 画质 ——
  $$('#weather-seg button').forEach((b) => b.addEventListener('click', () => {
    $$('#weather-seg button').forEach((x) => x.classList.remove('is-active'));
    b.classList.add('is-active');
    app.setWeather(b.dataset.weather);
    toast(b.dataset.weather === 'clear' ? '晴 · 湖光潋滟' : b.dataset.weather === 'mist' ? '雾 · 山色空蒙' : b.dataset.weather === 'rain' ? '雨 · 烟雨西湖' : '雪 · 断桥残雪', 2600);
  }));
  $$('#quality-seg button').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.quality === app.quality) return;
    const url = new URL(location.href);
    url.searchParams.set('q', b.dataset.quality);
    location.href = url.toString();
  }));
  $('#ck-labels').addEventListener('change', (e) => { labelsOn = e.target.checked; });
  $('#ck-rotate').addEventListener('change', (e) => { app.autoRotate = e.target.checked; });
  $('#ck-water').addEventListener('change', (e) => {
    if (app.water) app.water.mesh.setEnabled(e.target.checked);
  });

  // —— 信息卡 / 关于 ——
  $('#info-close').addEventListener('click', closeInfo);
  app.on('pick', (meta) => pickInfo(meta));
  $('#btn-info').addEventListener('click', () => { $('#about').hidden = false; });
  $('#about-close').addEventListener('click', () => { $('#about').hidden = true; });

  // —— 导览 ——
  function tourStart() {
    tourActive = true;
    tourPaused = false;
    tourIndex = Math.max(0, VIEW_ORDER.indexOf(app.viewName));
    $('#tour-hud').hidden = false;
    $('#tour-play').setAttribute('aria-pressed', 'true');
    showTourStep();
    scheduleTour();
    toast('自动导览开始 · 沿湖山十景缓行', 3000);
  }
  function tourStop() {
    tourActive = false;
    clearTimeout(tourTimer);
    tourTimer = 0;
    $('#tour-hud').hidden = true;
  }
  function scheduleTour() {
    clearTimeout(tourTimer);
    if (!tourActive || tourPaused) return;
    tourTimer = setTimeout(() => {
      tourIndex = (tourIndex + 1) % VIEW_ORDER.length;
      showTourStep();
      app.setView(VIEW_ORDER[tourIndex]);
      scheduleTour();
    }, 8800);
  }
  function showTourStep() {
    const name = VIEW_ORDER[tourIndex];
    const v = VIEWS[name];
    $('#tour-idx').textContent = String(tourIndex + 1).padStart(2, '0');
    $('#tour-total').textContent = String(VIEW_ORDER.length).padStart(2, '0');
    $('#tour-name').textContent = v.name;
    $('#tour-desc').textContent = v.desc;
    $('#tour-progress').style.transition = 'none';
    $('#tour-progress').style.width = '0%';
    requestAnimationFrame(() => {
      $('#tour-progress').style.transition = `width ${tourPaused ? 0 : 8.8}s linear`;
      $('#tour-progress').style.width = tourPaused ? '0%' : '100%';
    });
  }
  function stopTourIfManual() {
    if (tourActive && app.transition) {
      // 手动点景时关闭导览
      tourStop();
    }
  }
  $('#btn-tour').addEventListener('click', () => tourActive ? tourStop() : tourStart());
  $('#tour-close').addEventListener('click', tourStop);
  $('#tour-next').addEventListener('click', () => {
    tourIndex = (tourIndex + 1) % VIEW_ORDER.length;
    showTourStep(); app.setView(VIEW_ORDER[tourIndex]); scheduleTour();
  });
  $('#tour-prev').addEventListener('click', () => {
    tourIndex = (tourIndex - 1 + VIEW_ORDER.length) % VIEW_ORDER.length;
    showTourStep(); app.setView(VIEW_ORDER[tourIndex]); scheduleTour();
  });
  $('#tour-play').addEventListener('click', (e) => {
    tourPaused = !tourPaused;
    e.currentTarget.setAttribute('aria-pressed', String(!tourPaused));
    showTourStep();
    scheduleTour();
  });

  // —— 全屏 / 截图 / 声音 / 隐藏 ——
  $('#btn-full').addEventListener('click', toggleFullscreen);
  $('#btn-shot').addEventListener('click', () => { app.capture('西湖'); toast('照片已保存', 2200); });
  function toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  }
  function toggleSound() {
    if (!audio) audio = new LakeAudio();
    const btn = $('#btn-sound');
    if (audio.on) { audio.stop(); btn.setAttribute('aria-pressed', 'false'); toast('声音已关闭', 1800); }
    else { audio.start(); btn.setAttribute('aria-pressed', 'true'); toast('湖风、水声与远处钟声', 2600); }
  }
  $('#btn-sound').addEventListener('click', toggleSound);

  const about = $('#about');
  about.addEventListener('click', (e) => { if (e.target === about) about.hidden = true; });

  // —— 热点 ——
  const hotspotRoot = $('#hotspots');
  HOTSPOTS.forEach((h) => {
    const el = document.createElement('button');
    el.className = 'hotspot';
    el.innerHTML = `<b></b><span>${h.name}</span>`;
    el.addEventListener('click', () => { openInfo(h.key); app.setView(sceneForHotspot(h.key)); });
    hotspotRoot.appendChild(el);
    h.el = el;
  });
  function sceneForHotspot(key) {
    return ({ leifeng: 'leifeng', baochu: 'duanqiao', santan: 'santan', duanqiao: 'duanqiao', sudi: 'sudi', huxinting: 'santan', jingci: 'nanping', gushan: 'gushan' })[key] || 'hero';
  }
  function updateHotspots() {
    if (!labelsOn) { HOTSPOTS.forEach((h) => h.el.classList.remove('is-visible')); return; }
    const w = window.innerWidth, hgt = window.innerHeight;
    const transform = app.scene.getTransformMatrix();
    for (const h of HOTSPOTS) {
      const p = B.Vector3.Project(new B.Vector3(...h.pos), B.Matrix.Identity(), transform, app.camera.viewport.toGlobal(w, hgt));
      const visible = p.z > 0 && p.z < 1 && p.x > 40 && p.x < w - 40 && p.y > 90 && p.y < hgt - 110;
      h.el.classList.toggle('is-visible', visible);
      if (visible) { h.el.style.left = p.x + 'px'; h.el.style.top = p.y + 'px'; }
    }
  }

  // —— 罗盘 ——
  function updateCompass() {
    let deg = ((app.camera.alpha * 180 / Math.PI) + 90 + 360) % 360;
    $('#compass-deg').textContent = String(Math.round(deg)).padStart(3, '0') + '°';
    const ring = document.querySelector('.compass-ring i');
    if (ring) ring.style.transform = `rotate(${deg}deg)`;
  }

  // —— 键盘 ——
  window.addEventListener('keydown', (e) => {
    if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
    if (e.code === 'Space') { app.autoRotate = !app.autoRotate; $('#ck-rotate').checked = app.autoRotate; e.preventDefault(); }
    if (e.key === 'f' || e.key === 'F') toggleFullscreen();
    if (e.key === 'p' || e.key === 'P') { app.capture('西湖'); toast('照片已保存', 1800); }
    if (e.key === 't' || e.key === 'T') { tourActive ? tourStop() : tourStart(); }
    if (e.key === 'i' || e.key === 'I') { about.hidden = !about.hidden; }
    if (e.key === 'm' || e.key === 'M') toggleSound();
    if (e.key === 'h' || e.key === 'H') ui.classList.toggle('is-hidden');
    if (e.key === 'Escape') { about.hidden = true; closeInfo(); if (tourActive) tourStop(); }
    const num = Number(e.key);
    if (num >= 1 && num <= 9) {
      const name = VIEW_ORDER[num - 1];
      if (name) { app.setView(name); stopTourIfManual(); }
    }
    if (num === 0) { app.setView('night'); stopTourIfManual(); }
  });

  // —— 初始 UI ——
  app.on('view', ({ name }) => setCaption(null, name));
  app.on('time', () => updateTimeUI());
  app.on('stats', (s) => {
    $('#stat-fps').textContent = Math.round(s.fps || 0);
    $('#stat-tri').textContent = s.meshes ? (s.meshes > 999 ? (s.meshes / 1000).toFixed(1) + 'k' : s.meshes) : '—';
    $('#stat-call').textContent = s.calls || '—';
  });
  setCaption(null, app.viewName);
  updateTimeUI();
  setInterval(() => { updateHotspots(); updateCompass(); }, 70);

  // panel collapse
  $('#panel-toggle').addEventListener('click', () => $('#control-panel').classList.toggle('is-collapsed'));

  return { toast, openInfo, closeInfo, setCaption, tourStart, tourStop };
}

/** 程序化环境声：湖风、水声、远处钟声与偶发古琴拨弦。 */
class LakeAudio {
  constructor() {
    this.on = false;
    this.ctx = null;
    this.nodes = [];
    this.timers = [];
    this.pluckNotes = [196, 220, 262, 294, 330, 392, 440, 523];
  }
  start() {
    if (this.on) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    const ctx = this.ctx;
    const master = ctx.createGain();
    master.gain.value = 0.16;
    master.connect(ctx.destination);
    this.master = master;

    // 水声：布朗噪声 + 低通
    const noise = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    const data = noise.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 2.2;
    }
    const src = ctx.createBufferSource(); src.buffer = noise; src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 0.5;
    const g = ctx.createGain(); g.gain.value = 0.13;
    src.connect(lp).connect(g).connect(master);
    src.start();
    this.nodes.push(src, lp, g);

    // 风：经带通噪声
    const windSrc = ctx.createBufferSource(); windSrc.buffer = noise; windSrc.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 740; bp.Q.value = 0.35;
    const wg = ctx.createGain(); wg.gain.value = 0.035;
    windSrc.connect(bp).connect(wg).connect(master);
    windSrc.start(ctx.currentTime + 0.2);
    this.nodes.push(windSrc, bp, wg);

    this.pluckTimer = setInterval(() => this.pluck(), 6200);
    this.bellTimer = setInterval(() => this.bell(), 21000);
    this.on = true;
    if (ctx.state === 'suspended') ctx.resume();
  }
  pluck() {
    if (!this.on) return;
    const ctx = this.ctx;
    const freq = this.pluckNotes[Math.floor(Math.random() * this.pluckNotes.length)] * (Math.random() < 0.3 ? 0.5 : 1);
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.055, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.4);
    osc.connect(gain).connect(this.master);
    osc.start(now); osc.stop(now + 2.6);
  }
  bell() {
    if (!this.on) return;
    const ctx = this.ctx, now = ctx.currentTime;
    for (const [f, v] of [[196, 0.035], [294, 0.02], [392, 0.012], [588, 0.006]]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine'; osc.frequency.value = f;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(v, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 5.5);
      osc.connect(gain).connect(this.master);
      osc.start(now); osc.stop(now + 6);
    }
  }
  stop() {
    this.on = false;
    clearInterval(this.pluckTimer); clearInterval(this.bellTimer);
    if (this.master) this.master.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.6);
    const ctx = this.ctx;
    setTimeout(() => { try { ctx.close(); } catch (e) {} }, 800);
    this.ctx = null;
    this.nodes = [];
  }
}
