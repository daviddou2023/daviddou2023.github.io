# 访客与点赞接口部署

网站继续部署在 GitHub Pages，Cloudflare Worker 和 D1 只负责保存计数。每个浏览器在
`localStorage` 中保存一个随机 ID；清除浏览器数据、无痕模式或换设备会被视为新访客。
同一浏览器对每篇文章只能点赞一次。公开接口无法防止有人刻意伪造 ID。

1. 如尚未登录，在项目根目录运行 `npx wrangler login`。
2. 运行 `npx wrangler d1 create xixi-site-counter`，将输出中的 `database_id` 填入
   `worker/wrangler.toml`。
3. 核对 `worker/wrangler.toml` 中的 `SITE_ORIGIN`。它是 GitHub Pages 的域名来源，
   例如 `https://daviddou2023.github.io`，不含仓库路径及末尾斜杠。
4. 运行 `npx wrangler d1 execute xixi-site-counter --remote --file=worker/schema.sql --config worker/wrangler.toml` 建表。
5. 运行 `npx wrangler deploy --config worker/wrangler.toml`。将输出的
   `https://...workers.dev` 地址填到根目录 `engagement.js` 顶部的 `engagementApi`。
6. 在 Cloudflare 项目的 GitHub 构建设置中，将 **Deploy command** 改为
   `npx wrangler deploy --config worker/wrangler.toml`。**Build command** 保持空白，
   **Root directory** 保持 `/`。再推送代码；GitHub Pages 仍按原来的工作流发布网站。

当前 Cloudflare 项目会在推送后自动部署，因此先完成 D1 创建、数据库 ID 和 Worker
地址配置，再推送这些改动。
