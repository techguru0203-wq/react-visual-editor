import { Button, Divider, Form, Table, Typography } from 'antd';

import { useCurrentUser } from '../../../common/contexts/currentUserContext';
import { useLanguage } from '../../../common/contexts/languageContext';
import { LoadingScreen } from '../../layout/components/LoadingScreen';
import useUserProfileQuery from '../../profile/hooks/useUserProfileQuery';
import { fetchJiraRedirectUrl } from '../api/jiraApi';
import useJiraResources from '../hooks/useJiraResources';
import { JiraResource, JiraUserProfile } from '../types/jiraTypes';

import './AdminHome.scss';

export default function AdminHome() {
  const { user } = useCurrentUser();
  const { t } = useLanguage();
  const {
    data: existingProfile,
    isLoading,
    isSuccess,
  } = useUserProfileQuery(user.id, true, {
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const { data: jiraResources, isLoading: jiraLoading } = useJiraResources(
    true,
    {
      refetchOnMount: false,
      refetchOnWindowFocus: false,
    }
  );

  if (isLoading || jiraLoading) {
    return (
      <div style={{ width: '100%' }}>
        <LoadingScreen />
      </div>
    );
  }

  if (existingProfile?.isAdmin === false) {
    return (
      <div style={{ color: 'red' }}>
        <h1>{t('organization.unauthorized')}</h1>
        <p>{t('organization.notAuthorized')}</p>
      </div>
    );
  }

  async function redirectToJiraAuthorization() {
    let url = await fetchJiraRedirectUrl();
    // Redirect to Jira's website for authorization.
    window.location.href = url;
  }

  function getJiraUserProfileData(metaData: any): JiraUserProfile | null {
    return metaData?.jira_profile || null;
  }

  const jiraUserProfile = getJiraUserProfileData(existingProfile?.meta);

  const columnsForJiraResourcesTable = [
    {
      title: t('organization.name'),
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
    },
    {
      title: t('organization.url'),
      dataIndex: 'url',
      key: 'url',
      ellipsis: true,
      render: (link: string) => (
        <a href={link} target="_blank" rel="noopener noreferrer">
          {link}
        </a>
      ),
    },
  ];

  const jiraUserProfileColumns = [
    {
      title: 'Key',
      dataIndex: 'key',
      key: 'key',
      ellipsis: true,
    },
    {
      title: 'Value',
      dataIndex: 'value',
      key: 'value',
      ellipsis: true,
    },
  ];

  return (
    <div className="admin-form">
      <Form
        name="OrganizationAdmin"
        labelCol={{ span: 8 }}
        wrapperCol={{ span: 16 }}
        autoComplete="off"
        initialValues={existingProfile}
        disabled={isLoading || !isSuccess}
      >
        <Divider plain style={{ color: 'grey' }}>
          {t('organization.jiraIntegration')}
        </Divider>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div className="table-width">
            <Typography.Title level={4}>
              {t('organization.accountAuthorization')}
            </Typography.Title>
          </div>
        </div>
        <Form.Item
          label="Jira Id"
          name="jira"
          tooltip={t('organization.linkJiraTooltip')}
          style={{ textAlign: 'center' }}
          className="existing-profile-row"
        >
          {existingProfile && !existingProfile.jiraEnabled && (
            <Button
              type="primary"
              onClick={async () => {
                await redirectToJiraAuthorization();
              }}
            >
              {t('organization.connectWithJira')}
            </Button>
          )}
          {existingProfile && existingProfile.jiraEnabled && (
            <span style={{ fontWeight: 'bold', color: 'green' }}>
              {t('organization.jiraConnected')}
            </span>
          )}
        </Form.Item>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div className="table-width">
            <Typography.Title level={4}>
              {t('organization.jiraUserProfile')}
            </Typography.Title>
            {jiraUserProfile && (
              <Table
                columns={jiraUserProfileColumns}
                dataSource={Object.keys(jiraUserProfile).map(
                  (key: string, index: number) => {
                    if (key === 'picture') {
                      return {
                        key: key + index,
                        value: (
                          <img
                            src={
                              jiraUserProfile[
                                key as keyof typeof jiraUserProfile
                              ] as string | undefined
                            }
                            alt=""
                            style={{ width: 64, height: 64 }}
                          />
                        ),
                      };
                    } else {
                      return {
                        key: key + index,
                        value: jiraUserProfile[
                          key as keyof typeof jiraUserProfile
                        ] as string | undefined,
                      };
                    }
                  }
                )}
                pagination={{ pageSize: 5 }}
              />
            )}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div className="table-width">
            <Typography.Title level={4}>
              {t('organization.jiraResources')}
            </Typography.Title>
            {jiraResources && (
              <Table
                dataSource={jiraResources.map(
                  (resource: JiraResource, index: number) => ({
                    ...resource,
                    key: index,
                  })
                )}
                columns={columnsForJiraResourcesTable}
              />
            )}
          </div>
        </div>
      </Form>
    </div>
  );
}
