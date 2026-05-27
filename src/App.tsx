import { Layout, Tabs, Typography } from 'antd';
import { useMemo, useState } from 'react';
import ConfigPanel from './components/ConfigPanel';
import ImageGallery from './components/ImageGallery';
import ImageUpload from './components/ImageUpload';
import { isConfigValid } from './services/github';
import type { GitHubConfig } from './types';
import { getDefaultConfig } from './utils/storage';
import type { StoredConfig } from './utils/storage';

const { Header, Content } = Layout;

function toGitHubConfig(stored: StoredConfig): GitHubConfig | null {
  const config: GitHubConfig = {
    owner: stored.owner.trim(),
    repo: stored.repo.trim(),
    branch: stored.branch.trim() || 'main',
    token: stored.token?.trim() || '',
    imagesDir: stored.imagesDir.trim() || 'images',
  };
  return isConfigValid(config) ? config : null;
}

export default function App() {
  const [stored, setStored] = useState<StoredConfig>(() => getDefaultConfig());
  const [refreshKey, setRefreshKey] = useState(0);
  const config = useMemo(() => toGitHubConfig(stored), [stored]);

  const items = [
    {
      key: 'upload',
      label: '上传',
      children: config ? (
        <ImageUpload config={config} onUploaded={() => setRefreshKey((k) => k + 1)} />
      ) : (
        <Typography.Text type="warning">请先在「配置」中填写并保存 GitHub 信息</Typography.Text>
      ),
    },
    {
      key: 'gallery',
      label: '图库',
      children: config ? (
        <ImageGallery config={config} refreshKey={refreshKey} />
      ) : (
        <Typography.Text type="warning">请先在「配置」中填写并保存 GitHub 信息</Typography.Text>
      ),
    },
    {
      key: 'config',
      label: '配置',
      children: <ConfigPanel initial={stored} onSave={setStored} />,
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center' }}>
        <Typography.Title level={4} style={{ color: '#fff', margin: 0 }}>
          PhotoBed 图床
        </Typography.Title>
      </Header>
      <Content style={{ padding: 24, maxWidth: 1100, margin: '0 auto', width: '100%' }}>
        <Tabs items={items} />
      </Content>
    </Layout>
  );
}
