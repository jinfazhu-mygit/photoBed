import type { GitHubConfig, ImageItem, UploadResult } from '../types';

const API_BASE = 'https://api.github.com';

function authHeaders(token: string): HeadersInit {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

function encodePath(path: string): string {
  return path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function buildRawUrl(config: GitHubConfig, path: string): string {
  const { owner, repo, branch } = config;
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
}

function buildPagesUrl(config: GitHubConfig, path: string): string {
  const fileName = path.split('/').pop() || path;
  const imagesDir = config.imagesDir.replace(/^\//, '').replace(/\/$/, '');
  return `https://${config.owner}.github.io/${config.repo}/${imagesDir}/${fileName}`;
}

async function parseError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { message?: string };
    return data.message || res.statusText;
  } catch {
    return res.statusText;
  }
}

export async function listImages(config: GitHubConfig): Promise<ImageItem[]> {
  const dir = config.imagesDir.replace(/^\//, '').replace(/\/$/, '');
  const url = `${API_BASE}/repos/${config.owner}/${config.repo}/contents/${encodePath(dir)}?ref=${encodeURIComponent(config.branch)}`;

  const res = await fetch(url, { headers: authHeaders(config.token) });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(await parseError(res));

  const data = (await res.json()) as Array<{
    name: string;
    path: string;
    sha: string;
    size: number;
    download_url: string | null;
    type: string;
  }>;

  return data
    .filter((item) => item.type === 'file')
    .map((item) => ({
      name: item.name,
      path: item.path,
      sha: item.sha,
      size: item.size,
      url: buildPagesUrl(config, item.path),
      rawUrl: item.download_url || buildRawUrl(config, item.path),
    }))
    .sort((a, b) => b.name.localeCompare(a.name));
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      if (!base64) reject(new Error('无法读取文件'));
      else resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function sanitizeFileName(name: string): string {
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')) : '';
  const base = name.includes('.') ? name.slice(0, name.lastIndexOf('.')) : name;
  const safe = base.replace(/[^\w\u4e00-\u9fa5-]+/g, '-').replace(/-+/g, '-');
  const stamp = Date.now();
  return `${safe || 'image'}-${stamp}${ext.toLowerCase()}`;
}

export async function uploadImage(
  config: GitHubConfig,
  file: File,
  customName?: string
): Promise<UploadResult> {
  const dir = config.imagesDir.replace(/^\//, '').replace(/\/$/, '');
  const fileName = customName?.trim() || sanitizeFileName(file.name);
  const path = `${dir}/${fileName}`;
  const content = await fileToBase64(file);

  const checkUrl = `${API_BASE}/repos/${config.owner}/${config.repo}/contents/${encodePath(path)}?ref=${encodeURIComponent(config.branch)}`;
  let sha: string | undefined;
  const checkRes = await fetch(checkUrl, { headers: authHeaders(config.token) });
  if (checkRes.ok) {
    const existing = (await checkRes.json()) as { sha: string };
    sha = existing.sha;
  }

  const putUrl = `${API_BASE}/repos/${config.owner}/${config.repo}/contents/${encodePath(path)}`;
  const body = {
    message: `upload: ${fileName}`,
    content,
    branch: config.branch,
    ...(sha ? { sha } : {}),
  };

  const res = await fetch(putUrl, {
    method: 'PUT',
    headers: { ...authHeaders(config.token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(await parseError(res));

  return {
    name: fileName,
    path,
    url: buildPagesUrl(config, path),
    rawUrl: buildRawUrl(config, path),
  };
}

export async function deleteImage(config: GitHubConfig, item: ImageItem): Promise<void> {
  const url = `${API_BASE}/repos/${config.owner}/${config.repo}/contents/${encodePath(item.path)}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { ...authHeaders(config.token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `delete: ${item.name}`,
      sha: item.sha,
      branch: config.branch,
    }),
  });

  if (!res.ok) throw new Error(await parseError(res));
}

export function isConfigValid(config: Partial<GitHubConfig>): config is GitHubConfig {
  return Boolean(
    config.owner?.trim() &&
      config.repo?.trim() &&
      config.branch?.trim() &&
      config.token?.trim() &&
      config.imagesDir?.trim()
  );
}
