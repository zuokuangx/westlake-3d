/**
 * 西湖 · 一湖烟水 —— 场景契约
 * 机位、时刻、十景解说、材质键。
 */

export const MAT_KEYS = [
  'terrain', 'tile', 'tileGold', 'tileGreen', 'tileDark', 'wood', 'woodRed', 'lacquered',
  'stone', 'stoneDark', 'stoneWarm', 'white', 'marble', 'gold', 'bronze', 'window',
  'lantern', 'lampGold', 'road', 'path', 'grass', 'willow', 'willowLeaf', 'peach',
  'peachLeaf', 'tree', 'treeDark', 'treeLight', 'bamboo', 'bark', 'trunk',
  'lotusLeaf', 'lotusFlower', 'reed', 'boatWood', 'boatRoof', 'boatCanvas',
  'city', 'cityRoof', 'cityWall', 'cityGlass', 'embankment', 'soil',
];

export const VIEWS = {
  hero: {
    name: '西湖全景', en: 'WEST LAKE PANORAMA',
    pos: [1500, 650, 3150], target: [-700, 40, 700], fov: 0.62, dur: 4.5,
    desc: '三面云山一面城，六平方公里湖光，收在吴山与宝石山之间。',
  },
  aerial: {
    name: '湖山俯瞰', en: 'A BIRD’S-EYE OF THE LAKE',
    pos: [3300, 2850, 5150], target: [-180, 0, 620], fov: 0.7, dur: 4.2,
    desc: '从云端俯瞰，苏堤如线，三岛如棋，群山环抱一湖春水。',
  },
  sudi: {
    name: '苏堤春晓', en: 'SPRING DAWN AT SU CAUSEWAY',
    pos: [-340, 150, 2620], target: [-1060, 10, 520], fov: 0.58, dur: 3.8,
    desc: '六桥横绝天汉上，北山始与南屏通。二点八公里的长堤，是苏轼留给西湖的一行诗。',
  },
  duanqiao: {
    name: '断桥残雪', en: 'LINGERING SNOW ON BROKEN BRIDGE',
    pos: [520, 62, -660], target: [180, 12, -1220], fov: 0.55, dur: 3.6,
    desc: '白堤东端，一桥如月。雪后初晴，桥阳雪融，远远望去似断非断。',
  },
  santan: {
    name: '三潭印月', en: 'THREE POOLS MIRRORING THE MOON',
    pos: [360, 82, 1310], target: [-500, 7, 1160], fov: 0.58, dur: 3.8,
    desc: '湖中有岛，岛中有湖。三座石塔立在波心，月夜点燃烛火，水中便有了三十个月亮。',
  },
  leifeng: {
    name: '雷峰夕照', en: 'SUNSET GLOW AT LEIFENG PAGODA',
    pos: [620, 118, 2600], target: [0, 64, 1785], fov: 0.54, dur: 3.8,
    desc: '夕照山巅，五层八面。落日熔金，塔影横湖，是西湖最温柔的一抹晚照。',
  },
  nanping: {
    name: '南屏晚钟', en: 'EVENING BELL AT NANPING',
    pos: [510, 92, 2820], target: [-30, 20, 2070], fov: 0.56, dur: 3.7,
    desc: '南屏山麓，净慈寺钟声越过湖面。一记晚钟，把满湖暮色敲得更静。',
  },
  gushan: {
    name: '孤山探梅', en: 'PLUM BLOSSOM ON SOLITARY HILL',
    pos: [70, 54, -1000], target: [-640, 18, -455], fov: 0.52, dur: 3.6,
    desc: '孤山不孤，梅鹤相依。西泠印社的摩崖、文澜阁的书香，都藏在这座湖心青山里。',
  },
  liulang: {
    name: '柳浪闻莺', en: 'ORIOLES SINGING IN THE WILLOWS',
    pos: [1050, 42, 580], target: [560, 8, 900], fov: 0.52, dur: 3.4,
    desc: '柳丝拂水，莺声穿林。南宋御园旧地，如今是湖东最柔软的一段绿。',
  },
  night: {
    name: '夜湖月影', en: 'MOONLIT NIGHT ON THE LAKE',
    pos: [2540, 760, 3320], target: [-60, 10, 700], fov: 0.62, dur: 4.0,
    desc: '一湖夜色，两三点灯。雷峰塔的暖金、湖滨的灯影与月光一起落进水里。',
  },
};

