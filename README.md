# qifa-talk

西雅图·启发说的 Jekyll 网站，发布于 [qifatalk.org](https://qifatalk.org)。

## 活动内容来源

目前编号活动以公开 [Notion 活动页](https://zhz1208.notion.site/2ab260812fe780e3b0c7dae2e1161041) 为临时权威来源。同步程序只读取 Notion，不会修改对方页面。

- 编号活动会生成到 `qifa-talk/past/NNN.md` 或 `qifa-talk/upcoming/NNN.md`。
- 每个活动的首张 Notion 图片会下载、校正方向并压缩为 `assets/images/NNN.jpg`，供活动页和首页使用。
- 活动日期早于太平洋时区当天时归档为“往期活动”；当天及未来活动归入“即将开始”。
- 只有带 `notion_sync_managed: true` 的页面会在日常同步中被修改或移除。
- 非编号页面（例如“一起看电影”）不由同步程序管理。
- Notion 新增了 `057. 从相对论的角度聊聊时间的真相`，但后续编号没有全部顺延。`scripts/notion-sync/overrides.json` 将第二个 `061` 及之后的活动明确映射为连续的 `062`–`069`，保持公开活动的时间顺序。
- Host 邮箱、微信号等私密预约联系方式不会写入公开网站。

## 本地同步

需要 Node.js 20 和 Playwright Chromium：

```bash
npm ci
npx playwright install chromium
npm test
```

先预览变更，不写文件：

```bash
npm run sync:notion
```

写入已托管的编号活动，然后验证结果可重复：

```bash
npm run sync:notion -- --write
npm run sync:notion -- --check
```

`--check` 在存在待同步变更时返回非零状态，适用于 CI。需要复现特定日期的分类时，可加 `--as-of YYYY-MM-DD`。

只有首次接管仓库中现有的手工编号页面时才能使用：

```bash
npm run sync:notion -- --write --adopt-existing
```

此参数会允许覆盖现有的未托管编号页面，日常操作不要使用。

## 自动同步与发布

`.github/workflows/sync-notion.yml` 每天运行一次，也可在 GitHub Actions 中手动触发。工作流固定检出 `main`，依次执行测试、活动内容及海报同步、同一次提取结果的本地幂等检查和 Jekyll 构建；全部成功后才提交活动文件和图片。它不会为了幂等检查立即再次请求 Notion。由于 GitHub Actions 机器人提交不会再次触发普通 `push` 工作流，同一个同步任务会直接上传并部署刚验证过的 `_site`；即使内容没有变化也会部署，因此手动重跑可以修复上一次部署失败。普通人工提交仍由现有 GitHub Pages 工作流部署。

旧的自动归档工作流已改为仅手动触发，避免与 Notion 同步同时修改活动目录。

## 海报

海报目前仍由运营制作并上传到 Notion。同步程序从每个活动自己的内容范围提取海报，下载并统一生成优化后的 JPEG；除已确认在源页面中没有海报块的活动 001、002、003、004、038、048、066 外，缺失、无效或非 Notion 图片会让同步失败，避免官网悄悄发布没有海报的活动。页面按活动编号自动使用对应的 `assets/images/NNN.jpg`；运营日后在 Notion 补上这些图片后，同步会自动生成它们。海报自动生成留待后续阶段。

## 主持人候选活动表单

Notion 同步仍是官网内容的过渡来源。主持人候选活动通过私密 Google Form 提交，并由运营确认后才公开发布；表单提交本身不会修改官网。Apps Script 源码、安装步骤和运营说明见：

- [`google-apps-script/host-intake/README.md`](google-apps-script/host-intake/README.md)

主持人表单将收集可选周日、短标题、可选简介、微信号和邮箱；时间默认下午 2–5 点、地点默认 Bellevue Library、容量默认 16、活动类型目前仅为“科普 / 分享”，并保留可选的“其他说明”。微信号和邮箱仅供预约及运营联系，不公开到网站。
