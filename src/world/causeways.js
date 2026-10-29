/**
 * 苏堤、白堤、杨公堤、六桥与环湖道路。
 */
import { B, clamp, lerp, merge, setPick, hex } from '../core/utils.js';

const CAUSEWAYS = ['苏堤', '白堤', '杨公堤'];

export function createCauseways(scene, data, heightAt) {
  const mats = scene._wlMats;
  const root = new B.TransformNode('causeways', scene);
  const roads = data.roads || [];
  const roadMeshes = [];
  const bankMeshes = [];
  const postMeshes = [];
  const railMeshes = [];
  const bridgeMeshes = [];
  const pickables = [];

  const inCauseway = (name) => CAUSEWAYS.some((k) => name.includes(k));

  for (const r of roads) {
    if (!r.points || r.points.length < 2) continue;
    const key = r.name;
    const isCauseway = inCauseway(key);
    const width = isCauseway ? 9.5 : (r.class === 'primary' ? 13 : r.class === 'secondary' ? 10 : 7);
    const pts = r.points;
    // 道路中心线在堤上平直，在陆地上贴合地形
    const elevated = pts.map(([x, z]) => {
      if (isCauseway) return 0.66;
      return Math.max(0.55, heightAt(x, z) + 0.22);
    });
    const road = ribbonOpen(scene, 'road-' + key, pts, elevated, width, mats.road, 1.2);
    roadMeshes.push(road);
    setPick(road, 'road', { name: key });

    if (isCauseway) {
      const bankY = pts.map(() => 0.48);
      const bank = ribbonOpen(scene, 'bank-' + key, pts, bankY, 17.0, mats.grass, 0.9);
      bankMeshes.push(bank);
      // 两侧石质驳岸与栏杆
      for (const side of [-1, 1]) {
        const edgePts = offsetPath(pts, side * 8.32);
        const edge = ribbonOpen(scene, 'causeway-edge', edgePts, pts.map(() => 0.58), 0.7, mats.stoneWarm, 2.0);
        bankMeshes.push(edge);
        // 望柱 + 横栏
        const posts = [];
        for (let i = 0; i < edgePts.length - 1; i += 2) {
          const p = edgePts[i];
          const post = B.MeshBuilder.CreateBox('causeway-post', { width: 0.42, height: 1.15, depth: 0.42 }, scene);
          post.position.set(p[0], 0.86, p[1]);
          post.material = mats.stoneWarm;
          posts.push(post);
        }
        if (posts.length) postMeshes.push(merge(posts, 'causeway-posts-' + key + side));
        const rail = ribbonOpen(scene, 'causeway-rail', edgePts, pts.map(() => 1.30), 0.18, mats.stoneWarm, 1.0);
        railMeshes.push(rail);
      }
    }
  }

  // 合并大量小件，减少 draw call
  const roadMerged = merge(roadMeshes.filter(Boolean), 'roads-merged');
  const bankMerged = merge(bankMeshes.filter(Boolean), 'causeway-banks-merged');
  const postMerged = merge(postMeshes.filter(Boolean), 'causeway-posts-merged');
  const railMerged = merge(railMeshes.filter(Boolean), 'causeway-rails-merged');
  [roadMerged, bankMerged, postMerged, railMerged].forEach((m) => {
    if (m) { m.parent = root; m.receiveShadows = true; m.freezeWorldMatrix(); }
  });
  if (roadMerged) setPick(roadMerged, 'road', { name: '环湖道路' });

  // ——— 桥梁 ———
  for (const b of data.bridges || []) {
    const tangent = nearestRoadTangent(roads, b.x, b.z);
    const bridge = createBridge(scene, b, tangent, mats);
    if (bridge) {
      bridge.parent = root;
      bridgeMeshes.push(bridge);
      pickables.push(bridge);
    }
  }

  // 统一合并桥梁的静态部件（保留每座桥整体的可拾取？这里以桥名拆开，不合并整体）
  function update(t, dt, app) {}

  return { root, roads: roadMerged, banks: bankMerged, bridges: bridgeMeshes, pickables, update };
}

function ribbonOpen(scene, name, points, ys, width, material, uvScale = 1) {
  if (!points || points.length < 2) return null;
  const positions = [], indices = [], uvs = [];
  let acc = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];
    let dx = next[0] - prev[0], dz = next[1] - prev[1];
    const len = Math.hypot(dx, dz) || 1; dx /= len; dz /= len;
    const nx = -dz, nz = dx;
    const y = ys[Math.min(ys.length - 1, i)];
    if (i > 0) acc += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
    positions.push(p[0] + nx * width / 2, y, p[1] + nz * width / 2);
    positions.push(p[0] - nx * width / 2, y, p[1] - nz * width / 2);
    uvs.push(0, acc / uvScale); uvs.push(1, acc / uvScale);
  }
  for (let i = 0; i < points.length - 1; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const mesh = new B.Mesh(name, scene);
  const vd = new B.VertexData();
  vd.positions = positions; vd.indices = indices; vd.uvs = uvs; vd.normals = [];
  B.VertexData.ComputeNormals(positions, indices, vd.normals);
  vd.applyToMesh(mesh, true);
  mesh.material = material;
  // must add to scene after VertexData; constructing with null is allowed but scene needs add
  return mesh;
}

