import { useRef, useState } from 'react';
import { InfoCircleOutlined, SearchOutlined } from '@ant-design/icons';
import { DOCTYPE, TemplateAccess } from '@prisma/client';
import {
  Alert,
  Button,
  Drawer,
  Flex,
  Form,
  Input,
  Select,
  Tooltip,
} from 'antd';
import { useNavigate } from 'react-router';

import TiptapEditor from '../../../common/components/TiptapEditor';
import { GenerationMinimumCredit } from '../../../common/constants';
import { useCurrentUser } from '../../../common/contexts/currentUserContext';
import { useLanguage } from '../../../common/contexts/languageContext';
import { getOutOfCreditTitle } from '../../../common/util/app';
import trackEvent from '../../../trackingClient';
import DocumentToolbar from '../../documents/components/DocumentToolbar';
import { DocTypeOptionsSelection } from '../../documents/types/documentTypes';
import { UserTemplateDocumentsPath } from '../../nav/paths';
import { useTemplateDocumentMutation } from '../hooks/useTemplateDocumentMutation';

import './AddTemplateDocument.scss';

type AddTemplateDocumentProps = Readonly<{
  teamId?: string;
  templateCreated?: () => void;
  onSuccess?: () => void;
}>;

type FormValues = {
  name: string;
  description: string;
  access: TemplateAccess;
  type: DOCTYPE;
  promptText: string;
  outputFormat: string;
  sampleInputText: string;
  sampleOutputText: string;
};

