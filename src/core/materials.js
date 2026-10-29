/**
 * 材质库 —— 所有纹理由 Canvas2D / 噪声实时生成，无外部图片。
 */
import { B, canvasTexture, makeTerrainTexture, makeStoneTexture, makeRoofTexture, makeWoodTexture, noiseFill, mulberry32 } from './utils.js';

function std(scene, name, diffuse, opts = {}) {
  const m = new B.StandardMaterial(name, scene);
  m.diffuseColor = B.Color3.FromHexString(diffuse);
  m.specularColor = B.Color3.FromHexString(opts.specular || '#111111');
  m.specularPower = opts.power ?? 32;
  m.ambientColor = B.Color3.FromHexString(opts.ambient || '#080808');
  if (opts.emissive) {
    m.emissiveColor = B.Color3.FromHexString(opts.emissive);
    m.emissiveIntensity = opts.emissiveIntensity ?? 1;
  }
  if (opts.alpha !== undefined) m.alpha = opts.alpha;
  if (opts.backFaceCulling !== undefined) m.backFaceCulling = opts.backFaceCulling;
  return m;
}

export function createMaterials(scene) {
  const M = {};

  // —— 地形 ——
  M.terrain = std(scene, 'terrain', '#ffffff', { specular: '#000000', ambient: '#2b3226' });
  M.terrain.diffuseTexture = makeTerrainTexture(scene);
  M.terrain.diffuseTexture.level = 0.98;

  // —— 屋瓦 ——
  M.tile = std(scene, 'tile-blue', '#ffffff', { specular: '#9ea9ac', power: 72, ambient: '#0c1114' });
  M.tile.diffuseTexture = makeRoofTexture(scene, 'roof-blue', '#3e4b53', '#11181d', 41);
  M.tile.diffuseTexture.level = 0.92;
  M.tile.specularColor = new B.Color3(0.42, 0.48, 0.5);

  M.tileGold = std(scene, 'tile-gold', '#ffffff', { specular: '#c9a66a', power: 84, ambient: '#24170a' });
  M.tileGold.diffuseTexture = makeRoofTexture(scene, 'roof-gold', '#8f6b32', '#2d1e0b', 53);
  M.tileGold.diffuseTexture.level = 1.08;
  M.tileGold.emissiveColor = new B.Color3(0.16, 0.11, 0.035);
  M.tileGold.emissiveTexture = M.tileGold.diffuseTexture;

  M.tileGreen = std(scene, 'tile-green', '#ffffff', { specular: '#889e88', power: 68, ambient: '#0a130e' });
  M.tileGreen.diffuseTexture = makeRoofTexture(scene, 'roof-green', '#355046', '#101b17', 57);

  M.tileDark = std(scene, 'tile-dark', '#ffffff', { specular: '#555f62', power: 48, ambient: '#08090a' });
  M.tileDark.diffuseTexture = makeRoofTexture(scene, 'roof-dark', '#242b2c', '#090c0d', 59);
  for (const key of ['tile', 'tileGold', 'tileGreen', 'tileDark']) {
    M[key].backFaceCulling = false;
    M[key].twoSidedLighting = true;
  }

  // —— 木构 ——
  M.wood = std(scene, 'wood-dark', '#ffffff', { specular: '#6a4c36', power: 24, ambient: '#150b07' });
  M.wood.diffuseTexture = makeWoodTexture(scene, 'wood-dark-tex', '#4a281d', 71);

  M.woodRed = std(scene, 'wood-red', '#ffffff', { specular: '#8e5a42', power: 20, ambient: '#1c0a07' });
  M.woodRed.diffuseTexture = makeWoodTexture(scene, 'wood-red-tex', '#7e3024', 73);

  M.lacquered = std(scene, 'lacquer', '#3a130f', { specular: '#b97855', power: 80, ambient: '#120403' });
  M.lacquered.diffuseTexture = makeWoodTexture(scene, 'lacquer-tex', '#401510', 79);
  M.lacquered.diffuseTexture.level = 1.1;

  // —— 石作 ——
  M.stone = std(scene, 'stone', '#ffffff', { specular: '#7e817a', power: 24, ambient: '#242421' });
  M.stone.diffuseTexture = makeStoneTexture(scene, 'stone-tex', '#aaa797', 0.07, 17);
  M.stone.diffuseTexture.level = 1.02;

  M.stoneDark = std(scene, 'stone-dark', '#ffffff', { specular: '#676c68', power: 28, ambient: '#101312' });
  M.stoneDark.diffuseTexture = makeStoneTexture(scene, 'stone-dark-tex', '#656962', 0.12, 29);

  M.stoneWarm = std(scene, 'stone-warm', '#ffffff', { specular: '#8e8674', power: 20, ambient: '#1d1a14' });
  M.stoneWarm.diffuseTexture = makeStoneTexture(scene, 'stone-warm-tex', '#b4a78e', 0.05, 31);

  M.white = std(scene, 'plaster', '#d9d2c1', { specular: '#48443d', power: 8, ambient: '#28241c' });

  M.marble = std(scene, 'marble', '#e3ded1', { specular: '#9c9b92', power: 48, ambient: '#2a2924' });

  // —— 金属 / 光 ——
  M.gold = std(scene, 'gold', '#9a7a3d', { specular: '#ffe3a2', power: 160, ambient: '#33230a' });
  M.gold.emissiveColor = new B.Color3(0.15, 0.105, 0.035);

  M.bronze = std(scene, 'bronze', '#4e3c27', { specular: '#c9a46a', power: 90, ambient: '#181006' });

  M.window = std(scene, 'window-glow', '#5b2b17', { emissive: '#ffb36b', emissiveIntensity: 0.3, specular: '#ffd9a0', power: 60 });
  M.lantern = std(scene, 'lantern', '#8f2719', { emissive: '#ff5c32', emissiveIntensity: 1.0, specular: '#ffb088', power: 30 });
  M.lampGold = std(scene, 'lamp-gold', '#b88742', { emissive: '#ffd08a', emissiveIntensity: 0.75, specular: '#ffe6b0', power: 60 });

  // —— 地面 / 道路 ——
  M.road = std(scene, 'road', '#ffffff', { specular: '#3a3c39', power: 14, ambient: '#111313' });
  M.road.diffuseTexture = canvasTexture(scene, 'road-tex', 512, (ctx, s) => {
    noiseFill(ctx, s, '#444742', 0.18, 67, 4);
    const rand = mulberry32(68);
    ctx.globalAlpha = 0.16;
    for (let i = 0; i < 1400; i++) { ctx.fillStyle = rand() > 0.5 ? '#1e211e' : '#76766b'; ctx.fillRect(rand() * s, rand() * s, 1 + rand() * 3, 1 + rand() * 2); }
    ctx.globalAlpha = 1;
  }, { uScale: 4, vScale: 4 });

  M.path = std(scene, 'path', '#ffffff', { specular: '#555', power: 10 });
  M.path.diffuseTexture = makeStoneTexture(scene, 'path-tex', '#8f8b7c', 0.14, 37);

  M.grass = std(scene, 'grass', '#4b613f', { specular: '#000000', ambient: '#1c2919' });

  // —— 花木 ——
  M.willow = std(scene, 'willow', '#718a46', { specular: '#1a2414', power: 8, ambient: '#1b2814' });
  M.willowLeaf = std(scene, 'willow-leaf', '#6f8e45', { specular: '#263018', power: 8 });
  M.peach = std(scene, 'peach-blossom', '#e6a4a2', { specular: '#3a1c1c', power: 5 });
  M.peachLeaf = std(scene, 'peach-leaf', '#5b763b', { specular: '#1f2915', power: 7 });
  M.tree = std(scene, 'tree', '#2f4a2e', { specular: '#11190e', power: 6 });
  M.treeDark = std(scene, 'tree-dark', '#203a27', { specular: '#0b1309', power: 5 });
  M.treeLight = std(scene, 'tree-light', '#4d643b', { specular: '#17210f', power: 7 });
  M.bamboo = std(scene, 'bamboo', '#6c8c4c', { specular: '#1a2b12', power: 8 });
  M.bark = std(scene, 'bark', '#4f3b2a', { specular: '#1b120c', power: 5 });
  M.trunk = std(scene, 'trunk', '#6e5940', { specular: '#1e1812', power: 4 });
  M.lotusLeaf = std(scene, 'lotus-leaf', '#3c6736', { specular: '#1a2c18', power: 12, backFaceCulling: false });
  M.lotusFlower = std(scene, 'lotus-flower', '#efb8c1', { specular: '#5f2d34', power: 14, emissive: '#3a1015', emissiveIntensity: 0.12 });
  M.reed = std(scene, 'reed', '#8c8d57', { specular: '#292b16', power: 6 });

  // —— 舟船 ——
  M.boatWood = std(scene, 'boat-wood', '#4c2b1d', { specular: '#9b6b49', power: 45 });
  M.boatRoof = std(scene, 'boat-roof', '#1d2324', { specular: '#4e5a5d', power: 30 });
  M.boatCanvas = std(scene, 'boat-canvas', '#cfc3a7', { specular: '#3e3a32', power: 8 });

  // —— 城市 ——
  M.city = std(scene, 'city', '#ffffff', { specular: '#383a39', power: 12, ambient: '#262a2b' });
  M.city.emissiveColor = new B.Color3(0.025, 0.028, 0.028);
  M.city.diffuseTexture = canvasTexture(scene, 'city-tex', 512, (ctx, s) => {
    noiseFill(ctx, s, '#8c8c84', 0.12, 79, 3);
    const rand = mulberry32(80);
    // 窗格
    for (let y = 10; y < s; y += 22) {
      for (let x = 8; x < s; x += 16) {
        ctx.fillStyle = rand() > 0.3 ? 'rgba(48,54,57,0.35)' : 'rgba(204,198,175,0.4)';
        ctx.fillRect(x, y, 7, 10);
      }
    }
  }, { uScale: 2, vScale: 2 });

  M.cityRoof = std(scene, 'city-roof', '#4f5451', { specular: '#222', power: 6 });
  M.cityWall = std(scene, 'city-wall', '#c9c3b2', { specular: '#3b3a36', power: 6 });
  M.cityGlass = std(scene, 'city-glass', '#3e5560', { specular: '#bfe6ff', power: 160, emissive: '#0b1419', emissiveIntensity: 0.4 });

  // —— 水岸 / 荷塘 ——
  M.embankment = std(scene, 'embankment', '#ffffff', { specular: '#676961', power: 20 });
  M.embankment.diffuseTexture = makeStoneTexture(scene, 'embankment-tex', '#8f8d7f', 0.23, 89);
  M.soil = std(scene, 'soil', '#55442f', { specular: '#000000' });

  // —— 天空 / 雾 ——
  M.star = new B.StandardMaterial('star', scene);
  M.star.emissiveColor = new B.Color3(0.8, 0.88, 1);
  M.star.disableLighting = true;

  return M;
}
