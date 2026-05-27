import {
  CheckCircleOutlined,
  CloudUploadOutlined,
  CopyOutlined,
  LinkOutlined,
  PictureOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
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
import { useCallback, useState } from 'react';
import { uploadImage, uploadImages, validateImageFile } from '../services/github';
import type { UploadResult } from '../types';

interface Props {
  onUploaded: () => void;
}

type LinkFormat = 'pages' | 'raw' | 'markdown' | 'html';

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

export default function ImageUpload({ onUploaded }: Props) {
  const [customName, setCustomName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [recent, setRecent] = useState<UploadResult[]>([]);
  const [linkFormat, setLinkFormat] = useState<LinkFormat>('pages');

  const handleFiles = useCallback(
    async (fileList: File[]) => {
      const valid: File[] = [];
      for (const file of fileList) {
        const err = validateImageFile(file);
        if (err) message.warning(`${file.name}: ${err}`);
        else valid.push(file);
      }
      if (valid.length === 0) return;

      setUploading(true);
      setProgress({ done: 0, total: valid.length });

      try {
        let succeeded: UploadResult[] = [];
        const failed: { file: File; error: string }[] = [];

        if (valid.length === 1 && customName.trim()) {
          try {
            const result = await uploadImage(valid[0], customName.trim());
            succeeded = [result];
            setProgress({ done: 1, total: 1 });
          } catch (err) {
            failed.push({
              file: valid[0],
              error: err instanceof Error ? err.message : '上传失败',
            });
          }
        } else {
          const result = await uploadImages(valid, (done, total) =>
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
        }
        failed.forEach(({ file, error }) => message.error(`${file.name}: ${error}`));
      } finally {
        setUploading(false);
        setProgress({ done: 0, total: 0 });
      }
    },
    [customName, onUploaded]
  );

  const uploadProps: UploadProps = {
    name: 'file',
    multiple: true,
    showUploadList: false,
    accept: 'image/*',
    disabled: uploading,
    beforeUpload: (_, fileList) => {
      handleFiles(fileList as unknown as File[]);
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
                支持拖拽或批量选择，单文件最大 25MB
              </Typography.Text>
            </div>
          </div>

          <Input
            className="upload-name-input"
            placeholder="单张上传时可自定义文件名（可选）"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            disabled={uploading}
            allowClear
          />

          <Upload.Dragger {...uploadProps} className="upload-dragger">
            <p className="ant-upload-drag-icon">
              <CloudUploadOutlined />
            </p>
            <p className="ant-upload-text">拖拽图片到此处，或点击选择文件</p>
            <p className="ant-upload-hint">JPG · PNG · GIF · WebP · SVG · BMP</p>
          </Upload.Dragger>

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
