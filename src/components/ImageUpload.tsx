import {
  CheckCircleOutlined,
  CloudUploadOutlined,
  CopyOutlined,
  DeleteOutlined,
  PictureOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Input,
  List,
  Progress,
  Segmented,
  Tag,
  Typography,
  Upload,
  message,
} from 'antd';
import type { UploadProps } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import PreviewableImage from './PreviewableImage';
import { useIsMobile } from '../hooks/useIsMobile';
import { uploadImages, validateImageFile } from '../services/github';
import { getImageExtension, getSuggestedBaseName, resolveUploadFileName, stripImageExtension } from '../utils/filename';
import type { UploadResult } from '../types';

interface Props {
  onUploaded: () => void;
}

type LinkFormat = 'pages' | 'raw' | 'markdown' | 'html';

interface PendingItem {
  id: string;
  file: File;
  previewUrl: string;
  baseName: string;
}

function formatLink(result: UploadResult, format: LinkFormat): string {
  // 始终使用 rawUrl（Media URL）以支持 LFS 文件
  const url = result.rawUrl;
  switch (format) {
    case 'markdown':
      return `![${result.name}](${url})`;
    case 'html':
      return `<img src="${url}" alt="${result.name}" />`;
    default:
      return url;
  }
}

function fileKey(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

function createPendingItem(file: File): PendingItem {
  return {
    id: `${fileKey(file)}-${crypto.randomUUID()}`,
    file,
    previewUrl: URL.createObjectURL(file),
    baseName: getSuggestedBaseName(file),
  };
}

async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
  message.success('已复制');
}

