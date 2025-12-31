import { useCallback, useEffect, useState } from 'react';
import { Button, Flex, Form, Input, Spin, Typography } from 'antd';
import { useNavigate } from 'react-router';

import { useAppModal } from '../../../common/components/AppModal';
import { SelectOrganizationUser } from '../../../common/components/SelectOrganizationUser';
import { useCurrentUser } from '../../../common/contexts/currentUserContext';
import { useLanguage } from '../../../common/contexts/languageContext';
import { useInviteUserMutation } from '../../profile/hooks/useInviteUserMutation';
import { InviteUserResponse } from '../../profile/types/profileTypes';
import { useAddUserToTeamMutation } from '../hooks/useAddUserToTeamMutation';

type AddTeamMemberProps = Readonly<{
  teamId: string;
  onSuccess: () => void;
}>;

type ExistingUserFormValues = Readonly<{ selectedUser?: string }>;
type InviteUserFormValues = Readonly<{ email?: string }>;

function AddExistingUser({ teamId, onSuccess }: AddTeamMemberProps) {
  const [form] = Form.useForm();
  const [submitDisabled, setSubmitDisabled] = useState(true);
  const { t } = useLanguage();

  const navigate = useNavigate();

  const onError = useCallback((error: unknown) => {
    throw error;
  }, []);
  const addUserToTeamMutation = useAddUserToTeamMutation({
    onSuccess: () => {
      onSuccess();
    },
    onError,
  });

  const onValuesChange = useCallback(
    (
      changed: ExistingUserFormValues,
      { selectedUser }: ExistingUserFormValues
    ) => {
      setSubmitDisabled(
        !selectedUser ||
          form.getFieldsError().some(({ errors }) => errors.length)
      );
    },
    [form]
  );

  const onFinish = useCallback(
    ({ selectedUser }: Required<ExistingUserFormValues>) => {
      addUserToTeamMutation.mutate({ teamId, userId: selectedUser });
    },
    [addUserToTeamMutation, teamId]
  );

  return (
    <Form
      form={form}
      name="add"
      size="large"
      labelCol={{ span: 6 }}
      wrapperCol={{ span: 16 }}
      onValuesChange={onValuesChange}
      onFinish={onFinish}
    >
      <Form.Item>
        <Typography.Title level={5}>
          {t('team.addFromOrganization')}
        </Typography.Title>
      </Form.Item>
      <Form.Item name="selectedUser" label={t('team.user')}>
        <SelectOrganizationUser
          excludeTeamId={teamId}
          placeholder={t('team.selectUser')}
          secondaryInformation={['specialty', 'velocity']}
        />
      </Form.Item>
      <Form.Item wrapperCol={{ offset: 6, span: 16 }}>
        <Button type="primary" htmlType="submit" disabled={submitDisabled}>
          {t('team.addTeamMember')}
        </Button>
      </Form.Item>
    </Form>
  );
}

type InviteNewUserProps = Readonly<{
  title?: string;
  initialTeamId?: string;
  onSuccess: () => void;
}>;

