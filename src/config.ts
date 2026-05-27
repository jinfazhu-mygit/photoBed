import type { GitHubConfig } from './types';

function requireEnv(key: string, label: string): string {
  const value = (import.meta.env as Record<string, string | undefined>)[key]?.trim();
  if (!value) {
    throw new Error(`缺少环境变量 ${label}（${key}），请在 .env 或 GitHub Actions 中配置`);
  }
  return value;
}

let cached: GitHubConfig | null = null;

export function getGitHubConfig(): GitHubConfig {
  if (cached) return cached;

  cached = {
    owner: requireEnv('VITE_GITHUB_OWNER', 'GitHub 用户名'),
    repo: requireEnv('VITE_GITHUB_REPO', '仓库名'),
    branch: import.meta.env.VITE_GITHUB_BRANCH?.trim() || 'main',
    imagesDir: import.meta.env.VITE_IMAGES_DIR?.trim() || 'images',
    token: requireEnv('VITE_GITHUB_TOKEN', 'GitHub Token'),
  };

  return cached;
}

export function isConfigReady(): boolean {
  try {
    getGitHubConfig();
    return true;
  } catch {
    return false;
  }
}
