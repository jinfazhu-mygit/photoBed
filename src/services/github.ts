import { getGitHubConfig } from '../config';
import type { GitHubConfig, ImageItem, UploadResult } from '../types';
import { resolveUploadFileName, getImageExtension } from '../utils/filename';
import { encodeUrlPath } from '../utils/imageUrl';

const API_BASE = 'https://api.github.com';

function authHeaders(token: string): HeadersInit {
  return {
    Accept: 'application/vnd.github.v3+json',
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

/**
 * 构建 Media URL（支持 LFS 文件）
 * GitHub media API 会自动解析 LFS 文件并返回实际内容
 */
function buildMediaUrl(config: GitHubConfig, path: string): string {
  const { owner, repo, branch } = config;
  return `https://media.githubusercontent.com/media/${owner}/${repo}/${branch}/${encodeUrlPath(path)}`;
}

/**
 * 构建 Pages URL
 */
function buildPagesUrl(config: GitHubConfig, path: string): string {
  const imagesDir = config.imagesDir.replace(/^\//, '').replace(/\/$/, '');
  const fullPath = path.startsWith(`${imagesDir}/`) ? path : `${imagesDir}/${path.split('/').pop() || path}`;
  return `https://${config.owner}.github.io/${config.repo}/${encodeUrlPath(fullPath)}`;
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
      rawUrl: buildMediaUrl(config, item.path),
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

function generateUniqueFileName(baseName: string, ext: string, existingNames: Set<string>): string {
  let fileName = `${baseName}${ext}`;
  if (!existingNames.has(fileName)) {
    return fileName;
  }

  let counter = 1;
  while (counter <= 100) {
    const newFileName = `${baseName}(${counter})${ext}`;
    if (!existingNames.has(newFileName)) {
      return newFileName;
    }
    counter++;
  }

  const timestamp = Date.now();
  return `${baseName}-${timestamp}${ext}`;
}

async function getExistingFileNames(config: GitHubConfig): Promise<Set<string>> {
  try {
    const dir = config.imagesDir.replace(/^\//, '').replace(/\/$/, '');
    const url = `${API_BASE}/repos/${config.owner}/${config.repo}/contents/${encodePath(dir)}?ref=${encodeURIComponent(config.branch)}`;
    const res = await fetch(url, { headers: authHeaders(config.token) });
    if (!res.ok) return new Set();

    const data = (await res.json()) as Array<{ name: string; type: string }>;
    return new Set(data.filter(item => item.type === 'file').map(item => item.name));
  } catch {
    return new Set();
  }
}

async function calculateSha256(buffer: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function getFileBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

async function uploadToLfs(
  config: GitHubConfig,
  file: File
): Promise<{ oid: string; size: number }> {
  const buffer = await getFileBuffer(file);
  const oid = await calculateSha256(buffer);
  const size = buffer.byteLength;

  const batchUrl = `${API_BASE}/repos/${config.owner}/${config.repo}/git/lfs/objects/batch`;
  const batchRes = await fetch(batchUrl, {
    method: 'POST',
    headers: { ...authHeaders(config.token), 'Content-Type': 'application/vnd.git-lfs+json' },
    body: JSON.stringify({
      operation: 'upload',
      transfers: ['basic'],
      objects: [{ oid, size }],
    }),
  });

  if (!batchRes.ok) {
    const errorData = await batchRes.json();
    throw new Error(errorData.message || 'LFS batch request failed');
  }

  const batchData = await batchRes.json();
  const object = batchData.objects?.[0];

  if (!object || object.error) {
    throw new Error(object?.error?.message || 'LFS object error');
  }

  if (object.actions?.upload) {
    const uploadUrl = object.actions.upload.href;
    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: buffer,
    });

    if (!uploadRes.ok) {
      throw new Error('LFS upload failed');
    }
  }

  if (object.actions?.verify) {
    const verifyRes = await fetch(object.actions.verify.href, {
      method: 'POST',
      headers: {
        ...object.actions.verify.header,
        ...authHeaders(config.token),
        'Content-Type': 'application/vnd.git-lfs+json',
      },
      body: JSON.stringify({ oid, size }),
    });

    if (!verifyRes.ok) {
      throw new Error('LFS verify failed');
    }
  }

  return { oid, size };
}

async function createBlob(config: GitHubConfig, oid: string, size: number): Promise<string> {
  const blobRes = await fetch(`${API_BASE}/repos/${config.owner}/${config.repo}/git/blobs`, {
    method: 'POST',
    headers: { ...authHeaders(config.token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: `version https://git-lfs.github.com/spec/v1
oid sha256:${oid}
size ${size}`,
      encoding: 'utf-8',
    }),
  });

  if (!blobRes.ok) {
    throw new Error('Failed to create blob');
  }

  const blobData = await blobRes.json();
  return blobData.sha;
}

async function getTreeSha(config: GitHubConfig): Promise<string> {
  const url = `${API_BASE}/repos/${config.owner}/${config.repo}/git/trees/${config.branch}`;
  const res = await fetch(url, { headers: authHeaders(config.token) });
  if (!res.ok) {
    throw new Error('Failed to get tree');
  }
  const data = await res.json();
  return data.sha;
}

async function getHeadCommitSha(config: GitHubConfig): Promise<string> {
  const url = `${API_BASE}/repos/${config.owner}/${config.repo}/git/ref/heads/${encodePath(config.branch)}`;
  const res = await fetch(url, { headers: authHeaders(config.token) });
  if (!res.ok) {
    throw new Error('Failed to get head ref');
  }
  const data = await res.json();
  return data.object.sha;
}

async function createTree(
  config: GitHubConfig,
  parentTreeSha: string,
  path: string,
  blobSha: string
): Promise<string> {
  const treeRes = await fetch(`${API_BASE}/repos/${config.owner}/${config.repo}/git/trees`, {
    method: 'POST',
    headers: { ...authHeaders(config.token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      base_tree: parentTreeSha,
      tree: [
        {
          path,
          mode: '100644',
          type: 'blob',
          sha: blobSha,
        },
      ],
    }),
  });

  if (!treeRes.ok) {
    throw new Error('Failed to create tree');
  }

  const treeData = await treeRes.json();
  return treeData.sha;
}

async function createCommit(
  config: GitHubConfig,
  treeSha: string,
  parentCommitSha: string,
  message: string
): Promise<string> {
  const url = `${API_BASE}/repos/${config.owner}/${config.repo}/git/commits`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...authHeaders(config.token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      tree: treeSha,
      parents: [parentCommitSha],
    }),
  });

  if (!res.ok) {
    throw new Error('Failed to create commit');
  }

  const data = await res.json();
  return data.sha;
}

async function updateRef(config: GitHubConfig, commitSha: string): Promise<void> {
  const url = `${API_BASE}/repos/${config.owner}/${config.repo}/git/refs/heads/${config.branch}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { ...authHeaders(config.token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sha: commitSha,
      force: false,
    }),
  });

  if (!res.ok) {
    throw new Error('Failed to update ref');
  }
}

async function triggerPagesDeploy(config: GitHubConfig): Promise<void> {
  const url = `${API_BASE}/repos/${config.owner}/${config.repo}/actions/workflows/deploy.yml/dispatches`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...authHeaders(config.token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref: config.branch }),
  });

  if (!res.ok) {
    throw new Error(await parseError(res));
  }
}

async function triggerPagesDeployQuietly(config: GitHubConfig): Promise<void> {
  try {
    await triggerPagesDeploy(config);
  } catch (err) {
    console.warn('Failed to trigger Pages deploy:', err);
  }
}

export async function uploadImage(file: File, customName?: string): Promise<UploadResult> {
  const error = validateImageFile(file);
  if (error) throw new Error(error);

  const config = getGitHubConfig();
  const dir = config.imagesDir.replace(/^\//, '').replace(/\/$/, '');
  const ext = getImageExtension(file);

  const existingNames = await getExistingFileNames(config);

  let fileName: string;
  if (customName?.trim()) {
    const baseName = customName.trim();
    fileName = generateUniqueFileName(baseName, ext, existingNames);
  } else {
    fileName = resolveUploadFileName(file);
    while (existingNames.has(fileName)) {
      const base = fileName.replace(/\.[^.]+$/, '');
      fileName = generateUniqueFileName(base, ext, existingNames);
    }
  }

  const path = `${dir}/${fileName}`;

  try {
    // 使用 LFS 上传
    const { oid, size } = await uploadToLfs(config, file);
    const blobSha = await createBlob(config, oid, size);
    const parentCommitSha = await getHeadCommitSha(config);
    const parentTreeSha = await getTreeSha(config);
    const newTreeSha = await createTree(config, parentTreeSha, path, blobSha);
    const commitSha = await createCommit(config, newTreeSha, parentCommitSha, `upload: ${fileName}`);
    await updateRef(config, commitSha);
  } catch (lfsError) {
    // 如果 LFS 上传失败，回退到普通上传
    console.warn('LFS upload failed, falling back to regular upload:', lfsError);
    const content = await fileToBase64(file);
    const putUrl = `${API_BASE}/repos/${config.owner}/${config.repo}/contents/${encodePath(path)}`;
    const res = await fetch(putUrl, {
      method: 'PUT',
      headers: { ...authHeaders(config.token), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `upload: ${fileName}`,
        content,
        branch: config.branch,
      }),
    });

    if (!res.ok) throw new Error(await parseError(res));
  }

  return {
    name: fileName,
    path,
    url: buildPagesUrl(config, path),
    rawUrl: buildMediaUrl(config, path),
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

  if (succeeded.length > 0) {
    await triggerPagesDeployQuietly(getGitHubConfig());
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

  await triggerPagesDeployQuietly(config);
}
