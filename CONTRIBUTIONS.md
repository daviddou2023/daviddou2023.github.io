# 文章贡献热力图

首页热力图读取 `data/contributions.json`。GitHub Actions 在每次推送到 `main` 时运行 `scripts/build-contributions.mjs`，扫描 `content/*.md` 的 Git 提交记录：

- 每个日期的文章提交数决定当天格子的深浅。
- 右侧年份按钮切换历史年份。
- 下方记录列出该年份的文章提交日期和文章链接。

新增文章时，将 Markdown 文件放入 `content/` 并提交到 GitHub。下一次部署会自动重新生成数据。

如果文章有明确的发布日期，可以在 Markdown 顶部添加 `date: 2026-10-13`，生成脚本会优先使用该日期；没有日期时使用文章首次 Git 提交日期。
