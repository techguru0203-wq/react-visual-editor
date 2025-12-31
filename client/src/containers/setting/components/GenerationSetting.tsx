import { useEffect, useRef, useState } from 'react';
import { JsonObject } from '@prisma/client/runtime/library';
import { Alert, Button, Flex, Form, InputNumber, Typography } from 'antd';
import { useParams } from 'react-router-dom';

import LanguageSelect from '../../../common/components/LanguageSelect';
import {
  DefaultDocumentGenerateLang,
  DefaultSampleTaskStoryPoint,
  getSampleTask,
} from '../../../common/constants';
import { useCurrentUser } from '../../../common/contexts/currentUserContext';
import { useLanguage } from '../../../common/contexts/languageContext';
import { LoadingScreen } from '../../layout/components/LoadingScreen';
import { useOrganization } from '../../organization/hooks/useOrganization';
import { useUpdateProfileMutation } from '../../profile/hooks/useUpdateProfileMutation';
import useUserProfileQuery from '../../profile/hooks/useUserProfileQuery';

const REQUIRED = { required: true, message: 'required' };

type FormValues = {
  sampleTaskStoryPoint: number;
  documentGenerateLang: string;
};

export default function DevVelocity() {
  const { t } = useLanguage();
  const {
    user: currentUserProfile,
    isAdmin,
    subscriptionTier,
  } = useCurrentUser();
  const { data: organization } = useOrganization();
  const { id: inputId } = useParams();
  const userId = inputId || currentUserProfile.id;
  if (!userId) {
    throw new Error('userId is required');
  }

  const [submitDisabled, setSubmitDisabled] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string>();

  const {
    data: existingProfile,
    isLoading,
    isError,
    isSuccess,
    error,
  } = useUserProfileQuery(userId);

  const updateProfileMutation = useUpdateProfileMutation({
    onSuccess: () => {
      setErrorMsg(undefined);
      setSubmitDisabled(true);
    },
    onError: (error) => setErrorMsg(error.toString()),
  });

  const [form] = Form.useForm<FormValues>();

  let sampleTaskStoryPoint = useRef(DefaultSampleTaskStoryPoint);
  let documentGenerateLang = useRef(DefaultDocumentGenerateLang);

  useEffect(() => {
    if (isAdmin) {
      const orgMeta = organization?.meta as JsonObject;
      if (orgMeta) {
        sampleTaskStoryPoint.current =
          (orgMeta.sampleTaskStoryPoint as number) ||
          sampleTaskStoryPoint.current;
        documentGenerateLang.current =
          (orgMeta.documentGenerateLang as string) ||
          documentGenerateLang.current;
        console.log('sampleTaskStoryPoint:', sampleTaskStoryPoint);
        console.log('documentGenerateLang:', documentGenerateLang);
        form.setFieldsValue({
          sampleTaskStoryPoint: sampleTaskStoryPoint.current,
          documentGenerateLang: documentGenerateLang.current,
        });
      }
    }
  }, [organization, form, isAdmin]);

  if (isError) {
    setErrorMsg(
      'An error occurred while loading the existing profile: ' +
        (error || 'unknown error').toString()
    );
  }

  const onFormValueChanged = () => {
    const hasErrors = form.getFieldsError().some(({ errors }) => errors.length);
    const isDirty = form.isFieldsTouched();
    setSubmitDisabled(!isDirty || hasErrors);
  };

  const onSubmit = (formValues: FormValues) => {
    console.log(
      'updating profile with these values',
      formValues,
      existingProfile
    );
    const { sampleTaskStoryPoint, documentGenerateLang } = formValues;

    const { email, organizationId, username, firstname, lastname } =
      existingProfile!;

    if (!sampleTaskStoryPoint || !documentGenerateLang) {
      setErrorMsg('Please fill in all required values');
    } else {
      updateProfileMutation.mutate({
        id: userId,
        organizationId,
        email,
        username,
        firstname,
        lastname,
        sampleTaskStoryPoint,
        documentGenerateLang,
      });
    }
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAdmin) {
    return (
      <div style={{ color: 'red' }}>
        <h1>Unauthorized</h1>
        <p>You are not authorized to view this page.</p>
      </div>
    );
  }

  const MultilineText = ({ text }: { text: string }) => {
    const lines = text.split('\n'); // Split the text by line breaks
    return (
      <Typography>
        {lines.map((line: string, index: number) => (
          <Typography.Paragraph key={index}>{line}</Typography.Paragraph>
        ))}
      </Typography>
    );
  };

  return (
    <Flex className="profile-form">
      <Form
        form={form}
        name="UserProfile"
        onFieldsChange={onFormValueChanged}
        onFinish={onSubmit}
        autoComplete="off"
        disabled={isLoading || !isSuccess}
      >
        <Typography.Paragraph>
          <pre>
            {t('generation.estimateStoryPoints')}
          </pre>
        </Typography.Paragraph>

        <Form.Item label={t('generation.sampleTaskDescription')}>
          <MultilineText text={getSampleTask(t)} />
        </Form.Item>
        <Form.Item
          label={t('generation.sampleTaskStoryPoint')}
          name="sampleTaskStoryPoint"
          tooltip={t('generation.baselineStoryPoint')}
          rules={[REQUIRED]}
        >
          <InputNumber
            placeholder={t('generation.enterStoryPoint')}
            style={{ width: '100%' }}
          />
        </Form.Item>
        <Form.Item
          label={t('generation.documentGenerateLanguage')}
          name="documentGenerateLang"
          tooltip={t('generation.selectLanguage')}
          rules={[REQUIRED]}
          hidden={true}
        >
          <LanguageSelect style={{ width: '100%' }} />
        </Form.Item>
        {errorMsg && (
          <Form.Item
            wrapperCol={{
              xs: { offset: 0, span: 24 },
              sm: { offset: 8, span: 16 },
            }}
          >
            <Alert type="error" message={errorMsg} />
          </Form.Item>
        )}
        <Form.Item
          wrapperCol={{
            xs: { offset: 0, span: 24 },
            sm: { offset: 8, span: 16 },
          }}
        >
          <Button
            type="primary"
            htmlType="submit"
            disabled={submitDisabled}
            loading={updateProfileMutation.isLoading}
          >
            Save
          </Button>
        </Form.Item>
      </Form>
    </Flex>
  );
}
