# 嘻嘻仙人 · 个人网站

这是一个无需构建工具的静态个人网站，包含首页、技术博客和随笔页面。

## 发布到 GitHub Pages

1. 创建一个 GitHub 仓库，将本目录全部文件推送到 `main` 分支。
2. 在仓库的 **Settings → Pages** 中，将 **Source** 设置为 **Deploy from a branch**。
3. 选择 `main` 分支和 `/ (root)` 目录并保存。
4. 等待 GitHub Pages 发布，网站地址通常为 `https://用户名.github.io/仓库名/`。

如果仓库名是 `用户名.github.io`，网站地址就是 `https://用户名.github.io/`。

文章图片已经存放在 `assets/images/kv-cache/`，不依赖飞书授权链接。新增文章时，将 Markdown 文件放入 `content/`，并在对应页面增加文章入口即可。

## 导入 Markdown 文章

将飞书导出的 Markdown 放入 `content/` 后，在项目根目录运行：

```powershell
node import-articles.mjs
```

将 Markdown 随笔放入根目录的 `notes-content/` 后运行同一命令。全站搜索索引会自动包含 `content/` 技术博客和 `notes-content/` 随笔；点击随笔搜索结果会在随笔页面加载原文。

脚本会只导入新文章，或更新内容有变化的文章：本地化图片、覆盖生成文章详情页、更新技术博客列表，并重建贡献数据。尚未提交的文章修改会按本地文件日期计入贡献；完成后再自行提交。GitHub Actions 发布时也会自动运行该脚本。
