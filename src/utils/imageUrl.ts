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

/** 预览/展示用 URL 列表：优先 Pages，其次 Raw */
export function getImagePreviewSources(item: { url: string; rawUrl: string }): string[] {
  const sources = [item.url, item.rawUrl];
  return [...new Set(sources.filter(Boolean))];
}
