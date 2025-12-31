import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CreditCardOutlined,
  LogoutOutlined,
  MenuOutlined,
  MessageOutlined,
  PlusOutlined,
  SettingOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { SubscriptionTier } from '@prisma/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Drawer,
  Dropdown,
  Flex,
  Menu,
  MenuProps,
  Space,
  Tooltip,
  Typography,
} from 'antd';
import Sider from 'antd/es/layout/Sider';
import { signOut } from 'aws-amplify/auth';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useNavigate } from 'react-router';

import { useAppModal } from '../../../common/components/AppModal';
import { FreeProjectsCounter } from '../../../common/components/FreeProjectsCounter';
import { UserAvatar } from '../../../common/components/UserAvatar';
import { useCurrentUser } from '../../../common/contexts/currentUserContext';
import { useLanguage } from '../../../common/contexts/languageContext';
import { ReactComponent as LogoIcon } from '../../../common/icons/logo.svg';
import { COLORS, GenerationMinimumCredit } from '../../../lib/constants';
import trackEvent from '../../../trackingClient';
import { shouldShowFeedbackApi } from '../../common/api/feedbackApi';
import {
  BillingPath,
  HomePath,
  JiraAdminPath,
  ProfilePath,
  SettingsPath,
  UsersAdminPath,
  UserTemplateDocumentsPath,
} from '../../nav/paths';
import { useOrganizationHierarchy } from '../../organization/hooks/useOrganizationHierarchy';
import { useCollapsedNavigationMenuItems } from '../hooks/useCollapsedNavigationMenuItems';
import { useNormalNavigationMenuItems } from '../hooks/useNormalNavigationMenuItems';

