/**
 * 共用工具：确定性随机、Canvas 程序纹理、多边形、几何拼装。
 */
export const B = window.BABYLON;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);
export const invLerp = (a, b, v) => (v - a) / (b - a);

export function hex(h) {
  return B.Color3.FromHexString(h);
}
export function hex4(h, a = 1) {
  return new B.Color4(...B.Color3.FromHexString(h).asArray(), a);
}

/** TIME_STOPS 中颜色既可能是 hex 字符串，也可能是 Color3。 */
export function lineToColor(c) {
  if (!c) return new B.Color3(1, 1, 1);
  return typeof c === 'string' ? B.Color3.FromHexString(c) : c.clone ? c.clone() : new B.Color3(c.r, c.g, c.b);
}

/** 动态画布纹理。draw(ctx, size) 由调用方完全掌控。 */
export function canvasTexture(scene, name, size, draw, opts = {}) {
  const tex = new B.DynamicTexture(name, { width: size, height: size }, scene, !opts.mipmap);
  const ctx = tex.getContext();
  draw(ctx, size);
  tex.update(false);
  tex.wrapU = opts.wrap || B.Texture.WRAP_ADDRESSMODE;
  tex.wrapV = opts.wrap || B.Texture.WRAP_ADDRESSMODE;
  tex.anisotropicFilteringLevel = opts.aniso ?? 8;
  if (opts.uScale) tex.uScale = opts.uScale;
  if (opts.vScale) tex.vScale = opts.vScale;
  return tex;
}

/** 噪声画布：用于地形、石材、木纹、瓦面。 */
export function noiseFill(ctx, size, base, amp, seed = 1, octaves = 5) {
  const rand = mulberry32(seed);
  const data = ctx.createImageData(size, size);
  const perm = new Float32Array(size * size);
  for (let i = 0; i < perm.length; i++) perm[i] = rand();
  const value = (x, y) => {
    x = ((x % size) + size) % size; y = ((y % size) + size) % size;
    return perm[(y | 0) * size + (x | 0)];
  };
  const fbm = (x, y, oct) => {
    let v = 0, a = 0.5, f = 1;
    for (let o = 0; o < oct; o++) { v += value(x * f, y * f) * a; f *= 2.01; a *= 0.5; }
    return v;
  };
  const baseCol = B.Color3.FromHexString(base);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = fbm(x, y, octaves) - 0.5;
      const grain = (rand() - 0.5) * 0.35;
      const k = 1 + (n * 1.25 + grain) * amp;
      const i = (y * size + x) * 4;
      data.data[i] = clamp(baseCol.r * k) * 255;
      data.data[i + 1] = clamp(baseCol.g * k) * 255;
      data.data[i + 2] = clamp(baseCol.b * k) * 255;
      data.data[i + 3] = 255;
    }
  }
  ctx.putImageData(data, 0, 0);
}

export function makeTerrainTexture(scene) {
  const size = 1024;
  return canvasTexture(scene, 'terrain-albedo', size, (ctx, s) => {
    const rand = mulberry32(931);
    // 墨绿、苔青、土黄、浅草交织
    const grad = ctx.createLinearGradient(0, 0, s, s);
    grad.addColorStop(0, '#42563b');
    grad.addColorStop(0.35, '#576647');
    grad.addColorStop(0.62, '#3c4e35');
    grad.addColorStop(1, '#677057');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, s, s);
    // 多层细碎植被斑块
    for (let layer = 0; layer < 7; layer++) {
      const count = 420 - layer * 38;
      for (let i = 0; i < count; i++) {
        const x = rand() * s, y = rand() * s;
        const r = 2 + rand() * (34 - layer * 3);
        ctx.beginPath();
        ctx.fillStyle = layer % 3 === 0
          ? `rgba(${45 + rand() * 16},${61 + rand() * 22},${37 + rand() * 15},${0.22 + rand() * 0.23})`
          : layer % 3 === 1
            ? `rgba(${84 + rand() * 28},${90 + rand() * 22},${55 + rand() * 20},${0.12 + rand() * 0.18})`
            : `rgba(${41 + rand() * 14},${54 + rand() * 18},${44 + rand() * 12},${0.16 + rand() * 0.16})`;
        ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
    }
    // 极细草叶纹理
    ctx.globalAlpha = 0.16;
    for (let i = 0; i < 8000; i++) {
      const x = rand() * s, y = rand() * s, h = 2 + rand() * 7;
      ctx.strokeStyle = rand() > 0.5 ? '#263b29' : '#8b9064';
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (rand() - 0.5) * 3, y - h); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }, { uScale: 1, vScale: 1, aniso: 8, mipmap: true });
}