export const VIEW_ORDER = ['hero', 'aerial', 'sudi', 'duanqiao', 'santan', 'leifeng', 'nanping', 'gushan', 'liulang', 'night'];

export const INFO = {
  leifeng: {
    name: '雷峰塔', en: 'Leifeng Pagoda', sub: '夕照山 · 西湖十景「雷峰夕照」',
    year: '977 / 2002', height: '71.68 m', roof: '八角五层 · 楼阁式塔',
    body: '吴越国王钱弘俶为庆祝黄妃得子而建，初名黄妃塔。旧塔于1924年轰然倒塌，2002年在原址重建。新塔通高71.68米，八面五层，内有电梯与遗址层，是西湖最醒目的天际线。',
    fact: '夕阳西下时，塔身被染成金红色，湖面倒影碎成万点金鳞，故称「雷峰夕照」。',
    tags: ['吴越国', '西湖十景', '白蛇传'],
  },
  baochu: {
    name: '保俶塔', en: 'Baochu Pagoda', sub: '宝石山 · 五代吴越',
    year: '963', height: '45.3 m', roof: '六面七层 · 实心砖塔',
    body: '位于西湖北岸宝石山巅，为北宋开宝年间吴越国所建。塔身修长，像一枚插在山脊上的玉簪。旧塔历经多次重修，现在的塔体为1933年按原貌修复。',
    fact: '与南岸雷峰塔隔湖相望，一瘦一胖，杭州人说「保俶如美人，雷峰如老衲」。',
    tags: ['宝石山', '吴越国', '西湖地标'],
  },
  santan: {
    name: '三潭印月', en: 'Three Pools Mirroring the Moon', sub: '小瀛洲 · 西湖十景',
    year: '1607', height: '岛约 7.1 公顷', roof: '湖中有岛 · 岛中有湖',
    body: '小瀛洲是西湖三岛中最大的一座，明万历三十五年（1607）疏浚西湖时以淤泥堆成。岛南湖面立着三座石塔，塔身中空，球面有五个圆孔。',
    fact: '月夜在塔中点燃烛火，洞口蒙上薄纸，灯光透出如月，水里映出三十个「月亮」。一元人民币背面正是此景。',
    tags: ['西湖十景', '小瀛洲', '一元人民币'],
  },
  duanqiao: {
    name: '断桥', en: 'Broken Bridge', sub: '白堤东端 · 西湖十景「断桥残雪」',
    year: '唐代 / 1914 重修', height: '单孔石拱桥', roof: '长 8.8 米 · 宽 8.6 米',
    body: '断桥之名始于唐代，又名段家桥。今日石拱桥为1914年重建。桥东堍有「断桥残雪」碑亭，是白堤的起点，也是许仙与白娘子相遇的地方。',
    fact: '雪后桥阳面积雪先融，桥阴面仍白，远看桥身似断，故称「断桥不断」。',
    tags: ['白堤', '白蛇传', '西湖十景'],
  },
  sudi: {
    name: '苏堤', en: 'Su Causeway', sub: '西湖南北 · 西湖十景「苏堤春晓」',
    year: '1090', height: '长 2.8 km', roof: '六桥 · 桃柳夹岸',
    body: '北宋元祐五年（1090），苏轼任杭州知州，疏浚西湖，用挖出的葑泥堆成长堤。堤上六桥自南而北为映波、锁澜、望山、压堤、东浦、跨虹。',
    fact: '春晨薄雾未散，六桥烟柳、一堤桃花，是西湖十景之首。',
    tags: ['苏轼', '六桥', '西湖十景'],
  },
  baidi: {
    name: '白堤', en: 'Bai Causeway', sub: '断桥—平湖秋月 · 西湖十景',
    year: '唐代', height: '长约 1 km', roof: '桃柳夹岸 · 一株杨柳一株桃',
    body: '白堤东起断桥，西至孤山，原名白沙堤。白居易任杭州刺史时曾在此筑堤捍湖，后人遂以白公名之。堤上两行桃柳，春来如烟。',
    fact: '白居易离任时写下「最爱湖东行不足，绿杨阴里白沙堤」，白堤因此得名。',
    tags: ['白居易', '断桥', '平湖秋月'],
  },
  jingci: {
    name: '净慈寺', en: 'Jingci Temple', sub: '南屏山 · 西湖十景「南屏晚钟」',
    year: '954', height: '南屏山麓', roof: '禅宗五山 · 黄墙黛瓦',
    body: '后周显德元年（954）建，号慧日永明院，南宋时位列禅宗五山。寺内有济公运木古井、大雄宝殿与钟楼。',
    fact: '傍晚的钟声在南屏山与湖面之间回荡，传得很远，是为「南屏晚钟」。',
    tags: ['南屏山', '济公', '西湖十景'],
  },
  chenghuang: {
    name: '城隍阁', en: 'City God Pavilion', sub: '吴山 · 七层仿古楼阁',
    year: '2000', height: '41.6 m', roof: '七层 · 飞檐翘角',
    body: '雄踞吴山之巅，是一座七层仿古楼阁。登阁可北望西湖、南眺钱塘江，是湖东最重要的制高点。',
    fact: '阁内有一口「吴山天风」大钟，与南屏晚钟遥相呼应。',
    tags: ['吴山', '湖东', '登高'],
  },
  liuhe: {
    name: '六和塔', en: 'Liuhe Pagoda', sub: '钱塘江畔 · 月轮山',
    year: '970', height: '59.89 m', roof: '八角七层 · 砖木楼阁式',
    body: '北宋开宝三年（970）吴越国王钱弘俶为镇江潮而建。塔身高59.89米，外看十三层，内分七级，是钱塘江畔的标志。',
    fact: '「六和」取佛教身和、口和、意和、戒和、见和、利和之意。',
    tags: ['钱塘江', '吴越国', '古塔'],
  },
  lingyin: {
    name: '灵隐寺', en: 'Lingyin Temple', sub: '飞来峰 · 东晋古刹',
    year: '326', height: '北高峰麓', roof: '禅宗十刹 · 千年古寺',
    body: '东晋咸和元年（326），印度僧人慧理见飞来峰叹曰「此乃中天竺国灵鹫山之小岭，不知何以飞来」，遂建灵隐寺。',
    fact: '寺前的飞来峰造像与古刹香火，是西湖山水之外的另一重境界。',
    tags: ['东晋', '飞来峰', '禅寺'],
  },
  quyuan: {
    name: '曲院风荷', en: 'Wind and Lotus at the Crooked Courtyard', sub: '西湖北岸 · 西湖十景',
    year: '南宋', height: '荷塘约 28 公顷', roof: '酒坊旧址 · 荷风四面',
    body: '南宋时此地为官家酿酒作坊，取金沙涧水制曲，院内种荷。夏日风过，酒香与荷香交织，故称「曲院风荷」。',
    fact: '园内有风荷、曲桥、迎薰阁等景，是西湖赏荷第一处。',
    tags: ['荷花', '南宋', '西湖十景'],
  },
  huagang: {
    name: '花港观鱼', en: 'Viewing Fish at Flower Pond', sub: '苏堤南端 · 西湖十景',
    year: '南宋', height: '红鱼池 · 牡丹园', roof: '花家山溪 · 锦鲤成群',
    body: '南宋时花家山有一条溪流经此地入湖，人称花港。园内红鱼池养着成群的锦鲤，与牡丹园、芍药圃相邻。',
    fact: '乾隆皇帝曾题「花港观鱼」四字，碑上「鱼」字底部四点写作三点，传说避「火」字。',
    tags: ['锦鲤', '牡丹', '西湖十景'],
  },
  liulang: {
    name: '柳浪闻莺', en: 'Orioles Singing in the Willows', sub: '湖东 · 西湖十景',
    year: '南宋', height: '御园旧址', roof: '柳岸 · 莺啼',
    body: '南宋时为御花园「聚景园」，沿湖植柳，春日黄莺在柳浪间啼鸣。今日是湖东的开放式滨水公园。',
    fact: '「柳浪」写其形，「闻莺」写其声，是西湖十景中最富声音感的一景。',
    tags: ['南宋御园', '柳树', '西湖十景'],
  },
  pinghu: {
    name: '平湖秋月', en: 'Autumn Moon over the Calm Lake', sub: '白堤西端 · 西湖十景',
    year: '南宋', height: '临湖平台', roof: '月光 · 湖面 · 楼台',
    body: '位于白堤西端、孤山东南麓，是西湖赏月的最佳处。南宋时已列为西湖十景，清康熙帝题「平湖秋月」碑。',
    fact: '秋夜月白风清，湖面如镜，天上一个月亮，湖里一个月亮。',
    tags: ['赏月', '白堤', '西湖十景'],
  },
  gushan: {
    name: '孤山', en: 'Solitary Hill', sub: '西湖最大岛屿 · 人文渊薮',
    year: '天然岛屿', height: '海拔 38 m', roof: '梅鹤 · 印社 · 藏书阁',
    body: '孤山是西湖中最大的天然岛屿，东接白堤，西连西泠桥。山上有西泠印社、文澜阁、中山公园、楼外楼与放鹤亭。',
    fact: '北宋林逋隐居孤山，植梅养鹤，人称「梅妻鹤子」。',
    tags: ['西泠印社', '林逋', '文澜阁'],
  },
  huxinting: {
    name: '湖心亭', en: 'Mid-Lake Pavilion', sub: '西湖三岛 · 湖心小岛',
    year: '1552', height: '岛约 0.2 公顷', roof: '四面环水 · 一亭居中',
    body: '明嘉靖三十一年（1552）建亭于湖心，是西湖三岛中最早开发的一座。岛上有喜清阁、观湖亭，四面碧波。',
    fact: '「湖心平眺」曾是西湖十八景之一，站在岛上，东西南北都是水。',
    tags: ['西湖三岛', '湖心', '亭'],
  },
  ruangong: {
    name: '阮公墩', en: 'Ruangong Isle', sub: '西湖三岛 · 最小的岛',
    year: '1800', height: '岛约 0.6 公顷', roof: '疏浚淤泥 · 竹木葱茏',
    body: '清嘉庆五年（1800），浙江巡抚阮元疏浚西湖，以葑泥堆成此岛，后人称阮公墩。岛小如舟，绿荫覆盖。',
    fact: '阮公墩是西湖三岛中最小的一个，像一枚落在湖心的青螺。',
    tags: ['西湖三岛', '阮元', '小岛'],
  },
  xiaoyingzhou: {
    name: '小瀛洲', en: 'Lesser Yingzhou', sub: '三潭印月 · 湖中有岛',
    year: '1607', height: '岛约 7.1 公顷', roof: '田字格局 · 九曲桥',
    body: '小瀛洲是西湖三岛中最大的一座，明万历年间以疏浚淤泥堆成。岛上开湖，形成「湖中有岛，岛中有湖」的田字格局。',
    fact: '岛南的三座石塔，就是「三潭印月」的主角。',
    tags: ['三潭印月', '九曲桥', '西湖三岛'],
  },
};

