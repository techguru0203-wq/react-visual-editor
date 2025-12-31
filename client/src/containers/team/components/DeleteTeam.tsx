import { useState } from 'react';
import { Button, Form, Typography } from 'antd';
import { useNavigate } from 'react-router';

import { OrganizationPath } from '../../nav/paths';
import { useDeleteTeamMutation } from '../hooks/useTeamMutation';

type DeleteTeamProps = Readonly<{
  teamId: string;
  onSuccess: () => void;
}>;

export default function DeleteTeam({ teamId, onSuccess }: DeleteTeamProps) {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  function onMutationSuccess() {
    console.log('container.project.components.DeleteTeam.onMutationSuccess');
    onSuccess();
    setIsLoading(false);
    navigate(OrganizationPath);
  }

  function onMutationError(err: string | Error) {
    console.error(
      'containers.project.components.DeleteTeam.onMutationError',
      err
    );
    setIsLoading(false);
  }
  const { deleteTeamMutation } = useDeleteTeamMutation({
    onSuccess: onMutationSuccess,
    onError: onMutationError,
  });

  const onSubmit = () => {
    setIsLoading(true);
    deleteTeamMutation.mutate(teamId);
  };

  return (
    <>
      <Form
        form={form}
        name="deleteTeam"
        size="large"
        labelCol={{ span: 6 }}
        wrapperCol={{ span: 16 }}
        onFinish={onSubmit}
      >
        <Typography.Paragraph style={{ paddingBottom: '20px' }}>
          Are you sure you want to delete this team?
        </Typography.Paragraph>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={isLoading}>
            Delete
          </Button>
        </Form.Item>
      </Form>
    </>
  );
}
