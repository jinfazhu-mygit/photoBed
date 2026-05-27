import { CloudOutlined, PictureOutlined, UploadOutlined } from '@ant-design/icons';
import { Alert, Layout, Tabs, Typography } from 'antd';
import { useState } from 'react';
import ImageGallery from './components/ImageGallery';
import ImageUpload from './components/ImageUpload';
import { isConfigReady } from './config';
import { useIsMobile } from './hooks/useIsMobile';

const { Header, Content, Footer } = Layout;

export default function App() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState('upload');
  const configReady = isConfigReady();
  const isMobile = useIsMobile();

  const items = [
    {
      key: 'upload',
      label: (
        <span className="tab-label">
          <UploadOutlined />
          <span>上传</span>
        </span>
      ),
      children: <ImageUpload onUploaded={() => setRefreshKey((k) => k + 1)} />,
    },
    {
      key: 'gallery',
      label: (
        <span className="tab-label">
          <PictureOutlined />
          <span>图库</span>
        </span>
      ),
      children: <ImageGallery refreshKey={refreshKey} />,
    },
  ];

  return (
    <Layout className="app-layout">
      <Header className="app-header">
        <div className="app-header-inner">
          <div className="app-brand">
            <div className="app-logo" aria-hidden>
              <CloudOutlined />
            </div>
            <div className="app-brand-text">
              <Typography.Title level={4} className="app-title">
                PhotoBed
              </Typography.Title>
              <Typography.Text className="app-subtitle">GitHub 图床</Typography.Text>
            </div>
          </div>
        </div>
      </Header>

      <Content className="app-content">
        {!configReady && (
          <Alert
            type="warning"
            showIcon
            className="config-alert surface-card"
            message="环境变量未配置"
            description="请在 GitHub 仓库 Settings → Secrets 添加 VITE_GITHUB_TOKEN，并在 workflow 中配置仓库信息后再部署。"
          />
        )}
        <Tabs
          className="app-tabs"
          items={items}
          activeKey={activeTab}
          onChange={setActiveTab}
          size={isMobile ? 'middle' : 'large'}
          centered={isMobile}
          destroyInactiveTabPane={false}
        />
      </Content>

      <Footer className="app-footer">
        <span>图片存储于 GitHub 仓库</span>
        <span className="app-footer-dot" aria-hidden>
          ·
        </span>
        <span>由 GitHub Pages 提供访问</span>
      </Footer>
    </Layout>
  );
}
