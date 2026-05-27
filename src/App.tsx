import { PictureOutlined, UploadOutlined } from '@ant-design/icons';
import { Alert, Layout, Tabs, Typography } from 'antd';
import { useState } from 'react';
import ImageGallery from './components/ImageGallery';
import ImageUpload from './components/ImageUpload';
import { isConfigReady } from './config';

const { Header, Content, Footer } = Layout;

export default function App() {
  const [refreshKey, setRefreshKey] = useState(0);
  const configReady = isConfigReady();

  const items = [
    {
      key: 'upload',
      label: (
        <span>
          <UploadOutlined /> 上传
        </span>
      ),
      children: <ImageUpload onUploaded={() => setRefreshKey((k) => k + 1)} />,
    },
    {
      key: 'gallery',
      label: (
        <span>
          <PictureOutlined /> 图库
        </span>
      ),
      children: <ImageGallery refreshKey={refreshKey} />,
    },
  ];

  return (
    <Layout className="app-layout">
      <Header className="app-header">
        <div className="app-header-inner">
          <Typography.Title level={4} className="app-title">
            PhotoBed
          </Typography.Title>
          <Typography.Text className="app-subtitle">GitHub 图床</Typography.Text>
        </div>
      </Header>

      <Content className="app-content">
        {!configReady && (
          <Alert
            type="warning"
            showIcon
            className="config-alert"
            message="环境变量未配置"
            description="请在 GitHub 仓库 Settings → Secrets 添加 VITE_GITHUB_TOKEN，并在 workflow 中配置仓库信息后再部署。"
          />
        )}
        <Tabs className="app-tabs" items={items} size="large" />
      </Content>

      <Footer className="app-footer">
        图片存储于 GitHub 仓库 · 由GitHub Pages提供访问
      </Footer>
    </Layout>
  );
}