export function makeStoneTexture(scene, name, base = '#aaa798', seam = 0.08, seed = 81) {
  return canvasTexture(scene, name, 512, (ctx, s) => {
    noiseFill(ctx, s, base, 0.15, seed, 4);
    // 细密石纹与拼缝
    const rand = mulberry32(seed + 2);
    ctx.globalAlpha = 0.18; ctx.strokeStyle = '#575b55';
    for (let i = 0; i < 90; i++) {
      const y = rand() * s;
      ctx.beginPath(); ctx.moveTo(0, y);
      for (let x = 0; x <= s; x += 36) ctx.lineTo(x, y + (rand() - 0.5) * 5);
      ctx.stroke();
    }
    ctx.globalAlpha = seam;
    ctx.strokeStyle = '#363932'; ctx.lineWidth = 2;
    for (let y = 0; y <= s; y += s / 6) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(s, y); ctx.stroke();
    }
    for (let x = 0; x <= s; x += s / 4) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, s); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }, { uScale: 1, vScale: 1, aniso: 8 });
}

export function makeRoofTexture(scene, name, base, edge, seed = 1) {
  return canvasTexture(scene, name, 512, (ctx, s) => {
    const g = ctx.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0, edge); g.addColorStop(0.45, base); g.addColorStop(1, edge);
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    const rand = mulberry32(seed);
    // 筒瓦垄
    const w = s / 28;
    for (let i = 0; i <= 28; i++) {
      const x = i * w;
      const grad = ctx.createLinearGradient(x - w * 0.5, 0, x + w * 0.5, 0);
      grad.addColorStop(0, 'rgba(0,0,0,0.55)');
      grad.addColorStop(0.35, 'rgba(255,255,255,0.13)');
      grad.addColorStop(0.55, 'rgba(255,255,255,0.22)');
      grad.addColorStop(1, 'rgba(0,0,0,0.45)');
      ctx.fillStyle = grad;
      ctx.fillRect(x - w * 0.32, 0, w * 0.64, s);
    }
    // 横向瓦接缝
    ctx.globalAlpha = 0.18;
    for (let y = 0; y < s; y += s / 12) {
      ctx.strokeStyle = '#0c1012'; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(s, y); ctx.stroke();
    }
    ctx.globalAlpha = 0.08;
    for (let i = 0; i < 400; i++) {
      ctx.fillStyle = rand() > 0.5 ? '#fff3cf' : '#000000';
      ctx.fillRect(rand() * s, rand() * s, 1 + rand() * 2, 1 + rand() * 8);
    }
    ctx.globalAlpha = 1;
  }, { uScale: 2.2, vScale: 2.2, aniso: 8, mipmap: true });
}

