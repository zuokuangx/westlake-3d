/**
 * 天气与空气：雨、雪、山间雾带。
 */
import { B, canvasTexture, mulberry32 } from '../core/utils.js';

export function createAtmosphere(scene, app) {
  const rain = makeRain(scene);
  const snow = makeSnow(scene);
  const mist = makeMist(scene);
  app.rain = rain.system;
  app.snow = snow.system;
  app.mist = mist;

  return {
    rain, snow, mist,
    update(t, dt, app) {
      const mode = app.weather;
      rain.system.emitRate = mode === 'rain' ? 650 : 0;
      snow.system.emitRate = mode === 'snow' ? 260 : 0;
      mist.group.setEnabled(mode === 'mist' || mode === 'rain' || (app.palette?.t < 0.2));
      for (let i = 0; i < mist.planes.length; i++) {
        const p = mist.planes[i];
        p.position.x = mist.base[i][0] + Math.sin(t * 0.012 + i * 2.1) * 120;
        p.position.z = mist.base[i][1] + Math.cos(t * 0.009 + i * 1.4) * 90;
        p.setAlpha?.(1);
      }
    },
  };
}

function makeRain(scene) {
  const tex = canvasTexture(scene, 'rain-streak', 64, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    const g = ctx.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0, 'rgba(210,230,240,0)');
    g.addColorStop(0.45, 'rgba(210,230,240,0.6)');
    g.addColorStop(1, 'rgba(210,230,240,0.05)');
    ctx.fillStyle = g;
    ctx.fillRect(s * 0.45, 0, s * 0.1, s);
  }, { mipmap: false });
  const ps = new B.ParticleSystem('rain', 1400, scene);
  ps.particleTexture = tex;
  ps.emitter = new B.Vector3(0, 420, 500);
  ps.minEmitBox = new B.Vector3(-3500, 0, -3800);
  ps.maxEmitBox = new B.Vector3(3500, 1, 3800);
  ps.color1 = new B.Color4(0.64, 0.76, 0.82, 0.38);
  ps.color2 = new B.Color4(0.74, 0.84, 0.88, 0.28);
  ps.colorDead = new B.Color4(0.5, 0.6, 0.68, 0);
  ps.minSize = 0.5; ps.maxSize = 1.2;
  ps.minLifeTime = 0.7; ps.maxLifeTime = 1.3;
  ps.emitRate = 0;
  ps.gravity = new B.Vector3(-3, -120, 5);
  ps.direction1 = new B.Vector3(-5, -100, 2);
  ps.direction2 = new B.Vector3(5, -150, 8);
  ps.minEmitPower = 1; ps.maxEmitPower = 2;
  ps.updateSpeed = 0.02;
  ps.blendMode = B.ParticleSystem.BLENDMODE_ADD;
  ps.start();
  return { system: ps, texture: tex };
}

function makeSnow(scene) {
  const tex = canvasTexture(scene, 'snowflake', 64, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.85)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
  }, { mipmap: false });
  const ps = new B.ParticleSystem('snow', 700, scene);
  ps.particleTexture = tex;
  ps.emitter = new B.Vector3(0, 420, 500);
  ps.minEmitBox = new B.Vector3(-3200, 0, -3400);
  ps.maxEmitBox = new B.Vector3(3200, 2, 3400);
  ps.color1 = new B.Color4(0.92, 0.96, 1, 0.75);
  ps.color2 = new B.Color4(0.78, 0.86, 0.95, 0.5);
  ps.colorDead = new B.Color4(0.8, 0.86, 0.9, 0);
  ps.minSize = 1.3; ps.maxSize = 3.4;
  ps.minLifeTime = 4; ps.maxLifeTime = 8;
  ps.emitRate = 0;
  ps.gravity = new B.Vector3(0.4, -6, 0.2);
  ps.direction1 = new B.Vector3(-2, -4, -1);
  ps.direction2 = new B.Vector3(2, -8, 2);
  ps.minEmitPower = 0.4; ps.maxEmitPower = 0.9;
  ps.updateSpeed = 0.02;
  ps.blendMode = B.ParticleSystem.BLENDMODE_STANDARD;
  ps.start();
  return { system: ps, texture: tex };
}

function makeMist(scene) {
  const tex = canvasTexture(scene, 'mist-bank', 512, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    const rand = mulberry32(1489);
    const grad = ctx.createRadialGradient(s * 0.5, s * 0.5, s * 0.04, s * 0.5, s * 0.5, s * 0.48);
    grad.addColorStop(0, 'rgba(235,241,238,0.55)');
    grad.addColorStop(0.45, 'rgba(225,235,232,0.28)');
    grad.addColorStop(1, 'rgba(220,230,228,0)');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 80; i++) {
      const x = rand() * s, y = rand() * s;
      const r = 20 + rand() * 100;
      const g2 = ctx.createRadialGradient(x, y, 0, x, y, r);
      g2.addColorStop(0, `rgba(250,252,250,${0.03 + rand() * 0.05})`);
      g2.addColorStop(1, 'rgba(250,252,250,0)');
      ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
  }, { mipmap: false });
  const mat = new B.StandardMaterial('mist-mat', scene);
  mat.diffuseTexture = tex;
  mat.diffuseTexture.hasAlpha = true;
  mat.useAlphaFromDiffuseTexture = true;
  mat.diffuseColor = new B.Color3(0.92, 0.96, 0.95);
  mat.emissiveColor = new B.Color3(0.22, 0.26, 0.26);
  mat.specularColor = new B.Color3(0, 0, 0);
  mat.disableLighting = true;
  mat.backFaceCulling = false;
  mat.alpha = 0.38;
  mat.alphaMode = B.Engine.ALPHA_ADD;
  mat.fogEnabled = false;

  const group = new B.TransformNode('mist-banks', scene);
  const planes = [];
  const base = [];
  const spots = [
    [-2600, -400, 600, 34, 1100, 170], [-2300, 900, 700, 42, 1400, 210],
    [-1700, -900, 500, 30, 900, 130], [-900, 2300, 500, 38, 1000, 160],
    [400, 2500, 600, 48, 1200, 180], [1600, 300, 600, 52, 1100, 150],
    [-3000, 1400, 900, 26, 1000, 160], [2000, 1300, 700, 40, 900, 140],
    [-1500, 2200, 500, 54, 1200, 180], [1000, -1200, 600, 26, 900, 150],
  ];
  for (let i = 0; i < spots.length; i++) {
    const [x, z, y, h, w, d] = spots[i];
    const plane = B.MeshBuilder.CreatePlane('mist' + i, { width: w, height: h, sideOrientation: B.Mesh.DOUBLESIDE }, scene);
    plane.position.set(x, y, z);
    plane.billboardMode = B.Mesh.BILLBOARDMODE_ALL;
    plane.material = mat;
    plane.parent = group;
    plane.isPickable = false;
    plane.alphaIndex = 20;
    planes.push(plane);
    base.push([x, z]);
  }
  group.setEnabled(false);
  return { group, planes, base, material: mat };
}
