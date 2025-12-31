import React, { useEffect, useState } from 'react';
import { CopyOutlined } from '@ant-design/icons';
import { DOCTYPE, SubscriptionTier } from '@prisma/client';
import { Button, Card, Col, Flex, message, Row, Spin, Typography } from 'antd';

import { useAppModal } from '../../../common/components/AppModal';
import { FREE_PROJECT_LIMIT } from '../../../common/constants';
import { useCurrentUser } from '../../../common/contexts/currentUserContext';
import { useLanguage } from '../../../common/contexts/languageContext';
import { useOrganizationHierarchy } from '../../organization/hooks/useOrganizationHierarchy';
import useUserProfileQuery from '../../profile/hooks/useUserProfileQuery';
import { cloneProjectApi } from '../../project/api/project';
import { CommunityProject, fetchCommunityProjects } from '../api/communityApi';

import './FromCommunity.scss';

const { Text } = Typography;

interface FromCommunityProps {
  className?: string;
  onCategoryChange?: (category: string) => void;
}

// Domain categories with their associated project IDs
// This allows manual management of which projects belong to which domain
const DOMAIN_FILTERS_CONFIG = [
  {
    key: 'all',
    labelKey: 'community.all',
    projectIds: [
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '8',
      '9',
      '12',
      '13',
      '15',
      '16',
      '17',
      '18',
      '19',
      '20',
    ],
  }, // show all by default
  {
    key: 'ai',
    labelKey: 'community.aiNative',
    projectIds: ['2', '5', '15', '17'],
  }, // AI Native
  {
    key: 'SMBPortal',
    labelKey: 'community.smbPortal',
    projectIds: ['1', '3', '12', '13'],
  }, // SMB Portal '7', '10', '11', '14'
  {
    key: 'saas',
    labelKey: 'community.saas',
    projectIds: ['8', '9', '16', '20'],
  }, // SaaS
  {
    key: 'internal',
    labelKey: 'community.internalTool',
    projectIds: ['4', '6', '18', '19'],
  }, // Internal Tool
];

