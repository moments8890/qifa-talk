# qifa-talk

西雅图·启发说的 Jekyll 网站，发布于 [qifatalk.org](https://qifatalk.org)。

## 活动内容来源

目前编号活动以公开 [Notion 活动页](https://zhz1208.notion.site/2ab260812fe780e3b0c7dae2e1161041) 为临时权威来源。同步程序只读取 Notion，不会修改对方页面。

- 编号活动会生成到 `qifa-talk/past/NNN.md` 或 `qifa-talk/upcoming/NNN.md`。
- 活动日期早于太平洋时区当天时归档为“往期活动”；当天及未来活动归入“即将开始”。
- 只有带 `notion_sync_managed: true` 的页面会在日常同步中被修改或移除。
- 非编号页面（例如“一起看电影”）不由同步程序管理。
- Notion 中重复编号的 `066. 游戏人间` 通过 `scripts/notion-sync/overrides.json` 明确映射为 `068`。
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

`.github/workflows/sync-notion.yml` 每天运行一次，也可在 GitHub Actions 中手动触发。工作流依次执行测试、内容同步、同一次提取结果的本地幂等检查和 Jekyll 构建；全部成功后才提交活动文件。它不会为了幂等检查立即再次请求 Notion。提交到 `main` 后，现有 GitHub Pages 工作流负责部署网站。

旧的自动归档工作流已改为仅手动触发，避免与 Notion 同步同时修改活动目录。

## 海报

海报目前由运营手工上传为 `assets/images/NNN.jpg`。页面会按活动编号自动使用对应图片；图片缺失时页面隐藏图片区，不影响活动信息显示。海报自动生成留待后续阶段。

## 后续：主持人输入

Notion 同步是过渡方案。后续将以主持人提交的候选活动为输入，并由运营确认后才公开发布。已确认的要求和数据流记录在：

- `docs/superpowers/specs/2026-10-03-host-intake-content-sync-design.md`

主持人表单将收集可选周日、短标题、可选简介、微信号和邮箱；时间默认下午 2–5 点、地点默认 Bellevue Library、容量默认 16、活动类型目前仅为“科普 / 分享”，并保留可选的“其他说明”。微信号和邮箱仅供预约及运营联系，不公开到网站。
