import { InboxOutlined } from '@ant-design/icons';
import { Alert, Button, Input, Space, Upload, message } from 'antd';
import type { UploadProps } from 'antd';
import { useState } from 'react';
import { uploadImage } from '../services/github';
import type { GitHubConfig, UploadResult } from '../types';

interface Props {
  config: GitHubConfig;
  onUploaded: (result: UploadResult) => void;
}

export default function ImageUpload({ config, onUploaded }: Props) {
  const [uploading, setUploading] = useState(false);
  const [customName, setCustomName] = useState('');

  const doUpload = async (file: File) => {
    setUploading(true);
    try {
      const result = await uploadImage(config, file, customName || undefined);
      message.success(`上传成功: ${result.name}`);
      onUploaded(result);
      setCustomName('');
      return result;
    } catch (err) {
      message.error(err instanceof Error ? err.message : '上传失败');
      throw err;
    } finally {
      setUploading(false);
    }
  };

  const props: UploadProps = {
    name: 'file',
    multiple: true,
    showUploadList: false,
    accept: 'image/*',
    disabled: uploading,
    beforeUpload: (file) => {
      doUpload(file as File);
      return false;
    },
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <Alert
        type="info"
        showIcon
        message="上传后图片会提交到 GitHub 仓库，部署完成后可通过 GitHub Pages 链接访问。"
      />
      <Input
        placeholder="自定义文件名（可选，不含路径）"
        value={customName}
        onChange={(e) => setCustomName(e.target.value)}
        disabled={uploading}
      />
      <Upload.Dragger {...props}>
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">点击或拖拽图片到此处上传</p>
        <p className="ant-upload-hint">支持多图，格式：jpg、png、gif、webp 等</p>
      </Upload.Dragger>
      {uploading && (
        <Button type="primary" loading block>
          正在上传到 GitHub…
        </Button>
      )}
    </Space>
  );
}
