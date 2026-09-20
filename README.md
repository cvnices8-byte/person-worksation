# 研习台 · Personal Workstation

一个面向长期学习的、本地优先的个人工作站。当前版本将学习执行集中在网站，将规划与复盘通过 Markdown 导出交给 Obsidian。

## 当前功能

- 每天 6 小时学习时间尺
- 数据科学与 AI、CPA、考公、英语、求职维护、复盘的周配额
- 今日任务与完成状态
- 学习时长记录
- 论文专业理解与英文输出学习包
- 体重、腰围、睡眠、步数和训练记录
- Obsidian 周复盘 Markdown 导出
- JSON 完整备份与恢复
- IndexedDB 本地数据存储
- PWA 离线外壳

## 本地运行

项目没有第三方运行时依赖。需要通过本地 HTTP 服务器打开，不能直接双击 `index.html`，因为浏览器会限制 ES Modules 和 Service Worker。

```bash
npx serve .
```

或者：

```bash
python3 -m http.server 4173
```

打开 `http://localhost:4173`。

## GitHub Pages

仓库已包含 `.github/workflows/deploy.yml`。推送到 `main` 后：

1. 在仓库 `Settings → Pages` 中选择 `GitHub Actions` 作为发布源。
2. 打开 Actions，确认 `Deploy to GitHub Pages` 成功。
3. 访问 Actions 输出的 Pages 地址。

## 隐私模型

- 学习、健康和论文记录默认只保存在当前浏览器的 IndexedDB。
- 个人数据不会随网站部署到 GitHub。
- 更换设备或清理浏览器前，请在“复盘”中导出完整 JSON 备份。
- 不要把导出的备份、录音、简历或 API 密钥提交到仓库。

## 后续路线

1. 建立详细的数据科学、CPA、考公和英语知识树。
2. 加入间隔复习调度与题目作答模型。
3. 加入论文源同步与去重。
4. 加入可选的云同步和登录。
5. 通过服务端接口加入 AI 口语、写作和论文反馈。

## 仓库

目标远程仓库：`git@github.com:cvnices8-byte/person-worksation.git`