export function makeWoodTexture(scene, name, base, seed = 7) {
  return canvasTexture(scene, name, 512, (ctx, s) => {
    noiseFill(ctx, s, base, 0.12, seed, 3);
    const rand = mulberry32(seed + 11);
    ctx.globalAlpha = 0.25;
    for (let i = 0; i < 130; i++) {
      const y = rand() * s;
      ctx.strokeStyle = rand() > 0.5 ? '#26100b' : '#c07852';
      ctx.lineWidth = 0.6 + rand() * 1.4;
      ctx.beginPath(); ctx.moveTo(0, y);
      for (let x = 0; x <= s; x += 30) ctx.lineTo(x, y + Math.sin(x * 0.09 + i) * 2 + (rand() - 0.5) * 3);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }, { uScale: 1.5, vScale: 1.5, aniso: 8 });
}

/** 多边形（支持 holes）转三角网，earcut 由 vendor 脚本提供。 */
export function triangulatePolygon(outer, holes = []) {
  const earcut = window.earcut?.default || window.earcut;
  if (typeof earcut !== 'function') throw new Error('earcut missing');
  const flat = [];
  const holeIndices = [];
  for (const p of outer) flat.push(p[0], p[1]);
  for (const hole of holes) {
    holeIndices.push(flat.length / 2);
    for (const p of hole) flat.push(p[0], p[1]);
  }
  return earcut(flat, holeIndices, 2);
}

export function makePolygonMesh(name, outer, y, material, scene, holes = [], uvScale = 0.01) {
  const positions = [], indices = [], uvs = [], normals = [];
  const tri = triangulatePolygon(outer, holes);
  const all = [];
  for (const p of outer) all.push(p);
  for (const h of holes) for (const p of h) all.push(p);
  for (const p of all) {
    positions.push(p[0], y, p[1]);
    uvs.push(p[0] * uvScale, p[1] * uvScale);
    normals.push(0, 1, 0);
  }
  for (let i = 0; i < tri.length; i += 3) {
    const i0 = tri[i], i1 = tri[i + 1], i2 = tri[i + 2];
    const p0 = all[i0], p1 = all[i1], p2 = all[i2];
    // 统一为朝上的正面，避免 earcut 输入环方向不同导致背面剔除。
    const crossY = (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p1[1] - p0[1]) * (p2[0] - p0[0]);
    if (crossY >= 0) indices.push(i0, i1, i2);
    else indices.push(i0, i2, i1);
  }
  const mesh = new B.Mesh(name, scene);
  const vd = new B.VertexData();
  vd.positions = positions; vd.indices = indices; vd.normals = normals; vd.uvs = uvs;
  vd.applyToMesh(mesh, true);
  mesh.material = material;
  return mesh;
}

export function ringToRibbon(name, ring, y, width, material, scene, closed = true) {
  const pts = closed ? ring.concat([ring[0]]) : ring;
  const positions = [], indices = [], uvs = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[Math.min(pts.length - 1, i + 1)];
    const r = pts[Math.max(0, i - 1)];
    let dx = q[0] - r[0], dz = q[1] - r[1];
    const len = Math.hypot(dx, dz) || 1; dx /= len; dz /= len;
    const nx = -dz, nz = dx;
    positions.push(p[0] + nx * width * 0.5, y, p[1] + nz * width * 0.5);
    positions.push(p[0] - nx * width * 0.5, y, p[1] - nz * width * 0.5);
    uvs.push(0, i * 0.1); uvs.push(1, i * 0.1);
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const mesh = new B.Mesh(name, scene);
  const vd = new B.VertexData();
  vd.positions = positions; vd.indices = indices; vd.uvs = uvs;
  vd.normals = [];
  B.VertexData.ComputeNormals(positions, indices, vd.normals);
  vd.applyToMesh(mesh, true);
  mesh.material = material;
  return mesh;
}

export function wallAroundRing(name, ring, yTop, yBottom, material, scene) {
  const positions = [], indices = [], uvs = [], normals = [];
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i];
    positions.push(p[0], yTop, p[1], p[0], yBottom, p[1]);
    uvs.push(i * 0.08, 0, i * 0.08, 1);
  }
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length;
    const a = i * 2, b = j * 2;
    indices.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const mesh = new B.Mesh(name, scene);
  const vd = new B.VertexData();
  vd.positions = positions; vd.indices = indices; vd.uvs = uvs; vd.normals = normals;
  B.VertexData.ComputeNormals(positions, indices, vd.normals);
  vd.applyToMesh(mesh, true);
  mesh.material = material;
  return mesh;
}

export function box(name, w, h, d, x, y, z, mat, scene, parent = null) {
  const m = B.MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
  m.position.set(x, y, z); m.material = mat; if (parent) m.parent = parent;
  return m;
}

export function cylinder(name, diameterTop, diameterBottom, height, x, y, z, mat, scene, tess = 16, parent = null) {
  const m = B.MeshBuilder.CreateCylinder(name, { diameterTop, diameterBottom, height, tessellation: tess }, scene);
  m.position.set(x, y, z); m.material = mat; if (parent) m.parent = parent;
  return m;
}

