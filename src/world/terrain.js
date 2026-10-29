/**
 * 湖山地形：真实 SRTM 高程 + 程序化山体细节；湖岸、岛屿、城市与远山。
 */
import {
  B, clamp, smoothstep, lerp, mulberry32, sampleBilinear, makePolygonMesh, ringToRibbon,
  wallAroundRing, pointInPoly, box, merge, freeze, setPick, hex, bakeInstances,
} from '../core/utils.js';

const ORIGIN_LON = 120.145;
const ORIGIN_LAT = 30.250;
const M_LON = 96300;
const M_LAT = 110900;

export function createTerrain(scene, data, grid, quality = 'high') {
  const lake = data.lake;
  const outer = lake.outer;
  const holes = lake.holes;
  const holeRings = holes.map((h) => h.points);
  const holeBounds = holeRings.map((r) => {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const p of r) { minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minZ = Math.min(minZ, p[1]); maxZ = Math.max(maxZ, p[1]); }
    return { minX, maxX, minZ, maxZ };
  });

  const outerBB = bounds(outer);
  const q = quality === 'high' ? 260 : quality === 'medium' ? 180 : 110;
  const X0 = -6100, X1 = 6100, Z0 = -6800, Z1 = 6800;
  const stepX = (X1 - X0) / q, stepZ = (Z1 - Z0) / q;
  const n = grid.n;
  const shoreField = buildShoreField(outer, X0, X1, Z0, Z1, 128);

  function rawElevation(x, z) {
    const lon = ORIGIN_LON + x / M_LON;
    const lat = ORIGIN_LAT - z / M_LAT;
    const u = (lon - grid.lon0) / (grid.lon1 - grid.lon0);
    const v = (lat - grid.lat0) / (grid.lat1 - grid.lat0);
    return sampleBilinear(grid.grid, n, clamp(u, 0, 1), clamp(v, 0, 1));
  }

  function inHole(x, z) {
    for (let i = 0; i < holeRings.length; i++) {
      const b = holeBounds[i];
      if (x < b.minX - 2 || x > b.maxX + 2 || z < b.minZ - 2 || z > b.maxZ + 2) continue;
      if (pointInPoly(x, z, holeRings[i])) return i;
    }
    return -1;
  }

  // 精确湖岸判定；密集网格生成时在顶点上缓存一次。
  function isWater(x, z) {
    if (x < outerBB.minX || x > outerBB.maxX || z < outerBB.minZ || z > outerBB.maxZ) return false;
    if (!pointInPoly(x, z, outer)) return false;
    return inHole(x, z) < 0;
  }

  function noise2(x, z) {
    // value noise with several octaves, used only on hills
    const h = (ix, iz) => {
      let s = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453;
      return s - Math.floor(s);
    };
    let v = 0, amp = 0.5, fx = 1, fz = 1;
    for (let o = 0; o < 4; o++) {
      const xx = x * fx * 0.0045, zz = z * fz * 0.0045;
      const ix = Math.floor(xx), iz = Math.floor(zz);
      const tx = xx - ix, tz = zz - iz;
      const sx = tx * tx * (3 - 2 * tx), sz = tz * tz * (3 - 2 * tz);
      const a = h(ix, iz), b = h(ix + 1, iz), c = h(ix, iz + 1), d = h(ix + 1, iz + 1);
      v += lerp(lerp(a, b, sx), lerp(c, d, sx), sz) * amp;
      amp *= 0.5; fx *= 2.03; fz *= 2.03;
    }
    return v - 0.5;
  }

  function heightAt(x, z, forPlacement = false, knownWet = null) {
    const wet = knownWet === null ? isWater(x, z) : knownWet;
    if (wet) return -2.4;
    const elev = rawElevation(x, z);
    let y = (elev - 6.8) * 1.0;
    const hill = smoothstep(3, 38, y);
    y += hill * noise2(x, z) * 18.0;
    y += Math.max(0, y) * 0.018 * (noise2(x * 1.7 + 70, z * 1.7 - 31));
    if (y < 0.55) y = 0.55;
    // 湖滨 90 米内压平为缓坡，让水岸带与水面自然衔接
    const d = sampleField(shoreField, x, z);
    if (d < 90) y = Math.min(y, 0.22 + d * 0.0055);
    if (forPlacement) return y;
    return y;
  }

  // ——— 地形网格 ———
  const positions = [], indices = [], uvs = [], colors = [];
  const yCache = new Float32Array((q + 1) * (q + 1));
  const wetCache = new Uint8Array((q + 1) * (q + 1));
  for (let j = 0; j <= q; j++) {
    const z = Z0 + j * stepZ;
    for (let i = 0; i <= q; i++) {
      const x = X0 + i * stepX;
      const wet = isWater(x, z);
      wetCache[j * (q + 1) + i] = wet ? 1 : 0;
      const y = heightAt(x, z, false, wet);
      yCache[j * (q + 1) + i] = y;
      positions.push(x, y, z);
      uvs.push((x - X0) / 720, (z - Z0) / 720);
      const alt = clamp((y - 4) / 220, 0, 1);
      const tint = 0.92 + noise2(x * 3.1, z * 3.1) * 0.09;
      // 低地偏暖绿，山地偏冷青，极高处泛灰
      colors.push(
        (0.74 + alt * 0.08) * tint,
        (0.80 + alt * 0.02) * tint,
        (0.64 + alt * 0.06) * tint,
        1
      );
    }
  }
  for (let j = 0; j < q; j++) {
    for (let i = 0; i < q; i++) {
      const a = j * (q + 1) + i, b = a + 1, c = a + q + 1, d = c + 1;
      // 湖面网格整格剔除，由水面多边形覆盖；这样水下地形不会戳出水面。
      const xa = X0 + i * stepX, za = Z0 + j * stepZ;
      // 只要格子碰到水面就剔除；湖岸带会补住这一圈
      if (wetCache[a] || wetCache[b] || wetCache[c] || wetCache[d]) continue;
      const sd = sampleField(shoreField, xa + stepX * 0.5, za + stepZ * 0.5);
      if (sd < 45) continue;
      indices.push(a, b, c, b, d, c);
    }
  }
  // 兜底地面：填住湖岸网格接缝，避免任何背景色从岸线漏出
  const underlay = B.MeshBuilder.CreateGround('land-underlay', { width: 26000, height: 26000, subdivisions: 2 }, scene);
  underlay.position.y = -0.08;
  underlay.material = scene._wlMats?.grass;
  underlay.receiveShadows = true;

  const terrain = new B.Mesh('terrain', scene);
  const vd = new B.VertexData();
  vd.positions = positions; vd.indices = indices; vd.uvs = uvs; vd.colors = colors;
  vd.normals = [];
  B.VertexData.ComputeNormals(positions, indices, vd.normals);
  vd.applyToMesh(terrain, false);
  terrain.material = setupTerrainMaterial(scene);
  terrain.receiveShadows = true;
  terrain.freezeWorldMatrix();

  // ——— 湖岸石砌驳岸与环湖步道 ———
  const shore = [];
  const shoreGrass = scene._wlMats?.grass?.clone('shore-grass');
  if (shoreGrass) {
    shoreGrass.backFaceCulling = false;
    shoreGrass.twoSidedLighting = true;
    shoreGrass.diffuseColor = new B.Color3(0.25, 0.36, 0.21);
    shoreGrass.emissiveColor = new B.Color3(0.018, 0.028, 0.014);
  }
  shore.push(wallAroundRing('lake-embankment', outer, 0.30, -2.8, scene._wlMats?.embankment, scene));
  // 一条 60 米宽的湖岸绿带，遮住地形网格在岸线处的锯齿，同时形成真实湖滨。
  const shoreOuter = offsetRingOutward(outer, 72);
  const band = stripBetween('lake-shore-band', outer, shoreOuter, 0.51, shoreGrass || scene._wlMats?.grass, scene, 0.04);
  if (band) shore.push(band);
  shore.push(ringToRibbon('lake-shore-walk', outer, 0.535, 12.0, scene._wlMats?.stoneWarm || scene._wlMats?.stone, scene));
  for (const h of holes) {
    const topY = 0.48 + 0.1 * Math.min(1, h.area / 100000);
    // 堤岸由 causeways 模块的实体土堤负责；这里只保留岛缘石砌。
    const wall = wallAroundRing('island-edge-' + h.name, h.points, topY, -1.0, scene._wlMats?.embankment, scene);
    shore.push(wall);
  }
  // 材质由主程序注入（scene.materials 为自定义字段）
  for (const m of shore) {
    if (!m) continue;
    if (!m.material) m.material = scene._wlMats?.embankment;
    m.receiveShadows = true;
  }

  // 小岛顶面已经统一在岛岸循环中生成，不再重复叠加。

  // ——— 城市 ———
  const city = createCity(scene, data, heightAt, isWater, q);
  // ——— 远山 ———
  const ranges = createDistantRanges(scene);

  return {
    terrain, underlay, city, ranges,
    heightAt, isWater, inHole, outer, holes, holeRings,
    extent: { x0: X0, x1: X1, z0: Z0, z1: Z1 },
    update(t, dt, app) {
      if (city.update) city.update(t, app);
    },
  };
}

