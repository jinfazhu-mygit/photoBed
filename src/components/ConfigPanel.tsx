import { Button, Card, Form, Input, Space, Typography, message } from 'antd';
import { useEffect } from 'react';
import type { StoredConfig } from '../utils/storage';
import { clearConfig, saveConfig } from '../utils/storage';

interface Props {
  initial: StoredConfig;
  onSave: (config: StoredConfig) => void;
}

export default function ConfigPanel({ initial, onSave }: Props) {
  const [form] = Form.useForm<StoredConfig>();

  useEffect(() => {
    form.setFieldsValue(initial);
  }, [form, initial]);

  const handleSave = (values: StoredConfig) => {
    saveConfig(values);
    onSave(values);
    message.success('配置已保存');
  };

  const handleClear = () => {
    clearConfig();
    form.resetFields();
    onSave({ owner: '', repo: '', branch: 'main', imagesDir: 'images', token: '' });
    message.info('已清除本地配置');
  };

  return (
    <Card title="GitHub 配置" size="small">
      <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
        图片通过 GitHub Contents API 提交到仓库的 <code>images/</code> 目录，由 GitHub Pages
        提供访问。Token 需具备 <code>repo</code> 权限，仅保存在浏览器本地。
      </Typography.Paragraph>
      <Form form={form} layout="vertical" onFinish={handleSave}>
        <Form.Item name="owner" label="用户名 / 组织" rules={[{ required: true }]}>
          <Input placeholder="例如: octocat" />
        </Form.Item>
        <Form.Item name="repo" label="仓库名" rules={[{ required: true }]}>
          <Input placeholder="例如: photoBed" />
        </Form.Item>
        <Form.Item name="branch" label="分支" rules={[{ required: true }]}>
          <Input placeholder="main" />
        </Form.Item>
        <Form.Item name="imagesDir" label="图片目录" rules={[{ required: true }]}>
          <Input placeholder="images" />
        </Form.Item>
        <Form.Item
          name="token"
          label="Personal Access Token"
          rules={[{ required: true, message: '请输入 Token' }]}
          extra="GitHub → Settings → Developer settings → Personal access tokens"
        >
          <Input.Password placeholder="ghp_..." />
        </Form.Item>
        <Space>
          <Button type="primary" htmlType="submit">
            保存配置
          </Button>
          <Button onClick={handleClear}>清除</Button>
        </Space>
      </Form>
    </Card>
  );
}
