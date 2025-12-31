import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Card, Tooltip, Typography } from 'antd';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useNavigate } from 'react-router';

import { useCurrentUser } from '../../../common/contexts/currentUserContext';
import { ProjectDropdownOperMenu } from '../../layout/components/ProjectDropdownOperMenu';
import { ProjectsPath } from '../../nav/paths';

import './ProjectCard.scss';

dayjs.extend(relativeTime);

const { Text } = Typography;

type ProjectCardProps = {
  project: any;
  organization?: any;
  inOrganization?: boolean;
};

function ProjectCardComponent({
  project,
  organization,
  inOrganization: inOrganizationProp,
}: ProjectCardProps) {
  const navigate = useNavigate();
  const { user } = useCurrentUser();

  const isOwner = project.owner?.id === user.id;
  // Use prop if provided, otherwise fall back to checking organization users
  const inOrganization =
    inOrganizationProp !== undefined
      ? inOrganizationProp
      : organization?.users?.some((orgUser: any) => orgUser.id === user.id);
  const isShared =
    (project.access === 'SELF' && !isOwner) ||
    (project.access === 'ORGANIZATION' && !inOrganization);

  // Memoize preview URL computation to avoid re-computing on every render
  const previewUrl = useMemo(() => {
    if (!project.documents || !Array.isArray(project.documents)) {
      return null;
    }
    // First try to find PRODUCT document with sourceUrl
    const productDoc = project.documents.find(
      (doc: any) => doc.type === 'PRODUCT' && doc.meta?.sourceUrl
    );

    if (productDoc) {
      return productDoc.meta.sourceUrl;
    }

    // If no PRODUCT, try PROTOTYPE document with sourceUrl
    const prototypeDoc = project.documents.find(
      (doc: any) => doc.type === 'PROTOTYPE' && doc.meta?.sourceUrl
    );

    return prototypeDoc?.meta?.sourceUrl || null;
  }, [project.documents]);

  // Lazy-mount preview iframe only when visible to avoid focus-induced auto scrolling
  const coverRef = useRef<HTMLDivElement | null>(null);
  const [shouldLoadPreview, setShouldLoadPreview] = useState(false);

  // Defer IntersectionObserver setup to avoid blocking initial render
  useEffect(() => {
    if (!previewUrl) {
      return;
    }

    let observer: IntersectionObserver | null = null;

    // Defer observer setup to next frame to avoid blocking initial render
    const timeoutId = setTimeout(() => {
      const element = coverRef.current;
      if (!element || typeof IntersectionObserver === 'undefined') {
        // Fallback: if IO not supported, load immediately
        setShouldLoadPreview(true);
        return;
      }

      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setShouldLoadPreview(true);
              observer?.disconnect();
            }
          });
        },
        { root: null, rootMargin: '200px', threshold: 0.01 }
      );
      observer.observe(element);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      observer?.disconnect();
    };
  }, [previewUrl]);

  const handleCardClick = () => {
    navigate(`/${ProjectsPath}/${project.id}`);
  };

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const updatedAt = project.updatedAt || project.createdAt;
  const timeAgo = dayjs(updatedAt).fromNow();

  // Get first letter of project name for icon
  const projectInitial = project.name?.charAt(0)?.toUpperCase() || 'P';

  return (
    <Card
      className={`project-card ${isShared ? 'project-card-shared' : ''}`}
      hoverable
      onClick={handleCardClick}
      cover={
        <div className="project-card-cover" ref={coverRef}>
          {previewUrl && shouldLoadPreview ? (
            <iframe
              src={previewUrl}
              title={project.name}
              className="project-preview-iframe"
              loading="lazy"
              tabIndex={-1}
              sandbox="allow-scripts allow-same-origin"
            />
          ) : (
            <div className="project-card-placeholder" />
          )}
        </div>
      }
    >
      <div className="project-card-content">
        <div className="project-card-header">
          <Tooltip title={project.name}>
            <Text ellipsis className="project-card-name">
              {project.name}
            </Text>
          </Tooltip>
          <div onClick={handleMenuClick}>
            <ProjectDropdownOperMenu
              isShowDots={true}
              project={project}
              menuItemKey={`/${ProjectsPath}/${project.id}`}
              onMenuItemClicked={() => {}}
            />
          </div>
        </div>
        <div className="project-card-footer">
          <div className="project-card-icon">
            <span>{projectInitial}</span>
          </div>
          <Text type="secondary" className="project-card-time">
            Edited {timeAgo}
          </Text>
        </div>
      </div>
    </Card>
  );
}

// Memoize ProjectCard to prevent unnecessary re-renders
export const ProjectCard = memo(ProjectCardComponent);
