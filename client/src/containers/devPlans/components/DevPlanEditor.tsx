import React, { useCallback, useEffect, useRef, useState } from 'react';
import { InfoCircleOutlined, PlusCircleOutlined } from '@ant-design/icons';
import {
  ChatSessionTargetEntityType,
  DOCTYPE,
  DocumentStatus,
  IssueType,
} from '@prisma/client';
import { useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Card,
  Collapse,
  DatePicker,
  Empty,
  Flex,
  Form,
  message,
  Modal,
  Popconfirm,
  Skeleton,
  Space,
  Spin,
  Steps,
  Tabs,
  theme,
  Tooltip,
  Tree,
  Typography,
} from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import { random } from 'lodash';
import ReactMarkdown from 'react-markdown';
import { useNavigate, useParams } from 'react-router';

import { useAppModal } from '../../../common/components/AppModal';
import {
  ErrorMessage,
  GenerationMinimumCredit,
} from '../../../common/constants';
import { useCurrentUser } from '../../../common/contexts/currentUserContext';
import { useLanguage } from '../../../common/contexts/languageContext';
import {
  useProjectAccessQuery,
  useProjectQuery,
} from '../../../common/hooks/useProjectsQuery';
import { useMakeProductStore } from '../../../common/store/makeProductStore';
import { getOutOfCreditTitle } from '../../../common/util/app';
import { COLORS } from '../../../lib/constants';
import { createDevPlanDocxFile } from '../../../lib/convert';
import trackEvent from '../../../trackingClient';
import DocumentToolbar from '../../documents/components/DocumentToolbar';
import { BuildingPath, DocumentsPath, ProjectsPath } from '../../nav/paths';
import { getSpecialtyDisplayName } from '../../profile/profileUtils';
import { generateDocumentWithSSE } from '../../project/api/document';
import { useTeamOrOrganizationUsers } from '../../team/hooks/useTeamOrOrganizationUsers';
import { GET_DEV_PLAN_QUERY_KEY, useDevPlan } from '../hooks/useDevPlan';
import { useUpdateDevPlanMutation } from '../hooks/useUpdateDevPlanMutation';
import {
  DevPlanOutput,
  Epic,
  Milestone,
  Sprint,
  Story,
  Task,
} from '../types/devPlanTypes';
import { DevPlanEditorItemTitle } from './DevPlanEditorItemTitle';
import { syncEpicInMilestone, syncMilestoneToEpic } from './DevPlanEditorUtils';
import { DevPlanMilestoneTitle } from './DevPlanMilestoneTitle';
import { DevPlanSpecialtyInput } from './DevPlanSpecialtyInput';
import { DevPlanSprintTitle } from './DevPlanSprintTitle';
import { DevPlanStoryTitle } from './DevPlanStoryTitle';
import { DevPlanTeamInput } from './DevPlanTeamInput';

import './DevPlanEditor.scss';

type FormFields = Readonly<
  Pick<
    DevPlanOutput,
    | 'requiredSpecialties'
    | 'chosenDocumentIds'
    | 'teamMembers'
    | 'weeksPerSprint'
    | 'epics'
    | 'milestones'
  > & { sprintStartDate: Dayjs }
>;

const getDevPlanSteps = (t: (key: string) => string) => [
  {
    title: t('devplan.reviewWorkTitle'),
    // status: 'wait',
    description: t('devplan.reviewWorkDescription'),
  },
  {
    title: t('devplan.confirmScheduleTitle'),
    // status: 'process',
    description: t('devplan.confirmScheduleDescription'),
  },
];

const defaultWeeksPerSprint = 2;

const EpicTemplate = {
  type: IssueType.EPIC,
  storyPoint: 0,
  children: [],
};

const StoryTemplate = {
  type: IssueType.STORY,
  storyPoint: 0,
  children: [],
};

const TaskTemplate = {
  type: IssueType.TASK,
};

function useDevPlanIdParameter(): string {
  const { docId } = useParams();
  if (!docId) {
    throw new Error('You must specify a dev plan ID parameter');
  }
  return docId;
}