// 十景列表，供右侧索引与自动导览使用
export const SCENES = [
  { key: 'sudi', title: '苏堤春晓', en: 'Spring Dawn', no: '01', view: 'sudi' },
  { key: 'quyuan', title: '曲院风荷', en: 'Lotus in the Breeze', no: '02', view: 'sudi' },
  { key: 'pinghu', title: '平湖秋月', en: 'Autumn Moon', no: '03', view: 'gushan' },
  { key: 'duanqiao', title: '断桥残雪', en: 'Lingering Snow', no: '04', view: 'duanqiao' },
  { key: 'liulang', title: '柳浪闻莺', en: 'Orioles in Willows', no: '05', view: 'liulang' },
  { key: 'huagang', title: '花港观鱼', en: 'Fish at Flower Pond', no: '06', view: 'nanping' },
  { key: 'leifeng', title: '雷峰夕照', en: 'Sunset Glow', no: '07', view: 'leifeng' },
  { key: 'nanping', title: '南屏晚钟', en: 'Evening Bell', no: '08', view: 'nanping' },
  { key: 'santan', title: '三潭印月', en: 'Moon in Three Pools', no: '09', view: 'santan' },
  { key: 'shuangfeng', title: '双峰插云', en: 'Twin Peaks Piercing Clouds', no: '10', view: 'aerial' },
];