export const FromCommunity: React.FC<FromCommunityProps> = ({ className, onCategoryChange }) => {
  const { t } = useLanguage();
  const { showAppModal } = useAppModal();
  const { user } = useCurrentUser();
  const { data: userProfile } = useUserProfileQuery(user.id);
  const { data: organization } = useOrganizationHierarchy();
  const [selectedDomain, setSelectedDomain] = useState<string>('all');
  const [loading, setLoading] = useState<string | null>(null);
  const [projects, setProjects] = useState<CommunityProject[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);

  // Check project limit for free users
  const numProjects = organization?.projects.length ?? 0;
  const isLimitReached = numProjects >= FREE_PROJECT_LIMIT;
  const isFeatureLocked =
    isLimitReached && userProfile?.subscriptionTier === SubscriptionTier.FREE;

  // Fetch community projects from API
  useEffect(() => {
    const loadProjects = async () => {
      try {
        setProjectsLoading(true);
        const selectedFilter = DOMAIN_FILTERS_CONFIG.find(
          (f) => f.key === selectedDomain
        );
        const projectIds =
          selectedFilter?.projectIds && selectedFilter.projectIds.length > 0
            ? selectedFilter.projectIds
            : undefined;
        const projects = await fetchCommunityProjects(projectIds);
        setProjects(projects);
      } catch (error) {
        console.error('Error fetching community projects:', error);
        message.error(t('message.failedToLoadCommunityProjects'));
      } finally {
        setProjectsLoading(false);
      }
    };

    loadProjects();
  }, [selectedDomain, t]);

  const filteredProjects = projects;

  const handleCloneProject = async (project: CommunityProject) => {
    if (!project.projectId) {
      message.error('Project ID not available for cloning');
      return;
    }

    // Check if user has reached project limit
    if (isFeatureLocked) {
      showAppModal({
        type: 'updateSubscription',
        payload: {
          email: user.email,
          source: 'projectCloneLimit',
          destination: 'newPlan',
          isLowCredits: false,
        },
      });
      return;
    }

    setLoading(project.id);
    try {
      const clonedProject = await cloneProjectApi(project.projectId);
      message.success(
        t('home.projectClonedSuccessfully')
          .replace('{name}', project.name)
          .replace('{clonedName}', clonedProject.name),
        3
      );
      
      // Find the PROTOTYPE buildable and navigate to its document
      const prototypeDoc = clonedProject.documents?.find(b => b.type === DOCTYPE.PROTOTYPE);
      if (prototypeDoc) {
        // Redirect directly to the prototype document
        setTimeout(() => {
          window.location.href = `/docs/${prototypeDoc.id}`;
        }, 2000);
        return;
      }
      
      // Fallback: Redirect to the builder page if prototype not found
      setTimeout(() => {
        window.location.href = `/projects/${clonedProject.id}/planning/builder`;
      }, 2000);
    } catch (error) {
      console.error('Error cloning project:', error);
      message.error(t('home.failedToCloneProject'));
    } finally {
      setLoading(null);
    }
  };

  const handlePreviewProject = (project: CommunityProject) => {
    if (project.previewUrl) {
      window.open(project.previewUrl, '_blank');
    }
  };

  return (
    <div className={`from-community ${className || ''}`}>
      <div className="filter-section">
        <Flex gap="small" className="filter-buttons">
          {DOMAIN_FILTERS_CONFIG.map((filter) => (
            <Button
              key={filter.key}
              type={selectedDomain === filter.key ? 'primary' : 'default'}
              size="small"
              onClick={() => {
                setSelectedDomain(filter.key);
                onCategoryChange?.(filter.key);
              }}
            >
              {t(filter.labelKey)}
            </Button>
          ))}
        </Flex>
      </div>

      <div className="projects-grid">
        <Spin spinning={projectsLoading} size="large">
          <Row gutter={[24, 24]}>
            {filteredProjects.map((project) => (
              <Col key={project.id} xs={24} sm={12} md={8} lg={6}>
                <Card
                  hoverable
                  cover={
                    <div
                      className="project-image-container"
                      style={{
                        height: '160px',
                        background: `url(${project.imageUrl}) center/cover`,
                        position: 'relative',
                        cursor: 'pointer',
                      }}
                      onClick={() => handlePreviewProject(project)}
                    >
                      <div className="domain-badge">
                        {(() => {
                          const filter = DOMAIN_FILTERS_CONFIG.find(
                            (f) =>
                              f.key !== 'all' &&
                              f.projectIds.includes(project.id)
                          );
                          return filter
                            ? t(filter.labelKey)
                            : t('community.all');
                        })()}
                      </div>
                      <div className="hover-buttons">
                        <Button
                          type="text"
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePreviewProject(project);
                          }}
                          disabled={!project.previewUrl}
                          className="hover-btn"
                        >
                          {t('home.preview')}
                        </Button>
                        <Button
                          type="primary"
                          size="small"
                          icon={<CopyOutlined />}
                          loading={loading === project.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCloneProject(project);
                          }}
                          className="hover-btn"
                        >
                          {t('home.clone')}
                        </Button>
                      </div>
                    </div>
                  }
                >
                  <Card.Meta
                    title={
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '8px 0 4px 0',
                          gap: '8px',
                          textAlign: 'center',
                        }}
                      >
                        <Text
                          strong
                          style={{
                            fontSize: '14px',
                            color: '#333',
                            textAlign: 'center',
                            flex: '0 0 auto',
                          }}
                        >
                          {project.name}
                        </Text>
                        <span
                          className="author"
                          style={{
                            fontSize: '14px',
                            color: '#999',
                            textAlign: 'center',
                            flex: '0 0 auto',
                          }}
                        >
                          {t('home.by')} {project.author}
                        </span>
                      </div>
                    }
                  />
                </Card>
              </Col>
            ))}
          </Row>
        </Spin>
      </div>

      {filteredProjects.length === 0 && !projectsLoading && (
        <div className="empty-state">
          <Text style={{ fontSize: '18px' }}>{t('home.noProjectsFound')}</Text>
        </div>
      )}
    </div>
  );
};
