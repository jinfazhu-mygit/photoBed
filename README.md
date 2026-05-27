# PhotoBed 图床

基于 React + TypeScript + Ant Design 的 GitHub 图床：在网页上传图片到仓库 `images/` 目录，通过 GitHub Pages 访问。

## 功能

- 拖拽 / 点击上传图片到 GitHub 仓库
- 图库列表、预览、复制链接（Raw / Pages）
- 删除仓库中的图片
- GitHub Actions 自动构建并部署到 GitHub Pages

## 本地开发

```bash
npm install
npm run dev
```

## 部署到 GitHub Pages

1. 将项目推送到 GitHub 仓库（例如 `photoBed`）。
2. 仓库 **Settings → Pages → Build and deployment** 中，Source 选择 **GitHub Actions**。
3. 创建 [Personal Access Token](https://github.com/settings/tokens)（需 `repo` 权限）。
4. 打开部署后的站点，在 **配置** 中填写用户名、仓库名、分支、`images` 目录和 Token。
5. 在 **上传** 页面上传图片；每次向 `main` 推送（含 API 上传产生的提交）会触发 [deploy workflow](.github/workflows/deploy.yml)，将 `images/` 同步进 Pages 站点。

### 图片访问地址

| 类型 | 说明 |
|------|------|
| **Raw** | `https://raw.githubusercontent.com/{owner}/{repo}/{branch}/images/{file}`，上传后立即可用 |
| **Pages** | `https://{owner}.github.io/{repo}/images/{file}`，需在 Actions 部署完成后可用 |

## 环境变量（可选）

复制 `.env.example` 为 `.env` 可预设仓库信息（Token 建议在页面配置，不要提交到仓库）：

```env
VITE_DEFAULT_OWNER=your-username
VITE_DEFAULT_REPO=photoBed
VITE_DEFAULT_BRANCH=main
VITE_IMAGES_DIR=images
```

## 技术栈

- [Vite](https://vitejs.dev/) + React 18 + TypeScript
- [Ant Design](https://ant.design/)
- GitHub Contents API
- GitHub Actions + GitHub Pages

## License

MIT