function offsetPath(points, offset) {
  const out = [];
  for (let i = 0; i < points.length; i++) {
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];
    let dx = next[0] - prev[0], dz = next[1] - prev[1];
    const len = Math.hypot(dx, dz) || 1; dx /= len; dz /= len;
    out.push([points[i][0] - dz * offset, points[i][1] + dx * offset]);
  }
  return out;
}

function nearestRoadTangent(roads, x, z) {
  let best = null, bestD = Infinity;
  for (const r of roads) {
    if (!r.points || r.points.length < 2) continue;
    for (let i = 0; i < r.points.length - 1; i++) {
      const a = r.points[i], b = r.points[i + 1];
      const dx = b[0] - a[0], dz = b[1] - a[1];
      const l2 = dx * dx + dz * dz || 1;
      let t = ((x - a[0]) * dx + (z - a[1]) * dz) / l2;
      t = clamp(t, 0, 1);
      const px = a[0] + dx * t, pz = a[1] + dz * t;
      const d = Math.hypot(px - x, pz - z);
      if (d < bestD) {
        bestD = d;
        best = [dx / Math.sqrt(l2), dz / Math.sqrt(l2)];
      }
    }
  }
  return best || [0, 1];
}

function createBridge(scene, b, tangent, mats) {
  const root = new B.TransformNode('bridge-' + b.name, scene);
  root.position.set(b.x, 0.55, b.z);
  root.rotation.y = Math.atan2(tangent[0], tangent[1]);
  const L = 28, W = b.name.includes('断桥') ? 9.6 : b.name.includes('长桥') ? 18 : 12;
  const rise = b.name.includes('断桥') ? 2.6 : 2.1;
  const seg = 18;
  const positions = [], indices = [], uvs = [];
  // 桥面：沿局部 z 轴，中间拱起
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    const z = -L / 2 + L * t;
    const y = rise * Math.pow(Math.sin(Math.PI * t), 0.8);
    positions.push(-W / 2, y, z, W / 2, y, z);
    uvs.push(0, t * 4, 1, t * 4);
  }
  for (let i = 0; i < seg; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const deck = new B.Mesh('bridge-deck', scene);
  const vd = new B.VertexData();
  vd.positions = positions; vd.indices = indices; vd.uvs = uvs; vd.normals = [];
  B.VertexData.ComputeNormals(positions, indices, vd.normals);
  vd.applyToMesh(deck, true);
  deck.material = mats.stoneWarm;
  deck.parent = root;

  // 两侧栏板与望柱
  const railParts = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i <= seg; i += 2) {
      const t = i / seg;
      const z = -L / 2 + L * t;
      const y = rise * Math.pow(Math.sin(Math.PI * t), 0.8);
      const p = B.MeshBuilder.CreateBox('bridge-post', { width: 0.36, height: 1.2, depth: 0.4 }, scene);
      p.position.set(side * (W / 2 - 0.25), y + 0.55, z);
      p.material = mats.stoneWarm;
      p.parent = root;
      railParts.push(p);
    }
    // 桥栏：沿着拱面用一系列短栏板
    for (let i = 0; i < seg; i++) {
      const t0 = i / seg, t1 = (i + 1) / seg;
      const z0 = -L / 2 + L * t0, z1 = -L / 2 + L * t1;
      const y0 = rise * Math.pow(Math.sin(Math.PI * t0), 0.8);
      const y1 = rise * Math.pow(Math.sin(Math.PI * t1), 0.8);
      const len = Math.hypot(z1 - z0, y1 - y0);
      const slab = B.MeshBuilder.CreateBox('bridge-rail', { width: 0.18, height: 0.8, depth: len }, scene);
      slab.position.set(side * (W / 2 - 0.25), (y0 + y1) / 2 + 0.95, (z0 + z1) / 2);
      slab.rotation.x = -Math.atan2(y1 - y0, z1 - z0);
      slab.material = mats.stoneWarm;
      slab.parent = root;
      railParts.push(slab);
    }
  }
  const rails = merge(railParts, 'bridge-rails');
  if (rails) rails.parent = root;

  // 拱洞：半圆石拱，朝向桥的横向
  const archParts = [];
  const archR = 6.4;
  for (let i = 0; i <= 20; i++) {
    const a = Math.PI * (i / 20);
    const x = Math.cos(a) * archR;
    const y = Math.sin(a) * archR - archR;
    const stone = B.MeshBuilder.CreateBox('arch-stone', { width: 0.62, height: 1.2, depth: 1.2 }, scene);
    stone.position.set(x, y + 0.1, 0);
    stone.rotation.z = a - Math.PI / 2;
    stone.material = mats.stoneDark;
    stone.parent = root;
    archParts.push(stone);
  }
  const arch = merge(archParts, 'bridge-arch');
  if (arch) arch.parent = root;

  // 桥头两盏灯
  if (b.name === '断桥' || b.name === '锦带桥' || b.name === '西泠桥') {
    for (const side of [-1, 1]) {
      const lamp = B.MeshBuilder.CreateSphere('bridge-lamp', { diameter: 0.6, segments: 8 }, scene);
      lamp.position.set(side * (W / 2 - 0.4), rise * 0.35 + 2.2, -L / 2 + 1.2);
      lamp.material = mats.lantern;
      lamp.parent = root;
    }
  }
  setPick(deck, 'bridge', { name: b.name });
  if (rails) setPick(rails, 'bridge', { name: b.name });
  return root;
}