export const TIME_STOPS = [
  {
    t: 0.10, label: '晓雾', hour: '05:40', sunAzim: 68, sunElev: 2.5,
    skyTop: '#202c45', skyHorizon: '#d89b86', skyBottom: '#efc8a5',
    sunColor: '#ffc48f', sunIntensity: 0.32, ambient: '#5d6878', ambientIntensity: 0.55,
    hemiSky: '#7e8ea8', hemiGround: '#34392f', hemiIntensity: 0.65,
    fog: '#cbb5a5', fogDensity: 0.000075, exposure: 1.08, bloom: 0.22,
    waterTint: '#1d3438', stars: 0.05, lamp: 0.25,
  },
  {
    t: 0.24, label: '晨光', hour: '07:10', sunAzim: 82, sunElev: 23,
    skyTop: '#5d81ab', skyHorizon: '#e6be94', skyBottom: '#f2ddc3',
    sunColor: '#ffd6a0', sunIntensity: 1.55, ambient: '#8fa0ab', ambientIntensity: 0.58,
    hemiSky: '#b6cbdb', hemiGround: '#55513e', hemiIntensity: 0.92,
    fog: '#c8c6b8', fogDensity: 0.000035, exposure: 1.03, bloom: 0.2,
    waterTint: '#1b3c3c', stars: 0, lamp: 0,
  },
  {
    t: 0.42, label: '晴昼', hour: '12:20', sunAzim: 158, sunElev: 55,
    skyTop: '#2e6ca8', skyHorizon: '#afd0e4', skyBottom: '#d9e7ec',
    sunColor: '#fff2d2', sunIntensity: 1.55, ambient: '#9eb6c8', ambientIntensity: 0.52,
    hemiSky: '#b9d5e8', hemiGround: '#56604a', hemiIntensity: 0.78,
    fog: '#b9cbd3', fogDensity: 0.000026, exposure: 0.94, bloom: 0.13,
    waterTint: '#153d3f', stars: 0, lamp: 0,
  },
  {
    t: 0.58, label: '午后', hour: '15:40', sunAzim: 228, sunElev: 38,
    skyTop: '#3b73a5', skyHorizon: '#d3c2a0', skyBottom: '#ead6b8',
    sunColor: '#ffe0ae', sunIntensity: 1.42, ambient: '#9cabb2', ambientIntensity: 0.5,
    hemiSky: '#b4c9d8', hemiGround: '#5d5b43', hemiIntensity: 0.72,
    fog: '#c6c3b1', fogDensity: 0.000032, exposure: 0.97, bloom: 0.16,
    waterTint: '#1a3b3b', stars: 0, lamp: 0,
  },
  {
    t: 0.72, label: '夕照', hour: '17:40', sunAzim: 256, sunElev: 15,
    skyTop: '#4d6188', skyHorizon: '#e8a867', skyBottom: '#f7d3a2',
    sunColor: '#ffb56f', sunIntensity: 1.9, ambient: '#8b93a0', ambientIntensity: 0.56,
    hemiSky: '#aab9cc', hemiGround: '#514b3b', hemiIntensity: 0.82,
    fog: '#c7a68d', fogDensity: 0.000044, exposure: 1.08, bloom: 0.28,
    waterTint: '#26393b', stars: 0.02, lamp: 0.15,
  },
  {
    t: 0.84, label: '暮色', hour: '19:10', sunAzim: 278, sunElev: 2.5,
    skyTop: '#24314f', skyHorizon: '#c77e6f', skyBottom: '#e9b38a',
    sunColor: '#ff9b64', sunIntensity: 0.55, ambient: '#627089', ambientIntensity: 0.45,
    hemiSky: '#7a88a2', hemiGround: '#34342c', hemiIntensity: 0.58,
    fog: '#8a8390', fogDensity: 0.000065, exposure: 1.12, bloom: 0.34,
    waterTint: '#233238', stars: 0.35, lamp: 0.8,
  },
  {
    t: 0.93, label: '夜月', hour: '22:40', sunAzim: 310, sunElev: -20,
    skyTop: '#0a1328', skyHorizon: '#24354d', skyBottom: '#384657',
    sunColor: '#9db8e8', sunIntensity: 0.02, ambient: '#2e4060', ambientIntensity: 0.36,
    hemiSky: '#4a607d', hemiGround: '#161c22', hemiIntensity: 0.36,
    fog: '#1b2735', fogDensity: 0.00005, exposure: 1.25, bloom: 0.62,
    waterTint: '#101d26', stars: 1.0, lamp: 1.0,
  },
];

export const QUALITY = {
  low: { pr: 1, terrain: 110, trees: 320, shadow: 1024, waterRT: 512, pipeline: false },
  medium: { pr: 1.3, terrain: 180, trees: 900, shadow: 2048, waterRT: 512, pipeline: true },
  high: { pr: 1.7, terrain: 260, trees: 1800, shadow: 3072, waterRT: 768, pipeline: true },
};
