# PhotoBed 图床

基于 React + TypeScript + Ant Design 的 GitHub 图床。图片上传到仓库 `images/` 目录，通过 GitHub Pages 访问。

## 功能

- 拖拽 / 批量上传，进度显示
- 上传后快速复制链接（Pages / Raw / Markdown / HTML）
- 图库预览、删除、批量管理
- GitHub Actions 自动部署 Pages

## 首次配置

在 GitHub 仓库 **Settings → Secrets and variables → Actions** 中添加：

| Secret | 说明 |
|--------|------|
| `VITE_GITHUB_TOKEN` | Personal Access Token，需 `repo` 权限 |

推送代码后，Workflow 会自动注入 `owner`、`repo`、`branch` 等变量并完成部署。

> Token 会打入前端构建产物，仅适合个人私有图床。请勿在公开仓库使用高权限 Token。

## 本地开发

```bash
cp .env.example .env
# 编辑 .env 填入你的 GitHub 信息
npm install
npm run dev
```

## 图片链接

| 类型 | 地址 |
|------|------|
| **Pages** | `https://{owner}.github.io/{repo}/images/{file}` |
| **Raw** | `https://raw.githubusercontent.com/{owner}/{repo}/{branch}/images/{file}` |

上传后 Raw 立即可用；Pages 需等待 Actions 部署完成（约 1–2 分钟）。

## License

MIT