function setupTerrainMaterial(scene) {
  // materials 库由 app 注入到 scene.materials，避免重复创建纹理
  return scene._wlMats?.terrain;
}

function bounds(ring) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of ring) { minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minZ = Math.min(minZ, p[1]); maxZ = Math.max(maxZ, p[1]); }
  return { minX, maxX, minZ, maxZ };
}

function buildShoreField(ring, x0, x1, z0, z1, res) {
  const data = new Float32Array(res * res);
  const sampled = [];
  for (let i = 0; i < ring.length; i += 3) sampled.push(ring[i]);
  if (sampled[sampled.length - 1] !== ring[ring.length - 1]) sampled.push(ring[ring.length - 1]);
  for (let j = 0; j < res; j++) {
    const z = z0 + (z1 - z0) * (j / (res - 1));
    for (let i = 0; i < res; i++) {
      const x = x0 + (x1 - x0) * (i / (res - 1));
      let best = Infinity;
      for (let k = 0; k < sampled.length - 1; k++) {
        const a = sampled[k], b = sampled[k + 1];
        const dx = b[0] - a[0], dz = b[1] - a[1];
        const l2 = dx * dx + dz * dz || 1;
        let t = ((x - a[0]) * dx + (z - a[1]) * dz) / l2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const px = a[0] + dx * t, pz = a[1] + dz * t;
        const d = (x - px) ** 2 + (z - pz) ** 2;
        if (d < best) best = d;
      }
      data[j * res + i] = Math.sqrt(best);
    }
  }
  return { data, res, x0, x1, z0, z1 };
}

