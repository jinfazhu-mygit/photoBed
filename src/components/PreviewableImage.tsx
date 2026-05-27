import { Image } from 'antd';
import { useMemo, useState } from 'react';
import { getImagePreviewSources } from '../utils/imageUrl';

interface Props {
  url: string;
  rawUrl: string;
  alt: string;
  width: number;
  height?: number;
  className?: string;
}

/**
 * 图片预览：优先 Pages，失败时回退 Raw；URL 均已编码，避免中文路径加载失败
 */
export default function PreviewableImage({
  url,
  rawUrl,
  alt,
  width,
  height = width,
  className,
}: Props) {
  const sources = useMemo(() => getImagePreviewSources({ url, rawUrl }), [url, rawUrl]);
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
