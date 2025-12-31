import { useEffect, useRef, useState } from 'react';
import { DOCTYPE, IssueType } from '@prisma/client';
import { Flex, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';

import { useCurrentUser } from '../../../common/contexts/currentUserContext';
import { useLanguage } from '../../../common/contexts/languageContext';
import { COLORS } from '../../../lib/constants';
import { useUserDocuments } from '../../documents/hooks/useUserDocuments';
import { useMyIssues } from '../../issues/hooks/useMyIssues';
import { LoadingScreen } from '../../layout/components/LoadingScreen';
import { useUpdateIssueMutation } from '../../project/hooks/useIssueMutation';
import { DocTable, EmptyDoc } from './DocTable';
import { EmptyProject, IssuesTable } from './IssueTable';
import UserGuideCard from './UserGuideCard';

import 'driver.js/dist/driver.css';
import './MyIssues.scss';

// Number of issues to render initially and per batch
const INITIAL_ISSUE_COUNT = 20;
const ISSUE_BATCH_SIZE = 20;

export default function MyIssues() {
  const { user } = useCurrentUser();
  const { t } = useLanguage();

  // Only load documents - chat sessions are not used (commented out in render)
  const { data: documents, isLoading: isLoadingDoc } = useUserDocuments(
    user.id
  );

  const { data, isLoading, isError, error } = useMyIssues();
  const navigate = useNavigate();
  const [visibleIssueCount, setVisibleIssueCount] =
    useState(INITIAL_ISSUE_COUNT);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  let allIssues =
    data?.filter(
      (issue) =>
        issue.type === IssueType.TASK || issue.type === IssueType.BUILDABLE
    ) || [];

  // Only show visible issues for lazy loading
  let issues = allIssues.slice(0, visibleIssueCount);
  const hasMoreIssues = visibleIssueCount < allIssues.length;

  // Reset visible issue count when issues change
  useEffect(() => {
    setVisibleIssueCount(INITIAL_ISSUE_COUNT);
  }, [allIssues.length]);

  // Lazy load more issues when scrolling near the bottom
  useEffect(() => {
    if (visibleIssueCount >= allIssues.length) {
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
            setVisibleIssueCount((prev) => {
              const next = Math.min(prev + ISSUE_BATCH_SIZE, allIssues.length);
              return next;
            });
          }
        });
      },
      { root: null, rootMargin: '200px', threshold: 0.1 }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [visibleIssueCount, allIssues.length]);

  const updateIssueMutation = useUpdateIssueMutation({
    onSuccess: () => {
      console.log('updateIssueMutation.success');
    },
    onError: (e) => {
      console.error('updateIssueMutation.error:', e);
    },
  });

  // Show loading only for issues (main content), don't block on documents
  if (isLoading) {
    return <LoadingScreen />;
  }
  if (isError) {
    return <>Error: {error}</>;
  }

  if (!user) {
    console.log(
      "in containers.myissues.components.MyIssues: user doesn't exist"
    );
    navigate('/signin');
    return;
  }

  return (
    <>
      <Flex className="my-issues" vertical>
        <Flex vertical>
          <Typography.Title
            level={4}
            style={{ marginBottom: '8px' }}
            className="main-heading"
          >
            Hi, {user.firstname?.trim()}
          </Typography.Title>
          <Flex
            style={{
              fontSize: '12px',
              paddingLeft: '2px',
              color: COLORS.GRAY,
            }}
          >
            {t('issues.recentTasks')}
          </Flex>
        </Flex>
        <Flex
          style={{ flexGrow: 1, marginTop: '20px', columnGap: '20px' }}
          className="main-content"
        >
          {allIssues.length ? (
            <div style={{ flexGrow: 1, overflowX: 'hidden' }}>
              <div className="user-guide-card-mobile">
                <UserGuideCard />
              </div>
              <div
                style={{
                  border: `solid 1px ${COLORS.LIGHT_GRAY}`,
                  borderRadius: '15px',
                  padding: '10px',
                  maxHeight: 'calc(100vh - 122px)',
                  overflowY: 'auto',
                }}
              >
                <IssuesTable issues={issues} />
                {/* Sentinel element for lazy loading */}
                {hasMoreIssues && (
                  <div
                    ref={loadMoreRef}
                    style={{
                      width: '100%',
                      height: '20px',
                    }}
                  />
                )}
              </div>
            </div>
          ) : (
            <EmptyProject />
          )}
          <Flex
            vertical
            style={{
              minWidth: '45%',
              overflow: 'hidden',
            }}
          >
            <div className="user-guide-card">
              <UserGuideCard />
            </div>
            <div
              style={{
                fontSize: '16px',
                marginTop: '20px',
                marginBottom: '5px',
              }}
            >
              {t('myIssues.recentApps')}
            </div>
            {isLoadingDoc ? (
              <div
                style={{
                  border: `solid 1px ${COLORS.LIGHT_GRAY}`,
                  borderRadius: '15px',
                  padding: '8px',
                  minHeight: '100px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography.Text style={{ color: COLORS.GRAY }}>
                  {t('common.loading') || 'Loading...'}
                </Typography.Text>
              </div>
            ) : documents?.filter((doc) => doc.type === DOCTYPE.PROTOTYPE)
                .length ? (
              <div
                style={{
                  border: `solid 1px ${COLORS.LIGHT_GRAY}`,
                  borderRadius: '15px',
                  padding: '8px',
                  overflowY: 'auto',
                }}
              >
                <DocTable
                  docs={documents.filter(
                    (doc) => doc.type === DOCTYPE.PROTOTYPE
                  )}
                />
              </div>
            ) : (
              <EmptyDoc />
            )}
            <div
              style={{
                fontSize: '16px',
                marginTop: '20px',
                marginBottom: '5px',
              }}
            >
              {t('myIssues.recentPrds')}
            </div>
            {isLoadingDoc ? (
              <div
                style={{
                  border: `solid 1px ${COLORS.LIGHT_GRAY}`,
                  borderRadius: '15px',
                  padding: '8px',
                  minHeight: '100px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography.Text style={{ color: COLORS.GRAY }}>
                  {t('common.loading') || 'Loading...'}
                </Typography.Text>
              </div>
            ) : documents?.filter((doc) => doc.type === DOCTYPE.PRD).length ? (
              <div
                style={{
                  border: `solid 1px ${COLORS.LIGHT_GRAY}`,
                  borderRadius: '15px',
                  padding: '8px',
                  overflowY: 'auto',
                }}
              >
                <DocTable
                  docs={documents.filter((doc) => doc.type === DOCTYPE.PRD)}
                />
              </div>
            ) : (
              <EmptyDoc />
            )}
            {/*
            {ideas?.length ? (
              <div
                style={{
                  border: `solid 1px ${COLORS.LIGHT_GRAY}`,
                  borderRadius: '15px',
                  padding: '8px',
                  overflowY: 'auto',
                }}
              >
                <IdeaTable ideas={ideas} />
              </div>
            ) : (
              <EmptyIdea />
            )} */}
          </Flex>
        </Flex>
      </Flex>
    </>
  );
}