function sampleField(f, x, z) {
  const u = Math.max(0, Math.min(1, (x - f.x0) / (f.x1 - f.x0)));
  const v = Math.max(0, Math.min(1, (z - f.z0) / (f.z1 - f.z0)));
  const xx = u * (f.res - 1), zz = v * (f.res - 1);
  const x0 = Math.floor(xx), z0 = Math.floor(zz);
  const tx = xx - x0, tz = zz - z0;
  const g = (i, j) => f.data[Math.min(f.res - 1, j) * f.res + Math.min(f.res - 1, i)];
  const a = g(x0, z0), b = g(x0 + 1, z0), c = g(x0, z0 + 1), d = g(x0 + 1, z0 + 1);
  return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
}

function offsetRingOutward(ring, offset) {
  let cx = 0, cz = 0;
  for (const p of ring) { cx += p[0]; cz += p[1]; }
  cx /= ring.length; cz /= ring.length;
  return ring.map(([x, z]) => {
    const dx = x - cx, dz = z - cz;
    const l = Math.hypot(dx, dz) || 1;
    return [x + dx / l * offset, z + dz / l * offset];
  });
}

function stripBetween(name, inner, outer, y, material, scene, uvScale = 0.02) {
  const n = Math.min(inner.length, outer.length);
  const positions = [], indices = [], uvs = [];
  for (let i = 0; i < n; i++) {
    const a = inner[i], b = outer[i];
    positions.push(a[0], y, a[1], b[0], y, b[1]);
    uvs.push(a[0] * uvScale, a[1] * uvScale, b[0] * uvScale, b[1] * uvScale);
  }
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const a = i * 2, b = j * 2;
    indices.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const mesh = new B.Mesh(name, scene);
  const vd = new B.VertexData();
  vd.positions = positions; vd.indices = indices; vd.uvs = uvs; vd.normals = [];
  B.VertexData.ComputeNormals(positions, indices, vd.normals);
  vd.applyToMesh(mesh, true);
  mesh.material = material;
  mesh.receiveShadows = true;
  return mesh;
}

