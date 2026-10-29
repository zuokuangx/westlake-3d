/**
 * 西湖建筑群：雷峰塔、保俶塔、净慈寺、城隍阁、湖心三岛、亭台楼阁、桥梁与画舫。
 */
import {
  B, clamp, lerp, merge, setPick, box, cylinder, mulberry32, catmull, freeze,
} from '../core/utils.js';

export function createArchitecture(scene, data, heightAt) {
  const mats = scene._wlMats;
  const root = new B.TransformNode('architecture', scene);
  const pickables = [];
  const glowMeshes = [];
  const updaters = [];
  const shadowCasters = [];

  function group(name, x = 0, y = 0, z = 0, ry = 0) {
    const g = new B.TransformNode(name, scene);
    g.position.set(x, y, z);
    g.rotation.y = ry;
    g.parent = root;
    return g;
  }

  function finish(mesh, key, meta = {}, opts = {}) {
    if (mesh) {
      if (key) setPick(mesh, key, meta);
      if (opts.shadow) shadowCasters.push(mesh);
      if (opts.glow) glowMeshes.push(mesh);
    }
    return mesh;
  }

  function markAll(node, key, meta = {}, opts = {}) {
    const meshes = node.getChildMeshes ? node.getChildMeshes(false) : [];
    for (const m of meshes) {
      setPick(m, key, meta);
      if (opts.shadow) shadowCasters.push(m);
    }
    return meshes;
  }

  // ——— 通用攒尖 / 八角屋顶 ———
  function radialRoof(name, radius, height, sides, lift, mat, parent, segments = null) {
    const seg = segments || sides * 5;
    const rings = 6;
    const positions = [], indices = [], uvs = [];
    for (let r = 0; r <= rings; r++) {
      const t = r / rings;
      const rad = radius * (1 - Math.pow(t, 0.82) * 0.975) + 0.22;
      const baseY = height * Math.pow(t, 1.38);
      const step = Math.PI * 2 / sides;
      for (let s = 0; s < seg; s++) {
        const a = (s / seg) * Math.PI * 2;
        let d = ((a + step / 2) % step + step) % step - step / 2;
        d = Math.abs(d);
        const corner = Math.exp(-Math.pow(d / (step * 0.14), 2));
        const eaveLift = r === 0 ? lift * corner : 0;
        positions.push(Math.cos(a) * rad, baseY + eaveLift, Math.sin(a) * rad);
        uvs.push(s / seg * 3, t * 2.5);
      }
    }
    for (let r = 0; r < rings; r++) {
      for (let s = 0; s < seg; s++) {
        const a = r * seg + s, b = r * seg + (s + 1) % seg;
        const c = (r + 1) * seg + s, d = (r + 1) * seg + (s + 1) % seg;
        indices.push(a, c, b, b, c, d);
      }
    }
    const mesh = new B.Mesh(name, scene);
    const vd = new B.VertexData();
    vd.positions = positions; vd.indices = indices; vd.uvs = uvs; vd.normals = [];
    B.VertexData.ComputeNormals(positions, indices, vd.normals);
    vd.applyToMesh(mesh, true);
    mesh.material = mat;
    if (parent) mesh.parent = parent;
    mesh.receiveShadows = true;

    // 檐口压边
    const rim = B.MeshBuilder.CreateTorus(name + '-eave', {
      diameter: radius * 2.02, thickness: Math.max(0.18, radius * 0.022), tessellation: seg,
    }, scene);
    rim.position.y = 0.02;
    rim.material = mats.tileDark;
    rim.parent = parent || mesh;
    return mesh;
  }

  function roofRibs(name, radius, height, sides, parent, mat = mats.tileDark, count = null) {
    const n = count || sides;
    const parts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const path = [];
      for (let k = 0; k <= 5; k++) {
        const t = k / 5;
        const rr = radius * (1 - Math.pow(t, 0.82) * 0.965) + 0.2;
        path.push(new B.Vector3(Math.cos(a) * rr, height * Math.pow(t, 1.38) + 0.08, Math.sin(a) * rr));
      }
      const tube = B.MeshBuilder.CreateTube(name + '-rib' + i, { path, radius: Math.max(0.07, radius * 0.012), tessellation: 4, cap: B.Mesh.CAP_ALL }, scene);
      tube.material = mat;
      tube.parent = parent;
      parts.push(tube);
    }
    return merge(parts, name + '-ribs');
  }

  function finial(name, radius, height, parent) {
    const g = new B.TransformNode(name, scene);
    g.parent = parent;
    const parts = [];
    parts.push(cylinder(name + '-base', radius * 0.5, radius * 0.8, height * 0.18, 0, height * 0.09, 0, mats.gold, scene, 12, g));
    for (let i = 0; i < 5; i++) {
      const ring = B.MeshBuilder.CreateTorus(name + '-ring' + i, { diameter: radius * (0.7 - i * 0.08), thickness: radius * 0.055, tessellation: 16 }, scene);
      ring.position.y = height * (0.28 + i * 0.1);
      ring.rotation.x = Math.PI / 2;
      ring.material = mats.gold;
      ring.parent = g;
      parts.push(ring);
    }
    parts.push(cylinder(name + '-spire', 0.05, 0.16, height * 0.42, 0, height * 0.8, 0, mats.gold, scene, 8, g));
    const pearl = B.MeshBuilder.CreateSphere(name + '-pearl', { diameter: radius * 0.42, segments: 12 }, scene);
    pearl.position.y = height * 1.02;
    pearl.material = mats.gold;
    pearl.parent = g;
    return g;
  }

  function railing(name, radius, sides, y, parent, mat = mats.stoneWarm) {
    const parts = [];
    const seg = sides;
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const a2 = ((i + 1) / seg) * Math.PI * 2;
      const x1 = Math.cos(a) * radius, z1 = Math.sin(a) * radius;
      const x2 = Math.cos(a2) * radius, z2 = Math.sin(a2) * radius;
      const len = Math.hypot(x2 - x1, z2 - z1);
      const bar = B.MeshBuilder.CreateBox(name + '-bar', { width: 0.15, height: 0.22, depth: len }, scene);
      bar.position.set((x1 + x2) / 2, y + 0.9, (z1 + z2) / 2);
      bar.rotation.y = Math.atan2(x2 - x1, z2 - z1);
      bar.material = mat; bar.parent = parent; parts.push(bar);
      const post = B.MeshBuilder.CreateBox(name + '-post', { width: 0.22, height: 1.2, depth: 0.22 }, scene);
      post.position.set(x1, y + 0.6, z1);
      post.material = mat; post.parent = parent; parts.push(post);
    }
    return merge(parts, name + '-rail');
  }

  // ——— 雷峰塔 ———
  function leifeng() {
    const x = 2, z = 1790;
    const base = heightAt(x, z);
    const g = group('leifeng', x, base, z);
    const platform = cylinder('leifeng-platform', 34, 39, 4.2, 0, 2.1, 0, mats.stoneWarm, scene, 8, g);
    finish(platform, 'leifeng', { name: '雷峰塔' }, { shadow: true });
    // 台阶
    for (let i = -1; i <= 1; i++) {
      const step = box('leifeng-step', 10, 0.6, 2.4, i * 10, 0.4, 20, mats.stone, scene, g);
      finish(step, 'leifeng', { name: '雷峰塔' });
    }
    // 塔身五层，逐层收分：新的雷峰塔是八面五层楼阁式塔
    let y = 4.2;
    const tierH = 9.8;
    for (let t = 0; t < 5; t++) {
      const s = 1 - t * 0.075;
      const rBody = 17.0 * s;
      const h = t === 4 ? 8.2 : tierH;
      const wall = cylinder('leifeng-body' + t, rBody * 2, rBody * 2.04, h, 0, y + h / 2, 0, mats.woodRed, scene, 8, g);
      finish(wall, 'leifeng', { name: '雷峰塔' }, { shadow: true });
      // 白墙、朱柱、金饰与暖窗
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
        const px = Math.cos(a) * rBody * 0.985, pz = Math.sin(a) * rBody * 0.985;
        const panel = box('leifeng-wall', rBody * 0.64, h * 0.58, 0.35, px * 0.995, y + h * 0.47, pz * 0.995, mats.white, scene, g);
        panel.rotation.y = -a;
        finish(panel, 'leifeng', { name: '雷峰塔' });
        const col = cylinder('leifeng-col', 0.7, 0.82, h * 0.94, px, y + h / 2, pz, mats.woodRed, scene, 8, g);
        col.rotation.y = -a;
        finish(col, 'leifeng', { name: '雷峰塔' });
        const win = box('leifeng-window', rBody * 0.40, h * 0.32, 0.2, px * 1.015, y + h * 0.52, pz * 1.015, mats.window, scene, g);
        win.rotation.y = -a;
        finish(win, 'leifeng', { name: '雷峰塔' }, { glow: true });
        const band = box('leifeng-gold-band', rBody * 1.22, 0.3, 0.35, px * 1.0, y + h - 0.65, pz * 1.0, mats.gold, scene, g);
        band.rotation.y = -a;
        finish(band, 'leifeng', { name: '雷峰塔' });
      }
      // 斗拱层
      for (let k = 0; k < 24; k++) {
        const a = (k / 24) * Math.PI * 2;
        const br = box('leifeng-bracket', 1.0, 0.7, 0.9, Math.cos(a) * rBody * 1.04, y + h - 0.9, Math.sin(a) * rBody * 1.04, mats.woodRed, scene, g);
        br.rotation.y = -a;
        finish(br, 'leifeng', { name: '雷峰塔' });
      }
      // 平座与栏杆
      const deck = cylinder('leifeng-deck', rBody * 2.55, rBody * 2.55, 0.7, 0, y + h + 0.35, 0, mats.woodRed, scene, 8, g);
      finish(deck, 'leifeng', { name: '雷峰塔' });
      railing('leifeng-rail' + t, rBody * 1.25, 8, y + h + 0.65, g, mats.woodRed);
      // 屋面：金铜色，五层，飞檐舒展
      const roof = radialRoof('leifeng-roof' + t, rBody * 1.72, 4.5 * s, 8, 2.5 * s, mats.tileGold, g, 48);
      finish(roof, 'leifeng', { name: '雷峰塔' }, { shadow: true });
      roofRibs('leifeng-roofribs' + t, rBody * 1.72, 4.5 * s, 8, g, mats.gold, 8);
      y += h + 3.8;
    }
    finial('leifeng-finial', 2.6, 7.2, g);
    // 塔夜景灯笼
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const lantern = B.MeshBuilder.CreateSphere('leifeng-lantern', { diameter: 0.75, segments: 6 }, scene);
      lantern.position.set(Math.cos(a) * 13.4, y - 1.5, Math.sin(a) * 13.4);
      lantern.material = mats.lantern;
      lantern.parent = g;
      glowMeshes.push(lantern);
    }
    const light = new B.PointLight('leifeng-glow', new B.Vector3(0, 18, 0), scene);
    light.parent = g; light.diffuse = new B.Color3(1.0, 0.55, 0.22); light.intensity = 0.0; light.range = 90;
    updaters.push((t, dt, app) => {
      light.intensity = (app.palette?.lamp || 0) * 1.8;
    });
    return g;
  }

  // ——— 保俶塔 ———
  function baochu() {
    const x = -156, z = -1480;
    const base = heightAt(x, z);
    const g = group('baochu', x, base, z);
    const platform = cylinder('baochu-platform', 12, 16, 2.8, 0, 1.4, 0, mats.stoneWarm, scene, 8, g);
    finish(platform, 'baochu', { name: '保俶塔' }, { shadow: true });
    let y = 2.8;
    for (let t = 0; t < 7; t++) {
      const r = 3.7 - t * 0.34;
      const h = 5.4 - t * 0.18;
      const body = cylinder('baochu-body' + t, r * 2, r * 2.18, h, 0, y + h / 2, 0, mats.stoneWarm, scene, 8, g);
      finish(body, 'baochu', { name: '保俶塔' }, { shadow: true });
      const band = cylinder('baochu-band' + t, r * 2.45, r * 2.5, 0.38, 0, y + h - 0.2, 0, mats.tileDark, scene, 8, g);
      finish(band, 'baochu', { name: '保俶塔' });
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        const win = box('baochu-window', 0.56, 1.1, 0.12, Math.cos(a) * r * 0.99, y + h * 0.55, Math.sin(a) * r * 0.99, mats.tileDark, scene, g);
        win.rotation.y = -a;
        finish(win, 'baochu', { name: '保俶塔' });
      }
      y += h + 0.25;
    }
    finial('baochu-finial', 1.0, 4.2, g);
    return g;
  }

  // ——— 六和塔（远景） ———
  function liuhe() {
    const x = -1770, z = 5720;
    const base = Math.max(10, heightAt(x, z));
    const g = group('liuhe', x, base, z);
    cylinder('liuhe-base', 30, 40, 3, 0, 1.5, 0, mats.stone, scene, 12, g);
    let y = 3;
    for (let t = 0; t < 7; t++) {
      const r = 10 - t * 0.7;
      const h = 6.2 - t * 0.62;
      const body = cylinder('liuhe-body' + t, r * 2, r * 2.1, h, 0, y + h / 2, 0, mats.stoneWarm, scene, 8, g);
      finish(body, 'liuhe', { name: '六和塔' }, { shadow: true });
      radialRoof('liuhe-roof' + t, r * 1.55, 1.6, 8, 0.6, mats.tileDark, g, 28);
      y += h + 1.6;
    }
    finial('liuhe-finial', 1.2, 5, g);
    return g;
  }

  // ——— 城隍阁 ———
  function chenghuang() {
    const x = 1438, z = 1232;
    const base = Math.max(30, heightAt(x, z));
    const g = group('chenghuang', x, base, z);
    const terrace = box('chenghuang-terrace', 54, 8, 40, 0, 4, 0, mats.stoneWarm, scene, g);
    finish(terrace, 'chenghuang', { name: '城隍阁' }, { shadow: true });
    for (let t = 0; t < 5; t++) {
      const w = 30 - t * 3.2, d = 20 - t * 2.2, h = 6.8;
      const y = 8 + t * 7.4;
      const wall = box('chenghuang-wall', w, h, d, 0, y + h / 2, 0, mats.woodRed, scene, g);
      finish(wall, 'chenghuang', { name: '城隍阁' }, { shadow: true });
      for (let i = -2; i <= 2; i++) {
        const win = box('chenghuang-win', 2.2, 2.6, 0.16, i * 4.6, y + 3.8, d / 2 + 0.09, mats.window, scene, g);
        finish(win, 'chenghuang', { name: '城隍阁' }, { glow: true });
      }
      const roof = radialRoof('chenghuang-roof' + t, 20 - t * 1.4, 3.6, 4, 0.5, mats.tileGreen, g, 32);
      roof.scaling.x = 1.45; roof.scaling.z = 1.0;
      finish(roof, 'chenghuang', { name: '城隍阁' }, { shadow: true });
      // 四角飞檐
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const horn = box('chenghuang-horn', 2.8, 0.25, 0.55, sx * 20, y + 4.0, sz * 14, mats.gold, scene, g);
        horn.rotation.z = sx * -0.42; horn.rotation.y = (sx * sz) * 0.4;
        finish(horn, 'chenghuang', { name: '城隍阁' });
      }
    }
    finial('chenghuang-finial', 1.3, 4.5, g);
    return g;
  }

  // ——— 净慈寺 ———
  function jingci() {
    const x = -64, z = 2097;
    const base = Math.max(0.8, heightAt(x, z));
    const g = group('jingci', x, base, z, 0.03);
    // 院墙
    const walls = [];
    walls.push(box('jingci-wall', 150, 6, 2.5, 0, 3, -60, mats.white, scene, g));
    walls.push(box('jingci-wall', 150, 6, 2.5, 0, 3, 60, mats.white, scene, g));
    walls.push(box('jingci-wall', 2.5, 6, 120, -75, 3, 0, mats.white, scene, g));
    walls.push(box('jingci-wall', 2.5, 6, 120, 75, 3, 0, mats.white, scene, g));
    merge(walls, 'jingci-walls');
    // 山门
    hall('jingci-gate', g, 0, 47, 22, 11, 8.5, null, 'gate');
    // 大雄宝殿
    hall('jingci-main', g, 0, 3, 38, 22, 12.5, 'jingci', 'temple');
    // 钟楼与鼓楼
    hall('jingci-bell', g, -52, 12, 14, 14, 9.5, 'jingci', 'temple');
    hall('jingci-drum', g, 52, 12, 14, 14, 9.5, 'jingci', 'temple');
    // 放生池
    const pool = box('jingci-pool', 34, 0.2, 14, 0, 0.4, 30, mats.waterStone || mats.stoneDark, scene, g);
    finish(pool, 'jingci', { name: '净慈寺' });
    return g;
  }

  // 通用殿宇：白墙、红柱、深瓦、石台
  function hall(name, parent, lx, lz, w, d, h, infoKey, style = 'temple') {
    const g = new B.TransformNode(name, scene);
    g.parent = parent;
    g.position.set(lx, 0, lz);
    const wallMat = style === 'temple' ? mats.white : style === 'gate' ? mats.woodRed : mats.white;
    const base = box(name + '-base', w + 8, 2.2, d + 8, 0, 1.1, 0, mats.stoneWarm, scene, g);
    finish(base, infoKey, { name: '净慈寺' }, { shadow: true });
    const body = box(name + '-body', w, h, d, 0, h / 2 + 2.2, 0, wallMat, scene, g);
    finish(body, infoKey, { name: '净慈寺' }, { shadow: true });
    // 柱廊
    const cols = [];
    for (let i = 0; i < Math.max(3, Math.round(w / 5)); i++) {
      const px = -w / 2 + 2 + i * ((w - 4) / Math.max(1, Math.round(w / 5) - 1));
      for (const zz of [-d / 2 - 0.9, d / 2 + 0.9]) {
        const c = cylinder(name + '-col', 0.65, 0.75, h, px, h / 2 + 2.2, zz, mats.woodRed, scene, 8, g);
        cols.push(c);
      }
    }
    merge(cols, name + '-cols');
    // 门窗
    const door = box(name + '-door', Math.min(7, w * 0.28), h * 0.62, 0.2, 0, 2.2 + h * 0.32, d / 2 + 0.11, mats.lacquered, scene, g);
    finish(door, infoKey, { name: '净慈寺' });
    for (let i = 0; i < Math.floor(w / 6); i++) {
      const win = box(name + '-win', 2.2, h * 0.4, 0.18, -w / 2 + 4 + i * 6, 2.2 + h * 0.5, d / 2 + 0.12, mats.window, scene, g);
      finish(win, infoKey, { name: '净慈寺' }, { glow: true });
    }
    // 重檐 / 屋面
    const roof = radialRoof(name + '-roof', Math.max(w, d) * 0.72, h * 0.65, 4, 0.7, mats.tileDark, g, 34);
    roof.scaling.x = w / Math.max(w, d) * 1.1; roof.scaling.z = d / Math.max(w, d) * 1.1;
    finish(roof, infoKey, { name: '净慈寺' }, { shadow: true });
    // 正脊
    const ridge = box(name + '-ridge', w * 0.6, 0.55, 0.8, 0, h * 0.65 + 2.2 + h * 0.2, 0, mats.tileDark, scene, g);
    finish(ridge, infoKey, { name: '净慈寺' });
    return g;
  }

  // ——— 亭 ———
  function pavilion(name, x, z, opts = {}) {
    const baseY = opts.baseY !== undefined ? opts.baseY : heightAt(x, z);
    const scale = opts.scale || 1;
    const sides = opts.sides || 6;
    const r = (opts.radius || 5.2) * scale;
    const infoKey = opts.infoKey || null;
    const g = group(name, x, baseY, z, opts.rotation || 0);
    const platform = cylinder(name + '-platform', r * 2.4, r * 2.65, 1.3 * scale, 0, 0.65 * scale, 0, mats.stoneWarm, scene, sides, g);
    finish(platform, infoKey, { name: opts.label || name }, { shadow: true });
    // 柱
    const cols = [];
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2 + Math.PI / sides;
      const c = cylinder(name + '-col', 0.38 * scale, 0.44 * scale, 3.5 * scale, Math.cos(a) * r, 1.3 * scale + 1.75 * scale, Math.sin(a) * r, mats.woodRed, scene, 8, g);
      cols.push(c);
    }
    merge(cols, name + '-cols');
    // 坐凳 / 美人靠
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2;
      const bench = box(name + '-bench', r * 0.8, 0.45, 0.55, Math.cos(a) * r * 0.82, 1.7 * scale, Math.sin(a) * r * 0.82, mats.wood, scene, g);
      bench.rotation.y = -a;
      finish(bench, infoKey, { name: opts.label || name });
    }
    // 柱间挂落
    const ring = B.MeshBuilder.CreateTorus(name + '-beam', { diameter: r * 2.02, thickness: 0.16 * scale, tessellation: sides * 4 }, scene);
    ring.position.y = 1.3 * scale + 3.4 * scale;
    ring.material = mats.woodRed;
    ring.parent = g;
    // 屋顶
    const roof = radialRoof(name + '-roof', r * 1.65, 3.0 * scale, sides, 0.9 * scale, opts.roofMat || mats.tileGreen, g, sides * 8);
    finish(roof, infoKey, { name: opts.label || name }, { shadow: true });
    roofRibs(name + '-ribs', r * 1.65, 3.0 * scale, sides, g, opts.ribMat || mats.tileDark, sides);
    finial(name + '-finial', 0.55 * scale, 2.0 * scale, g);
    // 匾额
    const plaque = box(name + '-plaque', r * 0.75, 0.65 * scale, 0.16, 0, 1.3 * scale + 2.25 * scale, -r * 0.98, mats.lacquered, scene, g);
    finish(plaque, infoKey, { name: opts.label || name });
    return g;
  }

  // ——— 九曲桥 ———
  function zigzagBridge(name, cx, cz, scale = 1) {
    const g = group(name, cx, 0.28, cz);
    const points = [];
    let x = -34 * scale, z = 16 * scale;
    const dirs = [[1, 0], [0, -1], [1, 0], [0, 1], [1, 0], [0, -1], [1, 0], [0, 1], [1, 0]];
    points.push([x, z]);
    for (const [dx, dz] of dirs) { x += dx * 12 * scale; z += dz * 7.5 * scale; points.push([x, z]); }
    const parts = [];
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const slab = B.MeshBuilder.CreateBox(name + '-slab', { width: 2.8 * scale, height: 0.35, depth: len + 0.4 }, scene);
      slab.position.set((a[0] + b[0]) / 2, 0.2, (a[1] + b[1]) / 2);
      slab.rotation.y = Math.atan2(b[0] - a[0], b[1] - a[1]);
      slab.material = mats.stoneWarm; slab.parent = g; parts.push(slab);
      for (let k = 0; k < 3; k++) {
        const t = (k + 0.5) / 3;
        const px = a[0] + (b[0] - a[0]) * t;
        const pz = a[1] + (b[1] - a[1]) * t;
        const post = B.MeshBuilder.CreateBox(name + '-post', { width: 0.22, height: 0.9, depth: 0.22 }, scene);
        post.position.set(px, 0.85, pz);
        post.material = mats.stoneWarm; post.parent = g; parts.push(post);
      }
    }
    merge(parts, name + '-merged');
    return g;
  }

  // ——— 三潭石塔 ———
  function santan() {
    const cx = -503, cz = 1167;
    const g = group('santan', cx, 0.02, cz);
    const spots = [[-42, 88], [65, 34], [-15, -78]];
    for (let i = 0; i < 3; i++) {
      const [dx, dz] = spots[i];
      const pg = group('santan-tower' + i, dx, 0, dz);
      cylinder('santan-base', 2.6, 3.0, 0.7, 0, 0.35, 0, mats.stoneWarm, scene, 8, pg);
      cylinder('santan-body', 1.45, 1.7, 2.4, 0, 1.9, 0, mats.stoneWarm, scene, 12, pg);
      const sphere = B.MeshBuilder.CreateSphere('santan-head', { diameter: 2.15, segments: 14 }, scene);
      sphere.position.y = 3.9; sphere.material = mats.stoneWarm; sphere.parent = pg;
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        const hole = B.MeshBuilder.CreateSphere('santan-hole', { diameter: 0.45, segments: 6 }, scene);
        hole.position.set(Math.cos(a) * 0.92, 3.92, Math.sin(a) * 0.92);
        hole.material = mats.embankment;
        hole.parent = pg;
      }
      cylinder('santan-neck', 0.8, 1.15, 0.9, 0, 5.2, 0, mats.stoneWarm, scene, 8, pg);
      const cap = radialRoof('santan-cap', 1.15, 1.1, 6, 0.2, mats.stoneWarm, pg, 24);
      const tip = B.MeshBuilder.CreateSphere('santan-tip', { diameter: 0.5, segments: 8 }, scene);
      tip.position.y = 6.4; tip.material = mats.stoneWarm; tip.parent = pg;
      markAll(pg, 'santan', { name: '三潭印月' });
    }
    return g;
  }

  // ——— 湖心亭 / 阮公墩 / 小瀛洲 ———
  function islands() {
    pavilion('huxinting', -516, 168, { scale: 1.2, sides: 6, infoKey: 'huxinting', label: '湖心亭', roofMat: mats.tileGreen, baseY: 0.55 });
    pavilion('ruangong', -792, 133, { scale: 1.0, sides: 6, infoKey: 'ruangong', label: '阮公墩', roofMat: mats.tileGreen, baseY: 0.7 });
    // 小瀛洲：田字格局、九曲桥、三座小亭
    pavilion('xiaoying-main', -430, 1005, { scale: 1.35, sides: 8, infoKey: 'xiaoyingzhou', label: '小瀛洲', roofMat: mats.tileGreen, baseY: 0.55 });
    pavilion('xiaoying-east', -300, 1060, { scale: 0.7, sides: 4, infoKey: 'santan', label: '亭', roofMat: mats.tileGreen, baseY: 0.55, rotation: 0.4 });
    pavilion('xiaoying-west', -555, 930, { scale: 0.75, sides: 4, infoKey: 'santan', label: '亭', roofMat: mats.tileGreen, baseY: 0.55, rotation: -0.2 });
    zigzagBridge('xiaoying-bridge', -430, 1080, 0.8);
    // 岛岸垂柳由 vegetation 处理，这里加两块太湖石
    for (const [x, z, s] of [[-330, 970, 1.3], [-480, 1120, 1.0], [-250, 1140, 0.8]]) {
      const rock = B.MeshBuilder.CreatePolyhedron('taihu-rock', { type: 1, size: s }, scene);
      rock.position.set(x, 1.2, z); rock.scaling.y = 0.8; rock.material = mats.stoneDark;
      setPick(rock, 'santan', { name: '小瀛洲' });
    }
    return root;
  }

  function gushan() {
    const g = group('gushan', 0, 0, 0);
    pavilion('gushan-pavilion', -720, -500, { scale: 0.9, sides: 6, infoKey: 'gushan', label: '孤山', roofMat: mats.tileGreen, baseY: heightAt(-720, -500) });
    // 西泠印社石坊
    const x = -615, z = -520;
    const base = heightAt(x, z);
    const sg = group('xiling', x, base, z, 0.2);
    for (const sx of [-1, 1]) {
      cylinder('xiling-col', 0.7, 0.8, 5, sx * 3.1, 2.5, 0, mats.stoneWarm, scene, 8, sg);
    }
    box('xiling-beam', 7.6, 0.6, 0.7, 0, 5, 0, mats.stoneWarm, scene, sg);
    // 放鹤亭
    pavilion('fanghe', -820, -390, { scale: 0.8, sides: 6, infoKey: 'gushan', label: '放鹤亭', roofMat: mats.tileGreen, baseY: heightAt(-820, -390) });
    return g;
  }

  function watersideGardens() {
    // 曲院风荷：临水长廊与迎薰阁
    pavilion('quyuan', -1748, -178, { scale: 1.2, sides: 6, infoKey: 'quyuan', label: '曲院风荷', roofMat: mats.tileGreen, baseY: 0.5 });
    pavilion('quyuan-side', -1660, -120, { scale: 0.7, sides: 4, infoKey: 'quyuan', label: '风荷亭', roofMat: mats.tileGreen, baseY: 0.5 });
    // 花港观鱼
    pavilion('huagang', -731, 1728, { scale: 1.1, sides: 6, infoKey: 'huagang', label: '花港观鱼', roofMat: mats.tileGreen, baseY: heightAt(-731, 1728) });
    // 柳浪闻莺
    pavilion('liulang', 589, 899, { scale: 1.0, sides: 6, infoKey: 'liulang', label: '柳浪闻莺', roofMat: mats.tileGreen, baseY: Math.max(0.8, heightAt(589, 899)) });
    // 平湖秋月
    pavilion('pinghu', -320, -465, { scale: 1.15, sides: 6, infoKey: 'pinghu', label: '平湖秋月', roofMat: mats.tileGreen, baseY: 0.55 });
    // 白堤锦带桥边的水榭
    pavilion('baidi-pavilion', 70, -790, { scale: 0.8, sides: 4, infoKey: 'baidi', label: '白堤', roofMat: mats.tileGreen, baseY: 0.7 });
    return root;
  }

  // ——— 画舫与手划船 ———
  function boats() {
    const boatRoot = new B.TransformNode('boats', scene);
    const boats = [];
    const paths = [
      [[-1500, 400], [-1100, 900], [-600, 1200], [-900, 1600], [-1500, 1100]],
      [[500, -300], [700, 400], [400, 900], [-100, 500], [100, 0]],
      [[-200, 1400], [-900, 1500], [-1200, 900], [-700, 500], [-300, 900]],
      [[900, -700], [600, -300], [1000, -100], [1200, -500]],
    ];
    const definitions = [
      { path: 0, speed: 0.011, big: true, color: '#6e2d20' },
      { path: 1, speed: 0.014, big: true, color: '#4c1f17' },
      { path: 2, speed: 0.009, big: true, color: '#753422' },
      { path: 3, speed: 0.018, big: false, color: '#4b2b1d' },
      { path: 0, speed: 0.008, big: false, color: '#56311d' },
    ];
    definitions.forEach((def, i) => {
      const pts = catmull(def.path === 0 ? paths[0] : paths[def.path], 20);
      const g = new B.TransformNode('boat' + i, scene);
      g.parent = boatRoot;
      const hull = B.MeshBuilder.CreateCylinder('boat-hull', {
        diameterTop: def.big ? 1.6 : 0.8, diameterBottom: def.big ? 2.8 : 1.2,
        height: def.big ? 11 : 5.2, tessellation: 10,
      }, scene);
      hull.rotation.x = Math.PI / 2;
      hull.scaling.x = def.big ? 1.25 : 1;
      hull.material = mats.boatWood;
      hull.parent = g;
      const deck = box('boat-deck', def.big ? 3.0 : 1.3, 0.25, def.big ? 8.4 : 4.0, 0, 0.8, 0, mats.boatWood, scene, g);
      if (def.big) {
        const cabin = box('boat-cabin', 2.8, 1.8, 4.6, 0, 1.75, 0, mats.boatWood, scene, g);
        const roof = radialRoof('boat-roof', 2.9, 1.2, 4, 0.16, mats.boatRoof, g, 24);
        roof.scaling.z = 1.5; roof.position.y = 2.6;
        for (const sx of [-1, 1]) {
          const lantern = B.MeshBuilder.CreateSphere('boat-lantern', { diameter: 0.55, segments: 8 }, scene);
          lantern.position.set(sx * 1.5, 2.1, -2.2);
          lantern.material = mats.lantern;
          lantern.parent = g;
          glowMeshes.push(lantern);
        }
      }
      setPick(hull, 'boat', { name: def.big ? '画舫' : '手划船' });
      for (const cm of g.getChildMeshes(false)) cm.metadata = Object.assign({}, cm.metadata, { noMerge: true });
      boats.push({ node: g, pts, speed: def.speed, offset: i * 0.19, big: def.big });
    });
    updaters.push((t, dt) => {
      for (const b of boats) {
        const u = (b.offset + t * b.speed) % 1;
        const p = samplePath(b.pts, u);
        const p2 = samplePath(b.pts, (u + 0.005) % 1);
        b.node.position.set(p[0], 0.16 + Math.sin(t * 1.8 + b.offset * 10) * 0.06, p[1]);
        b.node.rotation.y = Math.atan2(p2[0] - p[0], p2[1] - p[1]);
        b.node.rotation.z = Math.sin(t * 1.1 + b.offset * 6) * 0.015;
      }
    });
    return boatRoot;
  }

  // ——— 飞鸟 ———
  function birds() {
    const birdRoot = new B.TransformNode('birds', scene);
    const birds = [];
    const mat = mats.white;
    for (let i = 0; i < 16; i++) {
      const g = new B.TransformNode('egret' + i, scene);
      g.parent = birdRoot;
      const body = B.MeshBuilder.CreateSphere('egret-body', { diameter: 0.9, segments: 6 }, scene);
      body.scaling.z = 2.0; body.material = mat; body.parent = g;
      for (const side of [-1, 1]) {
        const wing = B.MeshBuilder.CreateBox('egret-wing', { width: 2.2, height: 0.05, depth: 0.6 }, scene);
        wing.position.x = side * 1.1; wing.rotation.z = side * 0.2;
        wing.material = mat; wing.parent = g;
        g.metadata = g.metadata || {};
        g.metadata['wing' + side] = wing;
      }
      for (const cm of g.getChildMeshes(false)) cm.metadata = Object.assign({}, cm.metadata, { noMerge: true });
      birds.push({ node: g, phase: i * 0.7, radius: 400 + (i % 5) * 80, height: 55 + (i % 7) * 12, speed: 0.04 + (i % 4) * 0.008, cx: -300 + (i % 3) * 300, cz: 500 + (i % 4) * 250 });
    }
    updaters.push((t) => {
      for (const b of birds) {
        const a = t * b.speed + b.phase;
        b.node.position.set(b.cx + Math.cos(a) * b.radius, b.height + Math.sin(a * 2.4 + b.phase) * 4, b.cz + Math.sin(a) * b.radius * 0.62);
        b.node.rotation.y = -a + Math.PI / 2;
        b.node.rotation.z = Math.sin(a * 2) * 0.08;
        for (const side of [-1, 1]) {
          const wing = b.node.metadata['wing' + side];
          if (wing) wing.rotation.z = side * (0.25 + Math.sin(t * 1.8 + b.phase) * 0.45);
        }
      }
    });
    return birdRoot;
  }

  const leifengNode = leifeng();
  const baochuNode = baochu();
  const liuheNode = liuhe();
  const chenghuangNode = chenghuang();
  const jingciNode = jingci();
  const islandNode = islands();
  gushan();
  watersideGardens();
  santan();
  boats();
  birds();

  // ——— 静态建筑按材质合并，数千个零件压到几十个 draw call ———
  const all = root.getChildMeshes(false);
  const pickBoxes = new Map();
  for (const m of all) {
    const pk = m.metadata && m.metadata.pick;
    if (!pk) continue;
    const id = pk.key + '::' + (pk.name || '');
    const bb = m.getBoundingInfo().boundingBox;
    let entry = pickBoxes.get(id);
    if (!entry) { entry = { key: pk.key, name: pk.name, min: bb.minimumWorld.clone(), max: bb.maximumWorld.clone() }; pickBoxes.set(id, entry); }
    else {
      entry.min = B.Vector3.Minimize(entry.min, bb.minimumWorld);
      entry.max = B.Vector3.Maximize(entry.max, bb.maximumWorld);
    }
  }
  const groups = new Map();
  for (const m of all) {
    if (!m.material || m.getTotalVertices() < 3) continue;
    if (m.material.alpha === 0 || m.metadata?.noMerge) continue;
    const key = m.material.uniqueId;
    if (!groups.has(key)) groups.set(key, { material: m.material, list: [] });
    groups.get(key).list.push(m);
  }
  let mergedCount = 0;
  for (const { material, list } of groups.values()) {
    if (list.length < 2) continue;
    const merged = B.Mesh.MergeMeshes(list, true, true, undefined, false, true);
    if (merged) {
      merged.name = 'arch-merged-' + (material.name || mergedCount);
      merged.material = material;
      merged.parent = root;
      merged.receiveShadows = true;
      merged.freezeWorldMatrix();
      mergedCount++;
    }
  }
  // 透明拾取代理：不渲染，但保留整座塔/亭的可点击包围盒
  const proxyMat = new B.StandardMaterial('pick-proxy-mat', scene);
  proxyMat.alpha = 0;
  proxyMat.disableLighting = true;
  proxyMat.backFaceCulling = false;
  for (const p of pickBoxes.values()) {
    const size = p.max.subtract(p.min);
    const center = p.min.add(p.max).scale(0.5);
    const proxy = B.MeshBuilder.CreateBox('pick-' + p.key, {
      width: Math.max(3, size.x), height: Math.max(3, size.y), depth: Math.max(3, size.z),
    }, scene);
    proxy.position.copyFrom(center);
    proxy.material = proxyMat;
    proxy.isPickable = true;
    proxy.visibility = 0;
    proxy.metadata = { pick: { key: p.key, name: p.name } };
    proxy.parent = root;
  }

  return {
    root, pickables, glowMeshes, shadowCasters: [], mergedCount,
    nodes: { leifeng: leifengNode, baochu: baochuNode, liuhe: liuheNode, chenghuang: chenghuangNode, jingci: jingciNode, islands: islandNode },
    update(t, dt, app) { for (const u of updaters) u(t, dt, app); },
  };
}

function samplePath(pts, u) {
  if (!pts || pts.length < 2) return [0, 0];
  const total = (pts.length - 1) * u;
  const i = Math.min(pts.length - 2, Math.floor(total));
  const t = total - i;
  return [lerp(pts[i][0], pts[i + 1][0], t), lerp(pts[i][1], pts[i + 1][1], t)];
}
