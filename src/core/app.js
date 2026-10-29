/**
 * 场景内核：Babylon 引擎、相机、天空、光照、时间与天气、镜头过渡。
 */
import { B, clamp, lerp, smooth, lineToColor } from './utils.js';
import { createMaterials } from './materials.js';
import { VIEWS, TIME_STOPS, QUALITY } from './contract.js';

const SUN_GLSL = /* glsl */ `
  precision highp float;
  varying vec3 vDir;
  uniform vec3 uTop;
  uniform vec3 uHorizon;
  uniform vec3 uBottom;
  uniform vec3 uSunColor;
  uniform vec3 uSunDir;
  uniform vec3 uMoonDir;
  uniform vec3 uMoonColor;
  uniform float uSunIntensity;
  uniform float uMoon;
  uniform float uStars;
  uniform float uTime;
  uniform float uNight;
  uniform float uCloud;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += noise(p) * a; p *= 2.03; a *= 0.5; }
    return v;
  }

  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    vec3 col = mix(uBottom, uHorizon, smoothstep(-0.055, 0.24, h));
    col = mix(col, uTop, smoothstep(0.06, 0.72, h));

    // 太阳：核心、内晕、外晕
    float sd = max(0.0, dot(d, normalize(uSunDir)));
    float sun = pow(sd, 2400.0) * 4.0 + pow(sd, 80.0) * 0.22 + pow(sd, 5.0) * 0.06;
    col += uSunColor * sun * uSunIntensity;

    // 月亮
    float md = max(0.0, dot(d, normalize(uMoonDir)));
    float moonDisc = smoothstep(0.99972, 0.99991, md);
    float moonHalo = pow(md, 120.0) * 0.10 + pow(md, 18.0) * 0.025;
    col += uMoonColor * (moonDisc * 1.8 + moonHalo) * uMoon;

    // 层云：靠近地平线更厚；夜间只剩淡淡月云
    if (h > 0.006) {
      vec2 cp = d.xz / (h + 0.20) * 1.20 + vec2(uTime * 0.0018, uTime * 0.0007);
      float n = fbm(cp * 1.55);
      float n2 = fbm(cp * 4.1 + 3.7);
      float cloud = smoothstep(0.51, 0.79, n) * smoothstep(0.005, 0.18, h) * (1.0 - smoothstep(0.55, 0.95, h));
      cloud *= 0.42 * uCloud;
      vec3 cloudCol = mix(vec3(0.96, 0.88, 0.78), uHorizon, 0.26);
      cloudCol = mix(cloudCol, uMoonColor * 0.42, uNight * 0.55);
      col = mix(col, cloudCol, cloud * (1.0 - uNight * 0.45));
      // 云缝里的暖光
      float rim = smoothstep(0.62, 0.84, n2) * smoothstep(0.06, 0.3, h) * uSunIntensity * 0.08;
      col += uSunColor * rim;
    }

    // 星野：方向网格哈希，细小、凉白
    if (uStars > 0.001 && h > 0.02) {
      vec2 sp = vec2(atan(d.z, d.x) * 46.0, asin(clamp(h, -1.0, 1.0)) * 48.0);
      vec2 cell = floor(sp);
      vec2 f = fract(sp) - 0.5;
      float hsh = hash(cell);
      float star = smoothstep(0.055, 0.0, length(f * vec2(1.0, 1.25))) * step(0.986, hsh);
      star += smoothstep(0.085, 0.0, length(f)) * step(0.9991, hash(cell + 7.3)) * 0.7;
      col += vec3(0.76, 0.84, 1.0) * star * uStars * 1.9;
    }

    // 地平线薄雾
    float band = exp(-pow((h + 0.012) / 0.095, 2.0));
    col = mix(col, uHorizon, band * 0.20);

    gl_FragColor = vec4(col, 1.0);
  }
`;

const SKY_VERT = /* glsl */ `
  precision highp float;
  attribute vec3 position;
  uniform mat4 worldViewProjection;
  varying vec3 vDir;
  void main() {
    vDir = position;
    gl_Position = worldViewProjection * vec4(position, 1.0);
  }
`;

