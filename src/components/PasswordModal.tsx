import { LockOutlined } from '@ant-design/icons';
import { Button, Input, Modal, Typography } from 'antd';
import { useState } from 'react';

const ADMIN_PASSWORD = 'zzfPhotoBed';

interface Props {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
}

export default function PasswordModal({ visible, onCancel, onConfirm, title, description }: Props) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleOk = () => {
    if (password.trim() === ADMIN_PASSWORD) {
      setError('');
      setPassword('');
      onConfirm();
    } else {
      setError('密码错误，请重试');
    }
  };

  const handleCancel = () => {
    setPassword('');
    setError('');
    onCancel();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleOk();
    }
  };

  return (
    <Modal
      open={visible}
      title={title || '身份验证'}
      onCancel={handleCancel}
      footer={[
        <Button key="back" onClick={handleCancel}>
          取消
        </Button>,
        <Button key="submit" type="primary" onClick={handleOk}>
          确认
        </Button>,
      ]}
      className="password-modal"
    >
      <div className="password-modal-content">
        <div className="password-modal-icon">
          <LockOutlined />
        </div>
        <Typography.Paragraph className="password-modal-desc">
          {description || '请输入管理员密码以确认操作'}
        </Typography.Paragraph>
        <Input.Password
          placeholder="请输入管理员密码"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError('');
          }}
          onKeyPress={handleKeyPress}
          className="password-input"
          autoFocus
        />
        {error && (
          <Typography.Text type="danger" className="password-error">
            {error}
          </Typography.Text>
        )}
      </div>
    </Modal>
  );
}
