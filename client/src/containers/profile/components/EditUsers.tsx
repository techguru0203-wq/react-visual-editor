import { useEffect, useState } from 'react';
import { User } from '@prisma/client';
import { Alert, Input, Select, Table } from 'antd';
import _ from 'lodash';

import { useCurrentUser } from '../../../common/contexts/currentUserContext';
import { useLanguage } from '../../../common/contexts/languageContext';
import { isFeatureLocked } from '../../../common/util/app';
import { LoadingScreen } from '../../layout/components/LoadingScreen';
import { useOrganizationUsers } from '../../organization/hooks/useOrganizationUsers';
import useJiraUsers from '../hooks/useJiraUsers';
import { useUpdateProfileMutation } from '../hooks/useUpdateProfileMutation';
import { Specialization } from '../types/profileTypes';

import './Profile.scss';

export default function EditUsers() {
  const { data: members, isLoading, isError, error } = useOrganizationUsers();
  const [errorMsg, setErrorMsg] = useState<string>();
  const [successMsg, setSuccessMsg] = useState<string>();
  const { subscriptionStatus, subscriptionTier } = useCurrentUser();
  const { t } = useLanguage();
  const [screenSize, setScreenSize] = useState<'desktop' | 'tablet' | 'mobile'>(
    'desktop'
  );

  const { isAdmin } = useCurrentUser();

  useEffect(() => {
    const updateScreenSize = () => {
      const width = window.innerWidth;
      if (width <= 575) {
        setScreenSize('mobile');
      } else if (width <= 1099) {
        setScreenSize('tablet');
      } else {
        setScreenSize('desktop');
      }
    };
    window.addEventListener('resize', updateScreenSize);
    updateScreenSize();
    return () => window.removeEventListener('resize', updateScreenSize);
  }, []);

  let isJiraLocked = isFeatureLocked(
    subscriptionStatus as string,
    subscriptionTier as string
  );
  const { data: rawData } = useJiraUsers(!isJiraLocked);

  const updateProfileMutation = useUpdateProfileMutation({
    onSuccess: () => {
      setSuccessMsg('User profile update success!');
    },
    onError: (error: any) => {
      console.error(error.toString());
      setErrorMsg(error.toString());
    },
  });

  function getJiraId(meta: any): string {
    return meta?.jira_profile?.account_id || '';
  }

  if (isAdmin === false) {
    return (
      <div style={{ color: 'red' }}>
        <h1>Unauthorized</h1>
        <p>You are not authorized to view this page.</p>
      </div>
    );
  }

  if (isError) {
    throw error;
  }

  if (isLoading) {
    return <LoadingScreen />;
  }

  const jiraUsers = rawData?.filter((user) => user.accountType === 'atlassian');
  const jiraUserOptions = [{ label: 'Choose', value: 'choose' }];
  jiraUsers?.map((user) =>
    jiraUserOptions.push({
      label: user.displayName + '(' + user.accountId.slice(-4) + ')',
      value: user.accountId,
    })
  );

  const userSpecialityOptions = [{ label: 'Choose', value: 'choose' }];
  Object.entries(Specialization).forEach(([name, value]) => {
    userSpecialityOptions.push({
      label: value,
      value: name,
    });
  });

  const membersColumnsDesktop = [
    {
      title: t('profile.firstName'),
      dataIndex: 'firstname',
      key: 'firstname',
    },
    {
      title: t('profile.lastName'),
      dataIndex: 'lastname',
      key: 'lastname',
    },
    { title: t('profile.email'), dataIndex: 'email', key: 'email', ellipsis: true },
    {
      title: t('profile.specialty'),
      dataIndex: 'specialty',
      key: 'specialty',
      ellipsis: true,
    },
    {
      title: t('profile.velocity'),
      dataIndex: 'velocity',
      key: 'velocity',
    },
  ];

  if (!isJiraLocked) {
    membersColumnsDesktop.push({
      title: t('profile.jiraId'),
      dataIndex: 'jira',
      key: 'jira',
      ellipsis: true,
    });
  }

  const membersColumnsTablet = [
    {
      title: 'First Name',
      dataIndex: 'firstname',
      key: 'firstname',
    },
    {
      title: 'Last Name',
      dataIndex: 'lastname',
      key: 'lastname',
    },
    { title: 'Email', dataIndex: 'email', key: 'email', ellipsis: true },
  ];

  const membersColumnsMobile = [
    {
      title: 'First Name',
      dataIndex: 'firstname',
      key: 'firstname',
    },
    { title: 'Email', dataIndex: 'email', key: 'email', ellipsis: true },
  ];

  const membersColumns =
    screenSize === 'desktop'
      ? membersColumnsDesktop
      : screenSize === 'tablet'
        ? membersColumnsTablet
        : membersColumnsMobile;

  return (
    <div style={{ width: '100%' }}>
      {errorMsg && (
        <div>
          <Alert type="error" message={errorMsg} />
        </div>
      )}
      {successMsg && (
        <div>
          <Alert type="success" message={successMsg} />
        </div>
      )}
      <div>
        <Table
          columns={membersColumns}
          tableLayout="fixed"
          dataSource={members.map((member: User) => ({
            ...member,
            key: member.id,
            firstname: (
              <Input
                type="text"
                name="firstNameInput"
                defaultValue={member.firstname ? member.firstname : ''}
                style={{ minWidth: 120 }}
                allowClear
                onBlur={_.debounce((e) => {
                  console.log(e.target.value);
                  const firstname = e.target.value.trim();
                  if (firstname != '') {
                    updateProfileMutation.mutate({
                      id: member.id,
                      organizationId: member.organizationId,
                      email: member.email,
                      username: member.username,
                      firstname: firstname,
                      lastname: member.lastname,
                      specialty: member.specialty,
                    });
                  }
                }, 1000)}
              />
            ),
            lastname: (
              <Input
                type="text"
                name="firstNameInput"
                defaultValue={member.lastname ? member.lastname : ''}
                style={{ minWidth: 120 }}
                allowClear
                onBlur={_.debounce((e) => {
                  console.log(e.target.value);
                  const lastname = e.target.value.trim();
                  if (lastname != '') {
                    updateProfileMutation.mutate({
                      id: member.id,
                      organizationId: member.organizationId,
                      email: member.email,
                      username: member.username,
                      firstname: member.firstname,
                      lastname: lastname,
                      specialty: member.specialty,
                    });
                  }
                }, 1000)}
              />
            ),
            specialty: (
              <Select
                options={userSpecialityOptions}
                style={{ width: '100%' }}
                defaultValue={member.specialty ? member.specialty : 'choose'}
                onChange={(specialty) =>
                  updateProfileMutation.mutate({
                    id: member.id,
                    organizationId: member.organizationId,
                    email: member.email,
                    username: member.username,
                    firstname: member.firstname,
                    lastname: member.lastname,
                    specialty: specialty === 'choose' ? null : specialty,
                  })
                }
              />
            ),
            velocity: (
              <Input
                type="number"
                id="velocityInput"
                name="velocityInput"
                onChange={_.debounce((e) => {
                  console.log('e:', e.target.value);
                  updateProfileMutation.mutate({
                    id: member.id,
                    organizationId: member.organizationId,
                    email: member.email,
                    username: member.username,
                    firstname: member.firstname,
                    lastname: member.lastname,
                    velocity: e.target.valueAsNumber || 0,
                  });
                }, 1000)}
                defaultValue={member.velocity || 0}
              />
            ),
            jira: (
              <Select
                disabled={jiraUsers?.length === 0}
                options={jiraUserOptions}
                style={{ width: '100%' }}
                defaultValue={
                  getJiraId(member.meta) ? getJiraId(member.meta) : 'choose'
                }
                onChange={(jiraId) =>
                  updateProfileMutation.mutate({
                    id: member.id,
                    organizationId: member.organizationId,
                    email: member.email,
                    username: member.username,
                    firstname: member.firstname,
                    lastname: member.lastname,
                    jiraId: jiraId === 'choose' ? null : jiraId,
                  })
                }
              />
            ),
          }))}
          pagination={{ pageSize: 20 }}
        />
      </div>
    </div>
  );
}
