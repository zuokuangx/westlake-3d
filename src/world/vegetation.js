/**
 * 西湖草木：苏堤桃柳、环湖垂柳、山间林木、孤山梅、荷塘与芦苇。
 */
import { B, clamp, mulberry32, pointInPoly, distToPolyline, catmull, bakeInstances } from '../core/utils.js';

export function createVegetation(scene, data, terrain, quality = 'high') {
  const mats = scene._wlMats;
  const root = new B.TransformNode('vegetation', scene);
  const rand = mulberry32(884422);
  const q = quality === 'high' ? 1800 : quality === 'medium' ? 900 : 320;
  const heights = terrain.heightAt;
  const isWater = terrain.isWater;
  const lake = data.lake;

  const masters = {};
  const placements = { willow: [], peach: [], round: [], dark: [], light: [], bamboo: [], plum: [] };

  function makeTree(type, trunkMat, leafMat, kind) {
    const trunkParts = [];
    const leafParts = [];
    if (kind === 'willow') {
      const trunk = B.MeshBuilder.CreateCylinder('wt', { diameterTop: 0.24, diameterBottom: 0.58, height: 5.6, tessellation: 7 }, scene);
      trunk.position.y = 2.8; trunk.material = trunkMat; trunkParts.push(trunk);
      // 主冠：多团不规则柳云，垂枝从冠缘落下
      for (let i = 0; i < 5; i++) {
        const crown = B.MeshBuilder.CreateSphere('wc', { diameter: 4.2 + rand() * 2.2, segments: 6 }, scene);
        crown.position.set((rand() - 0.5) * 4.2, 6.6 + rand() * 1.8, (rand() - 0.5) * 4.2);
        crown.scaling.y = 0.62; crown.material = leafMat; leafParts.push(crown);
      }
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2 + 0.3;
        const drip = B.MeshBuilder.CreateCylinder('wd', {
          diameterTop: 0.05, diameterBottom: 0.9 + rand() * 0.7, height: 3.8 + rand() * 3.2, tessellation: 5,
        }, scene);
        drip.position.set(Math.cos(a) * (3.2 + rand() * 0.8), 4.6 - rand() * 1.3, Math.sin(a) * (3.2 + rand() * 0.8));
        drip.rotation.z = Math.cos(a) * (0.18 + rand() * 0.15);
        drip.rotation.x = Math.sin(a) * (0.18 + rand() * 0.15);
        drip.material = leafMat;
        leafParts.push(drip);
      }
    } else if (kind === 'peach') {
      const trunk = B.MeshBuilder.CreateCylinder('pt', { diameterTop: 0.2, diameterBottom: 0.44, height: 3.6, tessellation: 6 }, scene);
      trunk.position.y = 1.8; trunk.material = trunkMat; trunkParts.push(trunk);
      for (let i = 0; i < 5; i++) {
        const p = B.MeshBuilder.CreateSphere('pc', { diameter: 2.0 + rand() * 1.5, segments: 6 }, scene);
        p.position.set((rand() - 0.5) * 3.4, 3.8 + rand() * 1.7, (rand() - 0.5) * 3.4);
        p.scaling.y = 0.68; p.material = leafMat; leafParts.push(p);
      }
    } else if (kind === 'bamboo') {
      for (let i = 0; i < 7; i++) {
        const stalk = B.MeshBuilder.CreateCylinder('bt', { diameterTop: 0.07, diameterBottom: 0.13, height: 7 + rand() * 5, tessellation: 5 }, scene);
        stalk.position.set((rand() - 0.5) * 2.6, 3.5, (rand() - 0.5) * 2.6);
        stalk.rotation.z = (rand() - 0.5) * 0.14;
        stalk.material = leafMat;
        leafParts.push(stalk);
      }
      for (let i = 0; i < 6; i++) {
        const ball = B.MeshBuilder.CreateSphere('bb', { diameter: 2.0 + rand() * 1.5, segments: 5 }, scene);
        ball.position.set((rand() - 0.5) * 3.2, 7.4 + rand() * 3.0, (rand() - 0.5) * 3.2);
        ball.scaling.y = 0.55; ball.material = leafMat; leafParts.push(ball);
      }
    } else if (kind === 'plum') {
      const trunk = B.MeshBuilder.CreateCylinder('mt', { diameterTop: 0.18, diameterBottom: 0.42, height: 3.4, tessellation: 6 }, scene);
      trunk.position.y = 1.7; trunk.rotation.z = 0.2; trunk.material = trunkMat; trunkParts.push(trunk);
      for (let i = 0; i < 5; i++) {
        const p = B.MeshBuilder.CreateSphere('mc', { diameter: 1.1 + rand() * 0.6, segments: 5 }, scene);
        p.position.set((rand() - 0.5) * 3.0, 3.2 + rand() * 1.5, (rand() - 0.5) * 3.0);
        p.material = leafMat; leafParts.push(p);
      }
    } else {
      // 樟树 / 枫香 / 松：低矮分枝 + 多团不规则树冠
      const h = kind === 'dark' ? 8 + rand() * 4.5 : 6.5 + rand() * 5;
      const trunk = B.MeshBuilder.CreateCylinder('tt', { diameterTop: 0.28, diameterBottom: 0.82, height: h * 0.72, tessellation: 7 }, scene);
      trunk.position.y = h * 0.36; trunk.material = trunkMat; trunkParts.push(trunk);
      for (let i = 0; i < 3; i++) {
        const a = rand() * Math.PI * 2;
        const branch = B.MeshBuilder.CreateCylinder('tb', { diameterTop: 0.08, diameterBottom: 0.3, height: h * 0.48, tessellation: 5 }, scene);
        branch.position.set(Math.cos(a) * 1.2, h * 0.65, Math.sin(a) * 1.2);
        branch.rotation.z = Math.cos(a) * 0.55;
        branch.rotation.x = Math.sin(a) * 0.55;
        branch.material = trunkMat; trunkParts.push(branch);
      }
      const layers = kind === 'dark' ? 5 : 6;
      for (let i = 0; i < layers; i++) {
        const d = 3.4 + rand() * 3.0;
        const ball = B.MeshBuilder.CreateSphere('tc', { diameter: d, segments: 6 }, scene);
        const a = rand() * Math.PI * 2;
        const r = i < 2 ? 1.2 : 2.8;
        ball.position.set(Math.cos(a) * r, h * 0.62 + (i / layers) * h * 0.35, Math.sin(a) * r);
        ball.scaling.y = 0.72 + rand() * 0.15;
        ball.material = leafMat; leafParts.push(ball);
      }
    }
    const trunkMerged = B.Mesh.MergeMeshes(trunkParts, true, true, undefined, false, true);
    const leafMerged = B.Mesh.MergeMeshes(leafParts, true, true, undefined, false, true);
    if (trunkMerged) { trunkMerged.material = trunkMat; trunkMerged.isVisible = false; trunkMerged.parent = root; trunkMerged.freezeWorldMatrix(); }
    if (leafMerged) { leafMerged.material = leafMat; leafMerged.isVisible = false; leafMerged.parent = root; leafMerged.freezeWorldMatrix(); }
    return { trunk: trunkMerged, leaf: leafMerged };
  }

  masters.willow = makeTree('willow', mats.bark, mats.willowLeaf, 'willow');
  masters.peach = makeTree('peach', mats.bark, mats.peach, 'peach');
  masters.round = makeTree('round', mats.trunk, mats.tree, 'round');
  masters.dark = makeTree('dark', mats.trunk, mats.treeDark, 'dark');
  masters.light = makeTree('light', mats.trunk, mats.treeLight, 'light');
  masters.bamboo = makeTree('bamboo', mats.bark, mats.bamboo, 'bamboo');
  masters.plum = makeTree('plum', mats.bark, mats.peachLeaf, 'plum');

  // ——— 苏堤、白堤、杨公堤：一株杨柳一株桃 ———
  const causewayRoads = data.roads.filter((r) => /苏堤|白堤|杨公堤/.test(r.name));
  for (const r of causewayRoads) {
    const pts = r.points || [];
    let acc = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const segLen = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const dirX = (b[0] - a[0]) / (segLen || 1), dirZ = (b[1] - a[1]) / (segLen || 1);
      const step = 17;
      for (let d = 0; d < segLen; d += step) {
        const t = d / segLen;
        const x = a[0] + (b[0] - a[0]) * t;
        const z = a[1] + (b[1] - a[1]) * t;
        const side = (Math.floor(acc / step) % 2 === 0) ? -1 : 1;
        const off = 9.4;
        const px = x - dirZ * off * side, pz = z + dirX * off * side;
        if (isWater(px, pz)) continue;
        const kind = (Math.floor(acc / step) % 3 === 0) ? 'peach' : 'willow';
        placements[kind].push({ x: px, z: pz, y: 0.7, s: 0.72 + rand() * 0.35, r: rand() * Math.PI * 2 });
        acc += step;
      }
    }
  }

  // ——— 湖岸垂柳 ———
  const outer = lake.outer;
  let cx = 0, cz = 0;
  for (const p of outer) { cx += p[0]; cz += p[1]; }
  cx /= outer.length; cz /= outer.length;
  for (let i = 0; i < outer.length; i += 2) {
    const p = outer[i];
    let ox = p[0] - cx, oz = p[1] - cz;
    const l = Math.hypot(ox, oz) || 1; ox /= l; oz /= l;
    const x = p[0] + ox * 7.5, z = p[1] + oz * 7.5;
    if (isWater(x, z)) continue;
    const y = Math.max(0.5, heights(x, z));
    if (rand() < 0.72) placements.willow.push({ x, z, y, s: 0.8 + rand() * 0.5, r: rand() * 6 });
    else if (rand() < 0.35) placements.peach.push({ x: x - oz * 12, z: z + ox * 12, y, s: 0.75 + rand() * 0.35, r: rand() * 6 });
  }

  // ——— 岛上树 ———
  for (const h of lake.holes) {
    if (h.area < 5000) continue;
    const pts = h.points;
    const step = Math.max(1, Math.floor(pts.length / 10));
    for (let i = 0; i < pts.length; i += step) {
      const p = pts[i];
      const px = p[0] + (rand() - 0.5) * 35, pz = p[1] + (rand() - 0.5) * 35;
      if (isWater(px, pz)) continue;
      const y = Math.max(0.55, heights(px, pz));
      const kind = h.name.includes('孤山') && rand() < 0.25 ? 'plum' : rand() < 0.45 ? 'willow' : 'round';
      placements[kind].push({ x: px, z: pz, y, s: 0.65 + rand() * 0.55, r: rand() * 6 });
    }
  }

  // ——— 山林 ———
  let tries = 0;
  while (placements.round.length + placements.dark.length + placements.light.length < q && tries < q * 8) {
    tries++;
    const x = -5200 + rand() * 10400;
    const z = -5600 + rand() * 11000;
    if (isWater(x, z)) continue;
    const y = heights(x, z);
    if (y < 1.4) continue;
    const d = distanceToShore(x, z, outer);
    if (d < 18) continue;
    const density = Math.sin(x * 0.0021 + z * 0.0017) * 0.5 + 0.5;
    if (rand() > 0.28 + density * 0.6) continue;
    const kind = rand() < 0.35 ? 'dark' : rand() < 0.55 ? 'round' : 'light';
    placements[kind].push({ x, z, y, s: 0.72 + rand() * 0.7, r: rand() * 6.2 });
  }

  // 东岸前景树丛：为全景构建层次，也给低机位一点遮挡与纵深
  for (let i = 0; i < 90; i++) {
    const x = 850 + rand() * 1050;
    const z = 1800 + rand() * 1350;
    if (isWater(x, z)) continue;
    const y = heights(x, z);
    if (y < 0.35) continue;
    const kind = rand() < 0.55 ? 'round' : rand() < 0.5 ? 'light' : 'dark';
    placements[kind].push({ x, z, y, s: 1.35 + rand() * 0.65, r: rand() * 6.2 });
  }
  for (let i = 0; i < 55; i++) {
    const x = 1050 + rand() * 780;
    const z = -200 + rand() * 1500;
    if (isWater(x, z)) continue;
    placements.willow.push({ x, z, y: Math.max(0.55, heights(x, z)), s: 1.2 + rand() * 0.55, r: rand() * 6 });
  }

  // 孤山梅林 & 灵峰探梅（少量）
  for (let i = 0; i < 60; i++) {
    const x = -900 + rand() * 400, z = -580 + rand() * 360;
    if (isWater(x, z)) continue;
    const y = Math.max(0.7, heights(x, z));
    placements.plum.push({ x, z, y, s: 0.55 + rand() * 0.45, r: rand() * 6 });
  }
  // 竹林
  for (let i = 0; i < 22; i++) {
    const cluster = [[-800, -520], [-1010, -300], [-560, 1500], [-1800, -80]][i % 4];
    const x = cluster[0] + (rand() - 0.5) * 90, z = cluster[1] + (rand() - 0.5) * 90;
    if (isWater(x, z)) continue;
    placements.bamboo.push({ x, z, y: Math.max(0.6, heights(x, z)), s: 0.75 + rand() * 0.4, r: rand() * 6 });
  }

  // 让树冠在开阔湖面上仍能被看见
  for (const list of Object.values(placements)) for (const p of list) p.s *= 1.45;

  const counts = {};
  for (const [type, list] of Object.entries(placements)) {
    const m = masters[type];
    if (!m) continue;
    counts[type] = list.length;
    const matrices = [];
    for (const p of list) {
      const sy = p.s * (0.9 + rand() * 0.2);
      matrices.push(B.Matrix.Compose(
        new B.Vector3(p.s, sy, p.s),
        B.Quaternion.FromEulerAngles(0, p.r, 0),
        new B.Vector3(p.x, p.y, p.z)
      ));
    }
    if (m.trunk && matrices.length) {
      const tr = bakeInstances(scene, m.trunk, matrices, type + '-trunks', m.trunk.material);
      if (tr) tr.parent = root;
      m.trunk.dispose();
    }
    if (m.leaf && matrices.length) {
      const lf = bakeInstances(scene, m.leaf, matrices, type + '-leaves', m.leaf.material);
      if (lf) lf.parent = root;
      m.leaf.dispose();
    }
  }

  // ——— 荷花 ———
  const lotusPatches = [
    { x: -1748, z: -190, r: 180, n: 260 },
    { x: -1600, z: -95, r: 90, n: 90 },
    { x: -503, z: 1240, r: 120, n: 100 },
    { x: 1180, z: -80, r: 100, n: 80 },
    { x: -640, z: 1550, r: 90, n: 70 },
  ];
  const padMaster = B.MeshBuilder.CreateDisc('lotus-pad-master', { radius: 1.25, tessellation: 14 }, scene);
  padMaster.rotation.x = Math.PI / 2;
  padMaster.material = mats.lotusLeaf;
  padMaster.isVisible = false;
  padMaster.parent = root;
  const flowerMaster = B.MeshBuilder.CreateCylinder('lotus-flower-master', { diameterTop: 0.04, diameterBottom: 1.05, height: 1.5, tessellation: 6 }, scene);
  flowerMaster.material = mats.lotusFlower;
  flowerMaster.isVisible = false;
  flowerMaster.parent = root;
  let lotusCount = 0;
  const padMatrices = [];
  const flowerMatrices = [];
  for (const patch of lotusPatches) {
    for (let i = 0; i < patch.n; i++) {
      const a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * patch.r;
      const x = patch.x + Math.cos(a) * d, z = patch.z + Math.sin(a) * d;
      if (!isWater(x, z)) continue;
      padMatrices.push(B.Matrix.Compose(
        new B.Vector3(0.7 + rand() * 0.8, 0.7 + rand() * 0.6, 0.7 + rand() * 0.8),
        B.Quaternion.FromEulerAngles(Math.PI / 2, rand() * 6, 0),
        new B.Vector3(x, 0.08 + rand() * 0.04, z)
      ));
      lotusCount++;
      if (rand() < 0.18) {
        const h = 0.7 + rand() * 1.4;
        flowerMatrices.push(B.Matrix.Compose(
          new B.Vector3(0.6 + rand() * 0.6, h, 0.6 + rand() * 0.6),
          B.Quaternion.FromEulerAngles((rand() - 0.5) * 0.2, rand() * 6, (rand() - 0.5) * 0.2),
          new B.Vector3(x + (rand() - 0.5) * 1.2, 0.5 + h * 0.5, z + (rand() - 0.5) * 1.2)
        ));
      }
    }
  }
  const lotusPadMesh = bakeInstances(scene, padMaster, padMatrices, 'lotus-pads', mats.lotusLeaf);
  if (lotusPadMesh) lotusPadMesh.parent = root;
  const lotusFlowerMesh = bakeInstances(scene, flowerMaster, flowerMatrices, 'lotus-flowers', mats.lotusFlower);
  if (lotusFlowerMesh) lotusFlowerMesh.parent = root;
  padMaster.dispose(); flowerMaster.dispose();

  // ——— 芦苇 ———
  const reedMaster = B.MeshBuilder.CreateCylinder('reed-master', { diameterTop: 0.03, diameterBottom: 0.08, height: 2.2 + rand() * 1.5, tessellation: 4 }, scene);
  reedMaster.material = mats.reed;
  reedMaster.isVisible = false;
  reedMaster.parent = root;
  const reedMatrices = [];
  for (let i = 0; i < 500; i++) {
    const p = outer[Math.floor(rand() * outer.length)];
    const a = rand() * Math.PI * 2;
    const x = p[0] + Math.cos(a) * 4.5, z = p[1] + Math.sin(a) * 4.5;
    if (!isWater(x, z)) continue;
    reedMatrices.push(B.Matrix.Compose(
      new B.Vector3(0.7 + rand() * 0.6, 0.8 + rand(), 0.7 + rand() * 0.6),
      B.Quaternion.FromEulerAngles(0, rand() * 6, 0),
      new B.Vector3(x, 0.8, z)
    ));
  }
  const reedMesh = bakeInstances(scene, reedMaster, reedMatrices, 'reeds', mats.reed);
  if (reedMesh) reedMesh.parent = root;
  reedMaster.dispose();

  return {
    root, masters, counts, lotusCount,
    update(t) {
      // 柳丝轻摆：只旋转 top-level 风铃不会影响实例；保留整体静止以控制成本
    },
  };
}

function distanceToShore(x, z, ring) {
  let best = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const l2 = dx * dx + dz * dz || 1;
    let t = ((x - a[0]) * dx + (z - a[1]) * dz) / l2;
    t = clamp(t, 0, 1);
    const px = a[0] + dx * t, pz = a[1] + dz * t;
    best = Math.min(best, (x - px) ** 2 + (z - pz) ** 2);
  }
  return Math.sqrt(best);
}
