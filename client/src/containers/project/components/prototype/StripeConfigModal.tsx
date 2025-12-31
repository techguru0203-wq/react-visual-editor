import { useState } from 'react';
import { Button, Form, Input, message } from 'antd';

import { toBaseVercelHost } from '../../../../shared/utils';
import { setupStripeWebhookOnServer } from '../../api/stripeApi';
import { getVercelProjectInfo, updateVercelEnvVars } from '../../api/vercelApi';

import { useLanguage } from '../../../../common/contexts/languageContext';

interface StripeConfigModalProps {
  visible: boolean;
  onClose: () => void;
  projectId: string;
  title: string;
  stripeSecretKey?: string;
  stripePublishableKey?: string;
  deployDocId: string;
  userDomain: string;
}

export const StripeConfigModal: React.FC<
  Omit<StripeConfigModalProps, 'visible'>
> = ({
  onClose,
  deployDocId,
  stripeSecretKey = '',
  stripePublishableKey = '',
  userDomain,
}) => {
  const { t } = useLanguage();
  const [secretKey, setSecretKey] = useState(stripeSecretKey);
  const [publishableKey, setPublishableKey] = useState(stripePublishableKey);
  const [loading, setLoading] = useState(false);
  const handleSave = async () => {
    setLoading(true);
    if (!userDomain) {
      message.error(t('message.generateFirst'));
      return;
    }
    try {
      //get base vercel host
      userDomain = toBaseVercelHost(userDomain);

      const projectInfo = await getVercelProjectInfo(deployDocId);
      // Check if projectInfo is valid
      if (!projectInfo || !projectInfo.id) {
        console.error('project not found. Please check deployDocId.');
        return;
      }
      // Setup Stripe webhook
      const result = await setupStripeWebhookOnServer({
        secretKey,
        userDomain,
      });
      console.log('Stripe webhook setup result:', result);
      if (!result?.success) {
        throw new Error(result?.message || 'Failed to setup Stripe webhook');
      }
      const createdNew = Boolean(result.signingSecret);
      if (createdNew && result.signingSecret) {
        await updateVercelEnvVars(deployDocId, [
          { key: 'STRIPE_SECRET_KEY', value: secretKey },
          { key: 'VITE_STRIPE_PUBLISHABLE_KEY', value: publishableKey },
          { key: 'STRIPE_WEBHOOK_SECRET', value: result.signingSecret },
          { key: 'FRONTEND_URL', value: userDomain },
        ]);
      }
      onClose();
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        console.error('project not found. Please check deployDocId.');
      } else {
        console.error('Failed to update Vercel env vars:', error);
        message.error('Failed to update Stripe keys.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form layout="vertical">
      <Form.Item label="Stripe Secret Key">
        <Input
          value={secretKey}
          onChange={(e) => setSecretKey(e.target.value)}
          placeholder="Enter your stripe secret key in the format of sk_live_..."
        />
      </Form.Item>
      <Form.Item label="Stripe Publishable Key">
        <Input
          value={publishableKey}
          onChange={(e) => setPublishableKey(e.target.value)}
          placeholder="Enter your stripe publishable key in the format of pk_live_..."
        />
      </Form.Item>
      <div style={{ textAlign: 'right' }}>
        <Button onClick={onClose} style={{ marginRight: 8 }}>
          Cancel
        </Button>
        <Button type="primary" loading={loading} onClick={handleSave}>
          Save
        </Button>
      </div>
    </Form>
  );
};
