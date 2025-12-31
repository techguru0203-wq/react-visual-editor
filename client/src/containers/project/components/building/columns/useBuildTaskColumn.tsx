import { useEffect, useState } from 'react';
import { CodeOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { DOCTYPE, IssueStatus, SubscriptionTier } from '@prisma/client';
import { Button, message, Tooltip } from 'antd';
import { useNavigate } from 'react-router-dom';

import { ProjectTask } from '../../../../../../../shared/types';
import { useAppModal } from '../../../../../common/components/AppModal';
import { useCurrentUser } from '../../../../../common/contexts/currentUserContext';
import { useLanguage } from '../../../../../common/contexts/languageContext';
import { useProjectQuery } from '../../../../../common/hooks/useProjectsQuery';
import { getHeaders } from '../../../../../common/util/apiHeaders';
import { isFeatureLocked } from '../../../../../common/util/app';
import { api_url, GenerationMinimumCredit } from '../../../../../lib/constants';
import useUserProfileQuery from '../../../../profile/hooks/useUserProfileQuery';
import {
  createAndUploadToBitbucket,
  createBranchAndPullRequestBitbucket,
} from '../../../api/bitbucketApi';
import {
  createAndUploadToGithub,
  createBranchAndPullRequest,
} from '../../../api/githubApi';
import useDocumentMutation from '../../../hooks/useDocumentMutation';
import { ProjectFile } from '../../prototype/PrototypeEditor';

type UseBuildTaskColumnArgs = {
  issues: ReadonlyArray<ProjectTask>;
  onChange: (item: { id: string; status: IssueStatus | undefined }) => void;
};

const BUILD_COLUMN_WIDTH = 80;

// Create a separate component for each button to have its own state
function BuildButton({
  record,
  issue,
  issues,
  onChange,
}: {
  record: { id: string; status: IssueStatus };
  issue: ProjectTask | undefined;
  issues: ReadonlyArray<ProjectTask>;
  onChange: (item: { id: string; status: IssueStatus | undefined }) => void;
}) {
  const { user, organization } = useCurrentUser();
  const { showAppModal } = useAppModal();
  const navigate = useNavigate();
  const { t } = useLanguage();

  // Get user profile with meta data
  const { data: userProfile } = useUserProfileQuery(user.id);

  const { data: project } = useProjectQuery(issue?.projectId as string);
  const prototypeDoc = project?.documents.find(
    (d) => d.type === DOCTYPE.PROTOTYPE
  );

  const { subscriptionStatus, subscriptionTier } = useCurrentUser();
  let isTaskGenerationLocked = isFeatureLocked(
    subscriptionStatus as string,
    subscriptionTier as string,
    SubscriptionTier.ENTERPRISE
  );

  const isGenerationLocked =
    (organization?.credits ?? 0) <= GenerationMinimumCredit ||
    isTaskGenerationLocked;

  const [isCreatingPR, setIsCreatingPR] = useState(false);
  const [hasExistingRepo, setHasExistingRepo] = useState(false);

  const { upsertDocumentMutation } = useDocumentMutation({
    onSuccess: () => {
      console.log('upsertDocumentMutation.success');
    },
    onError: () => {
      console.error('error');
    },
  });

  useEffect(() => {
    if (!prototypeDoc) {
      return;
    }

    if ((userProfile?.meta as any)?.github_profile?.accessToken || (userProfile?.meta as any)?.bitbucket_profile?.accessToken) {
      setHasExistingRepo(true);
    }

    // Check if there are no issues in any milestone that are generating
    const hasGeneratingIssueInAnyMilestone = project?.milestones?.some(
      (milestone) =>
        milestone.sprints?.some(
          (sprint) =>
            sprint.stories?.some(
              (story) =>
                story.tasks?.some(
                  (task: any) => task.status === IssueStatus.GENERATING
                )
            )
        )
    );

    if (!hasGeneratingIssueInAnyMilestone) {
      localStorage.setItem('buildInProgress', 'false');
    }
  }, [
    prototypeDoc,
    issues,
    record.id,
    project?.id,
    project?.milestones,
    userProfile?.meta,
  ]);

  const handleClick = async () => {
    if (isGenerationLocked) {
      showAppModal({
        type: 'updateSubscription',
        payload: {
          email: user.email,
          source: 'devBuilder',
          destination: 'generateTaskCode',
        },
      });
      return;
    }

    if (!(userProfile?.meta as any)?.github_profile?.accessToken && !(userProfile?.meta as any)?.bitbucket_profile?.accessToken) {
      message.info('Please Connect to Github or Bitbucket first');
      navigate('/settings/github');
      return;
    }

    const hasGeneratingIssue = issues.some(
      (issue: ProjectTask) => issue.status === IssueStatus.GENERATING
    );
    if (hasGeneratingIssue) {
      message.info('Please wait for your current generation to complete');
      return;
    }

    //Prevent multiple simultaneous builds globally
    if (localStorage.getItem('buildInProgress') === 'true') {
      message.info('Please wait for your current generation to complete');
      return;
    }

    localStorage.setItem('buildInProgress', 'true');

    // Update status to STARTED when build begins
    onChange({ id: record.id, status: IssueStatus.GENERATING });

    // Make the API call non-blocking
    getHeaders()
      .then(async (headers) => {
        // Check if prototypeDoc exists
        if (!prototypeDoc) {
          throw new Error('No prototype document found');
        }

        let prototypeCode: string;
        try {
          // get the updated prototypeCode from API call
          const result = await fetch(
            `${api_url}/api/documents/${prototypeDoc?.id}`,
            {
              method: 'GET',
              headers,
              credentials: 'include',
            }
          );

          const { success, data, errorMsg } = await result.json();
          if (!success) {
            throw new Error(errorMsg);
          }

          // Use the updated prototypeCode from the API response
          prototypeCode = data.contents;

          let existingRepoUrl = (prototypeDoc?.meta as any)?.repoUrl;
          if (!existingRepoUrl) {
            const files = JSON.parse(prototypeCode).files;
            let projectFiles: ProjectFile[] = [];
            if (files && Array.isArray(files)) {
              projectFiles = files.map((file: any) => {
                let fileContent = file.content;
                // Handle different content types
                if (
                  file.path === 'package.json' &&
                  typeof fileContent === 'object'
                ) {
                  // package.json should be stringified if it's an object
                  fileContent = JSON.stringify(fileContent, null, 2);
                } else if (typeof fileContent === 'object') {
                  // For other objects, stringify them
                  fileContent = String(prototypeCode); //JSON.stringify(fileContent, null, 2);
                } else if (typeof fileContent !== 'string') {
                  // Convert non-strings to strings
                  fileContent = String(fileContent);
                }
                return {
                  type: 'file' as const,
                  content: fileContent,
                  path: file.path,
                };
              });
            }

            try {
              const result = await createAndUploadToGithub(
                projectFiles,
                project?.name || '',
                project?.description || '',
                (userProfile?.meta as any)?.github_profile?.accessToken || '',
                (userProfile?.meta as any)?.github_profile?.userName || ''
              );

              if (result.repoUrl) {
                await upsertDocumentMutation.mutateAsync({
                  id: prototypeDoc.id,
                  meta: {
                    ...(typeof prototypeDoc.meta === 'object' &&
                    prototypeDoc.meta !== null
                      ? prototypeDoc.meta
                      : {}),
                    repoUrl: result.repoUrl,
                  },
                });
                if (prototypeDoc && prototypeDoc.meta) {
                  (prototypeDoc.meta as any).repoUrl = result.repoUrl;
                }
              }
              setHasExistingRepo(true);
            } catch (error) {
              const errorMessage =
                error instanceof Error
                  ? error.message
                  : 'Failed to upload to GitHub';
              console.log(errorMessage);
            }
          } else if (existingRepoUrl) {
            setHasExistingRepo(true);
          }
        } catch (error) {
          console.error('Error fetching updated prototype code:', error);
          if (!prototypeDoc?.content) {
            throw new Error('No prototype document content found');
          }
          prototypeCode = prototypeDoc.content as any;
        }

        return fetch(`${api_url}/api/documents/generate-document-task-generation`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            entityId: prototypeDoc?.id,
            entityType: prototypeDoc?.type,
            entitySubType: prototypeDoc?.type,
            name: prototypeDoc?.name,
            description: issue?.description,
            projectId: issue?.projectId,
            contents: prototypeCode,
            chatSessionId: '',
            issueId: issue?.id,
          }),
        });
      })
      .then((response) => {
        if (response.ok) {
          return response.text();
        } else {
          throw new Error('API call failed');
        }
      })
      .then((fullResponse) => {
        localStorage.setItem('buildInProgress', 'false');
        // Split by newlines, filter out empty lines, and get the last line
        const lines = fullResponse.split('\n').filter(Boolean);
        let lastStatusMessage = '';
        try {
          const lastLine = lines[lines.length - 1];
          const lastObj = JSON.parse(lastLine);
          lastStatusMessage = lastObj?.status?.message || '';
        } catch (e) {
          console.error('Failed to parse last status message:', e);
        }

        localStorage.setItem('buildInProgress', 'false');
        if (lastStatusMessage === 'Deployment complete') {
          onChange({ id: record.id, status: IssueStatus.INREVIEW });
        } else {
          message.error(t('building.taskGenerationFailed'));
          onChange({ id: record.id, status: IssueStatus.STARTED });
        }
      })
      .catch((error) => {
        console.error('Build error:', error);
      });
  };

  const handleViewCode = async () => {
    console.log('handleViewCode called');

    if (!prototypeDoc?.id) {
      console.log('No prototypeDoc.id found');
      message.error('No prototype document found');
      return;
    }

    try {
      // Extract repository name from the URL
      // URL format: https://github.com/username/repo-name
      const projectName = project?.name
        ? project.name.replace(/\s+/g, '-')
        : '';
      const repoUrlParts = (prototypeDoc.meta as any)?.repoUrl
        ? (prototypeDoc.meta as any).repoUrl.split('/')
        : [projectName];
      const repoName = repoUrlParts[repoUrlParts.length - 1];

      if (!repoName) {
        console.log('Invalid repo name');
        message.error('Invalid repository URL format');
        return;
      }

      // Parse the document contents using the server-side codebase manager
      let projectFiles: ProjectFile[] = [];
      try {
        // get the updated prototypeCode from API call
        const headers = await getHeaders();
        const result = await fetch(
          `${api_url}/api/documents/${prototypeDoc?.id}`,
          {
            method: 'GET',
            headers,
            credentials: 'include',
          }
        );

        const { success, data, errorMsg } = await result.json();
        if (!success) {
          throw new Error(errorMsg);
        }

        // Use the updated prototypeCode from the API response
        const prototypeCode = data.contents;

        if (!prototypeCode) {
          console.log('No prototypeCode found');
          message.error('No project files found');
          return;
        }

        // Parse the JSON string to get project files
        const contentsData = JSON.parse(prototypeCode);

        if (
          contentsData &&
          contentsData.files &&
          Array.isArray(contentsData.files)
        ) {
          projectFiles = contentsData.files.map((file: any) => {
            let fileContent = file.content;
            // Handle different content types
            if (
              file.path === 'package.json' &&
              typeof fileContent === 'object'
            ) {
              // package.json should be stringified if it's an object
              fileContent = JSON.stringify(fileContent, null, 2);
            } else if (typeof fileContent === 'object') {
              // For other objects, stringify them
              fileContent = String(prototypeCode); //JSON.stringify(fileContent, null, 2);
            } else if (typeof fileContent !== 'string') {
              // Convert non-strings to strings
              fileContent = String(fileContent);
            }
            // If fileContent is already a string (like HTML, CSS, JS), keep it as is

            return {
              type: 'file' as const,
              content: fileContent,
              path: file.path,
            };
          });
        }
      } catch (parseError) {
        console.error('Error parsing document contents:', parseError);
        message.error('Failed to parse project files');
        return;
      }

      if (projectFiles.length === 0) {
        message.error('No project files found');
        return;
      }
      // Generate branch name from issue name
      const branchName = issue?.shortName
        ? String(issue.name)
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '')
        : `feature-${Date.now()}`;

      // Generate PR title and body
      const prTitle = issue?.name || 'Feature implementation';
      const prBody =
        issue?.description || 'Implementation for the requested feature';

      setIsCreatingPR(true);
      message.loading('Creating branch and pull request...');

      let baseBranch = "main";
      if ((prototypeDoc.meta as any)?.repoUrl?.includes('bitbucket')) {
        baseBranch = "master";
      }

      // Determine which API to use based on repository type
      let branchUrl: string;
      let prUrl: string;
      let prNumber: number;
      if ((prototypeDoc.meta as any)?.repoUrl?.includes('bitbucket') || (userProfile?.meta as any)?.bitbucket_profile) {
        // Use Bitbucket API
        const bitbucketProfile = (userProfile?.meta as any)?.bitbucket_profile;
        if (!(prototypeDoc.meta as any)?.repoUrl?.includes('bitbucket')) {
          // Create a repo on Bitbucket
          const result = await createAndUploadToBitbucket(
            projectFiles,
            project?.name || '',
            project?.description || ''
          );
          if (result.repoUrl) {
            await upsertDocumentMutation.mutateAsync({
              id: prototypeDoc.id,
              meta: {
                ...(typeof prototypeDoc.meta === 'object' && prototypeDoc.meta !== null
                  ? prototypeDoc.meta
                  : {}),
                repoUrl: result.repoUrl,
              },
            });
            if (prototypeDoc && prototypeDoc.meta) {
              (prototypeDoc.meta as any).repoUrl = result.repoUrl;
            }
          }
          setHasExistingRepo(true);
          // wait for Bitbucket Repo being created
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
        const { branchUrl: bbBranchUrl, prUrl: bbPrUrl, prNumber: bbPrNumber } = await createBranchAndPullRequestBitbucket({
          repoName,
          branchName,
          title: prTitle,
          body: prBody,
          files: projectFiles,
          baseBranch
        });
        branchUrl = bbBranchUrl;
        prUrl = bbPrUrl;
        prNumber = bbPrNumber;
      } else {
        // Use GitHub API
        const { branchUrl: ghBranchUrl, prUrl: ghPrUrl, prNumber: ghPrNumber } = await createBranchAndPullRequest(
          repoName,
          branchName,
          prTitle,
          prBody,
          projectFiles,
          baseBranch,
          (userProfile?.meta as any)?.github_profile?.accessToken || '',
          (userProfile?.meta as any)?.github_profile?.userName || '',
        );
        branchUrl = ghBranchUrl;
        prUrl = ghPrUrl;
        prNumber = ghPrNumber;
      }

      setIsCreatingPR(false);

      message.destroy();
      message.success(
        `Successfully created branch and pull request #${prNumber}`
      );
    } catch (error) {
      setIsCreatingPR(false);
      message.destroy();
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to create branch and pull request';
      message.error(errorMessage);
      console.error('Error in handleViewCode:', error);
    } finally {
      setIsCreatingPR(false);
    }
  };

  return (
    <div style={{ display: 'flex', gap: '4px' }}>
      <Tooltip
        title={
          record.status === IssueStatus.GENERATING
            ? 'Generating'
            : isTaskGenerationLocked
              ? 'Upgrade to Enterprise plan to generate code for task'
              : 'Generate Code'
        }
      >
        <Button
          size="small"
          style={{
            width: BUILD_COLUMN_WIDTH / 4,
            color: [
              IssueStatus.CREATED,
              IssueStatus.STARTED,
              IssueStatus.GENERATING,
              IssueStatus.INREVIEW,
              IssueStatus.APPROVED,
              IssueStatus.COMPLETED,
            ].includes(record.status as any)
              ? '#52c41a'
              : record.status === IssueStatus.CANCELED
                ? '#ff4d4f'
                : '#595959',
            fontSize: '12px',
            background: 'none',
            border: 'none',
          }}
          onClick={handleClick}
          loading={record.status === IssueStatus.GENERATING}
          disabled={
            record.status === IssueStatus.CANCELED ||
            record.status === IssueStatus.APPROVED ||
            record.status === IssueStatus.INREVIEW ||
            record.status === IssueStatus.COMPLETED
          }
        >
          {record.status !== IssueStatus.STARTED &&
          record.status !== IssueStatus.CREATED &&
          record.status !== IssueStatus.CANCELED &&
          record.status !== IssueStatus.GENERATING
            ? '✓'
            : record.status === IssueStatus.GENERATING
              ? ''
              : '▶'}
          {isTaskGenerationLocked && (
            <Tooltip title={t('common.upgradeToPerformance')}>
              <InfoCircleOutlined style={{ color: 'orange' }} />
            </Tooltip>
          )}
        </Button>
      </Tooltip>

      {record.status === IssueStatus.INREVIEW && (
        <Tooltip title={t('common.viewCode')}>
          <Button
            size="small"
            style={{
              color: '#5345F3',
              backgroundColor: 'none',
              border: 'none',
              padding: '0px 5px',
              fontSize: 18,
            }}
            onClick={handleViewCode}
            disabled={isCreatingPR || !hasExistingRepo}
            title={
              !hasExistingRepo
                ? 'No GitHub repository connected'
                : 'Create branch and pull request'
            }
          >
            <CodeOutlined style={{ fontSize: '12px' }} />
          </Button>
        </Tooltip>
      )}
    </div>
  );
}

export function useBuildTaskColumn({
  issues,
  onChange,
}: UseBuildTaskColumnArgs) {
  return {
    title: 'Action',
    key: 'action',
    width: BUILD_COLUMN_WIDTH,
    render: (record: { id: string; status: IssueStatus }) => {
      const issue = issues.find((issue) => issue.id === record.id);

      return (
        <BuildButton
          record={{ ...record, status: record.status as IssueStatus }}
          issue={issue}
          issues={issues}
          onChange={onChange}
        />
      );
    },
  };
}
