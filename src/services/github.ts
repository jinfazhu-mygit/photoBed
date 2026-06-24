import { getGitHubConfig } from '../config';
import type { GitHubConfig, ImageItem, UploadResult } from '../types';
import { getImageExtension, resolveUploadFileName } from '../utils/filename';
import { encodeUrlPath } from '../utils/imageUrl';

const API_BASE = 'https://api.github.com';
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp'];

interface UploadItemInput {
  file: File;
  customName?: string;
}

interface PreparedUpload {
  file: File;
  result: UploadResult;
  treeEntry: {
    path: string;
    sha: string;
  };
}

interface LfsAction {
  href: string;
  header?: Record<string, string>;
}

interface LfsBatchObject {
  oid: string;
  size: number;
  error?: { message?: string };
  actions?: {
    upload?: LfsAction;
    verify?: LfsAction;
  };
}

function authHeaders(token: string): HeadersInit {
  return {
    Accept: 'application/vnd.github.v3+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

function lfsHeaders(token: string): HeadersInit {
  return {
    ...authHeaders(token),
    Accept: 'application/vnd.git-lfs+json',
    'Content-Type': 'application/vnd.git-lfs+json',
  };
}

function encodePath(path: string): string {
  return path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function normalizeDir(dir: string): string {
  return dir.replace(/^\//, '').replace(/\/$/, '');
}

function buildMediaUrl(config: GitHubConfig, path: string): string {
  const { owner, repo, branch } = config;
  return `https://media.githubusercontent.com/media/${owner}/${repo}/${branch}/${encodeUrlPath(path)}`;
}

function buildPagesUrl(config: GitHubConfig, path: string): string {
  const imagesDir = normalizeDir(config.imagesDir);
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

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      if (!base64) reject(new Error('Unable to read file'));
      else resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function getFileBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

async function calculateSha256(buffer: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

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
  if (!existingNames.has(fileName)) return fileName;

  let counter = 1;
  while (counter <= 100) {
    const newFileName = `${baseName}(${counter})${ext}`;
    if (!existingNames.has(newFileName)) return newFileName;
    counter++;
  }

  return `${baseName}-${Date.now()}${ext}`;
}

function resolveUploadName(
  file: File,
  customName: string | undefined,
  existingNames: Set<string>
): string {
  const ext = getImageExtension(file);

  if (customName?.trim()) {
    return generateUniqueFileName(customName.trim(), ext, existingNames);
  }

  let fileName = resolveUploadFileName(file);
  while (existingNames.has(fileName)) {
    const base = fileName.replace(/\.[^.]+$/, '');
    fileName = generateUniqueFileName(base, ext, existingNames);
  }
  return fileName;
}

async function getExistingFileNames(config: GitHubConfig): Promise<Set<string>> {
  try {
    const dir = normalizeDir(config.imagesDir);
    const url = `${API_BASE}/repos/${config.owner}/${config.repo}/contents/${encodePath(dir)}?ref=${encodeURIComponent(config.branch)}`;
    const res = await fetch(url, { headers: authHeaders(config.token) });
    if (!res.ok) return new Set();

    const data = (await res.json()) as Array<{ name: string; type: string }>;
    return new Set(data.filter((item) => item.type === 'file').map((item) => item.name));
  } catch {
    return new Set();
  }
}

async function uploadToLfs(config: GitHubConfig, file: File): Promise<{ oid: string; size: number }> {
  const buffer = await getFileBuffer(file);
  const oid = await calculateSha256(buffer);
  const size = buffer.byteLength;
  const batchUrl = `${API_BASE}/repos/${config.owner}/${config.repo}/git/lfs/objects/batch`;

  const batchRes = await fetch(batchUrl, {
    method: 'POST',
    headers: lfsHeaders(config.token),
    body: JSON.stringify({
      operation: 'upload',
      transfers: ['basic'],
      objects: [{ oid, size }],
    }),
  });

  if (!batchRes.ok) {
    throw new Error(await parseError(batchRes));
  }

  const batchData = (await batchRes.json()) as { objects?: LfsBatchObject[] };
  const object = batchData.objects?.[0];
  if (!object || object.error) {
    throw new Error(object?.error?.message || 'LFS object upload was rejected');
  }

  if (object.actions?.upload) {
    const uploadRes = await fetch(object.actions.upload.href, {
      method: 'PUT',
      headers: {
        ...(object.actions.upload.header || {}),
        'Content-Type': 'application/octet-stream',
      },
      body: buffer,
    });

    if (!uploadRes.ok) {
      throw new Error('LFS object upload failed');
    }
  }

  if (object.actions?.verify) {
    const verifyRes = await fetch(object.actions.verify.href, {
      method: 'POST',
      headers: {
        ...lfsHeaders(config.token),
        ...(object.actions.verify.header || {}),
      },
      body: JSON.stringify({ oid, size }),
    });

    if (!verifyRes.ok) {
      throw new Error('LFS object verification failed');
    }
  }

  return { oid, size };
}

async function createGitBlob(
  config: GitHubConfig,
  content: string,
  encoding: 'utf-8' | 'base64'
): Promise<string> {
  const res = await fetch(`${API_BASE}/repos/${config.owner}/${config.repo}/git/blobs`, {
    method: 'POST',
    headers: { ...authHeaders(config.token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, encoding }),
  });

  if (!res.ok) {
    throw new Error(await parseError(res));
  }

  const data = (await res.json()) as { sha: string };
  return data.sha;
}

async function createLfsPointerBlob(config: GitHubConfig, oid: string, size: number): Promise<string> {
  return createGitBlob(
    config,
    `version https://git-lfs.github.com/spec/v1\noid sha256:${oid}\nsize ${size}`,
    'utf-8'
  );
}

async function createRegularFileBlob(config: GitHubConfig, file: File): Promise<string> {
  return createGitBlob(config, await fileToBase64(file), 'base64');
}

async function createUploadBlob(config: GitHubConfig, file: File): Promise<string> {
  try {
    const { oid, size } = await uploadToLfs(config, file);
    return await createLfsPointerBlob(config, oid, size);
  } catch (err) {
    console.warn('LFS upload failed, falling back to a regular git blob:', err);
    return createRegularFileBlob(config, file);
  }
}

async function getHeadCommitSha(config: GitHubConfig): Promise<string> {
  const url = `${API_BASE}/repos/${config.owner}/${config.repo}/git/ref/heads/${encodePath(config.branch)}`;
  const res = await fetch(url, { headers: authHeaders(config.token) });
  if (!res.ok) throw new Error(await parseError(res));

  const data = (await res.json()) as { object: { sha: string } };
  return data.object.sha;
}

async function getTreeSha(config: GitHubConfig): Promise<string> {
  const url = `${API_BASE}/repos/${config.owner}/${config.repo}/git/trees/${config.branch}`;
  const res = await fetch(url, { headers: authHeaders(config.token) });
  if (!res.ok) throw new Error(await parseError(res));

  const data = (await res.json()) as { sha: string };
  return data.sha;
}

async function createTree(
  config: GitHubConfig,
  parentTreeSha: string,
  entries: Array<{ path: string; sha: string }>
): Promise<string> {
  const res = await fetch(`${API_BASE}/repos/${config.owner}/${config.repo}/git/trees`, {
    method: 'POST',
    headers: { ...authHeaders(config.token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      base_tree: parentTreeSha,
      tree: entries.map((entry) => ({
        path: entry.path,
        mode: '100644',
        type: 'blob',
        sha: entry.sha,
      })),
    }),
  });

  if (!res.ok) throw new Error(await parseError(res));

  const data = (await res.json()) as { sha: string };
  return data.sha;
}

async function createCommit(
  config: GitHubConfig,
  treeSha: string,
  parentCommitSha: string,
  message: string
): Promise<string> {
  const res = await fetch(`${API_BASE}/repos/${config.owner}/${config.repo}/git/commits`, {
    method: 'POST',
    headers: { ...authHeaders(config.token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      tree: treeSha,
      parents: [parentCommitSha],
    }),
  });

  if (!res.ok) throw new Error(await parseError(res));

  const data = (await res.json()) as { sha: string };
  return data.sha;
}

async function updateRef(config: GitHubConfig, commitSha: string): Promise<void> {
  const url = `${API_BASE}/repos/${config.owner}/${config.repo}/git/refs/heads/${encodePath(config.branch)}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { ...authHeaders(config.token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sha: commitSha,
      force: false,
    }),
  });

  if (!res.ok) throw new Error(await parseError(res));
}

async function commitPreparedUploads(config: GitHubConfig, prepared: PreparedUpload[]): Promise<void> {
  const parentCommitSha = await getHeadCommitSha(config);
  const parentTreeSha = await getTreeSha(config);
  const newTreeSha = await createTree(
    config,
    parentTreeSha,
    prepared.map((item) => item.treeEntry)
  );
  const message =
    prepared.length === 1
      ? `upload: ${prepared[0].result.name}`
      : `upload: ${prepared.length} images`;
  const commitSha = await createCommit(config, newTreeSha, parentCommitSha, message);
  await updateRef(config, commitSha);
}

export async function listImages(): Promise<ImageItem[]> {
  const config = getGitHubConfig();
  const dir = normalizeDir(config.imagesDir);
  const url = `${API_BASE}/repos/${config.owner}/${config.repo}/contents/${encodePath(dir)}?ref=${encodeURIComponent(config.branch)}`;

  const res = await fetch(url, { headers: authHeaders(config.token) });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(await parseError(res));

  const data = (await res.json()) as Array<{
    name: string;
    path: string;
    sha: string;
    size: number;
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

export async function uploadImage(file: File, customName?: string): Promise<UploadResult> {
  const { succeeded, failed } = await uploadImages([{ file, customName }]);
  if (succeeded[0]) return succeeded[0];

  throw new Error(failed[0]?.error || '上传失败');
}

export async function uploadImages(
  items: UploadItemInput[],
  onProgress?: (done: number, total: number) => void
): Promise<{ succeeded: UploadResult[]; failed: { file: File; error: string }[] }> {
  const config = getGitHubConfig();
  const dir = normalizeDir(config.imagesDir);
  const existingNames = await getExistingFileNames(config);
  const prepared: PreparedUpload[] = [];
  const failed: { file: File; error: string }[] = [];
  const total = items.length;

  for (let i = 0; i < items.length; i++) {
    const { file, customName } = items[i];

    try {
      const error = validateImageFile(file);
      if (error) throw new Error(error);

      const fileName = resolveUploadName(file, customName, existingNames);
      existingNames.add(fileName);

      const path = `${dir}/${fileName}`;
      const sha = await createUploadBlob(config, file);
      prepared.push({
        file,
        result: {
          name: fileName,
          path,
          url: buildPagesUrl(config, path),
          rawUrl: buildMediaUrl(config, path),
        },
        treeEntry: { path, sha },
      });
    } catch (err) {
      failed.push({
        file,
        error: err instanceof Error ? err.message : '上传失败',
      });
    }

    onProgress?.(i + 1, total);
  }

  if (prepared.length > 0) {
    try {
      await commitPreparedUploads(config, prepared);
    } catch (err) {
      const error = err instanceof Error ? err.message : '上传提交失败';
      return {
        succeeded: [],
        failed: [
          ...failed,
          ...prepared.map((item) => ({ file: item.file, error })),
        ],
      };
    }
  }

  return {
    succeeded: prepared.map((item) => item.result),
    failed,
  };
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