export function InviteNewUser({
  title,
  initialTeamId,
  onSuccess,
}: InviteNewUserProps) {
  const [form] = Form.useForm();
  const [submitDisabled, setSubmitDisabled] = useState(true);
  const [inviteDisabled, setInviteDisabled] = useState(true);
  const [emails, setEmails] = useState<string[]>([]); // Added state for storing input emails
  const [failureEmails, setFailureEmails] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();
  const { showAppModal } = useAppModal();
  const { user, subscriptionTier } = useCurrentUser();
  const { t } = useLanguage();
  // TODO - we may re-enable locking invitation later. disabling for now based on user feedback
  const isLocked = false; //!subscriptionTier;

  useEffect(() => {
    setSubmitDisabled(emails.length === 0);
  }, [emails]);

  const onError = useCallback((error: unknown) => {
    throw error;
  }, []);
  const inviteUserMutation = useInviteUserMutation(initialTeamId, {
    onSuccess: (result: InviteUserResponse) => {
      if (
        result.failedEmails === null ||
        result.failedEmails === undefined ||
        result.failedEmails.length === 0
      ) {
        setIsLoading(false);
        onSuccess();
        console.log('Add user to team success');
        navigate(`/settings/users`);
      } else {
        setIsLoading(false);
        setFailureEmails(result.failedEmails);
        setEmails(result.failedEmails);
      }
    },
    onError: onError,
  });

  const onValuesChange = useCallback(
    (changed: InviteUserFormValues, { email }: InviteUserFormValues) => {
      setInviteDisabled(
        !email || form.getFieldsError().some(({ errors }) => errors.length)
      );
    },
    [form]
  );

  const onFinish = useCallback(() => {
    console.log('Invite new users: ', emails);
    inviteUserMutation.mutate({ emails, initialTeamId });
    setIsLoading(true);
  }, [emails, initialTeamId, inviteUserMutation]);

  const handleAddEmail = useCallback(() => {
    form.validateFields(['email']).then(({ email }) => {
      setEmails((prevEmails) => {
        const newEmails = [...prevEmails, email];
        form.resetFields(['email']);
        setInviteDisabled(true);
        return newEmails;
      });
    });
  }, [form]);

  return (
    <Spin spinning={isLoading}>
      {title && <Typography.Title level={5}>{title}</Typography.Title>}
      <Form
        form={form}
        name="invite"
        size="large"
        labelCol={{ span: 6 }}
        wrapperCol={{ span: 16 }}
        onValuesChange={onValuesChange}
        onFinish={onFinish}
      >
        <Form.Item
          name="email"
          label={t('team.email')}
          rules={[{ type: 'email', message: t('team.emailInvalid') }]}
        >
          <Input placeholder={t('team.enterEmailInvite')} />
        </Form.Item>
        <Form.Item wrapperCol={{ offset: 6, span: 16 }}>
          <Button
            type="primary"
            onClick={handleAddEmail}
            disabled={inviteDisabled || isLocked}
          >
            {t('team.add')}
          </Button>
        </Form.Item>
        {emails.length > 0 && (
          <Typography.Title level={5}>{t('team.usersToInvite')}</Typography.Title>
        )}
        <div>
          <ul>
            {emails.map((email, index) => (
              <li key={index}>
                {email}
                <Button
                  style={{ height: '32px' }}
                  type="link"
                  onClick={() => {
                    setEmails((prevEmails) =>
                      prevEmails.filter((_, i) => i !== index)
                    );
                  }}
                >
                  Delete
                </Button>
              </li>
            ))}
          </ul>
          {isLocked && (
            <Flex
              justify="center"
              style={{
                textAlign: 'center',
              }}
            >
              {' '}
              <Typography.Text type="secondary">
                To add teammates, please
                <a
                  href="/"
                  onClick={(e) => {
                    e.preventDefault();
                    showAppModal({
                      type: 'updateSubscription',
                      payload: {
                        email: user.email,
                        source: 'addTeamMember',
                        destination: 'EssentialPlan',
                      },
                    });
                    return;
                  }}
                >
                  {' '}
                  upgrade to Essential Plan or above
                </a>
              </Typography.Text>
            </Flex>
          )}
          {failureEmails.length > 0 && (
            <Typography style={{ fontWeight: 'bold', color: 'red' }}>
              Failed to invite the following users. Please click "Send
              Invitation" to retry.
            </Typography>
          )}

          {failureEmails.length > 0 && (
            <ul style={{ color: 'red' }}>
              {failureEmails.map((email, index) => (
                <li key={index}>{email}</li>
              ))}
            </ul>
          )}
        </div>
        <div style={{ textAlign: 'center' }}>
          {emails.length > 0 && (
            <Button type="primary" htmlType="submit" disabled={submitDisabled}>
              {t('team.sendInvitation')}
            </Button>
          )}
        </div>
      </Form>
    </Spin>
  );
}

export function AddTeamMember({ teamId, onSuccess }: AddTeamMemberProps) {
  return (
    <>
      {/* <AddExistingUser teamId={teamId} onSuccess={onSuccess} /> */}
      {/* <Divider /> */}
      <InviteNewUser
        initialTeamId={teamId}
        // title="Or invite a new user to join Omniflow"
        title=""
        onSuccess={onSuccess}
      />
    </>
  );
}
