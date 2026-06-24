function encodeSegment(segment: string): string {
  try {
    return encodeURIComponent(decodeURIComponent(segment))
      .replace(/\(/g, '%28')
      .replace(/\)/g, '%29');
  } catch {
    return encodeURIComponent(segment)
      .replace(/\(/g, '%28')
      .replace(/\)/g, '%29');
  }
}

export function encodeUrlPath(path: string): string {
  return path
    .split('/')
    .filter(Boolean)
    .map(encodeSegment)
    .join('/');
}

export function getImagePreviewSources(item: { url: string; rawUrl: string }): string[] {
  const sources = [item.rawUrl, item.url];
  return [...new Set(sources.filter(Boolean))];
}
