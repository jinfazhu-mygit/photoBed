/** 对路径各段进行 URL 编码（保留已编码内容） */
function encodeSegment(segment: string): string {
  try {
    return encodeURIComponent(decodeURIComponent(segment));
  } catch {
    return encodeURIComponent(segment);
  }
}

export function encodeUrlPath(path: string): string {
  return path
    .split('/')
    .filter(Boolean)
    .map(encodeSegment)
    .join('/');
}

/**
 * 预览/展示用 URL 列表
 * 优先 Media URL（支持 LFS），其次 Pages URL
 * Media URL 可以正确处理 LFS 文件，Pages URL 可能需要同步时间
 */
export function getImagePreviewSources(item: { url: string; rawUrl: string }): string[] {
  const sources = [item.rawUrl, item.url];
  return [...new Set(sources.filter(Boolean))];
}
