# PhotoBed 图床

基于 React + TypeScript + Ant Design 的 GitHub 图床。图片上传到仓库 `images/` 目录，默认复制 jsDelivr CDN 链接，也保留 GitHub Pages 链接作为备用访问方式。

## 功能

- 拖拽 / 批量上传，进度显示
- 上传后快速复制链接（CDN / Pages / Markdown / HTML）
- 图库预览、删除、批量管理
- GitHub Actions 自动部署 Pages

## 首次配置

在 GitHub 仓库 **Settings -> Secrets and variables -> Actions** 中添加：

| Secret | 说明 |
|--------|------|
| `VITE_GITHUB_TOKEN` | Personal Access Token，需要 `repo` 权限 |

推送代码后，workflow 会自动注入 `owner`、`repo`、`branch` 等变量并完成部署。

> Token 会打入前端构建产物，仅适合个人私有图床。请勿在公开仓库使用高权限 Token。

## 本地开发

```bash
cp .env.example .env
# 编辑 .env 填入你的 GitHub 信息
yarn install
yarn dev
```

## 图片链接

| 类型 | 地址 |
|------|------|
| **CDN** | `https://cdn.jsdelivr.net/gh/{owner}/{repo}@{branch}/images/{file}` |
| **Pages** | `https://{owner}.github.io/{repo}/images/{file}` |

新上传图片会以普通 Git blob 存入仓库，便于 jsDelivr 直接提供 CDN 访问。历史上已经进入 Git LFS 的图片，需要重新入库为普通 Git 文件后才能通过 jsDelivr CDN 访问。

## License

MIT
