import {
  CopyOutlined,
  DeleteOutlined,
  FileMarkdownOutlined,
  LinkOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Empty,
  Image,
  Popconfirm,
  Segmented,
  Space,
  Table,
  Tooltip,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useState } from 'react';
import { deleteImage, listImages } from '../services/github';
import type { ImageItem } from '../types';

interface Props {
  refreshKey: number;
}

type CopyFormat = 'pages' | 'raw' | 'markdown';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatCopy(item: ImageItem, format: CopyFormat): string {
  switch (format) {
    case 'raw':
      return item.rawUrl;
    case 'markdown':
      return `![${item.name}](${item.url})`;
    default:
      return item.url;
  }
}

async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
  message.success('已复制到剪贴板');
}

export default function ImageGallery({ refreshKey }: Props) {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [copyFormat, setCopyFormat] = useState<CopyFormat>('pages');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listImages();
      setImages(list);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const handleDelete = async (item: ImageItem) => {
    try {
      await deleteImage(item);
      message.success('已删除');
      load();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  const columns: ColumnsType<ImageItem> = [
    {
      title: '预览',
      dataIndex: 'rawUrl',
      width: 88,
      render: (url: string, record) => (
        <Image
          src={url}
          alt={record.name}
          width={56}
          height={56}
          className="gallery-thumb"
          style={{ objectFit: 'cover', borderRadius: 8 }}
        />
      ),
    },
    {
      title: '文件名',
      dataIndex: 'name',
      ellipsis: true,
    },
    {
      title: '大小',
      dataIndex: 'size',
      width: 96,
      render: (size: number) => formatSize(size),
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="按当前格式复制">
            <Button
              size="small"
              type="primary"
              ghost
              icon={<CopyOutlined />}
              onClick={() => copyText(formatCopy(record, copyFormat))}
            />
          </Tooltip>
          <Tooltip title="Pages 链接">
            <Button
              size="small"
              icon={<LinkOutlined />}
              onClick={() => copyText(record.url)}
            />
          </Tooltip>
          <Tooltip title="Markdown">
            <Button
              size="small"
              icon={<FileMarkdownOutlined />}
              onClick={() => copyText(formatCopy(record, 'markdown'))}
            />
          </Tooltip>
          <Popconfirm
            title="确定删除该图片？"
            description="将从 GitHub 仓库中永久删除"
            onConfirm={() => handleDelete(record)}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card
      className="gallery-card"
      title={`全部图片（${images.length}）`}
      bordered={false}
      extra={
        <Space>
          <Segmented
            size="small"
            value={copyFormat}
            onChange={(v) => setCopyFormat(v as CopyFormat)}
            options={[
              { label: 'Pages', value: 'pages' },
              { label: 'Raw', value: 'raw' },
              { label: 'MD', value: 'markdown' },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
            刷新
          </Button>
        </Space>
      }
    >
      {images.length === 0 && !loading ? (
        <Empty className="gallery-empty" description="暂无图片，去上传一张吧" />
      ) : (
        <Table
          rowKey="sha"
          columns={columns}
          dataSource={images}
          loading={loading}
          pagination={{ pageSize: 12, showSizeChanger: true, showTotal: (t) => `共 ${t} 张` }}
          size="middle"
        />
      )}
      <Typography.Paragraph type="secondary" className="gallery-hint">
        Pages 链接在 GitHub Actions 部署完成后生效；Raw 链接上传后立即可用。
      </Typography.Paragraph>
    </Card>
  );
}
