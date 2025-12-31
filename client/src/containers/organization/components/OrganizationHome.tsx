import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AppstoreOutlined,
  PlusOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { Button, Flex, Input, Segmented, Spin } from 'antd';
import { useNavigate } from 'react-router';

import { RollupSection } from '../../../common/components/RollupSection';
import { useCurrentUser } from '../../../common/contexts/currentUserContext';
import { useLanguage } from '../../../common/contexts/languageContext';
import { ReactComponent as EmptyIcon } from '../../../common/icons/empty-icon.svg';
import { LoadingScreen } from '../../layout/components/LoadingScreen';
import { HomePath } from '../../nav/paths';
import { ProjectCard } from '../../project/components/ProjectCard';
import ProjectsList from '../../project/components/ProjectsList';
import { useOrganizationWithInfiniteProjects } from '../hooks/useOrganization';

import './OrganizationHome.scss';

const { Search } = Input;

type ViewMode = 'card' | 'list';

export function OrganizationHome() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user } = useCurrentUser();
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [searchText, setSearchText] = useState('');
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // Defer the expensive rendering work while keeping UI responsive
  const deferredViewMode = useDeferredValue(viewMode);

  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useOrganizationWithInfiniteProjects();

  // Get organization info from the first page
  const organization = data?.pages[0];

  // Flatten all projects from all pages
  const allProjects = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page) => page.projects || []);
  }, [data?.pages]);

  // Memoize inOrganization check to avoid O(n*m) computation in each ProjectCard
  const inOrganization = useMemo(() => {
    if (!organization?.users || !user?.id) return false;
    return organization.users.some((orgUser) => orgUser.id === user.id);
  }, [organization?.users, user?.id]);

  // Filter projects by search text
  const filteredProjects = useMemo(() => {
    if (!allProjects.length) return [];

    if (searchText.trim()) {
      const lowerSearch = searchText.toLowerCase().trim();
      return allProjects.filter((project) =>
        project.name.toLowerCase().includes(lowerSearch)
      );
    }

    return allProjects;
  }, [allProjects, searchText]);

  // Update view mode immediately for responsive UI
  const handleViewModeChange = useCallback((value: ViewMode) => {
    setViewMode(value);
  }, []);

  // Lazy load more items when scrolling near the bottom
  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage) {
      return;
    }

    const element = loadMoreRef.current;
    if (!element || typeof IntersectionObserver === 'undefined') {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            fetchNextPage();
          }
        });
      },
      { root: null, rootMargin: '200px', threshold: 0.1 }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isError) {
    throw error;
  }

  if (isLoading || !organization) {
    return <LoadingScreen />;
  }

  const hasProjects = allProjects.length > 0;
  const hasFilteredProjects = filteredProjects.length > 0;

  const renderEmptyState = () => {
    const isSearchEmpty = searchText.trim() && !hasFilteredProjects;

    return (
      <div className="empty-state">
        <EmptyIcon />
        <div className="empty-text">
          {isSearchEmpty
            ? t('organization.noProjectsFound')
            : t('organization.noProjectsAvailable')}
        </div>
        {!isSearchEmpty && (
          <Button
            id="add-project-btn"
            type="primary"
            icon={<PlusOutlined />}
            size="middle"
            onClick={() => {
              navigate('/' + HomePath);
            }}
          >
            {t('organization.newProject')}
          </Button>
        )}
      </div>
    );
  };

  const renderProjects = () => {
    if (!hasFilteredProjects) {
      return renderEmptyState();
    }

    // Check if we're transitioning between views
    const isTransitioning = viewMode !== deferredViewMode;

    // Use deferredViewMode for expensive rendering while keeping UI responsive
    // The Segmented component updates immediately via viewMode,
    // while the actual rendering uses deferredViewMode
    // Show list view while transitioning to card view to avoid blocking
    if (deferredViewMode === 'card' && !isTransitioning) {
      return (
        <div className="projects-grid">
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              organization={organization}
              inOrganization={inOrganization}
            />
          ))}
          {/* Sentinel element for lazy loading */}
          {hasNextPage && (
            <div
              ref={loadMoreRef}
              style={{
                width: '100%',
                height: '20px',
                gridColumn: '1 / -1',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              {isFetchingNextPage && <Spin size="small" />}
            </div>
          )}
        </div>
      );
    }

    // Show list view during transition or when list view is selected
    return (
      <div className="projects-list">
        <ProjectsList
          organization={{
            ...organization,
            projects: filteredProjects,
          }}
        />
        {/* Sentinel element for lazy loading */}
        {hasNextPage && (
          <div
            ref={loadMoreRef}
            style={{
              width: '100%',
              height: '20px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            {isFetchingNextPage && <Spin size="small" />}
          </div>
        )}
      </div>
    );
  };

  const renderContent = () => {
    const elements = [];

    if (hasProjects) {
      elements.push(
        <div key="header" className="header-section" style={{ width: '100%' }}>
          <div className="search-view-controls">
            <Search
              className="search-input"
              placeholder={t('organization.searchProjects')}
              allowClear
              size="large"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onSearch={setSearchText}
            />
            <Segmented
              value={viewMode}
              onChange={(value) => handleViewModeChange(value as ViewMode)}
              options={[
                {
                  label: t('organization.cardView'),
                  value: 'card',
                  icon: <AppstoreOutlined />,
                },
                {
                  label: t('organization.listView'),
                  value: 'list',
                  icon: <UnorderedListOutlined />,
                },
              ]}
            />
          </div>
        </div>
      );
    }

    elements.push(
      <div key="content" style={{ width: '100%' }}>
        {renderProjects()}
      </div>
    );

    return elements;
  };

  return (
    <Flex className="page-container organization-home" vertical>
      <RollupSection title={t('organization.currentProjects')} actions={[]}>
        {renderContent()}
      </RollupSection>
    </Flex>
  );
}