export function DevPlanEditor() {
  const { t } = useLanguage();
  const { token } = theme.useToken();
  const navigate = useNavigate();

  const DevPlanSteps = getDevPlanSteps(t);
  const devPlanId = useDevPlanIdParameter();

  const [currentStep, setStep] = useState(0);
  const [savedFormValues, setSavedFormValues] = useState<FormFields>();
  const [isDevPlanBeingPublished, setIsDevPlanBeingPublished] = useState(false);
  const isFetchingDevPlan = useRef(false);
  const sseAbortControllerRef = useRef<AbortController | null>(null);

  const [epicActiveKeys, setEpicActiveKeys] = useState<string[]>([]);
  const [storyActiveKeys, setStoryActiveKeys] = useState<string[]>(['0']);

  const {
    roles: makeProductRoles,
    teammateIds: makeProductTeammateIds,
    triggerDevPlanGeneration,
    clearMakeProductData,
  } = useMakeProductStore();

  const { showAppModal } = useAppModal();
  const queryClient = useQueryClient();

  const { user, organization } = useCurrentUser();
  const isGenerationLocked =
    (organization?.credits ?? 0) <= GenerationMinimumCredit;
  const { data: devPlan, isLoading, isError, error } = useDevPlan(devPlanId);
  const { data: availableUsers } = useTeamOrOrganizationUsers({
    source: 'team',
    teamId: devPlan?.project?.teamId,
  });

  const { data: project } = useProjectQuery(devPlan?.projectId as string);
  const { data: access } = useProjectAccessQuery(devPlan?.projectId as string);
  const disabled = access?.projectPermission === 'VIEW';

  const prdDoc = project?.documents.find((b) => b.type === DOCTYPE.PRD);

  const [form] = Form.useForm<FormFields>();
  const [teamError, setTeamError] = useState<string>();
  const [paragraphs, setParagraphs] = useState<any[]>([]);

  const formValues = Form.useWatch([], form);
  const requiredSpecialties = Form.useWatch('requiredSpecialties', form);

  useEffect(() => {
    if (devPlan?.epics) {
      setEpicActiveKeys(devPlan.epics.map((_, index) => index * 100 + ''));
    }
    if (devPlan) {
      const newParagraphs = createDevPlanDocxFile(devPlan, availableUsers);
      setParagraphs(newParagraphs);

      // Update form values when dev plan data changes (e.g., after generation)
      // Update if we have epics and they differ from what's in the form
      if (devPlan.epics && devPlan.epics.length > 0) {
        const currentEpics = form.getFieldValue('epics');
        const currentEpicsLength = currentEpics?.length || 0;
        const devPlanEpicsLength = devPlan.epics.length;

        // Update form if epics count changed (new generation) or if form is empty
        if (
          currentEpicsLength !== devPlanEpicsLength ||
          currentEpicsLength === 0
        ) {
          // Preserve existing form values for requiredSpecialties if they exist
          const currentRequiredSpecialties = form.getFieldValue(
            'requiredSpecialties'
          );
          const newValues = {
            requiredSpecialties:
              currentRequiredSpecialties?.length > 0
                ? currentRequiredSpecialties
                : devPlan.requiredSpecialties || [],
            chosenDocumentIds: devPlan.chosenDocumentIds || [],
            teamMembers: devPlan.teamMembers || [],
            weeksPerSprint: devPlan.weeksPerSprint || defaultWeeksPerSprint,
            sprintStartDate: devPlan.sprintStartDate
              ? dayjs(devPlan.sprintStartDate, 'MM/DD/YYYY')
              : dayjs(),
            epics: devPlan.epics,
            milestones: devPlan.milestones || [],
          };
          setSavedFormValues(newValues);
          form.setFieldsValue(newValues);
        }
      }
    }
  }, [formValues, savedFormValues, devPlan, availableUsers, form]);

  const onUpdateDevPlanSuccess = useCallback(
    (output: DevPlanOutput) => {
      if (output.status === DocumentStatus.PUBLISHED) {
        navigate(`/${ProjectsPath}/${output.projectId}/${BuildingPath}`);
      } else {
        const newValues = {
          requiredSpecialties: output.requiredSpecialties,
          chosenDocumentIds: output.chosenDocumentIds,
          teamMembers: output.teamMembers,
          weeksPerSprint: output.weeksPerSprint || defaultWeeksPerSprint,
          sprintStartDate: dayjs(output.sprintStartDate, 'MM/DD/YYYY'),
          epics: output.epics,
          milestones: output.milestones,
        };
        setSavedFormValues(newValues);
        form.setFieldsValue(newValues);
      }
    },
    [form, navigate]
  );
  const updateDevPlanMutation = useUpdateDevPlanMutation({
    onSuccess: onUpdateDevPlanSuccess,
  });

  const validateTeamMemberSpecialties = useCallback(() => {
    if (currentStep === 0) {
      return false;
    }
    let requiredSpecialties = form.getFieldValue('requiredSpecialties');
    let teamMemberSpecialties = form
      .getFieldValue('teamMembers')
      .map((s: any) => s.specialty);
    let missingSpecialties = requiredSpecialties.reduce(
      (accu: string[], s: string) => {
        if (teamMemberSpecialties.includes(s)) {
          return accu;
        } else if (
          // if frontend or backend is required but fullstack engineer is present, it's okay
          ['FRONTEND_ENGINEER', 'BACKEND_ENGINEER'].includes(s) &&
          teamMemberSpecialties.includes('FULLSTACK_ENGINEER')
        ) {
          return accu;
        } else if (
          // if fullstack is required but frontend/backend engineer is present, it's okay
          s === 'FULLSTACK_ENGINEER' &&
          teamMemberSpecialties.includes('FRONTEND_ENGINEER') &&
          teamMemberSpecialties.includes('BACKEND_ENGINEER')
        ) {
          return accu;
        }
        // finally, return the missing specialty
        return [...accu, s];
      },
      []
    );
    console.log('missingSpecialties:', missingSpecialties);
    if (missingSpecialties.length) {
      setTeamError(
        `Please add teammates: ${missingSpecialties
          .map((s: string) => getSpecialtyDisplayName(s, t))
          .join(', ')}`
      );
      return false;
    } else {
      setTeamError(undefined);
      return true;
    }
  }, [form, currentStep, t]);
  const handleErrorMsgs = (error: string | Error) => {
    const errorMessage = (error as string | Error).toString();
    console.log('DevPlanEditor.generateDocumentMutation.error: ', errorMessage);
    // disable isFetchingDevPlan if we have an error so page won't keep showing spinner and it will display the error
    if (errorMessage.endsWith(ErrorMessage.NOT_ENOUGH_CAPACITY_BACKEND)) {
      isFetchingDevPlan.current = false;
      setTeamError('This project requires backend (or fullstack) team members');
    } else if (
      errorMessage.endsWith(ErrorMessage.NOT_ENOUGH_CAPACITY_FRONTEND)
    ) {
      isFetchingDevPlan.current = false;
      setTeamError(
        'This project requires frontend (or fullstack) team members'
      );
    } else if (
      errorMessage.endsWith(ErrorMessage.NOT_ENOUGH_CAPACITY_ANDROID)
    ) {
      isFetchingDevPlan.current = false;
      setTeamError('This project requires Android team members');
    } else if (errorMessage.endsWith(ErrorMessage.NOT_ENOUGH_CAPACITY_IOS)) {
      isFetchingDevPlan.current = false;
      setTeamError('This project requires iOS team members');
    } else {
      console.error(
        'DevPlanEditor.generateDocumentMutation.error: ',
        errorMessage
      );
      // trigger window reload
      // window.location.reload();
    }
  };

  const setEpicsDataKeyMapping = (epics: ReadonlyArray<Epic>) => {
    epics.forEach((epic: Epic, index: number) => {
      if (epic) {
        epic.key = epic.key || `epic:${epics.length}`;
        epic.children.forEach((story: any, index: number) => {
          if (story) {
            story.key =
              story.key || `${epic.key};story:${epic.children.length}`;
            story.children.forEach((task: any, index: number) => {
              if (task) {
                task.key =
                  task.key || `${story.key};task:${story.children.length}`;
                task.sprintKey = task.sprintKey || '';
              }
            });
          }
        });
      }
    });
  };

  const validateStoryPoints = useCallback(
    (targets: Array<Milestone | Sprint | Epic | Story | Task>) => {
      let list = targets || [];
      for (let index = list.length - 1; index >= 0; --index) {
        let target = targets[index];
        // remove at story level will leave an undefined or incompeleted item in the array
        // we need to remove it to avoid errors.
        if (!target || (!target.name && !target.type)) {
          targets.splice(index, 1);
          return;
        }
        if ('children' in target && target.children) {
          validateStoryPoints(target.children); // First process the children
          target.storyPoint = target.children.reduce(
            (result, child) => result + child.storyPoint,
            0
          );
        }
      }
    },
    []
  );

  const saveDevPlan = useCallback(() => {
    if (devPlan) {
      form.validateFields().then(
        (values) => {
          setEpicsDataKeyMapping(values.epics);
          validateStoryPoints(values.epics);
          const input = {
            devPlanId: devPlan.id,
            epics: values.epics || devPlan.epics,
            sprints: devPlan.sprints,
            milestones: values.milestones || devPlan.milestones,
            weeksPerSprint: values.weeksPerSprint || defaultWeeksPerSprint,
            requiredSpecialties: (values.requiredSpecialties || []).join(','),
            chosenDocumentIds: (values.chosenDocumentIds || []).join(','),
            teamMembers: values.teamMembers || devPlan.teamMembers,
            sprintStartDate:
              values.sprintStartDate?.format('MM/DD/YYYY') ||
              devPlan.sprintStartDate,
            regenerateMilestones: true,
            publishPlan: false,
          };
          updateDevPlanMutation.mutate(input);
          // track event
          trackEvent('updateDevPlan', {
            distinct_id: user.email,
            payload: JSON.stringify({
              name: devPlan.name,
              id: devPlan.id,
              action: 'saveDevPlanAfterChange:reviewTask',
            }),
          });
        },
        () => {} // Just mark as invalid - nothing else to do
      );
    }
  }, [devPlan, form, updateDevPlanMutation, validateStoryPoints, user.email]);

  const saveDevPlanInMilestone = useCallback(() => {
    if (devPlan) {
      form.validateFields().then(
        (values) => {
          validateStoryPoints(values.milestones);
          const input = {
            devPlanId: devPlan.id,
            epics: values.epics || devPlan.epics,
            sprints: devPlan.sprints,
            milestones: values.milestones || devPlan.milestones,
            weeksPerSprint: values.weeksPerSprint || defaultWeeksPerSprint,
            requiredSpecialties: values.requiredSpecialties.join(','),
            chosenDocumentIds: (values.chosenDocumentIds || [prdDoc?.id]).join(
              ','
            ),
            teamMembers: values.teamMembers,
            sprintStartDate: values.sprintStartDate.format('MM/DD/YYYY'),
            regenerateMilestones: true,
            publishPlan: false,
          };
          // milestone and epics don't share same story instance in devplan,
          // we need to copy your changed story point and name in milestones to epics
          // we only do this when milestones exist, because when it doesn't exist, it's a newly created plan
          if (input.milestones.length) {
            syncMilestoneToEpic(input);
          }

          // after that we update epic's story point to correct value.
          validateStoryPoints(input.epics);

          // after that we update epic info in the milestone objects since they are another copy.
          syncEpicInMilestone(input);
          updateDevPlanMutation.mutate(input);
          // track event
          trackEvent('updateDevPlan', {
            distinct_id: user.email,
            payload: JSON.stringify({
              name: devPlan.name,
              id: devPlan.id,
              action: 'saveDevPlanAfterChange:reviewTimeline',
            }),
          });
        },
        () => {} // Just mark as invalid - nothing else to do
      );
    }
  }, [
    devPlan,
    form,
    updateDevPlanMutation,
    validateStoryPoints,
    user.email,
    prdDoc?.id,
  ]);

  // remove a task and save devplan
  const removeThenSave = (
    removeFunction: (index: number | number[]) => void,
    saveFunction: () => void
  ) => {
    return (index: number | number[]) => {
      removeFunction(index);
      saveFunction();
    };
  };

  const publishDevPlan = useCallback(() => {
    if (devPlan) {
      // track event
      trackEvent('publishDevPlan', {
        distinct_id: user.email,
        payload: JSON.stringify({
          name: devPlan.name,
          id: devPlan.id,
          projectId: devPlan.projectId,
        }),
      });
      // display message for publish dev plan for documents
      if (!devPlan.projectId) {
        const modal = Modal.info({
          title: t('devplan.publishTitle'),
          width: '510px',
          content: (
            <div>
              <p>
                {t('devplan.publishMessage')
                  .split('Add A Project')
                  .map((part, index) => (
                    <React.Fragment key={index}>
                      {part}
                      {index === 0 && (
                        <a
                          href="/"
                          onClick={(e) => {
                            e.preventDefault();
                            modal.destroy();
                            showAppModal({ type: 'addProject' });
                          }}
                        >
                          {t('devplan.addProject')}
                        </a>
                      )}
                    </React.Fragment>
                  ))}
              </p>{' '}
            </div>
          ),
          onOk() {},
        });
        return;
      }
      form.validateFields().then(
        (values) => {
          const input = {
            devPlanId: devPlan.id,
            epics: values.epics || devPlan.epics,
            sprints: devPlan.sprints,
            milestones: values.milestones || devPlan.milestones,
            weeksPerSprint: values.weeksPerSprint || defaultWeeksPerSprint,
            requiredSpecialties: values.requiredSpecialties.join(','),
            chosenDocumentIds: (values.chosenDocumentIds || [prdDoc?.id]).join(
              ','
            ),
            teamMembers: values.teamMembers,
            sprintStartDate: values.sprintStartDate.format('MM/DD/YYYY'),
            // TODO: decide a best regenerateMilestones flag logic
            regenerateMilestones: currentStep === 0,
            publishPlan: true,
          };
          updateDevPlanMutation.mutate(input);
          setIsDevPlanBeingPublished(true);
        },
        () => {} // Just mark as invalid - nothing else to do
      );
    }
  }, [
    devPlan,
    form,
    currentStep,
    updateDevPlanMutation,
    user.email,
    showAppModal,
    t,
    prdDoc?.id,
  ]);

  const autoSaveDevPlan = useCallback(() => {
    let isTeamValid = validateTeamMemberSpecialties();
    if (isTeamValid) {
      currentStep === 0 ? saveDevPlan() : saveDevPlanInMilestone();
    } else {
      console.log(
        "Team members don't have the required specialties, skipping autosave"
      );
    }
  }, [
    saveDevPlan,
    currentStep,
    saveDevPlanInMilestone,
    validateTeamMemberSpecialties,
  ]);

  const generateDevPlan = useCallback(() => {
    if (isGenerationLocked) {
      showAppModal({
        type: 'updateSubscription',
        payload: {
          email: user.email,
          source: 'devPlanEditor',
          destination: 'generateDevPlan',
        },
      });
      return;
    }
    if (devPlan) {
      form
        .validateFields([['requiredSpecialties'], ['chosenDocumentIds']])
        .then(
          (values) => {
            const input = {
              entityId: devPlan.id,
              entityType: ChatSessionTargetEntityType.DOCUMENT,
              entitySubType: DOCTYPE.DEVELOPMENT_PLAN,
              // id: documentId,
              // type: doc?.type,
              name: devPlan.name,
              description: devPlan?.description || '',
              projectId: devPlan.projectId as string,
              templateId: devPlan.templateDocumentId!,
              meta: {
                requiredSpecialties: values.requiredSpecialties.join(','),
                chosenDocumentIds: values.chosenDocumentIds.join(','),
              },
            };
            setTeamError(undefined);

            // Use SSE for dev plan generation
            isFetchingDevPlan.current = true;

            // Abort any existing SSE connection
            if (sseAbortControllerRef.current) {
              sseAbortControllerRef.current.abort();
            }

            // Create new AbortController for this generation
            const abortController = new AbortController();
            sseAbortControllerRef.current = abortController;

            // Show loading message
            const messageKey = 'dev-plan-generation';
            message.loading({
              content: 'Dev plan is being generated. It may take a min...',
              key: messageKey,
              duration: 0,
            });

            // Start SSE-based generation
            generateDocumentWithSSE(input, (progressData) => {
              // Handle progress updates
              if (progressData.status?.message) {
                console.log(
                  'Dev plan generation progress:',
                  progressData.status.message
                );
                // Update loading message with progress
                message.loading({
                  content: progressData.status.message,
                  key: messageKey,
                  duration: 0,
                });
              }

              // Handle completion event
              if (progressData.completed === true && progressData.docId) {
                console.log('Dev plan generation completed, refreshing data');
                isFetchingDevPlan.current = false;
                message.destroy(messageKey);
                // Show success message
                message.success('Dev plan generated successfully');
                // Invalidate and refetch dev plan data instead of reloading page
                // This preserves form state including requiredSpecialties
                queryClient.invalidateQueries([
                  GET_DEV_PLAN_QUERY_KEY,
                  devPlanId,
                ]);
              }

              // Handle errors
              if (progressData.error) {
                console.error('Dev plan generation error:', progressData.error);
                isFetchingDevPlan.current = false;
                message.destroy(messageKey);
                handleErrorMsgs(new Error(progressData.error));
              }
            })
              .then((result) => {
                // Success - the completion event should have already handled refresh
                console.log('Dev plan generation completed:', result);
                if (isFetchingDevPlan.current) {
                  // If completion event didn't trigger refresh, do it now
                  isFetchingDevPlan.current = false;
                  message.destroy(messageKey);
                  // Show success message
                  message.success('Dev plan generated successfully');
                  // Invalidate and refetch dev plan data instead of reloading page
                  // This preserves form state including requiredSpecialties
                  queryClient.invalidateQueries([
                    GET_DEV_PLAN_QUERY_KEY,
                    devPlanId,
                  ]);
                }
              })
              .catch((error) => {
                console.error('Dev plan generation failed:', error);
                isFetchingDevPlan.current = false;
                message.destroy(messageKey);
                handleErrorMsgs(error);
              });
          },
          () => {} // Just mark as invalid - nothing else to do
        );
    }
  }, [
    devPlan,
    form,
    isGenerationLocked,
    showAppModal,
    user.email,
    devPlanId,
    queryClient,
  ]);

  useEffect(() => {
    if (triggerDevPlanGeneration && availableUsers && devPlan) {
      const teamMembers = availableUsers
        .filter((u) => makeProductTeammateIds.includes(u.id))
        .map((u) => ({ userId: u.id, specialty: u.specialty as string }));

      // Default to the project's PRD if no documents are linked
      let chosenDocs = devPlan.chosenDocumentIds;
      if (chosenDocs.length === 0 && prdDoc?.id) {
        chosenDocs = [prdDoc.id];
      }

      form.setFieldsValue({
        requiredSpecialties: makeProductRoles,
        teamMembers,
        chosenDocumentIds: chosenDocs,
      });

      // Trigger generation
      generateDevPlan();

      // Clear the data from the store to prevent re-triggering
      clearMakeProductData();
    }
  }, [
    triggerDevPlanGeneration,
    makeProductRoles,
    makeProductTeammateIds,
    form,
    clearMakeProductData,
    generateDevPlan,
    availableUsers,
    devPlan,
    prdDoc,
  ]);

  // Cleanup SSE connection on unmount
  useEffect(() => {
    return () => {
      if (sseAbortControllerRef.current) {
        sseAbortControllerRef.current.abort();
        sseAbortControllerRef.current = null;
      }
      isFetchingDevPlan.current = false;
    };
  }, []);

  const onFormValuesChange = (changedValues: Partial<FormFields>) => {
    if (changedValues.teamMembers) {
      setTeamError(undefined);
    }
  };

  const handleNextStep = () => {
    if (currentStep < DevPlanSteps.length) {
      setStep((val) => val + 1);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 0) {
      setStep((val) => val - 1);
    }
  };

  const getTabData = function () {
    // Convert the key values in treeData to string type, while preserving children, title, and key
    let epicsData = devPlan?.epics.map((epic: any) => ({
      ...epic,
      title: 'Epic: ' + epic.name,
      key: epic.key as string,
      children: epic.children.map((story: any) => ({
        ...story,
        title: 'Story: ' + story.name,
        key: story.key as string,
        // Convert the key values in children to string type
        children: story.children.map((task: any) => ({
          ...task,
          title: (
            <Flex vertical>
              <div>{task.name}</div>
              <div
                style={{
                  marginLeft: 20,
                  padding: 3,
                }}
              >
                <ReactMarkdown>{task.description}</ReactMarkdown>
              </div>
            </Flex>
          ),
          key: task.key as string,
        })),
      })),
    }));
    // Build milestone data
    let milestoneData = devPlan?.milestones.map((m: any) => ({
      ...m,
      title: `${m.name}: ${m.storyPoint} pts, ${m.startDate}-${m.endDate}`,
      key: m.key as string,
      children: m.children.map((s: any) => ({
        ...s,
        title: `${s.name}: ${s.storyPoint} pts, ${s.startDate}-${s.endDate}`,
        key: s.key as string,
        // Convert the key values in children to string type
        children: s.children.map((st: any) => ({
          ...st,
          title: `Story: ${st.name}, ${st.storyPoint} pts, ${st.startDate}-${st.endDate}`,
          key: (st.key as string) + random(1, 100),
          children: st.children.map((t: any) => ({
            ...t,
            title: (
              <Flex vertical>
                <div>
                  {t.name}, {t.storyPoint} pts, {t.startDate}-{t.endDate}
                </div>
                <div
                  style={{
                    marginLeft: 20,
                    padding: 3,
                  }}
                >
                  <ReactMarkdown>{t.description}</ReactMarkdown>
                </div>
              </Flex>
            ),
            key: t.key as string,
          })),
        })),
      })),
    }));
    return [
      {
        label: t('devplan.taskBreakdown'),
        key: 'task-breakdown',
        children: (
          <Tree
            className="draggable-tree"
            defaultExpandAll={true}
            treeData={epicsData}
          />
        ),
      },
      {
        label: t('devplan.workSchedule'),
        key: 'working-schedule',
        children: (
          <Tree
            className="draggable-tree"
            defaultExpandAll={true}
            treeData={milestoneData}
          />
        ),
      },
    ];
  };

  // Show skeleton only for initial load, not during generation (generation uses message spinner)
  if (
    isLoading ||
    !devPlan ||
    (!devPlan?.epics && !isFetchingDevPlan.current)
  ) {
    return (
      <>
        <Skeleton active />
      </>
    );
  }
  if (isError) {
    return <>Error: {error}</>;
  }

  const breadcrumbItems = [
    {
      key: 'project',
      label: devPlan.project.name,
      link: `/projects/${devPlan.projectId}`,
    },
  ];

  return (
    <Spin spinning={isDevPlanBeingPublished}>
      <Flex className="dev-plan-editor">
        <Flex vertical flex={1} style={{ overflow: 'auto' }}>
          <DocumentToolbar
            breadcrumbItems={breadcrumbItems}
            doc={devPlan}
            updateDoc={publishDevPlan}
            paragraphs={paragraphs}
            isReadOnly={disabled}
          />
          {disabled ? (
            <div style={{ paddingTop: 16 }}>
              <Tabs
                defaultActiveKey="task-breakdown"
                hideAdd={true}
                items={getTabData()}
              />
            </div>
          ) : (
            <Form
              form={form}
              labelCol={{ span: 4 }}
              wrapperCol={{ flex: 1 }}
              autoComplete="off"
              size="large"
              disabled={
                updateDevPlanMutation.isLoading || isFetchingDevPlan.current
              }
              initialValues={{
                ...devPlan,
                sprintStartDate: dayjs(devPlan.sprintStartDate, 'MM/DD/YYYY'),
              }}
              onValuesChange={onFormValuesChange}
            >
              <Flex className="form-row">
                <Form.Item
                  label={t('devplan.rolesNeeded')}
                  name="requiredSpecialties"
                  rules={[
                    {
                      required: true,
                      message: t('devplan.selectRolesNeeded'),
                    },
                  ]}
                  tooltip={t('devplan.addRolesTooltip')}
                  initialValue={devPlan.requiredSpecialties || []}
                >
                  <DevPlanSpecialtyInput
                    onChange={autoSaveDevPlan}
                    value={
                      requiredSpecialties || devPlan.requiredSpecialties || []
                    }
                    disabled={disabled}
                  />
                </Form.Item>
              </Flex>

              {currentStep === 1 && !disabled && (
                <Flex className="form-row">
                  <Form.Item
                    label={t('devplan.teamMembersLabel')}
                    name="teamMembers"
                    rules={[
                      {
                        required: true,
                        message: t('devplan.selectTeamMembers'),
                      },
                    ]}
                    validateStatus={teamError ? 'error' : undefined}
                    help={teamError}
                    tooltip={t('devplan.teamTooltip')}
                  >
                    <DevPlanTeamInput
                      teamId={devPlan.project?.teamId}
                      value={devPlan.teamMembers}
                      onChange={autoSaveDevPlan}
                      placeholder={t('devplan.teamPlaceholder')}
                      disabled={disabled}
                    />
                  </Form.Item>
                  {/* <Form.Item
            label="Weeks per Sprint"
            name="weeksPerSprint"
            rules={[
              {
                required: true,
                message: 'You must specify the number of weeks per sprint',
              },
            ]}
          >
            <InputNumber />
          </Form.Item> */}
                  <Form.Item
                    label={t('devplan.startDate')}
                    name="sprintStartDate"
                    rules={[{ required: true }]}
                  >
                    <DatePicker
                      format="MM/DD/YYYY"
                      allowClear={false}
                      onChange={autoSaveDevPlan}
                      disabledDate={(current) =>
                        current && current < dayjs().endOf('day')
                      }
                      disabled={disabled}
                    />
                  </Form.Item>
                </Flex>
              )}

              {currentStep !== DevPlanSteps.length - 1 && (
                <Form.Item>
                  <Flex
                    justify="center"
                    align="center"
                    style={{ marginTop: '20px' }}
                  >
                    <Flex
                      justify="center"
                      gap={20}
                      align="flex-start"
                      style={{ width: 300 }}
                    >
                      {currentStep === 0 && //devPlan.epics.length == 0 &&
                        (devPlan.epics.length ? (
                          <Popconfirm
                            title={t('devplan.warning')}
                            className="generate-btn-pop"
                            description={
                              <Space.Compact direction="vertical">
                                <Typography.Text>
                                  {t('devplan.overwriteWarning')}
                                </Typography.Text>
                                <Typography.Text>
                                  {t('devplan.continueQuestion')}
                                </Typography.Text>
                              </Space.Compact>
                            }
                            onConfirm={generateDevPlan}
                          >
                            <Flex align="center">
                              {isGenerationLocked && (
                                <Tooltip
                                  title={getOutOfCreditTitle(organization, t)}
                                >
                                  <InfoCircleOutlined
                                    style={{ color: 'orange' }}
                                  />
                                  &nbsp;&nbsp;
                                </Tooltip>
                              )}
                              <Button
                                type="primary"
                                style={{ flex: 1, padding: '0' }}
                                block
                                disabled={isGenerationLocked || disabled}
                              >
                                {t('devplan.generateTask')}
                              </Button>
                            </Flex>
                          </Popconfirm>
                        ) : (
                          <Button
                            type="primary"
                            style={{ flex: 1, padding: '0' }}
                            onClick={generateDevPlan}
                            disabled={disabled}
                          >
                            {t('devplan.generateTask')}
                          </Button>
                        ))}

                      {currentStep !== DevPlanSteps.length - 1 && (
                        <Button
                          type="primary"
                          style={{ flex: 1, padding: '0' }}
                          onClick={handleNextStep}
                          disabled={!devPlan.epics.length}
                        >
                          {t('devplan.confirmSchedule')}
                        </Button>
                      )}
                    </Flex>
                  </Flex>
                </Form.Item>
              )}

              {currentStep === DevPlanSteps.length - 1 && (
                <Flex
                  justify="center"
                  gap={20}
                  align="center"
                  style={{ width: 300, margin: '20px auto 0 auto' }}
                >
                  <Button
                    type="primary"
                    style={{ flex: 1, padding: '0' }}
                    onClick={handlePrevStep}
                  >
                    {t('devplan.reviewWork')}
                  </Button>
                  <Button
                    type="primary"
                    style={{ flex: 1, padding: '0' }}
                    disabled={!devPlan.milestones?.length || disabled}
                    onClick={publishDevPlan}
                  >
                    {t('devplan.publishDevPlan')}
                  </Button>
                </Flex>
              )}

              <Form.Item style={{ marginTop: '10px' }}>
                <Steps
                  type="navigation"
                  current={currentStep}
                  size="small"
                  items={DevPlanSteps}
                  onChange={setStep}
                  className="devPlan-tabs"
                />
              </Form.Item>
              {currentStep === 0 && (
                <Form.List name="epics">
                  {(epicFields, { add: addEpic, remove: removeEpic }) => (
                    <Flex
                      vertical
                      gap={2}
                      style={{
                        border: `solid 1px ${COLORS.COLOR_ANTD_BORDER}`,
                        borderRadius: '8px',
                        paddingBottom: '10px',
                        padding: '10px 15px',
                      }}
                    >
                      {epicFields.length === 0 && (
                        <Empty
                          description={
                            <div style={{ margin: '10px 0' }}>
                              <Typography.Title level={3}>
                                {t('devplan.tasksNotGenerated')}
                              </Typography.Title>
                              {!makeProductRoles.length ? (
                                <Typography.Text>
                                  {t('devplan.addRolesFirst')}
                                </Typography.Text>
                              ) : (
                                <Typography.Text>
                                  {t('devplan.publishPrdFirst')
                                    .replace('Publish a PRD', '')
                                    .trim()}{' '}
                                  <a href={`/${DocumentsPath}/${prdDoc?.id}`}>
                                    Publish a PRD
                                  </a>{' '}
                                  {t('devplan.publishPrdFirst').split(
                                    'Publish a PRD'
                                  )[1] || ''}
                                </Typography.Text>
                              )}
                            </div>
                          }
                        />
                      )}
                      <Collapse
                        className="accordion"
                        activeKey={epicActiveKeys}
                        style={{ border: 'none' }}
                        onChange={(e) => setEpicActiveKeys(e as string[])}
                        items={epicFields.map((epicField, epicIndex) => ({
                          key: epicIndex * 100,
                          headerClass: 'dev-plan-header epic-header',
                          label: (
                            <DevPlanEditorItemTitle
                              type="Epic"
                              index={epicField.name}
                              onDelete={removeThenSave(removeEpic, saveDevPlan)}
                              onSave={saveDevPlan}
                              disabled={disabled}
                            />
                          ),
                          children: (
                            <Form.List name={[epicField.name, 'children']}>
                              {(
                                storyFields,
                                { add: addStory, remove: removeStory }
                              ) => (
                                <Flex vertical gap={2}>
                                  <Collapse
                                    size="small"
                                    style={{ border: 'none' }}
                                    activeKey={storyActiveKeys}
                                    onChange={(e) =>
                                      setStoryActiveKeys(e as string[])
                                    }
                                    className="story-header"
                                    items={storyFields.map(
                                      (storyField, storyIndex) => ({
                                        key:
                                          epicIndex * 100 +
                                          storyIndex * 10 +
                                          '',
                                        headerClass: 'dev-plan-header',
                                        label: (
                                          <DevPlanEditorItemTitle
                                            type="Story"
                                            index={storyField.name}
                                            onDelete={removeThenSave(
                                              removeStory,
                                              saveDevPlan
                                            )}
                                            onSave={saveDevPlan}
                                            disabled={disabled}
                                          />
                                        ),
                                        children: (
                                          <Form.List
                                            name={[storyField.name, 'children']}
                                          >
                                            {(
                                              taskFields,
                                              {
                                                add: addTask,
                                                remove: removeTask,
                                              }
                                            ) => (
                                              <Flex vertical gap={2}>
                                                {taskFields.map((taskField) => (
                                                  <Card
                                                    size="small"
                                                    key={taskField.key}
                                                    style={{
                                                      backgroundColor:
                                                        token.colorFillAlter,
                                                      border: 'none',
                                                      borderRadius: '0',
                                                    }}
                                                    className="dev-plan-header task-card"
                                                  >
                                                    <DevPlanEditorItemTitle
                                                      key={taskField.key}
                                                      type="Task"
                                                      index={taskField.name}
                                                      onDelete={removeThenSave(
                                                        removeTask,
                                                        saveDevPlan
                                                      )}
                                                      onSave={saveDevPlan}
                                                      disabled={
                                                        access?.projectPermission ===
                                                        'VIEW'
                                                      }
                                                    />
                                                  </Card>
                                                ))}
                                                <Space
                                                  style={{
                                                    marginLeft: '18px',
                                                    marginBottom: '5px',
                                                  }}
                                                >
                                                  <Button
                                                    type="dashed"
                                                    icon={
                                                      <PlusCircleOutlined />
                                                    }
                                                    onClick={() =>
                                                      addTask(TaskTemplate)
                                                    }
                                                    disabled={
                                                      access?.projectPermission ===
                                                      'VIEW'
                                                    }
                                                  >
                                                    {t('devplan.newTask')}
                                                  </Button>
                                                </Space>
                                              </Flex>
                                            )}
                                          </Form.List>
                                        ),
                                      })
                                    )}
                                  />
                                  <Space style={{ marginBottom: '3px' }}>
                                    <Button
                                      type="dashed"
                                      icon={<PlusCircleOutlined />}
                                      onClick={() => addStory(StoryTemplate)}
                                      disabled={disabled}
                                    >
                                      {t('devplan.newStory')}
                                    </Button>
                                  </Space>
                                </Flex>
                              )}
                            </Form.List>
                          ),
                        }))}
                      />
                      {epicFields.length > 0 && (
                        <Space>
                          <Button
                            type="dashed"
                            icon={<PlusCircleOutlined />}
                            onClick={() => addEpic(EpicTemplate)}
                            disabled={disabled}
                          >
                            {t('devplan.newEpic')}
                          </Button>
                        </Space>
                      )}
                    </Flex>
                  )}
                </Form.List>
              )}
              {currentStep === 1 && (
                <Form.List name="milestones">
                  {(
                    milestoneFields,
                    { add: addMilestone, remove: removeMilestone }
                  ) => (
                    <Flex
                      vertical
                      gap={2}
                      style={{
                        border: `solid 1px ${COLORS.COLOR_ANTD_BORDER}`,
                        borderRadius: '8px',
                        paddingBottom: '10px',
                        padding: '10px 15px',
                      }}
                    >
                      {milestoneFields.length === 0 && (
                        <Empty
                          description={
                            <div style={{ margin: '10px 0' }}>
                              <Typography.Title level={3}>
                                {t('devplan.addTeamAndDate')}
                              </Typography.Title>
                              {!devPlan.chosenDocumentIds.length && (
                                <Typography.Text>
                                  {t('devplan.createTaskBreakdown')
                                    .replace('Task Breakdown', '')
                                    .trim()}{' '}
                                  <a
                                    href="/"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      setStep(0);
                                    }}
                                  >
                                    {t('devplan.taskBreakdown')}
                                  </a>{' '}
                                  {t('devplan.createTaskBreakdown').split(
                                    'Task Breakdown'
                                  )[1] || ''}
                                </Typography.Text>
                              )}
                            </div>
                          }
                        />
                      )}
                      <Collapse
                        defaultActiveKey={['0']}
                        style={{ border: 'none' }}
                        items={milestoneFields.map((milestoneField) => ({
                          key: milestoneField.key,
                          headerClass: 'dev-plan-header epic-header',
                          label: (
                            <Form.Item name={milestoneField.name}>
                              <DevPlanMilestoneTitle />
                            </Form.Item>
                          ),
                          children: (
                            <Form.List
                              name={[milestoneField.name, 'children']}
                              key="0"
                            >
                              {(
                                sprintFields,
                                { add: addSprint, remove: removeSprint }
                              ) => (
                                <Collapse
                                  defaultActiveKey={['0']}
                                  style={{ border: 'none' }}
                                  className="story-header"
                                  items={sprintFields.map((sprintField) => ({
                                    key: sprintField.key,
                                    headerClass: 'dev-plan-header',
                                    label: (
                                      <Form.Item
                                        name={sprintField.name}
                                        key="0"
                                      >
                                        <DevPlanSprintTitle />
                                      </Form.Item>
                                    ),
                                    children: (
                                      <Form.List
                                        name={[sprintField.name, 'children']}
                                        key="0"
                                      >
                                        {(
                                          storyFields,
                                          { add: addStory, remove: removeStory }
                                        ) => (
                                          <Collapse
                                            defaultActiveKey={['0']}
                                            style={{
                                              border: 'none',
                                              borderTop: `solid 1px ${COLORS.COLOR_ANTD_BORDER}`,
                                              marginLeft: '20px',
                                            }}
                                            items={storyFields.map(
                                              (storyField) => ({
                                                key: storyField.key,
                                                headerClass: 'dev-plan-header',
                                                label: (
                                                  <Form.Item
                                                    name={storyField.name}
                                                    key="0"
                                                  >
                                                    <DevPlanStoryTitle />
                                                  </Form.Item>
                                                ),
                                                children: (
                                                  <Form.List
                                                    name={[
                                                      storyField.name,
                                                      'children',
                                                    ]}
                                                    key="0"
                                                  >
                                                    {(
                                                      taskFields,
                                                      {
                                                        add: addTask,
                                                        remove: removeTask,
                                                      }
                                                    ) => (
                                                      <Flex
                                                        vertical
                                                        gap={2}
                                                        key="0"
                                                      >
                                                        {taskFields.map(
                                                          (taskField) => (
                                                            <Card
                                                              size="small"
                                                              key={
                                                                taskField.key
                                                              }
                                                              style={{
                                                                backgroundColor:
                                                                  token.colorFillAlter,
                                                                border: 'none',
                                                                borderRadius:
                                                                  '0',
                                                              }}
                                                              className="dev-plan-header task-card"
                                                            >
                                                              <DevPlanEditorItemTitle
                                                                key={
                                                                  taskField.key
                                                                }
                                                                type="Task"
                                                                index={
                                                                  taskField.name
                                                                }
                                                                onDelete={removeThenSave(
                                                                  removeTask,
                                                                  saveDevPlanInMilestone
                                                                )}
                                                                onSave={
                                                                  saveDevPlanInMilestone
                                                                }
                                                              />
                                                            </Card>
                                                          )
                                                        )}
                                                      </Flex>
                                                    )}
                                                  </Form.List>
                                                ),
                                              })
                                            )}
                                          />
                                        )}
                                      </Form.List>
                                    ),
                                  }))}
                                />
                              )}
                            </Form.List>
                          ),
                        }))}
                      />
                    </Flex>
                  )}
                </Form.List>
              )}
            </Form>
          )}
        </Flex>
        {/* <EditorSidebar form={form} document={devPlan} /> */}
      </Flex>
    </Spin>
  );
}