/** 把同一 master 的大量变换实例烘焙成单张静态网格（比 InstancedMesh 更少 draw call）。 */
export function bakeInstances(scene, master, matrices, name, material) {
  if (!master || !matrices.length) return null;
  const p = master.getVerticesData('position');
  const n = master.getVerticesData('normal');
  const uv = master.getVerticesData('uv');
  const idx = master.getIndices();
  if (!p || !idx) return null;
  const positions = new Array(matrices.length * p.length);
  const normals = n ? new Array(matrices.length * n.length) : null;
  const uvs = uv ? new Array(matrices.length * uv.length) : null;
  const indices = new Array(matrices.length * idx.length);
  let vo = 0, io = 0;
  const tmp = new B.Vector3();
  for (let k = 0; k < matrices.length; k++) {
    const mat = matrices[k];
    const base = k * (p.length / 3);
    for (let i = 0; i < p.length; i += 3) {
      tmp.set(p[i], p[i + 1], p[i + 2]);
      B.Vector3.TransformCoordinatesToRef(tmp, mat, tmp);
      positions[vo++] = tmp.x; positions[vo++] = tmp.y; positions[vo++] = tmp.z;
    }
    if (n) {
      let no = k * n.length;
      for (let i = 0; i < n.length; i += 3) {
        tmp.set(n[i], n[i + 1], n[i + 2]);
        B.Vector3.TransformNormalToRef(tmp, mat, tmp);
        tmp.normalize();
        normals[no++] = tmp.x; normals[no++] = tmp.y; normals[no++] = tmp.z;
      }
    }
    if (uv) {
      const uo = k * uv.length;
      for (let i = 0; i < uv.length; i++) uvs[uo + i] = uv[i];
    }
    for (let i = 0; i < idx.length; i++) indices[io++] = idx[i] + base;
  }
  const mesh = new B.Mesh(name, scene);
  const vd = new B.VertexData();
  vd.positions = positions;
  vd.indices = indices;
  if (normals) vd.normals = normals;
  if (uvs) vd.uvs = uvs;
  vd.applyToMesh(mesh, false);
  mesh.material = material;
  mesh.freezeWorldMatrix();
  return mesh;
}

export function merge(meshes, name = 'merged', dispose = true) {
  if (!meshes.length) return null;
  const merged = B.Mesh.MergeMeshes(meshes, true, true, undefined, false, true);
  if (merged) merged.name = name;
  return merged;
}

export function freeze(mesh) {
  if (!mesh) return mesh;
  mesh.freezeWorldMatrix();
  mesh.doNotSyncBoundingInfo = true;
  return mesh;
}

export function setPick(mesh, key, meta = {}) {
  mesh.metadata = Object.assign({}, mesh.metadata, { pick: Object.assign({ key }, meta) });
  return mesh;
}

export function pointInPoly(x, z, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], zi = ring[i][1], xj = ring[j][0], zj = ring[j][1];
    if (((zi > z) !== (zj > z)) && (x < (xj - xi) * (z - zi) / (zj - zi + 1e-12) + xi)) inside = !inside;
  }
  return inside;
}

export function distToSegmentSq(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const l2 = dx * dx + dz * dz;
  let t = l2 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0;
  t = clamp(t, 0, 1);
  const x = ax + dx * t, z = az + dz * t;
  return (px - x) ** 2 + (pz - z) ** 2;
}

export function distToPolyline(px, pz, pts) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    best = Math.min(best, distToSegmentSq(px, pz, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]));
  }
  return Math.sqrt(best);
}

export function smoothstep(a, b, x) {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}

export function sampleBilinear(grid, n, u, v) {
  const xx = clamp(u * (n - 1), 0, n - 1.001);
  const yy = clamp(v * (n - 1), 0, n - 1.001);
  const x0 = Math.floor(xx), y0 = Math.floor(yy);
  const tx = xx - x0, ty = yy - y0;
  const g = (x, y) => grid[clamp(y, 0, n - 1)][clamp(x, 0, n - 1)];
  return lerp(lerp(g(x0, y0), g(x0 + 1, y0), tx), lerp(g(x0, y0 + 1), g(x0 + 1, y0 + 1), tx), ty);
}

export function bezier3(a, b, c, d, t) {
  const u = 1 - t;
  return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
}

export function catmull(points, samples = 24) {
  const out = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)], p1 = points[i], p2 = points[i + 1], p3 = points[Math.min(points.length - 1, i + 2)];
    for (let s = 0; s < samples; s++) {
      const t = s / samples;
      const t2 = t * t, t3 = t2 * t;
      out.push([
        0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  out.push(points[points.length - 1]);
  return out;
}