export default function SidePanel() {
  const [collapsed, setCollapsed] = useState(() => {
    const storedCollapsed = localStorage.getItem('sidebarCollapsed');
    return storedCollapsed ? JSON.parse(storedCollapsed) : false;
  });
  const [openKeys, setOpenKeys] = useState<ReadonlyArray<string>>([]);

  const { showAppModal } = useAppModal();
  const { t } = useLanguage();

  const {
    normalMenuItems,
    openItemKeys: forcedOpenItemKeys,
    selectedItemKeys,
    organization,
  } = useNormalNavigationMenuItems();

  // Get the loading state from the organization query to prevent flashing
  const { isLoading: isOrganizationLoading } = useOrganizationHierarchy();

  const { collapsedMenuItems } = useCollapsedNavigationMenuItems();

  const { user, subscriptionTier, isAdmin } = useCurrentUser();
  const [isMobile, setIsMobile] = useState(false);
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Check if feedback should be shown
  const { data: feedbackData } = useQuery({
    queryKey: ['FEEDBACK_CHECK'],
    queryFn: shouldShowFeedbackApi,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  const shouldShowFeedbackButton =
    !collapsed && feedbackData?.shouldShow === true;

  // Listen for sidebar collapse changes from other components
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent | CustomEvent) => {
      if (e instanceof StorageEvent) {
        if (e.key === 'sidebarCollapsed') {
          const newValue = e.newValue ? JSON.parse(e.newValue) : false;
          setCollapsed(newValue);
        }
      } else if (
        e instanceof CustomEvent &&
        e.detail?.collapsed !== undefined
      ) {
        setCollapsed(e.detail.collapsed);
        localStorage.setItem(
          'sidebarCollapsed',
          JSON.stringify(e.detail.collapsed)
        );
      }
    };

    // Listen to storage events (for cross-tab communication)
    window.addEventListener('storage', handleStorageChange);
    // Listen to custom events (for same-tab communication)
    window.addEventListener(
      'sidebarCollapseChange',
      handleStorageChange as EventListener
    );

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener(
        'sidebarCollapseChange',
        handleStorageChange as EventListener
      );
    };
  }, []);

  // Monitor credits and trigger feedback check when credits run low
  const prevCreditsRef = useRef<number | undefined>(organization?.credits);
  useEffect(() => {
    const currentCredits = organization?.credits ?? 0;
    const prevCredits = prevCreditsRef.current ?? 0;

    // If credits dropped to or below threshold, invalidate feedback check query
    if (
      typeof prevCredits === 'number' &&
      prevCredits > GenerationMinimumCredit &&
      currentCredits <= GenerationMinimumCredit
    ) {
      // Credits just dropped below threshold, check if feedback should be shown
      queryClient.invalidateQueries({ queryKey: ['FEEDBACK_CHECK'] });
    }

    prevCreditsRef.current = currentCredits;
  }, [organization?.credits, queryClient]);

  const onMenuItemOpened = useCallback((newOpenKeys: ReadonlyArray<string>) => {
    setOpenKeys(newOpenKeys);
  }, []);

  const onClickNew = () => {
    // showAppModal({ type: 'addProject' });
    navigate(HomePath);
    // if (e.key === AddNewOptions.NEW_PROJECT) {
    //   showAppModal({ type: 'addProject' });
    // } else if (e.key === AddNewOptions.NEW_APP) {
    //   showAppModal({ type: 'addDocument', docType: DOCTYPE.PROTOTYPE });
    // } else if (e.key === AddNewOptions.NEW_REQUIREMENT) {
    //   showAppModal({ type: 'addDocument', docType: DOCTYPE.PRD });
    // } else if (e.key === AddNewOptions.NEW_TEAM) {
    //   showAppModal({ type: 'addTeam' });
    // } else if (e.key === AddNewOptions.NEW_CHAT) {
    //   showAppModal({ type: 'addChat' });
    // }
  };

  const onClick = useCallback(
    async ({ key }: { key: string }) => {
      // track event
      trackEvent('User Dropdown Click', {
        distinct_id: user.email,
        payload: JSON.stringify({
          key: key,
        }),
      });
      if (key === 'settings') {
        navigate(SettingsPath);
      } else if (key === 'profile') {
        navigate(ProfilePath);
      } else if (key === 'billing') {
        navigate(BillingPath);
      } else if (key === 'jiraAdmin') {
        navigate(JiraAdminPath);
      } else if (key === 'usersAdmin') {
        navigate(UsersAdminPath);
      } else if (key === UserTemplateDocumentsPath) {
        navigate(UserTemplateDocumentsPath);
      } else if (key === 'logout') {
        await signOut();
        queryClient.clear();
      } else if (key === 'invite') {
        // show add teammate popup
        showAppModal({ type: 'addTeamMember', teamId: '' });
      }
      setIsSidebarVisible(false);
    },
    [navigate, queryClient, user.email, showAppModal]
  );
  const items: MenuProps['items'] = isAdmin
    ? [
        {
          key: ProfilePath,
          label:
            !isMobile && collapsed ? (
              <Tooltip
                title={t('sidePanel.myProfile')}
                placement="right"
                mouseEnterDelay={0}
              >
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    right: 0,
                    bottom: 0,
                  }}
                />
              </Tooltip>
            ) : (
              t('sidePanel.myProfile')
            ),
          icon: <UserOutlined />,
        },
        {
          key: BillingPath,
          label:
            !isMobile && collapsed ? (
              <Tooltip
                title={t('sidePanel.billing')}
                placement="right"
                mouseEnterDelay={0}
              >
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    right: 0,
                    bottom: 0,
                  }}
                />
              </Tooltip>
            ) : (
              t('sidePanel.billing')
            ),
          icon: <CreditCardOutlined />,
        },
        {
          key: SettingsPath,
          label:
            !isMobile && collapsed ? (
              <Tooltip
                title={t('sidePanel.admin')}
                placement="right"
                mouseEnterDelay={0}
              >
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    right: 0,
                    bottom: 0,
                  }}
                />
              </Tooltip>
            ) : (
              t('sidePanel.admin')
            ),
          icon: <SettingOutlined />,
        },
      ]
    : [
        {
          key: ProfilePath,
          label:
            !isMobile && collapsed ? (
              <Tooltip
                title={t('sidePanel.myProfile')}
                placement="right"
                mouseEnterDelay={0}
              >
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    right: 0,
                    bottom: 0,
                  }}
                />
              </Tooltip>
            ) : (
              t('sidePanel.myProfile')
            ),
          icon: <UserOutlined />,
        },
      ];
  items.push(
    {
      type: 'divider',
    },
    // {
    //   key: 'invite',
    //   label: 'Invite Team',
    // },
    {
      key: 'logout',
      label:
        !isMobile && collapsed ? (
          <Tooltip
            title={t('sidePanel.logout')}
            placement="right"
            mouseEnterDelay={0}
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                position: 'absolute',
                left: 0,
                top: 0,
                right: 0,
                bottom: 0,
              }}
            />
          </Tooltip>
        ) : (
          t('sidePanel.logout')
        ),
      icon: <LogoutOutlined />,
    }
  );

  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth <= 767);
    };
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => {
      window.removeEventListener('resize', checkScreenSize);
    };
  }, []);

  const sidebarContent = (
    <Sider
      className="app-sider"
      width={isMobile ? 250 : 225}
      collapsed={!isMobile && collapsed}
      theme="light"
      style={{
        position: isMobile ? 'fixed' : 'relative',
        zIndex: isMobile ? 1000 : 'auto',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Flex vertical style={{ height: '100%', overflow: 'hidden' }}>
        <Flex
          style={{
            backgroundColor: '#fff',
            padding: '15px',
            alignItems: 'center',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            justifyContent: !isMobile && collapsed ? 'center' : 'flex-start',
            cursor: 'pointer',
            flexShrink: 0,
          }}
          onClick={() => {
            navigate(HomePath);
          }}
        >
          <LogoIcon style={{ width: '30px', height: '30px' }} />
          {(isMobile || !collapsed) && (
            <Tooltip title={organization?.name || 'Omniflow'}>
              <Typography.Text
                ellipsis
                style={{
                  fontSize: '1.8em',
                  fontWeight: 'bold',
                  marginLeft: '10px',
                  flex: 1,
                }}
              >
                {organization?.name || 'Omniflow'}
              </Typography.Text>
            </Tooltip>
          )}
        </Flex>
        <Flex
          style={{
            paddingLeft: !isMobile && collapsed ? '23px' : '18px',
            borderTop: `solid 1px ${COLORS.LIGHT_GRAY}`,
            borderBottom: `solid 1px ${COLORS.LIGHT_GRAY}`,
            flexShrink: 0,
          }}
        >
          <>
            <style>{`
              .user-menu-dropdown .ant-dropdown-menu-item {
                position: relative;
              }
            `}</style>
            <Dropdown
              menu={{ items, onClick }}
              trigger={['click']}
              arrow
              placement="bottom"
              overlayClassName="user-menu-dropdown"
            >
              <Space
                style={{
                  marginTop: '8px',
                  marginBottom: '8px',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                }}
              >
                <UserAvatar user={user} />
                {!isMobile && collapsed ? (
                  ''
                ) : (
                  <span style={{ cursor: 'pointer' }}>{user.username}</span>
                )}
              </Space>
            </Dropdown>
          </>
        </Flex>
        <Flex
          style={{
            marginLeft: !isMobile && collapsed ? '27px' : '18px',
            marginTop: '15px',
            marginBottom: '5px',
            flexShrink: 0,
          }}
        >
          <Button
            id="add-project-btn"
            type="primary"
            icon={<PlusOutlined />}
            onClick={onClickNew}
            size={!isMobile && collapsed ? 'small' : 'middle'}
            style={{
              marginRight: '10px',
              borderRadius: !isMobile && collapsed ? '50%' : undefined,
              width:
                !isMobile && collapsed
                  ? undefined
                  : isMobile
                    ? '222px'
                    : '192px',
              fontSize: '15px',
            }}
          >
            {!isMobile && collapsed ? '' : ` ${t('button.newProject')}`}
          </Button>
        </Flex>
        <Flex
          vertical
          style={{
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              overflow: 'auto',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <Menu
                selectedKeys={selectedItemKeys}
                openKeys={[
                  ...openKeys,
                  ...(collapsed ? [] : forcedOpenItemKeys),
                ]}
                mode="inline"
                inlineIndent={12}
                theme="light"
                items={collapsed ? collapsedMenuItems : normalMenuItems}
                onOpenChange={onMenuItemOpened}
                onClick={() => setIsSidebarVisible(false)}
                style={{
                  borderInlineEnd: 'none',
                  marginLeft: collapsed ? '-4px' : '0',
                  paddingLeft: collapsed ? '0' : '2px',
                }}
              />
            </div>

            {/* Feedback Button - Show below menu block */}
            {shouldShowFeedbackButton && (
              <div
                style={{
                  padding: '8px 18px',
                  flexShrink: 0,
                  position: 'relative',
                }}
              >
                <Button
                  type="default"
                  icon={<MessageOutlined style={{ color: COLORS.PRIMARY }} />}
                  onClick={() => showAppModal({ type: 'feedback' })}
                  block
                  style={{
                    fontSize: '14px',
                    height: '36px',
                    fontWeight: 500,
                    color: COLORS.PRIMARY,
                  }}
                >
                  {t('feedback.feedbackForCredits')}
                </Button>
                <span
                  style={{
                    position: 'absolute',
                    top: '0px',
                    right: '12px',
                    backgroundColor: '#ff4d4f',
                    color: '#fff',
                    fontSize: '10px',
                    fontWeight: 600,
                    padding: '2px 6px',
                    borderRadius: '10px',
                    lineHeight: '1.2',
                    zIndex: 1,
                  }}
                >
                  NEW
                </span>
              </div>
            )}

            {!collapsed && (
              <>
                {/* Low Credit Warning */}
                {!isOrganizationLoading &&
                  (organization?.credits ?? 0) <= GenerationMinimumCredit && (
                    <div
                      style={{
                        margin: '8px 32px',
                        padding: '8px 12px',
                        backgroundColor: '#fff2f0',
                        border: '1px solid #ffccc7',
                        borderRadius: '6px',
                        fontSize: '12px',
                        color: '#ff4d4f',
                      }}
                    >
                      <div style={{ fontSize: '11px' }}>
                        ⚠️ {t('layout.lowCredits')}{' '}
                        <a
                          href="/"
                          style={{
                            fontSize: '11px',
                            color: '#ff4d4f',
                            textDecoration: 'underline',
                            cursor: 'pointer',
                            paddingLeft: '8px',
                          }}
                          onClick={(e) => {
                            e.preventDefault();
                            showAppModal({
                              type: 'purchaseCredits',
                              payload: {
                                email: user.email,
                                source: 'sidebar',
                                destination: 'refillCredits',
                                isLowCredits: true,
                              },
                            });
                          }}
                        >
                          {t('sidePanel.refillNow')}
                        </a>
                      </div>
                    </div>
                  )}
              </>
            )}

            {/* Free Projects Counter - Only for FREE tier */}
            {subscriptionTier === SubscriptionTier.FREE && !collapsed && (
              <div
                style={{
                  backgroundColor: 'white',
                  padding: '8px 0',
                  borderTop: '1px solid #f0f0f0',
                  marginTop: '0',
                }}
              >
                <FreeProjectsCounter />
                <Button
                  color="primary"
                  variant="filled"
                  style={{ margin: '0 7px' }}
                  href="https://bit.ly/3B88K2g"
                  target="_blank"
                >
                  {t('sidePanel.joinSlackCommunity')}
                </Button>
              </div>
            )}
          </div>
        </Flex>
        {!isMobile && (
          <Flex
            style={{
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              borderTop: `1px solid ${COLORS.LIGHT_GRAY}`,
              minHeight: '48px',
              flexShrink: 0,
              position: 'relative',
            }}
          >
            {/* Share & Earn button - Only for FREE & STARTER plans, hidden when collapsed */}
            {!collapsed &&
              (subscriptionTier === SubscriptionTier.FREE ||
                subscriptionTier === SubscriptionTier.STARTER) && (
                <Button
                  type="primary"
                  onClick={() => showAppModal({ type: 'referralModal' })}
                  size="small"
                  style={{
                    background:
                      'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    border: 'none',
                    borderRadius: '20px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    fontSize: '12px',
                    padding: '4px 12px',
                    height: 'auto',
                    lineHeight: '1.5',
                  }}
                >
                  {t('sidePanel.shareAndEarn')}
                </Button>
              )}
            <div
              style={{
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '24px',
                color: COLORS.PRIMARY,
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                padding: '4px',
                borderRadius: '4px',
                transition: 'background-color 0.2s',
              }}
              onClick={() => {
                const newVal = !collapsed;
                setCollapsed(newVal);
                localStorage.setItem(
                  'sidebarCollapsed',
                  JSON.stringify(newVal)
                );
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f0f0f0';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              {collapsed ? (
                <PanelLeftOpen size={18} />
              ) : (
                <PanelLeftClose size={18} />
              )}
            </div>
          </Flex>
        )}
      </Flex>
    </Sider>
  );

  return (
    <>
      {isMobile ? (
        <>
          <Button
            icon={<MenuOutlined />}
            onClick={() => setIsSidebarVisible(true)}
            style={{
              position: 'absolute',
              top: '14px',
              left: '16px',
              zIndex: 105,
            }}
          />
          <Drawer
            open={isSidebarVisible}
            placement="left"
            onClose={() => setIsSidebarVisible(!isSidebarVisible)}
            width={250}
            styles={{
              body: { padding: 0 },
              header: {
                position: 'absolute',
                top: '25px',
                right: 0,
                border: 'none',
                padding: '0',
                zIndex: 9999,
              },
            }}
          >
            {sidebarContent}
          </Drawer>
        </>
      ) : (
        sidebarContent
      )}
    </>
  );
}
