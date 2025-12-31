import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Form, Input, message, Rate } from 'antd';

import { useLanguage } from '../../../common/contexts/languageContext';
import { submitFeedbackApi } from '../api/feedbackApi';

const { TextArea } = Input;

interface FeedbackFormProps {
  onSuccess: () => void;
  onCancel?: () => void;
}

export function FeedbackForm({ onSuccess, onCancel }: FeedbackFormProps) {
  const { t } = useLanguage();
  const [form] = Form.useForm();
  const [npsScore, setNpsScore] = useState<number>(0);
  const queryClient = useQueryClient();

  const submitMutation = useMutation({
    mutationFn: submitFeedbackApi,
    onSuccess: () => {
      message.success(t('feedback.submitSuccess'));
      // Clear the dismissed flag so modal won't show again
      localStorage.removeItem('feedbackModalDismissed');
      // Invalidate the feedback check query to hide the button
      queryClient.invalidateQueries({ queryKey: ['FEEDBACK_CHECK'] });
      onSuccess();
    },
    onError: (error: Error) => {
      message.error(error.message || t('feedback.submitError'));
    },
  });

  const handleCancel = () => {
    // Mark as dismissed so floating button shows
    localStorage.setItem('feedbackModalDismissed', 'true');
    if (onCancel) {
      onCancel();
    } else {
      onSuccess();
    }
  };

  const handleSubmit = async (values: { likes: string; dislikes: string }) => {
    await submitMutation.mutateAsync({
      npsScore,
      likes: values.likes,
      dislikes: values.dislikes,
    });
  };

  const slackMessage = t('feedback.slackMessage');
  const slackUrl =
    'https://join.slack.com/t/omniflow-group/shared_invite/zt-2p2s2f1qo-mzt18hQIKzhegEPExub40g';

  // Split the message to insert a link for "#user-support" (English) or "#user-support" (Chinese)
  const renderSlackMessage = () => {
    // Try English first
    if (slackMessage.includes('#user-support')) {
      const parts = slackMessage.split('#user-support');
      if (parts.length === 2) {
        return (
          <>
            {parts[0]}
            <a
              href={slackUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: '#5345F3',
                textDecoration: 'underline',
                fontWeight: 600,
              }}
            >
              #user-support
            </a>
            {parts[1]}
          </>
        );
      }
    }
    // Try Chinese
    if (slackMessage.includes('#user-support')) {
      const parts = slackMessage.split('#user-support');
      if (parts.length === 2) {
        return (
          <>
            {parts[0]}
            <a
              href={slackUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: '#5345F3',
                textDecoration: 'underline',
                fontWeight: 600,
              }}
            >
              #user-support
            </a>
            {parts[1]}
          </>
        );
      }
    }
    return slackMessage;
  };

  return (
    <>
      <div
        style={{
          padding: '16px',
          backgroundColor: '#F5EBFF',
          border: '1px solid #5345F3',
          borderRadius: '6px',
          marginBottom: 24,
          fontSize: 15,
          fontWeight: 500,
          color: '#5345F3',
          lineHeight: '1.6',
        }}
      >
        {renderSlackMessage()}
      </div>
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        style={{ marginTop: 16 }}
      >
        <Form.Item
          label={t('feedback.npsQuestion')}
          required
          style={{ marginBottom: 24 }}
          rules={[
            {
              validator: () => {
                if (npsScore === 0) {
                  return Promise.reject(new Error(t('feedback.pleaseRate')));
                }
                return Promise.resolve();
              },
            },
          ]}
        >
          <div>
            <div
              className="feedback-rate-wrapper"
              style={{ display: 'flex', justifyContent: 'center' }}
            >
              <Rate
                count={10}
                value={npsScore}
                onChange={setNpsScore}
                style={{ fontSize: 24 }}
              />
            </div>
            <style>{`
              .feedback-rate-wrapper .ant-rate-star-second {
                color: #d3d3d3 !important;
              }
              .feedback-rate-wrapper .ant-rate-star {
                color: #d3d3d3 !important;
              }
              .feedback-rate-wrapper .ant-rate-star.ant-rate-star-full {
                color: #d3d3d3 !important;
              }
              .feedback-rate-wrapper .ant-rate-star.ant-rate-star-zero {
                color: #d3d3d3 !important;
              }
              /* When wrapper is hovered, make all stars yellow by default */
              .feedback-rate-wrapper:hover .ant-rate-star,
              .feedback-rate-wrapper:hover .ant-rate-star .ant-rate-star-second,
              .feedback-rate-wrapper:hover .ant-rate-star .ant-rate-star-first {
                color: #fadb14 !important;
              }
              /* Keep stars to the right of hovered star lightgray */
              .feedback-rate-wrapper:hover .ant-rate-star:hover ~ .ant-rate-star,
              .feedback-rate-wrapper:hover .ant-rate-star:hover ~ .ant-rate-star .ant-rate-star-second,
              .feedback-rate-wrapper:hover .ant-rate-star:hover ~ .ant-rate-star .ant-rate-star-first {
                color: #d3d3d3 !important;
              }
            `}</style>
            <div
              style={{
                marginTop: 8,
                fontSize: 12,
                color: '#666',
                textAlign: 'center',
              }}
            >
              {npsScore === 0 && (
                <span>
                  {t('feedback.npsScale')}: 1 - {t('feedback.veryUnlikely')}, 10
                  - {t('feedback.veryLikely')}
                </span>
              )}
              {npsScore > 0 && (
                <span>
                  {npsScore}/10 -{' '}
                  {npsScore <= 3
                    ? t('feedback.veryUnlikely')
                    : npsScore <= 6
                      ? t('feedback.neutral')
                      : npsScore <= 8
                        ? t('feedback.likely')
                        : t('feedback.veryLikely')}
                </span>
              )}
            </div>
          </div>
        </Form.Item>

        <Form.Item
          label={t('feedback.whatYouLike')}
          name="likes"
          required
          style={{ marginBottom: 24 }}
          rules={[
            {
              required: true,
              message:
                t('feedback.whatYouLikeRequired') ||
                'Please tell us what you like about Omniflow',
            },
          ]}
        >
          <TextArea
            rows={4}
            placeholder={t('feedback.whatYouLikePlaceholder')}
            maxLength={1000}
            showCount
          />
        </Form.Item>

        <Form.Item
          label={t('feedback.whatYouDontLike')}
          name="dislikes"
          required
          style={{ marginBottom: 24 }}
          rules={[
            {
              required: true,
              message:
                t('feedback.whatYouDontLikeRequired') ||
                'Please tell us what you do not like about Omniflow',
            },
          ]}
        >
          <TextArea
            rows={4}
            placeholder={t('feedback.whatYouDontLikePlaceholder')}
            maxLength={1000}
            showCount
          />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={handleCancel}>{t('common.cancel')}</Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={submitMutation.isLoading}
            >
              {t('feedback.submit')}
            </Button>
          </div>
        </Form.Item>
      </Form>
    </>
  );
}
