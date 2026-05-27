import { CopyOutlined, DeleteOutlined, LinkOutlined, ReloadOutlined } from '@ant-design/icons';
import {
  Button,
  Card,
  Empty,
  Image,
  Popconfirm,
  Space,
  Table,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useState } from 'react';
import { deleteImage, listImages } from '../services/github';
import type { GitHubConfig, ImageItem } from '../types';

interface Props {
  config: GitHubConfig;
  refreshKey: number;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
  message.success('已复制到剪贴板');
}

export default function ImageGallery({ config, refreshKey }: Props) {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listImages(config);
      setImages(list);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [config]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const handleDelete = async (item: ImageItem) => {
    try {
      await deleteImage(config, item);
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
      width: 100,
      render: (url: string, record) => (
        <Image src={url} alt={record.name} width={64} height={64} style={{ objectFit: 'cover' }} />
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
      width: 100,
      render: (size: number) => formatSize(size),
    },
    {
      title: '操作',
      key: 'actions',
      width: 280,
      render: (_, record) => (
        <Space wrap>
          <Button
            size="small"
            icon={<CopyOutlined />}
            onClick={() => copyText(record.rawUrl)}
          >
            Raw
          </Button>
          <Button
            size="small"
            icon={<LinkOutlined />}
            onClick={() => copyText(record.url)}
          >
            Pages
          </Button>
          <Popconfirm
            title="确定删除该图片？"
            description="将从 GitHub 仓库中永久删除"
            onConfirm={() => handleDelete(record)}
          >
            <Button size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title="图片列表"
      size="small"
      extra={
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
          刷新
        </Button>
      }
    >
      {images.length === 0 && !loading ? (
        <Empty description="暂无图片，请先上传" />
      ) : (
        <Table
          rowKey="sha"
          columns={columns}
          dataSource={images}
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: true }}
          size="small"
        />
      )}
      <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
        Raw：GitHub raw 直链；Pages：经 GitHub Pages 的访问地址（需完成部署）。
      </Typography.Paragraph>
    </Card>
  );
}
