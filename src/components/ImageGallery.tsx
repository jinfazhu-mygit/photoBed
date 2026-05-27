import {
  CopyOutlined,
  DeleteOutlined,
  FileMarkdownOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Empty,
  Pagination,
  Popconfirm,
  Segmented,
  Space,
  Spin,
  Table,
  Tooltip,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useMemo, useState } from 'react';
import PreviewableImage from './PreviewableImage';
import { deleteImage, listImages } from '../services/github';
import { useIsMobile } from '../hooks/useIsMobile';
import type { ImageItem } from '../types';

interface Props {
  refreshKey: number;
}

type CopyFormat = 'pages' | 'raw' | 'markdown';

const MOBILE_PAGE_SIZE = 8;
const DESKTOP_PAGE_SIZE = 12;

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
  const [mobilePage, setMobilePage] = useState(1);
  const [selectedRows, setSelectedRows] = useState<ImageItem[]>([]);
  const [deleting, setDeleting] = useState(false);
  const isMobile = useIsMobile();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listImages();
      setImages(list);
      setMobilePage(1);
      setSelectedRows([]);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(images.length / MOBILE_PAGE_SIZE));
    if (mobilePage > maxPage) setMobilePage(maxPage);
  }, [images.length, mobilePage]);

  const handleDelete = async (item: ImageItem) => {
    try {
      await deleteImage(item);
      message.success('已删除');
      load();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  const handleBatchDelete = async () => {
    if (selectedRows.length === 0) return;
    setDeleting(true);
    let successCount = 0;
    let failCount = 0;
    for (const item of selectedRows) {
      try {
        await deleteImage(item);
        successCount++;
      } catch {
        failCount++;
      }
    }
    setDeleting(false);
    setSelectedRows([]);
    if (successCount > 0) {
      message.success(`成功删除 ${successCount} 张图片`);
    }
    if (failCount > 0) {
      message.error(`${failCount} 张图片删除失败`);
    }
    load();
  };

  const mobilePageData = useMemo(() => {
    const start = (mobilePage - 1) * MOBILE_PAGE_SIZE;
    return images.slice(start, start + MOBILE_PAGE_SIZE);
  }, [images, mobilePage]);

  const copyFormatControl = (
    <Segmented
      className="format-segmented"
      size="small"
      value={copyFormat}
      onChange={(v) => setCopyFormat(v as CopyFormat)}
      options={[
        { label: 'Pages', value: 'pages' },
        { label: 'Raw', value: 'raw' },
        { label: 'MD', value: 'markdown' },
      ]}
    />
  );

  const columns: ColumnsType<ImageItem> = [
    {
      title: '预览',
      dataIndex: 'rawUrl',
      width: 88,
      render: (_, record) => (
        <PreviewableImage
          url={record.url}
          rawUrl={record.rawUrl}
          alt={record.name}
          width={56}
          height={56}
          className="gallery-thumb"
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
        <Space size={4} wrap>
          <Tooltip title="按当前格式复制">
            <Button
              size="small"
              type="primary"
              ghost
              icon={<CopyOutlined />}
              onClick={() => copyText(formatCopy(record, copyFormat))}
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

  const renderMobileItem = (item: ImageItem) => (
    <article key={item.sha} className="gallery-mobile-item">
      <div className="gallery-mobile-main">
        <PreviewableImage
          url={item.url}
          rawUrl={item.rawUrl}
          alt={item.name}
          width={72}
          height={72}
          className="gallery-mobile-thumb"
        />
        <div className="gallery-mobile-info">
          <Typography.Text strong className="gallery-mobile-name" ellipsis>
            {item.name}
          </Typography.Text>
          <Typography.Text type="secondary" className="gallery-mobile-size">
            {formatSize(item.size)}
          </Typography.Text>
        </div>
      </div>
      <div className="gallery-mobile-actions">
        <Button
          type="primary"
          ghost
          block
          icon={<CopyOutlined />}
          onClick={() => copyText(formatCopy(item, copyFormat))}
        >
          复制链接
        </Button>
        <Button
          block
          icon={<FileMarkdownOutlined />}
          onClick={() => copyText(formatCopy(item, 'markdown'))}
        >
          MD
        </Button>
        <Popconfirm
          title="确定删除？"
          description="将从仓库永久删除"
          onConfirm={() => handleDelete(item)}
        >
          <Button block danger icon={<DeleteOutlined />}>
            删除
          </Button>
        </Popconfirm>
      </div>
    </article>
  );

  const rowSelection = {
    selectedRowKeys: selectedRows.map(item => item.sha),
    onChange: (_: React.Key[], selectedItems: ImageItem[]) => {
      setSelectedRows(selectedItems);
    },
  };

  return (
    <Card
      className="gallery-card surface-card"
      title={<span className="card-title-text">全部图片（{images.length}）</span>}
      bordered={false}
      extra={
        !isMobile ? (
          <Space wrap className="gallery-toolbar-desktop">
            {copyFormatControl}
            <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
              刷新
            </Button>
          </Space>
        ) : undefined
      }
    >
      {isMobile && (
        <div className="card-toolbar-mobile">
          {copyFormatControl}
          <Button
            className="toolbar-refresh-btn"
            icon={<ReloadOutlined />}
            onClick={load}
            loading={loading}
            block
          >
            刷新列表
          </Button>
        </div>
      )}

      {!isMobile && selectedRows.length > 0 && (
        <div className="gallery-batch-toolbar">
          <span className="gallery-batch-count">已选择 {selectedRows.length} 项</span>
          <Popconfirm
            title="确定批量删除？"
            description={`将永久删除选中的 ${selectedRows.length} 张图片`}
            onConfirm={handleBatchDelete}
          >
            <Button
              danger
              loading={deleting}
              icon={<DeleteOutlined />}
            >
              批量删除
            </Button>
          </Popconfirm>
        </div>
      )}

      <Spin spinning={loading}>
        {images.length === 0 && !loading ? (
          <Empty className="gallery-empty" description="暂无图片，去上传一张吧" />
        ) : isMobile ? (
          <>
            <div className="gallery-mobile-list">
              {mobilePageData.map(renderMobileItem)}
            </div>
            {images.length > 0 && (
              <Pagination
                className="gallery-mobile-pagination"
                current={mobilePage}
                pageSize={MOBILE_PAGE_SIZE}
                total={images.length}
                onChange={setMobilePage}
                hideOnSinglePage={false}
                simple
                showSizeChanger={false}
                size="small"
                showTotal={(total) => `共 ${total} 张`}
              />
            )}
          </>
        ) : (
          <div className="gallery-table-wrap">
            <Table
              rowKey="sha"
              columns={columns}
              dataSource={images}
              loading={loading}
              rowSelection={rowSelection}
              pagination={{
                pageSize: DESKTOP_PAGE_SIZE,
                showSizeChanger: true,
                showTotal: (t) => `共 ${t} 张`,
              }}
              size="middle"
              scroll={{ x: 640 }}
            />
          </div>
        )}
      </Spin>
      <Typography.Paragraph type="secondary" className="gallery-hint">
        Pages 链接在 GitHub Actions 部署完成后生效；Raw 链接上传后立即可用。
      </Typography.Paragraph>
    </Card>
  );
}