function createCity(scene, data, heightAt, isWater) {
  const rand = mulberry32(20261029);
  const root = new B.TransformNode('city-root', scene);
  const masters = [];
  const mats = [
    scene._wlMats.city, scene._wlMats.cityWall, scene._wlMats.cityGlass,
  ];
  for (let i = 0; i < 3; i++) {
    const m = B.MeshBuilder.CreateBox('city-master-' + i, { size: 1 }, scene);
    m.material = mats[i];
    m.isVisible = false;
    m.parent = root;
    masters.push(m);
  }
  const roofMaster = B.MeshBuilder.CreateCylinder('city-roof-master', { diameterTop: 0.04, diameterBottom: 1.25, height: 0.22, tessellation: 4 }, scene);
  roofMaster.material = scene._wlMats.cityRoof;
  roofMaster.isVisible = false; roofMaster.parent = root;

  const blocks = [];
  const buckets = [[], [], []];
  const roofMatrices = [];
  // 东侧湖滨城市、北侧城区。南侧留给公园与山麓，避免压在相机脚下。
  for (let i = 0; i < 980; i++) {
    let x, z;
    if (i < 700) {
      x = 3200 + rand() * 2600;
      z = -3600 + rand() * 5000;
    } else if (i < 900) {
      x = -1500 + rand() * 5200;
      z = -6800 + rand() * 2500;
    } else {
      x = 2700 + rand() * 650;
      z = -1100 + rand() * 2400;
    }
    if (isWater(x, z)) continue;
    const base = heightAt(x, z);
    if (base > 105) continue;
    let h = 7 + rand() * 15;
    if (x > 2500 && x < 4300 && z > -900 && z < 1500) h += rand() * 38;
    if (rand() < 0.03) h += 35 + rand() * 55;
    const w = 12 + rand() * (x > 2500 ? 26 : 30);
    const d = 12 + rand() * (x > 2500 ? 26 : 30);
    const idx = h > 38 ? 2 : rand() < 0.5 ? 1 : 0;
    const rot = (rand() - 0.5) * 0.08;
    buckets[idx].push(B.Matrix.Compose(
      new B.Vector3(w, h, d),
      B.Quaternion.FromEulerAngles(0, rot, 0),
      new B.Vector3(x, base + h / 2, z)
    ));
    // 中式坡顶：低层建筑加一层薄屋顶
    if (h < 26 && rand() < 0.6) {
      roofMatrices.push(B.Matrix.Compose(
        new B.Vector3(w * 1.04, 1, d * 1.04),
        B.Quaternion.FromEulerAngles(0, rot, 0),
        new B.Vector3(x, base + h + 0.8, z)
      ));
    }
    blocks.push({ x, z, base, h });
  }
  const cityMeshes = [];
  for (let i = 0; i < 3; i++) {
    const mesh = bakeInstances(scene, masters[i], buckets[i], 'city-buildings-' + i, mats[i]);
    if (mesh) { mesh.parent = root; cityMeshes.push(mesh); }
    masters[i].dispose();
  }
  const roofs = bakeInstances(scene, roofMaster, roofMatrices, 'city-roofs', scene._wlMats.cityRoof);
  if (roofs) { roofs.parent = root; cityMeshes.push(roofs); }
  roofMaster.dispose();
  root.freezeWorldMatrix?.();
  return { root, cityMeshes, blocks, update() {} };
}

function createDistantRanges(scene) {
  const root = new B.TransformNode('far-ranges', scene);
  const mountains = [];
  const layers = [
    { radius: 12800, height: 880, color: '#637b80', emissive: '#111d20', alpha: 0.58, phase: 1.2 },
    { radius: 9400, height: 700, color: '#405d62', emissive: '#0b1619', alpha: 0.72, phase: 3.7 },
    { radius: 7400, height: 540, color: '#2b474b', emissive: '#071114', alpha: 0.88, phase: 6.1 },
  ];
  for (let layer = 0; layer < layers.length; layer++) {
    const cfg = layers[layer];
    const seg = 180;
    const positions = [], indices = [], colors = [];
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const rr = cfg.radius + Math.sin(a * 3.1 + cfg.phase) * 520 + Math.sin(a * 7.3 + 1.7) * 240;
      const ridge = cfg.height
        + Math.sin(a * 2.2 + cfg.phase) * 120
        + Math.abs(Math.sin(a * 6.3 + cfg.phase * 1.7)) * 300
        + Math.abs(Math.sin(a * 12.7 + cfg.phase * 0.7)) * 160
        + Math.max(0, Math.sin(a * 19.3 + 0.7)) * 70;
      const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      positions.push(x, -160, z, x, ridge, z);
      indices.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
    const mesh = new B.Mesh('far-ridge-' + layer, scene);
    const vd = new B.VertexData();
    vd.positions = positions; vd.indices = indices; vd.normals = [];
    B.VertexData.ComputeNormals(positions, indices, vd.normals);
    vd.applyToMesh(mesh, false);
    const mat = new B.StandardMaterial('far-ridge-mat-' + layer, scene);
    mat.diffuseColor = new B.Color3(0, 0, 0);
    mat.emissiveColor = B.Color3.FromHexString(cfg.color).scale(0.86);
    mat.specularColor = new B.Color3(0, 0, 0);
    mat.disableLighting = true;
    mat.backFaceCulling = false;
    mat.alpha = cfg.alpha;
    mat.fogEnabled = true;
    mesh.material = mat;
    mesh.parent = root;
    mountains.push(mesh);
  }
  return { root, mountains, material: mountains[0]?.material };
}
