import { useState } from 'react';
import { Button, DatePicker, Form, Input, Select, Tooltip } from 'antd';
import dayjs from 'dayjs';

import { ProjectOutput } from '../../../../../shared/types';
import { SelectTeamUser } from '../../../common/components/SelectTeamUser';
import { getProjectAccessOptions } from '../../../common/constants';
import { useLanguage } from '../../../common/contexts/languageContext';
import { useProjectAccessQuery } from '../../../common/hooks/useProjectsQuery';
import { useUpdateProjectMutation } from '../hooks/useProjectMutation';

import './EditProject.scss';

type EditProjectProps = Readonly<{
  project: ProjectOutput;
  teamId?: string;
  onSuccess: () => void;
}>;

export default function EditProject({
  project,
  teamId,
  onSuccess,
}: EditProjectProps) {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const projectId = project.id;
  const { t } = useLanguage();
  const { data: access } = useProjectAccessQuery(projectId);
  const isReadOnly = access?.projectPermission === 'VIEW';

  function onMutationSuccess() {
    console.log('container.project.components.EditProject.onMutationSuccess');
    onSuccess();
    setIsLoading(false);
  }

  function onMutationError(err: string) {
    console.error(
      'containers.project.components.EditProject.onMutationError',
      err
    );
    setIsLoading(false);
  }

  const { updateProjectMutation } = useUpdateProjectMutation({
    onSuccess: onMutationSuccess,
    onError: onMutationError,
  });

  function onSubmit(values: any) {
    let { name, description, dueDate, ownerUserId, access } = values;
    updateProjectMutation.mutate({
      projectId,
      name,
      description,
      ownerUserId,
      access,
      dueDate: dueDate.format('MM-DD-YYYY'),
    });
    setIsLoading(true);
  }

  return (
    <Form
      labelCol={{ span: 6 }}
      wrapperCol={{ span: 16 }}
      onFinish={onSubmit}
      autoComplete="off"
      size="large"
      disabled={isLoading}
      initialValues={{
        ownerUserId: project.ownerUserId,
        name: project.name,
        description: project.description,
        dueDate: dayjs(project.dueDate),
        access: project.access,
      }}
      className="edit-project-form"
    >
      <Form.Item
        label={t('project.name')}
        name="name"
        rules={[{ required: true, message: t('project.projectNameRequired') }]}
      >
        <Input placeholder={t('project.enterProjectName')} />
      </Form.Item>

      <Form.Item
        label={t('project.access')}
        name="access"
        rules={[
          {
            required: true,
            message: t('project.accessRequired'),
          },
        ]}
      >
        <Select options={getProjectAccessOptions(t)} />
      </Form.Item>

      <Form.Item
        label={t('project.owner')}
        name="ownerUserId"
        rules={[{ required: true, message: t('project.ownerRequired') }]}
      >
        <SelectTeamUser
          teamId={teamId}
          placeholder={t('project.selectOwner')}
          secondaryInformation={[]}
        />
      </Form.Item>

      <Form.Item label={t('project.deliveryDate')} name="dueDate">
        <DatePicker
          mode="month"
          picker="month"
          style={{ width: '100%' }}
          disabledDate={(current) => current && current < dayjs().endOf('day')}
        />
      </Form.Item>

      <Form.Item label={t('project.description')} name="description">
        <Input.TextArea placeholder={t('project.enterProjectDescription')} />
      </Form.Item>

      <Form.Item wrapperCol={{ span: 24 }} style={{ textAlign: 'center' }}>
        <Tooltip
          title={
            isReadOnly
              ? t('project.viewOnlyAccess')
              : t('project.updateProject')
          }
        >
          <Button
            type="primary"
            htmlType="submit"
            loading={isLoading}
            disabled={isReadOnly}
          >
            {t('project.updateProject')}
          </Button>
        </Tooltip>
      </Form.Item>
    </Form>
  );
}
