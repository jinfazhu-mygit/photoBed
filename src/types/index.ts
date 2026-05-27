export interface GitHubConfig {
  owner: string;
  repo: string;
  branch: string;
  token: string;
  imagesDir: string;
}

export interface ImageItem {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  rawUrl: string;
  uploadedAt?: string;
}

export interface UploadResult {
  name: string;
  path: string;
  url: string;
  rawUrl: string;
}
