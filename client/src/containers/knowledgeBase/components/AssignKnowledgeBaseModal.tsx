import { useState, useEffect } from 'react';
import { Modal, Form, Select, message, Spin } from 'antd';
import { useLanguage } from '../../../common/contexts/languageContext';
import {
  linkProjectToKnowledgeBaseApi,
  unlinkProjectFromKnowledgeBaseApi,
  getKnowledgeBaseByIdApi,
  KnowledgeBase,
} from '../api/knowledgeBaseApi';
import { useOrganizationHierarchy } from '../../organization/hooks/useOrganizationHierarchy';
import { useQuery } from '@tanstack/react-query';

interface AssignKnowledgeBaseModalProps {
  open: boolean;
  knowledgeBase: KnowledgeBase;
  onCancel: () => void;
  onSuccess: () => void;
}

export function AssignKnowledgeBaseModal({
  open,
  knowledgeBase,
  onCancel,
  onSuccess,
}: AssignKnowledgeBaseModalProps) {
  const { t } = useLanguage();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const { data: organization, isLoading: isLoadingOrg } =
    useOrganizationHierarchy();

  // Fetch current project assignments for this knowledge base
  const { data: currentKb, isLoading: isLoadingKb } = useQuery({
    queryKey: ['knowledgeBase', knowledgeBase.id],
    queryFn: () => getKnowledgeBaseByIdApi(knowledgeBase.id),
    enabled: open && !!knowledgeBase.id,
  });

  const currentProjectIds =
    (currentKb as any)?.projectLinks
      ?.map((link: any) => link.project?.id)
      .filter(Boolean) || [];

  useEffect(() => {
    if (open && organization && currentKb) {
      form.setFieldsValue({
        projectIds: currentProjectIds,
      });
    }
  }, [open, organization, currentKb, currentProjectIds, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const selectedProjectIds: string[] = values.projectIds || [];
      setLoading(true);

      // Get current project IDs from the knowledge base
      const currentIds = currentProjectIds;

      // Find projects to link (in selected but not in current)
      const toLink = selectedProjectIds.filter(
        (id: string) => !currentIds.includes(id)
      );
      // Find projects to unlink (in current but not in selected)
      const toUnlink = currentIds.filter(
        (id: string) => !selectedProjectIds.includes(id)
      );

      // Perform link/unlink operations
      await Promise.all([
        ...toLink.map((projectId: string) =>
          linkProjectToKnowledgeBaseApi(knowledgeBase.id, projectId)
        ),
        ...toUnlink.map((projectId: string) =>
          unlinkProjectFromKnowledgeBaseApi(knowledgeBase.id, projectId)
        ),
      ]);

      message.success(
        t('knowledgeBase.assignSuccess') || 'Projects assigned successfully'
      );
      onSuccess();
    } catch (error: any) {
      console.error('Error assigning projects:', error);
      message.error(
        error.message ||
          t('knowledgeBase.assignError') ||
          'Failed to assign projects'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  if (isLoadingOrg || isLoadingKb) {
    return (
      <Modal
        title={t('knowledgeBase.assignToProject') || 'Assign to Project'}
        open={open}
        onCancel={handleCancel}
        footer={null}
      >
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" />
        </div>
      </Modal>
    );
  }

  const projects = organization?.projects || [];

  return (
    <Modal
      title={t('knowledgeBase.assignToProject') || 'Assign to Project'}
      open={open}
      onOk={handleSubmit}
      onCancel={handleCancel}
      confirmLoading={loading}
      okText={t('common.save')}
      cancelText={t('common.cancel')}
      className="app-modal-with-footer"
    >
      <Form form={form} layout="vertical" style={{ marginTop: '16px' }}>
        <Form.Item
          name="projectIds"
          label={t('knowledgeBase.selectProjects') || 'Select Projects'}
        >
          <Select
            mode="multiple"
            showSearch
            placeholder={
              projects.length === 0
                ? t('knowledgeBase.noProjectsAvailable') ||
                  'No projects available'
                : t('knowledgeBase.selectProjects') || 'Select Projects'
            }
            optionFilterProp="label"
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            style={{ width: '100%' }}
            disabled={projects.length === 0}
            options={projects.map((project) => ({
              value: project.id,
              label: project.name,
            }))}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
