/** 常见图片后缀（用于剥离用户输入中的扩展名） */
const IMAGE_EXT_PATTERN = /\.(png|jpe?g|gif|webp|svg|bmp|ico|avif|heic|heif)$/i;

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
  'image/bmp': '.bmp',
  'image/x-icon': '.ico',
  'image/avif': '.avif',
  'image/heic': '.heic',
  'image/heif': '.heif',
};

/** 根据上传文件解析扩展名（带点，小写） */
export function getImageExtension(file: File): string {
  if (file.type && MIME_TO_EXT[file.type]) {
    return MIME_TO_EXT[file.type];
  }
  const match = file.name.match(IMAGE_EXT_PATTERN);
  if (match) {
    const raw = match[1].toLowerCase();
    return raw === 'jpeg' ? '.jpg' : `.${raw}`;
  }
  return '.png';
}

/** 去掉用户输入中的图片后缀 */
export function stripImageExtension(name: string): string {
  return name.trim().replace(IMAGE_EXT_PATTERN, '').trim();
}

/** 选图后填入输入框的建议名（不含扩展名） */
export function getSuggestedBaseName(file: File): string {
  const base = stripImageExtension(file.name);
  return base || 'image';
}

function sanitizeBaseName(base: string): string {
  return base
    .replace(/[^\w\u4e00-\u9fa5-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function defaultBaseName(file: File): string {
  const raw = stripImageExtension(file.name) || 'image';
  const safe = sanitizeBaseName(raw);
  return safe || 'image';
}

/**
 * 生成最终上传文件名：自定义名仅作主体，扩展名由文件类型决定
 */
export function resolveUploadFileName(file: File, customName?: string): string {
  const ext = getImageExtension(file);

  if (customName?.trim()) {
    const base = sanitizeBaseName(stripImageExtension(customName));
    if (!base) {
      throw new Error('自定义名称无效，请只填写文件名主体');
    }
    return `${base}${ext}`;
  }

  const base = defaultBaseName(file);
  const stamp = Date.now();
  return `${base}-${stamp}${ext}`;
}
