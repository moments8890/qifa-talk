# Host 候选活动 Google Form

这套 Google Apps Script 创建并维护启发说的 Host 候选活动表单。提交只会进入私密候选表；运营确认前不会发布到 GitHub Pages，也不会替代目前的 Notion 内容同步。

## 已固定的表单内容

- 必填：当前开放的周日、活动短标题、微信号、邮箱。
- 可选：活动简介、详细资料或 Google Doc 链接、其他说明。
- 默认安排：下午 2–5 点、Bellevue Library、容量 16、类型“科普 / 分享”。
- Host 可以选择特殊安排，并填写开始/结束时间、地点和容量。
- 海报不由 Host 上传；由运营制作并手工上传。
- 微信号、邮箱和“其他说明”只进入私密工作簿，不进入公开字段。

## 日期来源

现有协调工作簿 `启发说房间预定` 增加了 `Host Intake Dates` 标签页。每行是一档可提交的周日：

| Available Sunday | Status | Candidate ID | Hold Expires |
|---|---|---|---|
| 2026-11-08 | Open | | |

运营添加日期时只需新增一行并把 `Status` 设为 `Open`。脚本每 6 小时刷新一次表单选项；也可以在 Apps Script 中手动运行 `refreshAvailableSundayChoices`。有效提交会把对应行改为 `Held`，写入 Candidate ID 和七天后到期时间。未确认的 hold 到期后自动恢复为 `Open`。

不要删除或改名这四个表头。不要在这个共享日期标签页保存微信号、邮箱或私密备注。

## 部署

项目文件：

- `Core.gs`：纯数据验证、表单定义、候选记录与 hold 计划。
- `Config.gs`：协调工作簿、标签页和状态值。
- `Code.gs`：Google Form、私密工作簿和定时触发器。
- `appsscript.json`：Apps Script 清单和最小 OAuth scopes。

仓库已经关联到一个 standalone Apps Script 项目。由于 Google 会阻止 `clasp` 的共享 OAuth 客户端请求 Forms/Sheets 敏感权限，首次创建不要使用 `clasp run`。请打开 Apps Script 编辑器，在函数列表中选择 `setupHostIntake`，点击 **Run**，并完成该项目自己的授权。Google 官方文档也要求首次手动运行需要新权限的函数来授权触发器。

成功后，执行日志会显示以下链接，同时保存到 Script Properties；日后也可以手动运行 `getHostIntakeLinks` 再次查看：

- `HOST_INTAKE_FORM_PUBLIC_URL`：发给 Host 的提交链接。
- `HOST_INTAKE_FORM_EDIT_URL`：运营编辑表单的链接。
- `HOST_INTAKE_WORKBOOK_URL`：私密候选与审计工作簿。

`setupHostIntake` 具有重复执行保护；如果已经创建过表单，它会停止，而不是再创建一份。如果首次部署在安装触发器时中断，运行 `repairHostIntake` 会检查现有 Form/工作簿、补齐缺少的触发器，并刷新日期选项，不会创建重复资源或触发器。

日常源代码更新可以使用 `clasp push`；`.clasp.json` 只保留在本机并已加入 `.gitignore`。不需要部署 Apps Script API executable。

## 运营流程

1. 在 `Host Intake Dates` 增加或开放可选周日。
2. Host 提交后，到私密工作簿的 `Candidates` 标签页审核。
3. 联系 Host，确认标题、时间、地点、容量及房间预约。
4. 在该候选行的 `Operator Action` 列填入 `Confirm`，然后在 Apps Script 编辑器中直接运行无参数的 `confirmCandidate`。脚本要求恰好一行待确认，在锁内验证该候选仍拥有 hold，把协调表状态改为 `Booked`，并把候选状态改为 `Confirmed / Booked`；中断后可再次运行以续完部分状态。不要仅手工修改状态单元格。
5. 只有运营明确确认后，才把公开字段加入官网/后续发布数据源并制作海报。确认预订本身仍不会自动发布官网。
6. 微信号、邮箱和其他私密说明不得复制到官网仓库。

原始 Google Form 回答会出现在同一私密工作簿的 `Form Responses 1`。`Operations Log` 记录候选和 hold 状态变化。

## 本地验证

在仓库根目录运行：

```bash
npm test
```

Node 测试会直接加载 Apps Script，并用服务替身覆盖日期过滤、默认/特殊安排、联系方式校验、私密字段隔离、候选表 schema、提交/回滚、并发锁、到期释放和确认预订；另有 package/manifest 静态检查。
