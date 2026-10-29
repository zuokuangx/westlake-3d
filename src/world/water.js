/**
 * 西湖水面：湖形遮罩 + 自研 GLSL（细波纹 / 菲涅尔 / 夕阳碎金）。
 */
import { B, setPick, canvasTexture, mulberry32 } from '../core/utils.js';

const VERT = /* glsl */ `
  precision highp float;
  attribute vec3 position;
  attribute vec3 normal;
  uniform mat4 world;
  uniform mat4 worldViewProjection;
  uniform float uTime;
  varying vec3 vWorldPos;
  varying vec3 vNormalW;
  void main() {
    vec4 wp = world * vec4(position, 1.0);
    float w = sin(wp.x * 0.021 + uTime * 0.7) * 0.06
            + sin(wp.z * 0.034 - uTime * 0.55 + 1.7) * 0.045
            + sin((wp.x + wp.z) * 0.058 + uTime * 1.1) * 0.02;
    wp.y += w;
    vWorldPos = wp.xyz;
    vNormalW = normalize((world * vec4(normal, 0.0)).xyz);
    gl_Position = worldViewProjection * vec4(position.x, position.y + w, position.z, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  varying vec3 vWorldPos;
  varying vec3 vNormalW;
  uniform sampler2D maskSampler;
  uniform sampler2D normalSampler;
  uniform vec2 uMaskMin;
  uniform vec2 uMaskMax;
  uniform float uFlipY;
  uniform vec3 uCameraPos;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uSkyTop;
  uniform vec3 uSkyHorizon;
  uniform vec3 uDeepColor;
  uniform vec3 uShallowColor;
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  uniform float uTime;
  uniform float uSunPower;

  void main() {
    vec2 m = (vWorldPos.xz - uMaskMin) / (uMaskMax - uMaskMin);
    m = vec2(m.x, mix(m.y, 1.0 - m.y, uFlipY));
    if (m.x < 0.0 || m.y < 0.0 || m.x > 1.0 || m.y > 1.0) discard;
    if (texture2D(maskSampler, m).r < 0.42) discard;

    vec3 viewDir = normalize(uCameraPos - vWorldPos);
    vec3 baseNormal = normalize(vNormalW);
    float d = length(uCameraPos - vWorldPos);
    float rippleFade = 1.0 - smoothstep(1600.0, 6200.0, d);
    vec3 nA = texture2D(normalSampler, vWorldPos.xz * 0.0020 + vec2(uTime * 0.0010, 0.0)).rgb * 2.0 - 1.0;
    vec3 nB = texture2D(normalSampler, vWorldPos.xz * 0.0052 + vec2(0.0, -uTime * 0.0015)).rgb * 2.0 - 1.0;
    vec3 n = normalize(baseNormal + vec3((nA.x + nB.x) * 0.22, 0.0, (nA.y + nB.y) * 0.22) * rippleFade);

    float fresnel = pow(1.0 - max(dot(n, viewDir), 0.0), 3.0);
    vec3 reflected = reflect(-viewDir, n);
    vec3 skyRef = mix(uSkyHorizon, uSkyTop, smoothstep(0.0, 0.5, max(reflected.y, 0.0)));
    vec3 col = mix(uDeepColor, uShallowColor, 0.4);
    col = mix(col, skyRef, clamp(fresnel * 0.58 + 0.07, 0.0, 0.62));
    vec3 h = normalize(normalize(uSunDir) + viewDir);
    float spec = pow(max(dot(n, h), 0.0), 900.0);
    col += uSunColor * spec * 1.6 * uSunPower;
    float fog = 1.0 - exp(-pow(d * uFogDensity, 2.0));
    col = mix(col, uFogColor, clamp(fog * 0.92, 0.0, 0.82));
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function createWater(scene, data, quality = 'high') {
  const lake = data.lake;
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of lake.outer) { minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minZ = Math.min(minZ, p[1]); maxZ = Math.max(maxZ, p[1]); }
  minX -= 120; maxX += 120; minZ -= 120; maxZ += 120;
  const size = quality === 'high' ? 2048 : quality === 'medium' ? 1536 : 1024;
  const mask = makeWaterMask(scene, lake, minX, maxX, minZ, maxZ, size);

  const mat = new B.ShaderMaterial('westlake-water-shader', scene,
    { vertexSource: VERT, fragmentSource: FRAG },
    {
      attributes: ['position', 'normal'],
      uniforms: ['world', 'worldViewProjection', 'uMaskMin', 'uMaskMax', 'uFlipY', 'uCameraPos',
        'uSunDir', 'uSunColor', 'uSkyTop', 'uSkyHorizon', 'uDeepColor', 'uShallowColor',
        'uFogColor', 'uFogDensity', 'uTime', 'uSunPower'],
      samplers: ['maskSampler', 'normalSampler'],
      needAlphaBlending: false,
      backFaceCulling: false,
    });
  mat.backFaceCulling = false;
  mat.setTexture('maskSampler', mask);
  mat.setTexture('normalSampler', makeWaterNormal(scene));
  mat.setVector2('uMaskMin', new B.Vector2(minX, minZ));
  mat.setVector2('uMaskMax', new B.Vector2(maxX, maxZ));
  mat.setFloat('uFlipY', 0.0);
  mat.setFloat('uTime', 0);
  mat.setFloat('uSunPower', 1);

  const mesh = B.MeshBuilder.CreateGround('westlake-water-surface', {
    width: maxX - minX, height: maxZ - minZ, subdivisions: 1,
  }, scene);
  mesh.position.set((minX + maxX) / 2, 0.02, (minZ + maxZ) / 2);
  mesh.material = mat;
  mesh.isPickable = true;
  mesh.alwaysSelectAsActiveMesh = true;
  mesh.receiveShadows = false;
  setPick(mesh, 'water', { name: '西湖水面' });
  mesh.metadata.pick.kind = 'water';

  return {
    mesh, material: mat,
    addReflection() {},
    update(t, dt, app) {
      const p = app.palette;
      if (!p) return;
      mat.setVector3('uCameraPos', app.camera.position);
      mat.setVector3('uSunDir', app.sunDir || new B.Vector3(0, 0.5, -0.5));
      mat.setColor3('uSunColor', p.sunColor);
      mat.setColor3('uSkyTop', p.skyTop);
      mat.setColor3('uSkyHorizon', p.skyHorizon);
      mat.setColor3('uDeepColor', B.Color3.FromHexString('#0a3036'));
      mat.setColor3('uShallowColor', B.Color3.FromHexString('#1f5450'));
      mat.setColor3('uFogColor', p.fog);
      mat.setFloat('uFogDensity', p.fogDensity);
      mat.setFloat('uTime', t);
      mat.setFloat('uSunPower', Math.max(0, Math.min(2.0, p.sunIntensity / 1.5)));
    },
  };
}

function makeWaterMask(scene, lake, minX, maxX, minZ, maxZ, size) {
  const tex = canvasTexture(scene, 'westlake-water-mask', size, (ctx, s) => {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, s, s);
    const tx = (x) => (x - minX) / (maxX - minX) * s;
    const ty = (z) => (z - minZ) / (maxZ - minZ) * s;
    const paint = (ring, color) => {
      if (!ring || ring.length < 3) return;
      ctx.beginPath(); ctx.moveTo(tx(ring[0][0]), ty(ring[0][1]));
      for (let i = 1; i < ring.length; i++) ctx.lineTo(tx(ring[i][0]), ty(ring[i][1]));
      ctx.closePath(); ctx.fillStyle = color; ctx.fill();
    };
    paint(lake.outer, '#fff');
    for (const h of lake.holes) paint(h.points, '#000');
    if (lake.pond) paint(lake.pond.points, '#fff');
  }, { uScale: 1, vScale: 1, aniso: 4, mipmap: true });
  tex.wrapU = B.Texture.CLAMP_ADDRESSMODE;
  tex.wrapV = B.Texture.CLAMP_ADDRESSMODE;
  return tex;
}

function makeWaterNormal(scene) {
  const size = 512;
  const tex = canvasTexture(scene, 'water-normal', size, (ctx, s) => {
    const rand = mulberry32(993);
    const height = new Float32Array(s * s);
    const waves = [];
    for (let i = 0; i < 28; i++) waves.push({ angle: rand() * Math.PI * 2, freq: 0.008 + rand() * 0.042, amp: 0.35 + rand() * 0.65, phase: rand() * Math.PI * 2 });
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      let h = 0;
      for (const w of waves) h += Math.sin((x * Math.cos(w.angle) + y * Math.sin(w.angle)) * w.freq * Math.PI * 2 + w.phase) * w.amp;
      height[y * s + x] = h / waves.length;
    }
    const img = ctx.createImageData(s, s);
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const l = height[y * s + (x - 1 + s) % s], r = height[y * s + (x + 1) % s];
      const u = height[((y - 1 + s) % s) * s + x], d = height[((y + 1) % s) * s + x];
      let nx = (l - r) * 1.1, ny = (u - d) * 1.1, nz = 1.0;
      const len = Math.hypot(nx, ny, nz); nx /= len; ny /= len; nz /= len;
      const i = (y * s + x) * 4;
      img.data[i] = (nx * 0.5 + 0.5) * 255; img.data[i + 1] = (ny * 0.5 + 0.5) * 255; img.data[i + 2] = (nz * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }, { uScale: 1, vScale: 1, aniso: 8, mipmap: true });
  tex.wrapU = B.Texture.WRAP_ADDRESSMODE; tex.wrapV = B.Texture.WRAP_ADDRESSMODE;
  return tex;
}
