import { Image } from 'antd';
import { useMemo, useState } from 'react';
import { getImagePreviewSources } from '../utils/imageUrl';

interface Props {
  url: string;
  rawUrl: string;
  tempUrl?: string;
  alt: string;
  width: number;
  height?: number;
  className?: string;
}

/**
 * 图片预览：优先临时预览 URL（上传后立即显示），然后尝试 Media URL，最后回退 Pages；URL 均已编码，避免中文路径加载失败
 */
export default function PreviewableImage({
  url,
  rawUrl,
  tempUrl,
  alt,
  width,
  height = width,
  className,
}: Props) {
  const sources = useMemo(() => {
    const baseSources = getImagePreviewSources({ url, rawUrl });
    // 如果有临时预览 URL，优先使用
    if (tempUrl) {
      return [tempUrl, ...baseSources];
    }
    return baseSources;
  }, [url, rawUrl, tempUrl]);
  const [sourceIndex, setSourceIndex] = useState(0);
  const src = sources[sourceIndex] ?? sources[0];

  if (!src) return null;

  const tryNextSource = () => {
    setSourceIndex((prev) => (prev < sources.length - 1 ? prev + 1 : prev));
  };

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      style={{ objectFit: 'cover' }}
      preview={{ src }}
      onError={tryNextSource}
    />
  );
}