export default function AddTemplateDocument({
  templateCreated,
  onSuccess,
}: AddTemplateDocumentProps) {
  const { t } = useLanguage();
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const { user, organization } = useCurrentUser();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [hasGeneratedSampleOutput, setHasGeneratedSampleOutput] =
    useState(false);
  const [form] = Form.useForm<FormValues>();

  const isGenerationLocked =
    (organization?.credits ?? 0) <= GenerationMinimumCredit;

  const chatSessionId = useRef('');
  const docId = useRef('');

  const { addTemplateDocumentMutation } = useTemplateDocumentMutation({
    onSuccess: (templateDocument) => {
      console.log('Successfully created Template Document ', templateDocument);
      setIsSaving(false);
      onSuccess?.();
      templateCreated?.();
      navigate(`/template-documents/${templateDocument.id}`);
    },
    onError: () => {
      console.error('error');
      setIsSaving(false);
    },
  });

  const { createTemplatePromptMutation } = useTemplateDocumentMutation({
    onSuccess: (data) => {
      console.log('Successfully created Template prompt ', data);
      setIsSaving(false);
      form.setFieldValue('promptText', data.promptText as string);
    },
    onError: () => {
      console.error('error');
      setIsSaving(false);
    },
  });

  const { createTemplateSampleOutputMutation } = useTemplateDocumentMutation({
    onSuccess: (data) => {
      console.log('Successfully created Template prompt ', data);
      setIsSaving(false);
      form.setFieldValue('sampleOutputText', data.sampleOutputText as string);
      chatSessionId.current = data.chatSessionId as string;
      docId.current = data.docId as string;
    },
    onError: () => {
      console.error('error');
      setIsSaving(false);
    },
  });

  const { createNewTemplateMutation } = useTemplateDocumentMutation({
    onSuccess: (templateDocument) => {
      console.log('Successfully created Template Document ', templateDocument);
      setIsSaving(false);
      onSuccess?.();
      templateCreated?.();
      navigate(`/template-documents/${templateDocument.id}`);
    },
    onError: () => {
      console.error('error');
      setIsSaving(false);
    },
  });

  async function generateTemplatePrompt() {
    try {
      const values = await form.validateFields();
      console.log('Success:', values);
    } catch (error) {
      console.log('Failed:', error);
      return;
    }

    const { name, description, type } = form.getFieldsValue();
    setIsSaving(true);
    console.log('name,desc,type:', name, description, type);
    createTemplatePromptMutation.mutate({
      name,
      description,
      type,
    });

    // track event
    trackEvent('New Template Prompt', {
      distinct_id: user.email,
      payload: JSON.stringify({
        templateType: type,
        templateName: name,
        description,
      }),
    });
  }

  function generateSampleOutput() {
    const { sampleInputText, promptText, type, name } = form.getFieldsValue();
    setIsSaving(true);
    setHasGeneratedSampleOutput(true);
    console.log(
      'generateSampleOutput.input:',
      promptText,
      type,
      sampleInputText
    );
    createTemplateSampleOutputMutation.mutate({
      sampleInputText,
      promptText,
      type,
      chatSessionId: chatSessionId.current,
    });

    // track event
    trackEvent('New Template Sample Output', {
      distinct_id: user.email,
      payload: JSON.stringify({
        templateType: type,
        name,
        sampleInputText,
      }),
    });
  }

  function generateTemplate() {
    const { promptText, type, name, description } = form.getFieldsValue();

    setIsSaving(true);
    createNewTemplateMutation.mutate(
      { name, description, type, promptText },
      {
        onSuccess: (template) => {
          docId.current = template.id;
          addTemplateDocumentMutation.mutate({
            id: template.id,
            name,
            description,
            type,
            promptText,
          });

          // track
          trackEvent('New Template Created (Initial)', {
            distinct_id: user.email,
            payload: JSON.stringify({
              templateType: type,
              templateName: name,
              description,
            }),
          });
        },
        onError: () => {
          setIsSaving(false);
          alert('Failed to create template.');
        },
      }
    );
  }

  function onSubmit(formValues: FormValues) {
    console.log(formValues);
    const {
      name,
      description,
      type,
      promptText,
      sampleOutputText,
      sampleInputText,
    } = formValues;

    setIsSaving(true);
    addTemplateDocumentMutation.mutate({
      name,
      description,
      access: TemplateAccess.SELF, // default set to self
      type,
      promptText,
      sampleOutputText,
      sampleInputText,
      id: docId.current,
    });
    // track event
    trackEvent('New Template Creation', {
      distinct_id: user.email,
      payload: JSON.stringify({
        templateType: type,
        templateName: name,
        description,
        promptText,
        sampleInputText,
      }),
    });
  }

  const breadcrumbItems = [
    {
      key: 'templates',
      label: t('template.documentTemplates'),
      link: `/${UserTemplateDocumentsPath}`,
    },
    {
      key: 'create',
      label: t('template.create'),
    },
  ];
  return (
    <>
      <DocumentToolbar
        breadcrumbItems={breadcrumbItems}
        docActions={[]}
        hideProgressBar={true}
      />
      <Flex className="add-template-container" vertical>
        <Form
          labelCol={{
            sm: { span: 7 },
            lg: { span: 5 },
          }}
          wrapperCol={{
            sm: { span: 15 },
            lg: { span: 17 },
          }}
          onFinish={onSubmit}
          form={form}
          size="large"
          initialValues={{
            type: DOCTYPE.PRD,
            access: TemplateAccess.SELF,
            name: '',
            description: '',
            promptText: '',
            sampleInputText: '',
            sampleOutputText: '',
          }}
          className="add-template-document-form"
        >
          <Form.Item
            label={t('template.name')}
            name="name"
            rules={[{ required: true, message: t('template.nameRequired') }]}
          >
            <Input placeholder={t('template.namePlaceholder')} />
          </Form.Item>
          <Form.Item
            label={t('template.type')}
            name="type"
            rules={[{ required: true, message: t('template.typeRequired') }]}
          >
            <Select
              style={{ width: 200 }}
              allowClear
              options={DocTypeOptionsSelection.slice(1).filter(
                (item) =>
                  item.value !== DOCTYPE.UI_DESIGN &&
                  item.value !== DOCTYPE.DEVELOPMENT_PLAN &&
                  item.value !== DOCTYPE.PROTOTYPE
              )}
            />
          </Form.Item>
          <Form.Item
            label={t('template.description')}
            name="description"
            tooltip={t('template.descriptionTooltip')}
            rules={[
              {
                required: true,
                message: t('template.descriptionRequired'),
              },
            ]}
          >
            <Input.TextArea
              rows={4}
              placeholder={t('template.descriptionPlaceholder')}
            />
          </Form.Item>
          <Flex justify="center" align="center">
            <Flex
              justify="center"
              gap={32}
              align="flex-start"
              style={{ width: '250px' }}
            >
              {isGenerationLocked && (
                <Tooltip title={getOutOfCreditTitle(organization, t)}>
                  <InfoCircleOutlined style={{ color: 'orange' }} />
                  &nbsp;&nbsp;
                </Tooltip>
              )}
              <Button
                type="primary"
                block
                style={{ flex: 1, padding: '0', marginBottom: '20px' }}
                onClick={generateTemplatePrompt}
                loading={isSaving}
                disabled={isSaving}
              >
                {form.getFieldValue('promptText')
                  ? t('template.regenerateTemplatePrompt')
                  : t('template.generateTemplatePrompt')}
              </Button>
            </Flex>
          </Flex>
          <>
            <Form.Item
              label={t('template.templatePromptLabel')}
              name="promptText"
              tooltip={t('template.templatePromptTooltip')}
              rules={[
                {
                  message: t('template.templatePromptRequired'),
                },
              ]}
            >
              <TiptapEditor
                toolbarHelperText={t('template.toolbarHelperText')}
              />
            </Form.Item>
            <Flex justify="center" align="center">
              <Flex
                justify="center"
                align="flex-start"
                style={{ width: '450px', marginBottom: '40px' }}
                className="buttons-row"
              >
                <Button
                  type="link"
                  block
                  style={{ padding: '0 4px' }}
                  onClick={() => setOpen(true)}
                  disabled={isSaving || !form.getFieldValue('promptText')}
                >
                  <SearchOutlined />
                  {t('template.checkTemplateOutput')}
                </Button>
                <Button
                  type="primary"
                  block
                  style={{ padding: '0 4px' }}
                  onClick={generateTemplate}
                  disabled={isSaving || !form.getFieldValue('promptText')}
                >
                  {t('template.saveTemplate')}
                </Button>
              </Flex>
            </Flex>
          </>
          <Drawer
            title={t('template.checkTemplateOutput')}
            placement="right"
            size="large"
            onClose={() => setOpen(false)}
            open={open}
            className="create-template-drawer"
          >
            {!form.getFieldValue('promptText') && (
              <Alert
                type="error"
                message={t('template.generatePromptFirst')}
                style={{ marginBottom: '20px' }}
              />
            )}
            <Form.Item
              label={t('template.sampleInput')}
              name="sampleInputText"
              tooltip={t('template.sampleInputTooltip')}
              rules={[
                {
                  message: t('template.sampleInputRequired'),
                },
              ]}
            >
              <Input.TextArea
                rows={6}
                style={{ fontSize: '12px' }}
                placeholder={t('template.sampleInputPlaceholder')}
              />
            </Form.Item>
            <Form.Item
              label={t('template.outputDoc')}
              name="sampleOutputText"
              tooltip={t('template.outputDocTooltip')}
              rules={[
                {
                  message: t('template.outputDocRequired'),
                },
              ]}
            >
              <TiptapEditor
                toolbarHelperText={t('template.toolbarHelperTextOutput')}
              />
            </Form.Item>
            <Flex justify="center" align="center">
              <Flex
                justify="center"
                gap={32}
                align="flex-start"
                style={{ width: '250px' }}
              >
                {isGenerationLocked && (
                  <Tooltip title={getOutOfCreditTitle(organization, t)}>
                    <InfoCircleOutlined style={{ color: 'orange' }} />
                    &nbsp;&nbsp;
                  </Tooltip>
                )}
                <Button
                  type="primary"
                  style={{ flex: 1, padding: '0' }}
                  loading={isSaving}
                  disabled={isSaving || !form.getFieldValue('promptText')}
                  onClick={generateSampleOutput}
                >
                  {t('template.generateSampleOutput')}
                </Button>
              </Flex>
            </Flex>
          </Drawer>
        </Form>
      </Flex>
    </>
  );
}
