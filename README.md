# DataMind Star Dashboard

OpenDCAI/DataMind 的 Star 增长与运营看板。

线上地址：https://jununn.github.io/datamind-star-dashboard/

## 页面内容

- 每日新增 Star 与用户提供的运营 action
- GitHub Traffic 四指标折线图及可展开的每日数据
- 2026 年 9 月新增 stargazer 的公开地区比例
- 运营日历与推广原始链接
- 9 月新增 stargazer 的共同关注项目与潜在使用场景

## 数据口径

Star 快照截至 2026-09-18；Traffic 为用户提供的 08/31—09/13 截图快照。
地区分析覆盖 9 月新增的 98 位当前 stargazer。共同关注分析每人读取最近 100 个公开收藏，71 位用户超过该上限。具体来源与更新时间见 data/ 下的 JSON。
运营 action 仅记录用户提供的内容，不从提交、发布或其他来源自动添加。

## 部署与更新

纯静态网页，无构建依赖。GitHub Pages 从 main 分支根目录发布。
修改 HTML、CSS、JavaScript 或 data/ 中的快照后推送到 main 即可部署。
JSON 数据快照与同名 JavaScript 快照需保持同步，后者支持本地 file:// 打开。
