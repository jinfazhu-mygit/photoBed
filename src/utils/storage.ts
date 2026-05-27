import type { GitHubConfig } from '../types';

const CONFIG_KEY = 'photobed_github_config';

export type StoredConfig = Omit<GitHubConfig, 'token'> & { token?: string };

export function loadConfig(): StoredConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredConfig;
  } catch {
    return null;
  }
}

export function saveConfig(config: StoredConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

export function clearConfig(): void {
  localStorage.removeItem(CONFIG_KEY);
}

export function getDefaultConfig(): StoredConfig {
  const saved = loadConfig();
  return {
    owner: saved?.owner || import.meta.env.VITE_DEFAULT_OWNER || '',
    repo: saved?.repo || import.meta.env.VITE_DEFAULT_REPO || '',
    branch: saved?.branch || import.meta.env.VITE_DEFAULT_BRANCH || 'main',
    imagesDir: saved?.imagesDir || import.meta.env.VITE_IMAGES_DIR || 'images',
    token: saved?.token || '',
  };
}
