# 西湖 · 一湖烟水

Babylon.js 纯前端 3D 交互场景，以程序化几何再现西湖山水、苏堤春晓、保俶塔与雷峰塔等景观。

## 在线部署（Vercel）

本项目为纯静态站点，可直接导入 Vercel 发布：

- **Framework Preset**：Other（`null`）
- **Build Command**：无
- **Output Directory**：`.`
- **入口文件**：`index.html`

仓库根目录的 `vercel.json` 已配置静态托管与缓存响应头，导入仓库后无需额外设置即可发布。

## 目录结构

```
index.html              # 页面入口
vercel.json             # Vercel 静态托管配置
data/                   # 地形网格与西湖场景数据
src/                    # Babylon.js 场景模块（core / world / ui）
styles/main.css         # 样式
vendor/earcut/          # 第三方多边形三角化依赖
```

## 本地预览

由于页面通过 `fetch` 加载 `data/*.json`，请通过任意静态服务器打开（直接双击 `index.html` 可能受浏览器 CORS 限制）：

```bash
npx serve .
```
