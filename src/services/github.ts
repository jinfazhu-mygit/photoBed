import { getGitHubConfig } from '../config';
import type { GitHubConfig, ImageItem, UploadResult } from '../types';
import { resolveUploadFileName } from '../utils/filename';

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

export async function listImages(): Promise<ImageItem[]> {
  const config = getGitHubConfig();
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

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp'];

export function validateImageFile(file: File): string | null {
  if (!file.type.startsWith('image/') && !ALLOWED_TYPES.includes(file.type)) {
    return '仅支持图片文件';
  }
  if (file.size > MAX_FILE_SIZE) {
    return `文件不能超过 ${MAX_FILE_SIZE / 1024 / 1024}MB`;
  }
  return null;
}

export async function uploadImage(file: File, customName?: string): Promise<UploadResult> {
  const error = validateImageFile(file);
  if (error) throw new Error(error);

  const config = getGitHubConfig();
  const dir = config.imagesDir.replace(/^\//, '').replace(/\/$/, '');
  const fileName = resolveUploadFileName(file, customName);
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
  const res = await fetch(putUrl, {
    method: 'PUT',
    headers: { ...authHeaders(config.token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `upload: ${fileName}`,
      content,
      branch: config.branch,
      ...(sha ? { sha } : {}),
    }),
  });

  if (!res.ok) throw new Error(await parseError(res));

  return {
    name: fileName,
    path,
    url: buildPagesUrl(config, path),
    rawUrl: buildRawUrl(config, path),
  };
}

export interface UploadItemInput {
  file: File;
  customName?: string;
}

export async function uploadImages(
  items: UploadItemInput[],
  onProgress?: (done: number, total: number) => void
): Promise<{ succeeded: UploadResult[]; failed: { file: File; error: string }[] }> {
  const succeeded: UploadResult[] = [];
  const failed: { file: File; error: string }[] = [];
  const total = items.length;

  for (let i = 0; i < items.length; i++) {
    const { file, customName } = items[i];
    try {
      const result = await uploadImage(file, customName?.trim() || undefined);
      succeeded.push(result);
    } catch (err) {
      failed.push({
        file,
        error: err instanceof Error ? err.message : '上传失败',
      });
    }
    onProgress?.(i + 1, total);
  }

  return { succeeded, failed };
}

export async function deleteImage(item: ImageItem): Promise<void> {
  const config = getGitHubConfig();
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