function revokeObjectUrl(url?: string) {
  if (url?.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}

function revokePendingPreviewUrls(items: Pick<PendingItem, 'previewUrl'>[]) {
  items.forEach((item) => revokeObjectUrl(item.previewUrl));
}

function revokeRecentPreviewUrls(items: Pick<UploadResult, 'tempUrl'>[]) {
  items.forEach((item) => revokeObjectUrl(item.tempUrl));
}

export default function ImageUpload({ onUploaded }: Props) {
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [recent, setRecent] = useState<UploadResult[]>([]);
  const [linkFormat, setLinkFormat] = useState<LinkFormat>('pages');
  const isMobile = useIsMobile();
  const pendingItemsRef = useRef(pendingItems);
  const recentRef = useRef(recent);
  pendingItemsRef.current = pendingItems;
  recentRef.current = recent;

  useEffect(() => {
    return () => {
      revokePendingPreviewUrls(pendingItemsRef.current);
      revokeRecentPreviewUrls(recentRef.current);
    };
  }, []);

  const clearPending = useCallback(() => {
    setPendingItems((prev) => {
      revokePendingPreviewUrls(prev);
      return [];
    });
  }, []);

  const removePendingItem = useCallback((id: string) => {
    setPendingItems((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) revokePendingPreviewUrls([target]);
      return prev.filter((item) => item.id !== id);
    });
  }, []);

  const updatePendingBaseName = useCallback((id: string, value: string) => {
    const baseName = stripImageExtension(value);
    setPendingItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, baseName } : item))
    );
  }, []);

  const handleSelectFiles = useCallback((fileList: File[]) => {
    const existingKeys = new Set(pendingItemsRef.current.map((item) => fileKey(item.file)));
    const toAdd: PendingItem[] = [];
    let skipped = 0;

    for (const file of fileList) {
      const err = validateImageFile(file);
      if (err) {
        message.warning(`${file.name}: ${err}`);
        continue;
      }
      const key = fileKey(file);
      if (existingKeys.has(key)) {
        skipped += 1;
        continue;
      }
      existingKeys.add(key);
      toAdd.push(createPendingItem(file));
    }

    if (toAdd.length === 0) {
      if (skipped > 0) message.info('所选图片已在待上传列表中');
      return;
    }

    setPendingItems((prev) => [...prev, ...toAdd]);
    message.success(`已添加 ${toAdd.length} 张图片到待上传列表`);
    if (skipped > 0) message.info(`已跳过 ${skipped} 张重复图片`);
  }, []);

  const handleConfirmUpload = useCallback(async () => {
    if (pendingItems.length === 0) {
      message.warning('请先选择要上传的图片');
      return;
    }

    setUploading(true);
    setProgress({ done: 0, total: pendingItems.length });

    try {
      const { succeeded, failed } = await uploadImages(
        pendingItems.map((item) => ({
          file: item.file,
          customName: item.baseName.trim() || undefined,
        })),
        (done, total) => setProgress({ done, total })
      );

      if (succeeded.length > 0) {
        const promotedPreviewIds = new Set<string>();
        const resultsWithPreview = succeeded.map((result) => {
          const pendingItem = pendingItems.find((item) => {
            const expectedName = item.baseName.trim()
              ? `${item.baseName.trim()}${getImageExtension(item.file)}`
              : resolveUploadFileName(item.file);
            return result.name === expectedName;
          });
          if (pendingItem) {
            promotedPreviewIds.add(pendingItem.id);
          }
          return {
            ...result,
            tempUrl: pendingItem?.previewUrl,
          };
        });
        setRecent((prev) => {
          const next = [...resultsWithPreview, ...prev];
          const kept = next.slice(0, 8);
          revokeRecentPreviewUrls(next.slice(8));
          return kept;
        });
        onUploaded();
        message.success(`成功上传 ${succeeded.length} 张图片`);
        setPendingItems((prev) => {
          revokePendingPreviewUrls(prev.filter((item) => !promotedPreviewIds.has(item.id)));
          return [];
        });
      }
      failed.forEach(({ file, error }) => message.error(`${file.name}: ${error}`));
    } finally {
      setUploading(false);
      setProgress({ done: 0, total: 0 });
    }
  }, [pendingItems, onUploaded, clearPending]);

  const lastUploadKeyRef = useRef<string>('');

  const uploadProps: UploadProps = {
    name: 'file',
    multiple: true,
    showUploadList: false,
    accept: 'image/*',
    disabled: uploading,
    beforeUpload: (_, fileList) => {
      const files = fileList as unknown as File[];
      const currentKey = files.map(f => fileKey(f)).sort().join('|');
      if (currentKey === lastUploadKeyRef.current) {
        return false;
      }
      lastUploadKeyRef.current = currentKey;
      handleSelectFiles(files);
      return false;
    },
  };

  const percent =
    progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="upload-section">
      <Card className="upload-card surface-card" bordered={false}>
        <div className="upload-card-inner">
          <div className="upload-intro">
            <div className="upload-intro-icon" aria-hidden>
              <PictureOutlined />
            </div>
            <div className="upload-intro-text">
              <Typography.Title level={5} className="section-title">
                上传图片
              </Typography.Title>
              <Typography.Text type="secondary" className="section-desc">
                可多次选择图片加入列表，确认后一并上传，单文件最大 25MB
              </Typography.Text>
            </div>
          </div>

          <Upload.Dragger {...uploadProps} className="upload-dragger">
            <p className="ant-upload-drag-icon">
              <CloudUploadOutlined />
            </p>
            <p className="ant-upload-text">
              {isMobile ? '点击选择图片（可多次添加）' : '拖拽或点击选择图片（可多次添加）'}
            </p>
            <p className="ant-upload-hint">JPG · PNG · GIF · WebP · SVG · BMP</p>
          </Upload.Dragger>

          {pendingItems.length > 0 && (
            <div className="pending-block">
              <div className="pending-header">
                <Typography.Text strong>
                  待上传 {pendingItems.length} 张
                </Typography.Text>
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={clearPending}
                  disabled={uploading}
                >
                  全部清空
                </Button>
              </div>

              <Typography.Paragraph type="secondary" className="pending-tip">
                文件名无需填写后缀，将按各图片格式自动补全（如 .png、.jpg）
              </Typography.Paragraph>

              <ul className="pending-list">
                {pendingItems.map((item, index) => (
                  <li key={item.id} className="pending-list-item">
                    <img
                      src={item.previewUrl}
                      alt={item.file.name}
                      className="pending-list-thumb"
                    />
                    <div className="pending-list-body">
                      <Typography.Text type="secondary" className="pending-list-origin" ellipsis>
                        原文件：{item.file.name}
                      </Typography.Text>
                      <Input
                        addonAfter={getImageExtension(item.file)}
                        placeholder="文件名"
                        value={item.baseName}
                        onChange={(e) => updatePendingBaseName(item.id, e.target.value)}
                        onBlur={(e) => updatePendingBaseName(item.id, e.target.value)}
                        disabled={uploading}
                        allowClear
                      />
                    </div>
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => removePendingItem(item.id)}
                      disabled={uploading}
                      aria-label={`移除第 ${index + 1} 张`}
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="upload-actions">
            <Button
              type="primary"
              size="large"
              icon={<UploadOutlined />}
              loading={uploading}
              disabled={pendingItems.length === 0}
              onClick={handleConfirmUpload}
              block
            >
              {pendingItems.length === 0
                ? '确认上传'
                : `确认上传（${pendingItems.length} 张）`}
            </Button>
          </div>

          {uploading && (
            <div className="upload-progress">
              <Progress percent={percent} status="active" />
              <Typography.Text type="secondary">
                正在上传 {progress.done} / {progress.total}
              </Typography.Text>
            </div>
          )}
        </div>
      </Card>

      {recent.length > 0 && (
        <Card
          className="recent-card surface-card"
          title={
            <div className='recent-title-tip'>
              <span className="recent-title">
                <CheckCircleOutlined className="recent-title-icon" />
                最近上传
              </span>
              <span className="recent-tip">{'注意：刚上传完成的图片链接需等待1分钟(项目构建)后才能访问'}</span>
            </div>
          }
          extra={
            !isMobile ? (
              <Segmented
                className="format-segmented"
                size="small"
                value={linkFormat}
                onChange={(v) => setLinkFormat(v as LinkFormat)}
                options={[
                  { label: 'Pages', value: 'pages' },
                  { label: 'Raw', value: 'raw' },
                  { label: 'MD', value: 'markdown' },
                  { label: 'HTML', value: 'html' },
                ]}
              />
            ) : undefined
          }
          bordered={false}
        >
          {isMobile && (
            <div className="card-toolbar-mobile recent-toolbar">
              <Segmented
                className="format-segmented"
                block
                size="small"
                value={linkFormat}
                onChange={(v) => setLinkFormat(v as LinkFormat)}
                options={[
                  { label: 'Pages', value: 'pages' },
                  { label: 'Raw', value: 'raw' },
                  { label: 'MD', value: 'markdown' },
                  { label: 'HTML', value: 'html' },
                ]}
              />
            </div>
          )}
          <List
            className="recent-list"
            dataSource={recent}
            renderItem={(item) => {
              const link = formatLink(item, linkFormat);
              return (
                <List.Item className="recent-list-item">
                  <div className="recent-item-body">
                    <PreviewableImage
                      url={item.url}
                      rawUrl={item.rawUrl}
                      tempUrl={item.tempUrl}
                      alt={item.name}
                      width={56}
                      height={56}
                      className="recent-thumb"
                    />
                    <div className="recent-item-info">
                      <div className="recent-item-head">
                        <Typography.Text strong ellipsis className="recent-item-name">
                          {item.name}
                        </Typography.Text>

                      </div>
                      <Typography.Text copyable={{ text: link }} className="recent-link">
                        {link}
                      </Typography.Text>
                    </div>
                  </div>
                  <div className="recent-item-actions">
                    <Tag color="success" className="recent-tag">
                      已上传
                    </Tag>
                    <Button
                      size="small"
                      type="primary"
                      ghost
                      icon={<CopyOutlined />}
                      onClick={() => copyText(link)}
                    >
                      复制
                    </Button>
                  </div>
                </List.Item>
              );
            }}
          />
        </Card>
      )}
    </div>
  );
}
