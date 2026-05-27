import {
  CheckCircleOutlined,
  CloudUploadOutlined,
  CopyOutlined,
  DeleteOutlined,
  LinkOutlined,
  PictureOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Form,
  Input,
  List,
  Progress,
  Segmented,
  Space,
  Tag,
  Typography,
  Upload,
  message,
} from 'antd';
import type { UploadProps } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { uploadImage, uploadImages, validateImageFile } from '../services/github';
import { getSuggestedBaseName, stripImageExtension } from '../utils/filename';
import type { UploadResult } from '../types';

interface Props {
  onUploaded: () => void;
}

type LinkFormat = 'pages' | 'raw' | 'markdown' | 'html';

interface PendingItem {
  file: File;
  previewUrl: string;
}

function formatLink(result: UploadResult, format: LinkFormat): string {
  const url = format === 'raw' ? result.rawUrl : result.url;
  switch (format) {
    case 'markdown':
      return `![${result.name}](${url})`;
    case 'html':
      return `<img src="${url}" alt="${result.name}" />`;
    default:
      return url;
  }
}

async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
  message.success('已复制');
}

function revokePreviewUrls(items: PendingItem[]) {
  items.forEach((item) => URL.revokeObjectURL(item.previewUrl));
}

export default function ImageUpload({ onUploaded }: Props) {
  const [customName, setCustomName] = useState('');
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [recent, setRecent] = useState<UploadResult[]>([]);
  const [linkFormat, setLinkFormat] = useState<LinkFormat>('pages');

  const pendingFiles = useMemo(() => pendingItems.map((item) => item.file), [pendingItems]);
  const isSinglePending = pendingFiles.length === 1;
  const pendingItemsRef = useRef(pendingItems);
  pendingItemsRef.current = pendingItems;

  useEffect(() => {
    return () => revokePreviewUrls(pendingItemsRef.current);
  }, []);

  const clearPending = useCallback(() => {
    setPendingItems((prev) => {
      revokePreviewUrls(prev);
      return [];
    });
  }, []);

  const handleSelectFiles = useCallback(
    (fileList: File[]) => {
      const valid: File[] = [];
      for (const file of fileList) {
        const err = validateImageFile(file);
        if (err) message.warning(`${file.name}: ${err}`);
        else valid.push(file);
      }
      if (valid.length === 0) return;

      clearPending();
      const items: PendingItem[] = valid.map((file) => ({
        file,
        previewUrl: URL.createObjectURL(file),
      }));
      setPendingItems(items);

      if (valid.length === 1) {
        setCustomName(getSuggestedBaseName(valid[0]));
      } else {
        setCustomName('');
      }
    },
    [clearPending]
  );

  const handleConfirmUpload = useCallback(async () => {
    if (pendingFiles.length === 0) {
      message.warning('请先选择要上传的图片');
      return;
    }

    setUploading(true);
    setProgress({ done: 0, total: pendingFiles.length });

    try {
      let succeeded: UploadResult[] = [];
      const failed: { file: File; error: string }[] = [];

      if (isSinglePending) {
        try {
          const name = customName.trim() || undefined;
          const result = await uploadImage(pendingFiles[0], name);
          succeeded = [result];
          setProgress({ done: 1, total: 1 });
        } catch (err) {
          failed.push({
            file: pendingFiles[0],
            error: err instanceof Error ? err.message : '上传失败',
          });
        }
      } else {
        const result = await uploadImages(pendingFiles, (done, total) =>
          setProgress({ done, total })
        );
        succeeded = result.succeeded;
        failed.push(...result.failed);
      }

      if (succeeded.length > 0) {
        setRecent((prev) => [...succeeded, ...prev].slice(0, 8));
        onUploaded();
        message.success(`成功上传 ${succeeded.length} 张图片`);
        setCustomName('');
        clearPending();
      }
      failed.forEach(({ file, error }) => message.error(`${file.name}: ${error}`));
    } finally {
      setUploading(false);
      setProgress({ done: 0, total: 0 });
    }
  }, [
    pendingFiles,
    isSinglePending,
    customName,
    onUploaded,
    clearPending,
  ]);

  const uploadProps: UploadProps = {
    name: 'file',
    multiple: true,
    showUploadList: false,
    accept: 'image/*',
    disabled: uploading,
    beforeUpload: (_, fileList) => {
      handleSelectFiles(fileList as unknown as File[]);
      return false;
    },
  };

  const percent =
    progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="upload-section">
      <Card className="upload-card" bordered={false}>
        <div className="upload-card-inner">
          <div className="upload-intro">
            <PictureOutlined className="upload-intro-icon" />
            <div>
              <Typography.Title level={5} style={{ margin: 0 }}>
                上传图片
              </Typography.Title>
              <Typography.Text type="secondary">
                选择图片并确认后再上传，单文件最大 25MB
              </Typography.Text>
            </div>
          </div>

          <Upload.Dragger {...uploadProps} className="upload-dragger">
            <p className="ant-upload-drag-icon">
              <CloudUploadOutlined />
            </p>
            <p className="ant-upload-text">拖拽图片到此处，或点击选择文件</p>
            <p className="ant-upload-hint">JPG · PNG · GIF · WebP · SVG · BMP</p>
          </Upload.Dragger>

          {pendingItems.length > 0 && (
            <div className="pending-block">
              <div className="pending-header">
                <Typography.Text strong>
                  已选择 {pendingItems.length} 个文件
                </Typography.Text>
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => {
                    clearPending();
                    setCustomName('');
                  }}
                  disabled={uploading}
                >
                  清空
                </Button>
              </div>
              <div className="pending-previews">
                {pendingItems.map((item) => (
                  <div key={item.previewUrl} className="pending-preview-item">
                    <img src={item.previewUrl} alt={item.file.name} />
                    <Typography.Text ellipsis className="pending-preview-name">
                      {item.file.name}
                    </Typography.Text>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Form.Item
            className="upload-name-field"
            label="自定义文件名"
            extra={
              isSinglePending
                ? '仅填文件名主体，不要带 .png、.jpg 等后缀；上传后将按图片格式自动补全'
                : pendingItems.length > 1
                  ? '批量上传时将自动为每个文件生成文件名'
                  : '选择单张图片后可在此修改文件名'
            }
          >
            <Input
              className="upload-name-input"
              placeholder={
                isSinglePending
                  ? '例如：avatar、banner-2024'
                  : '请先选择单张图片以自定义文件名'
              }
              value={customName}
              onChange={(e) => setCustomName(stripImageExtension(e.target.value))}
              onBlur={(e) => setCustomName(stripImageExtension(e.target.value))}
              disabled={uploading || !isSinglePending}
              allowClear
            />
          </Form.Item>

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
          className="recent-card"
          title={
            <Space>
              <CheckCircleOutlined style={{ color: '#52c41a' }} />
              <span>最近上传</span>
            </Space>
          }
          extra={
            <Segmented
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
          }
          bordered={false}
        >
          <List
            dataSource={recent}
            renderItem={(item) => {
              const link = formatLink(item, linkFormat);
              return (
                <List.Item
                  actions={[
                    <Button
                      key="copy"
                      type="link"
                      size="small"
                      icon={<CopyOutlined />}
                      onClick={() => copyText(link)}
                    >
                      复制
                    </Button>,
                    <Button
                      key="pages"
                      type="link"
                      size="small"
                      icon={<LinkOutlined />}
                      onClick={() => copyText(item.url)}
                    >
                      Pages
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    avatar={
                      <img src={item.rawUrl} alt={item.name} className="recent-thumb" />
                    }
                    title={item.name}
                    description={
                      <Typography.Text copyable={{ text: link }} ellipsis className="recent-link">
                        {link}
                      </Typography.Text>
                    }
                  />
                  <Tag color="success">已上传</Tag>
                </List.Item>
              );
            }}
          />
        </Card>
      )}
    </div>
  );
}
