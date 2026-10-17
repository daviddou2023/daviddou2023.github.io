# 嘻嘻仙人 · 个人网站

这是一个无需构建工具的静态个人网站，包含首页、技术博客和随笔页面。

## 发布到 GitHub Pages

1. 创建一个 GitHub 仓库，将本目录全部文件推送到 `main` 分支。
2. 在仓库的 **Settings → Pages** 中，将 **Source** 设置为 **Deploy from a branch**。
3. 选择 `main` 分支和 `/ (root)` 目录并保存。
4. 等待 GitHub Pages 发布，网站地址通常为 `https://用户名.github.io/仓库名/`。

如果仓库名是 `用户名.github.io`，网站地址就是 `https://用户名.github.io/`。

文章图片已经存放在 `assets/images/kv-cache/`，不依赖飞书授权链接。新增文章时，将 Markdown 文件放入 `content/`，并在对应页面增加文章入口即可。
