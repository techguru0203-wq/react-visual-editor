import { useState } from 'react';
import { Access } from '@prisma/client';
import { Button, DatePicker, Flex, Form, Input, Typography } from 'antd';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router';

import { useAppModal } from '../../../common/components/AppModal';
import { FREE_PROJECT_LIMIT } from '../../../common/constants';
import { useCurrentUser } from '../../../common/contexts/currentUserContext';
import { useLanguage } from '../../../common/contexts/languageContext';
import { useOrganizationHierarchy } from '../../organization/hooks/useOrganizationHierarchy';
import useUserProfileQuery from '../../profile/hooks/useUserProfileQuery';
import { useAddProjectMutation } from '../hooks/useProjectMutation';

import './AddProject.scss';

type AddProjectProps = Readonly<{
  teamId?: string;
  onSuccess: () => void;
}>;

export default function AddProject({ teamId, onSuccess }: AddProjectProps) {
  const { user } = useCurrentUser();
  const { t } = useLanguage();
  const { data: userProfile } = useUserProfileQuery(user.id);
  console.log('userProfile', userProfile);
  const { data: organization } = useOrganizationHierarchy();

  const { showAppModal } = useAppModal();

  const numProjects = organization?.projects.length ?? 0;
  const isLimitReached = numProjects >= FREE_PROJECT_LIMIT;

  // const numberProjectsThisWeek = organization?.projects.filter((project) =>
  //   dayjs(project.createdAt).isAfter(dayjs().subtract(7, 'days'))
  // ).length;

  const isFeatureLocked = isLimitReached && !userProfile?.subscriptionTier;
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const navigate = useNavigate();
  const { createProjectMutation } = useAddProjectMutation({
    onSuccess: (project) => {
      console.log('Successfully created project', project);
      onSuccess();
      setIsSaving(false);
      navigate(`/projects/${project.id}/planning/builder`);
    },
    onError: () => {
      console.error('error');
      setIsSaving(false);
    },
  });

  function onSubmit(values: any) {
    let { name, description, dueDate, ownerUserId } = values;
    dueDate = dayjs(dueDate).endOf('month');

    createProjectMutation.mutate({
      name,
      description,
      access: Access.SELF,
      dueDate: dueDate?.format('MM/DD/YYYY'),
      teamId,
      ownerUserId,
    });
    setIsSaving(true);
  }

  return (
    <>
      <Form
        labelCol={{ span: 8 }}
        wrapperCol={{ span: 15 }}
        onFinish={onSubmit}
        autoComplete="off"
        size="large"
        disabled={isSaving}
        initialValues={{ ownerUserId: user.id, access: Access.SELF }}
        className="add-project-form"
      >
        <Form.Item
          label="Name"
          name="name"
          rules={[{ required: true, message: 'Please specify a project name' }]}
        >
          <Input placeholder="Enter project name" />
        </Form.Item>
        {/* <Form.Item
          label="Access"
          name="access"
          rules={[
            {
              required: true,
              message: 'Please select who can access the project',
            },
          ]}
        >
          <Select options={generalAccessOptions} />
        </Form.Item> */}
        {/* <Form.Item
          label="Owner"
          name="ownerUserId"
          rules={[{ required: true, message: 'Please select a project owner' }]}
        >
          <SelectTeamUser
            teamId={teamId}
            placeholder="Select an owner"
            secondaryInformation={[]}
          />
        </Form.Item> */}

        <Form.Item
          label="Target month"
          name="dueDate"
          rules={[
            {
              required: true,
              message: 'Please specify the month the project is due',
            },
          ]}
          tooltip="Please pick a month for when the project is due. The actual projected delivery date will be shown after Dev Plan creation."
        >
          <DatePicker
            size="large"
            mode="month"
            picker="month"
            style={{ width: '100%' }}
            disabledDate={(current) =>
              current && current < dayjs().startOf('month')
            }
          />
        </Form.Item>

        {/* <Form.Item label="Description" name="description">
          <TextArea placeholder="Enter project description" />
        </Form.Item> */}

        <Form.Item wrapperCol={{ span: 24 }} style={{ textAlign: 'center' }}>
          <Button
            type="primary"
            htmlType="submit"
            loading={isSaving}
            disabled={isFeatureLocked as boolean}
          >
            Save
          </Button>
        </Form.Item>
      </Form>
      <Flex
        justify="center"
        align="center"
        style={{
          display: isFeatureLocked ? 'block' : 'none',
          textAlign: 'center',
        }}
      >
        <Typography.Text type="secondary">
          {t('message.projectLimitReached').replace('{upgradeLink}', '')}
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              showAppModal({
                type: 'updateSubscription',
                payload: {
                  email: user.email,
                  source: 'addProjectModal',
                  destination: 'newPlanOrAddCredit',
                },
              });
              return;
            }}
          >
            {' '}
            {t('message.upgradePlan')}
          </a>
        </Typography.Text>
      </Flex>
    </>
  );
}