export class WestLakeApp {
  constructor(opts = {}) {
    this.container = opts.container;
    this.quality = opts.quality || 'high';
    this.q = QUALITY[this.quality] || QUALITY.high;
    this.data = opts.data;
    this.time = opts.time ?? 0.24;
    this.weather = 'clear';
    this.autoRotate = false;
    this.stillAfter = opts.still || 0;
    this.updaters = [];
    this.pickables = [];
    this.transition = null;
    this.viewName = 'hero';
    this.elapsed = 0;
    this.fps = 0;
    this._fpsAcc = 0;
    this._fpsN = 0;
    this._timer = 0;
    this._timeAnim = null;
    this._autoTour = null;
    this._moonDir = new B.Vector3(0.4, 0.5, -0.7);
    this._temp = { pos: new B.Vector3(), target: new B.Vector3() };
  }

  async init() {
    const w = window.innerWidth, h = window.innerHeight;
    const canvas = document.createElement('canvas');
    canvas.id = 'scene-canvas';
    canvas.setAttribute('aria-label', '西湖三维场景');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.touchAction = 'none';
    canvas.style.outline = 'none';
    this.container.appendChild(canvas);

    const engine = new B.Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
      antialias: true,
      deterministicLockstep: false,
      powerPreference: 'high-performance',
      failIfMajorPerformanceCaveat: false,
      premultipliedAlpha: false,
    }, false);
    engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, this.q.pr));
    engine.setSize(w, h);
    this.engine = engine;
    this.canvas = canvas;

    const scene = new B.Scene(engine);
    scene.clearColor = new B.Color4(0.72, 0.76, 0.77, 1);
    scene.ambientColor = new B.Color3(0.3, 0.32, 0.29);
    scene.fogMode = B.Scene.FOGMODE_EXP2;
    scene.fogDensity = 0.00012;
    scene.fogColor = new B.Color3(0.76, 0.75, 0.70);
    scene.autoClear = true;
    scene.skipPointerMovePicking = true;
    scene.imageProcessingConfiguration.toneMappingEnabled = true;
    scene.imageProcessingConfiguration.toneMappingType = B.ImageProcessingConfiguration.TONEMAPPING_ACES;
    scene.imageProcessingConfiguration.exposure = 1.0;
    scene.imageProcessingConfiguration.contrast = 1.05;
    this.scene = scene;

    this.materials = createMaterials(scene);
    scene._wlMats = this.materials;

    this.camera = new B.ArcRotateCamera('camera', 0.68, 1.13, 4300, new B.Vector3(0, 10, 520), scene);
    this.camera.minZ = 1.5;
    this.camera.maxZ = 32000;
    this.camera.lowerRadiusLimit = 25;
    this.camera.upperRadiusLimit = 12500;
    this.camera.wheelPrecision = 0.018;
    this.camera.pinchPrecision = 18;
    this.camera.panningSensibility = 900;
    this.camera.inertia = 0.78;
    this.camera.angularSensibilityX = 1100;
    this.camera.angularSensibilityY = 1100;
    this.camera.useNaturalPinchZoom = true;
    this.camera.attachControl(canvas, true);
    this.camera.fov = 0.62;

    this._initLights();
    this._initSky();
    this._initPost();
    this._initPicking();

    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.engine.stopRenderLoop();
      else if (!this._stopped) this._startLoop();
    });

    this.setTime(this.time, true);
    return this;
  }

  _initLights() {
    const scene = this.scene;
    this.hemi = new B.HemisphericLight('hemi', new B.Vector3(0.05, 1, -0.1), scene);
    this.hemi.intensity = 0.7;
    this.hemi.diffuse = new B.Color3(0.65, 0.75, 0.84);
    this.hemi.groundColor = new B.Color3(0.20, 0.21, 0.17);

    const sun = new B.DirectionalLight('sun', new B.Vector3(-0.45, -0.7, 0.3), scene);
    sun.position = new B.Vector3(-1800, 2600, 1200);
    sun.intensity = 1.0;
    sun.diffuse = new B.Color3(1.0, 0.86, 0.68);
    sun.specular = new B.Color3(1.0, 0.92, 0.76);
    sun.shadowMinZ = 1;
    sun.shadowMaxZ = 10000;
    sun.autoUpdateExtends = false;
    sun.shadowFrustumSize = 3600;
    this.sun = sun;

    this.fill = new B.DirectionalLight('fill', new B.Vector3(0.6, -0.2, -0.5), scene);
    this.fill.intensity = 0.22;
    this.fill.diffuse = new B.Color3(0.52, 0.63, 0.72);
    this.fill.specular = new B.Color3(0, 0, 0);

    this.moonLight = new B.DirectionalLight('moon', new B.Vector3(0.4, -0.6, 0.7), scene);
    this.moonLight.intensity = 0.0;
    this.moonLight.diffuse = new B.Color3(0.38, 0.5, 0.76);
    this.moonLight.specular = new B.Color3(0.2, 0.3, 0.5);

    this.shadow = new B.ShadowGenerator(this.q.shadow, sun);
    this.shadow.useBlurExponentialShadowMap = true;
    this.shadow.blurKernel = 18;
    this.shadow.bias = 0.0009;
    this.shadow.normalBias = 0.02;
    this.shadow.darkness = 0.42;
    this.shadow.setTransparencyShadow(false);
  }

  _initSky() {
    const mat = new B.ShaderMaterial('westlake-sky', this.scene,
      { vertexSource: SKY_VERT, fragmentSource: SUN_GLSL },
      {
        attributes: ['position'],
        uniforms: ['worldViewProjection', 'uTop', 'uHorizon', 'uBottom', 'uSunColor', 'uSunDir',
          'uMoonDir', 'uMoonColor', 'uSunIntensity', 'uMoon', 'uStars', 'uTime', 'uNight', 'uCloud'],
      });
    mat.backFaceCulling = false;
    mat.disableDepthWrite = true;
    this.skyMat = mat;
    this.sky = B.MeshBuilder.CreateSphere('sky-dome', { diameter: 22000, segments: 24, sideOrientation: B.Mesh.BACKSIDE }, this.scene);
    this.sky.material = mat;
    this.sky.infiniteDistance = true;
    this.sky.isPickable = false;
    this.sky.applyFog = false;
    this.sky.renderingGroupId = 0;
    this.sky.alwaysSelectAsActiveMesh = true;
    this.skyMat.setFloat('uTime', 0);
    this.skyMat.setFloat('uCloud', 1);
    this.skyMat.setFloat('uStars', 0);
    this.skyMat.setFloat('uMoon', 0);
    this.skyMat.setFloat('uSunIntensity', 1);
    this.skyMat.setColor3('uTop', new B.Color3(0.17, 0.35, 0.56));
    this.skyMat.setColor3('uHorizon', new B.Color3(0.62, 0.72, 0.77));
    this.skyMat.setColor3('uBottom', new B.Color3(0.76, 0.80, 0.78));
    this.skyMat.setColor3('uSunColor', new B.Color3(1, 0.85, 0.63));
    this.skyMat.setColor3('uMoonColor', new B.Color3(0.85, 0.89, 0.98));
    this.skyMat.setVector3('uSunDir', new B.Vector3(0.4, 0.6, -0.6));
    this.skyMat.setVector3('uMoonDir', this._moonDir);
  }

  _initPost() {
    if (!this.q.pipeline) return;
    const pipeline = new B.DefaultRenderingPipeline('westlake-post', true, this.scene, [this.camera]);
    pipeline.samples = this.quality === 'high' ? 4 : 2;
    pipeline.fxaaEnabled = true;
    pipeline.bloomEnabled = true;
    pipeline.bloomThreshold = 0.78;
    pipeline.bloomWeight = 0.26;
    pipeline.bloomKernel = 36;
    pipeline.bloomScale = 0.6;
    pipeline.imageProcessingEnabled = true;
    pipeline.imageProcessing.toneMappingEnabled = true;
    pipeline.imageProcessing.toneMappingType = B.ImageProcessingConfiguration.TONEMAPPING_ACES;
    pipeline.imageProcessing.exposure = 1.0;
    pipeline.imageProcessing.contrast = 1.06;
    pipeline.imageProcessing.vignetteEnabled = true;
    pipeline.imageProcessing.vignetteWeight = 2.0;
    pipeline.imageProcessing.vignetteColor = new B.Color4(0.02, 0.018, 0.012, 0);
    this.pipeline = pipeline;

    this.glow = new B.GlowLayer('glow', this.scene, { mainTextureFixedSize: 512, blurKernelSize: 32 });
    this.glow.intensity = 0.42;
  }

  _initPicking() {
    this._pointerDown = null;
    this.canvas.addEventListener('pointerdown', (e) => {
      this._pointerDown = { x: e.clientX, y: e.clientY, t: performance.now() };
    });
    this.canvas.addEventListener('pointerup', (e) => {
      const d = this._pointerDown;
      this._pointerDown = null;
      if (!d) return;
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 9) return;
      if (performance.now() - d.t > 650) return;
      this.pick(e.clientX, e.clientY);
    });
  }

  pick(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const ray = this.scene.createPickingRay(clientX - rect.left, clientY - rect.top, B.Matrix.Identity(), this.camera);
    const hit = this.scene.pickWithRay(ray, (m) => !!(m.metadata && m.metadata.pick), false);
    if (hit && hit.pickedMesh) {
      const meta = hit.pickedMesh.metadata.pick;
      this.emit('pick', { ...meta, point: hit.pickedPoint });
    } else {
      this.emit('pick', null);
    }
  }

  setTime(t, silent = false) {
    this.time = clamp(t, 0, 1);
    const p = sampleTime(this.time);
    this.palette = p;

    const az = p.sunAzim * Math.PI / 180;
    const el = p.sunElev * Math.PI / 180;
    const sunDir = new B.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
    this.sunDir = sunDir;

    // 太阳在天空中的位置
    this.sun.position.copyFrom(sunDir.scale(5200));
    this.sun.direction.copyFrom(sunDir.scale(-1));
    this.sun.diffuse = lineToColor(p.sunColor);
    this.sun.specular = lineToColor(p.sunColor).scale(0.8);
    this.sun.intensity = p.sunIntensity;

    // 夜间月亮方向：与太阳相反，略抬高
    const moonDir = sunDir.scale(-1);
    moonDir.y = Math.max(0.22, Math.abs(moonDir.y) * 0.7 + 0.2);
    moonDir.normalize();
    this._moonDir.copyFrom(moonDir);
    this.moonLight.direction.copyFrom(moonDir.scale(-1));
    this.moonLight.intensity = Math.max(0, 1 - (p.sunElev + 4) / 16) * 0.38;
    this.moonLight.position.copyFrom(moonDir.scale(5000));

    this.hemi.diffuse = lineToColor(p.hemiSky);
    this.hemi.groundColor = lineToColor(p.hemiGround);
    this.hemi.intensity = p.hemiIntensity;
    this.fill.intensity = 0.09 + p.ambientIntensity * 0.16;
    this.fill.diffuse = lineToColor(p.ambient);

    this.scene.fogColor = lineToColor(p.fog);
    this.scene.fogDensity = p.fogDensity;
    this.scene.clearColor = new B.Color4(...lineToColor(p.fog).asArray(), 1);

    this.skyMat.setColor3('uTop', lineToColor(p.skyTop));
    this.skyMat.setColor3('uHorizon', lineToColor(p.skyHorizon));
    this.skyMat.setColor3('uBottom', lineToColor(p.skyBottom));
    this.skyMat.setColor3('uSunColor', lineToColor(p.sunColor));
    this.skyMat.setVector3('uSunDir', sunDir);
    this.skyMat.setVector3('uMoonDir', moonDir);
    this.skyMat.setFloat('uSunIntensity', clamp(p.sunIntensity / 1.2, 0.05, 2.3));
    this.skyMat.setFloat('uStars', p.stars);
    this.skyMat.setFloat('uMoon', clamp(p.stars * 1.25, 0, 1));
    this.skyMat.setFloat('uNight', clamp(1 - (p.sunElev + 5) / 20, 0, 1));

    if (this.pipeline) {
      this.pipeline.imageProcessing.exposure = p.exposure;
      this.pipeline.bloomWeight = p.bloom;
      this.pipeline.imageProcessing.vignetteWeight = 1.6 + (1 - p.hemiIntensity) * 0.45;
    }
    if (this.glow) this.glow.intensity = 0.18 + (p.lamp || 0) * 0.55;

    // 材质随夜色变化
    const lamp = p.lamp || 0;
    const M = this.materials;
    if (M) {
      M.window.emissiveIntensity = 0.18 + lamp * 2.6;
      M.lantern.emissiveIntensity = 0.6 + lamp * 3.2;
      M.lampGold.emissiveIntensity = 0.3 + lamp * 2.4;
      M.cityGlass.emissiveIntensity = 0.15 + lamp * 1.3;
      M.gold.emissiveColor = new B.Color3(0.12 + lamp * 0.18, 0.085 + lamp * 0.13, 0.025 + lamp * 0.06);
    }
    if (this.water) {
      this.water.waterColor = lineToColor(p.waterTint);
      this.water.waterColor2 = lineToColor(p.waterTint).scale(1.45);
      this.water.colorBlendFactor = 0.38 + (1 - p.sunIntensity / 1.6) * 0.16;
    }
    // 雨雾天气加重
    this._applyWeather();
    if (!silent) this.emit('time', { t: this.time, palette: p });
  }

  setTimeAnimated(to, duration = 1.8) {
    const from = this.time;
    let delta = to - from;
    if (Math.abs(delta) > 0.5) delta = Math.sign(delta) * (1 - Math.abs(delta));
    this._timeAnim = { t: 0, duration, from, delta };
  }

  setWeather(mode) {
    this.weather = mode;
    this._applyWeather();
    this.emit('weather', { mode });
  }

  _applyWeather() {
    const p = this.palette;
    if (!p) return;
    if (this.weather === 'rain') {
      this.scene.fogDensity = p.fogDensity * 1.9 + 0.00008;
      this.hemi.intensity = p.hemiIntensity * 0.72;
      this.sun.intensity = p.sunIntensity * 0.45;
      this.skyMat.setFloat('uCloud', 2.2);
      this.skyMat.setColor3('uTop', lineToColor(p.skyTop).scale(0.7));
      this.skyMat.setColor3('uHorizon', lineToColor(p.skyHorizon).scale(0.76));
      if (this.rain) this.rain.emitter.position.y = 600;
    } else if (this.weather === 'mist') {
      this.scene.fogDensity = p.fogDensity * 2.6 + 0.00012;
      this.hemi.intensity = p.hemiIntensity * 0.88;
      this.sun.intensity = p.sunIntensity * 0.62;
      this.skyMat.setFloat('uCloud', 1.5);
      this.skyMat.setFloat('uSunIntensity', Math.max(0.05, p.sunIntensity * 0.35));
    } else if (this.weather === 'snow') {
      this.scene.fogDensity = p.fogDensity * 1.7 + 0.00006;
      this.hemi.intensity = p.hemiIntensity * 1.15;
      this.sun.intensity = p.sunIntensity * 0.4;
      this.skyMat.setFloat('uCloud', 2.5);
      this.skyMat.setColor3('uTop', lineToColor('#7f8f9d'));
      this.skyMat.setColor3('uHorizon', lineToColor('#d5d8d5'));
    } else {
      this.skyMat.setFloat('uCloud', 1.0);
    }
    if (this.rain) this.rain.emitter.position.y = this.weather === 'rain' ? 500 : 900;
    if (this.snow) this.snow.emitter.position.y = this.weather === 'snow' ? 500 : 900;
    if (this.rain) this.rain.manualEmitCount = this.weather === 'rain' ? 400 : 0;
    if (this.snow) this.snow.manualEmitCount = this.weather === 'snow' ? 200 : 0;
  }

  registerPickable(mesh, key, meta = {}) {
    if (!mesh) return;
    mesh.metadata = Object.assign({}, mesh.metadata, { pick: Object.assign({ key }, meta) });
    this.pickables.push(mesh);
  }

  setView(name, instant = false, duration = null) {
    const v = VIEWS[name];
    if (!v) return false;
    this.viewName = name;
    this.emit('view', { name, view: v });
    const target = B.Vector3.FromArray(v.target);
    const pos = B.Vector3.FromArray(v.pos);
    const delta = pos.subtract(target);
    const radius = delta.length();
    let alpha = Math.atan2(delta.z, delta.x);
    let beta = Math.acos(clamp(delta.y / radius, -1, 1));
    beta = clamp(beta, 0.08, Math.PI * 0.495);
    if (instant) {
      this.camera.alpha = alpha;
      this.camera.beta = beta;
      this.camera.radius = radius;
      this.camera.target.copyFrom(target);
      this.camera.fov = v.fov || 0.6;
      this.transition = null;
      return true;
    }
    let da = alpha - this.camera.alpha;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    this.transition = {
      t: 0, duration: duration || v.dur || 3.4,
      fromAlpha: this.camera.alpha, toAlpha: this.camera.alpha + da,
      fromBeta: this.camera.beta, toBeta: beta,
      fromRadius: this.camera.radius, toRadius: radius,
      fromTarget: this.camera.target.clone(), toTarget: target,
      fromFov: this.camera.fov, toFov: v.fov || 0.6,
    };
    return true;
  }

  _updateTransition(dt) {
    const tr = this.transition;
    if (!tr) return;
    tr.t += dt / tr.duration;
    const k = smooth(clamp(tr.t, 0, 1));
    this.camera.alpha = lerp(tr.fromAlpha, tr.toAlpha, k);
    this.camera.beta = lerp(tr.fromBeta, tr.toBeta, k);
    this.camera.radius = lerp(tr.fromRadius, tr.toRadius, k);
    this.camera.target = B.Vector3.Lerp(tr.fromTarget, tr.toTarget, k);
    this.camera.fov = lerp(tr.fromFov, tr.toFov, k);
    if (tr.t >= 1) this.transition = null;
  }

  _startLoop() {
    this.engine.stopRenderLoop();
    this.engine.runRenderLoop(() => this._tick());
  }

  start() {
    this._stopped = false;
    this._startLoop();
  }

  stop() {
    this._stopped = true;
    this.engine.stopRenderLoop();
  }

  _tick() {
    const dtMs = this.engine.getDeltaTime();
    const dt = Math.min(0.05, dtMs / 1000);
    this.elapsed += dt;
    this._timer += dt;

    if (this._timeAnim) {
      const a = this._timeAnim;
      a.t += dt / a.duration;
      const k = smooth(clamp(a.t, 0, 1));
      this.setTime((a.from + a.delta * k + 1) % 1);
      if (a.t >= 1) this._timeAnim = null;
    }
    this._updateTransition(dt);
    if (this.autoRotate) this.camera.alpha += dt * 0.018;
    this.sky.position.copyFrom(this.camera.position);
    this.skyMat.setFloat('uTime', this.elapsed);
    for (const u of this.updaters) {
      try { u(this.elapsed, dt, this); } catch (e) { console.warn('[update]', e); }
    }
    this.scene.render();
    if (this.stillAfter) {
      this._stillFrames = (this._stillFrames || 0) + 1;
      if (this._stillFrames >= this.stillAfter) {
        this.stillAfter = 0;
        window.__READY__ = true;
        this.stop();
      }
    }

    this._fpsAcc += dt;
    this._fpsN++;
    if (this._fpsAcc >= 0.5) {
      this.fps = this._fpsN / this._fpsAcc;
      this._fpsAcc = 0; this._fpsN = 0;
      this.emit('stats', { fps: this.fps, meshes: this.scene.meshes.length, calls: this.engine._drawCalls?.current ?? 0 });
    }
  }

  resize() {
    this.engine.resize();
  }

  on(name, fn) {
    if (!this._events) this._events = new Map();
    if (!this._events.has(name)) this._events.set(name, new Set());
    this._events.get(name).add(fn);
  }

  emit(name, payload) {
    const set = this._events?.get(name);
    if (set) for (const fn of [...set]) { try { fn(payload); } catch (e) { console.warn(e); } }
  }

  capture(name = '西湖') {
    this.scene.render();
    const url = this.canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`;
    a.click();
  }
}

export function sampleTime(t) {
  const stops = TIME_STOPS;
  let a = stops[0], b = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i].t && t <= stops[i + 1].t) { a = stops[i]; b = stops[i + 1]; break; }
  }
  const k = b.t === a.t ? 0 : smooth((t - a.t) / (b.t - a.t));
  const num = (key) => lerp(a[key], b[key], k);
  const col = (key) => B.Color3.Lerp(lineToColor(a[key]), lineToColor(b[key]), k);
  return {
    label: k < 0.5 ? a.label : b.label,
    hour: k < 0.5 ? a.hour : b.hour,
    sunAzim: num('sunAzim'), sunElev: num('sunElev'), sunIntensity: num('sunIntensity'),
    ambientIntensity: num('ambientIntensity'), hemiIntensity: num('hemiIntensity'),
    fogDensity: num('fogDensity'), exposure: num('exposure'), bloom: num('bloom'),
    stars: num('stars'), lamp: num('lamp'),
    sunColor: col('sunColor'), ambient: col('ambient'), hemiSky: col('hemiSky'),
    hemiGround: col('hemiGround'), fog: col('fog'), skyTop: col('skyTop'),
    skyHorizon: col('skyHorizon'), skyBottom: col('skyBottom'), waterTint: col('waterTint'),
  };
}
