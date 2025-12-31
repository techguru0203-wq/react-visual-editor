import { useState } from 'react';
import { Issue, IssueType } from '@prisma/client';
import {
  Button,
  Card,
  Form,
  Radio,
  Select,
  Space,
  Spin,
  TreeSelect,
} from 'antd';
import TextArea from 'antd/es/input/TextArea';
import dayjs from 'dayjs';
import _ from 'lodash';
import { useNavigate } from 'react-router';

import { ProjectOutput } from '../../../../../../shared/types';
import { useCurrentUser } from '../../../../common/contexts/currentUserContext';
import { useLanguage } from '../../../../common/contexts/languageContext';
import { GlobalStoreInst } from '../../../../common/util/globalStore';
import trackEvent from '../../../../trackingClient';
import { DevPlan } from '../../../devPlans/types/devPlanTypes';
import {
  useAddIssueMutation,
  useAddIssueSuggestionMutation,
} from '../../hooks/useIssueMutation';
import { IIssueForm } from '../../types/projectType';

import './IssueEditor.scss';

interface args {
  issueId?: string;
  workPlanId?: string;
  onSuccess: () => void;
}

export default function IssueEditor({ issueId, workPlanId, onSuccess }: args) {
  const { user } = useCurrentUser();
  const { t } = useLanguage();

  const initialValues: Partial<IIssueForm> = {
    name: '',
    parentIssueId: undefined,
    workPlanId: workPlanId || '',
    sprintSelection: 'auto',
  };

  const [insights, setInsights] = useState({
    newTasks: [],
    epics: [],
    milestones: [],
    devPlanDocId: '' as string | undefined | null,
    newDevPlan: undefined as DevPlan | undefined,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [formValues, setFormValues] =
    useState<Partial<IIssueForm>>(initialValues);

  const addIssueSuggestionMutation = useAddIssueSuggestionMutation({
    onSuccess: (data) => {
      console.log('success', data);
      let { newTaskInfo, epicsImpact, milestoneImpact } = data.deliveryImpact;
      setInsights({
        newTasks: newTaskInfo,
        epics: Object.values(epicsImpact),
        milestones: Object.values(milestoneImpact),
        devPlanDocId: data.devPlanDocId,
        newDevPlan: data.newDevPlan,
      });
      setIsLoading(false);
    },
    onError: () => {
      console.error('error');
    },
  });

  const navigator = useNavigate();
  const addIssueMutation = useAddIssueMutation({
    onSuccess: (issue: any) => {
      console.log('addIssueMutation.success:', issue);
      setTimeout(() => {
        setIsLoading(false);
        onSuccess();
        navigator(`/projects/${project.id}/building/projectorganizationpath`);
      }, 2000);
    },
    onError: (e) => {
      console.error('addIssueMutation.failure:', e);
      setIsLoading(false);
      onSuccess();
    },
  });
  /*
    See the note further below on why this is commented out
  */
  // const addIssuePublishMutation = useAddIssuePublishMutation({
  //   onSuccess: (project: any) => {
  //     console.log('addIssuePublishMutation.success:', project);
  //     setTimeout(() => {
  //       setIsLoading(false);
  //       onSuccess();
  //       if (formValues.sprintSelection === 'backlog') {
  //         navigator(`/projects/${project.id}/building/projectorganizationpath`);
  //       } else {
  //         navigator(`/projects/${project.id}/building/milestones`);
  //       }
  //     }, 2000);
  //   },
  //   onError: (e) => {
  //     console.error('addIssuePublishMutation.failure:', e);
  //     setIsLoading(false);
  //     onSuccess();
  //   },
  // });

  console.log('in containers.project.components.IssueEditor:', workPlanId);
  const project: ProjectOutput = GlobalStoreInst.get('activeProject');

  function onSubmit() {
    const workPlanId =
      formValues.sprintSelection === 'backlog' ||
      formValues.sprintSelection === 'auto'
        ? project.backlogId
        : formValues.workPlanId;

    console.log('what is backlog id', formValues.workPlanId);
    console.log('what is workPlanId: ', workPlanId);

    const payload = {
      projectId: project.id,
      name: formValues.name!,
      workPlanId: workPlanId,
      parentIssueId:
        formValues.parentIssueId === 'other'
          ? undefined
          : formValues.parentIssueId,
      type: IssueType.TASK,
      creatorUserId: user.id,
      shortName: project.shortName,
    };

    addIssueMutation.mutate(payload);
    // track event for adding issue
    trackEvent('addIssue', {
      distinct_id: user.email,
      payload: JSON.stringify({
        project: project.name,
        issueName: formValues.name,
      }),
    });

    /* TODO: This behavior is dangerously unstable.

         In its current state:
           - Its intended behavior does not work
           - A risk of overwriting existing backlog and from the persepctive of the UI, wiping it
    */

    // if (formValues.sprintSelection === 'backlog') {
    //   if (!formValues.name) {
    //     console.log('Cannot submit because no name is specified');
    //     return;
    //   }
    //   payload = {
    //     target: 'backlog',
    //     projectId: project.id,
    //     issueName: formValues.name,
    //   };
    // } else {
    //   console.log('insights', insights);
    //   console.log('formValues', formValues);

    //   if (!insights.devPlanDocId || !insights.newDevPlan) {
    //     console.log('Cannot publish because dev plan is not available');
    //     return;
    //   }
    //   payload = {
    //     target: 'milestone',
    //     projectId: project.id,
    //     devPlanDocId: insights.devPlanDocId,
    //     devPlan: insights.newDevPlan,
    //   };
    // }
    // addIssuePublishMutation.mutate(payload);
    setIsLoading(true);
  }

  function onGetSuggestion() {
    let payload: Partial<Issue> = {
      name: formValues.name,
      parentIssueId: formValues.parentIssueId,
      workPlanId: '',
    };
    if (formValues.sprintSelection === 'preset') {
      payload.workPlanId = formValues.workPlanId;
    }
    console.log('onGetSuggestion.payload:', payload);
    addIssueSuggestionMutation.mutate({ ...payload, projectId: project.id });
    setIsLoading(true);
  }

  function onValuesChange(changedValues: any, allValues: any) {
    console.log('onValuesChange:', changedValues, allValues);
    setFormValues(allValues);
  }

  const milestoneEpicsTreeData = getMilestoneEpicsTreeData(project, t);
  const sprintData = getSprintDataIDs(project);
  console.log('sprintData:', sprintData, workPlanId);
  return (
    <Spin spinning={isLoading}>
      <Form
        labelCol={{ span: 5 }}
        wrapperCol={{ span: 16 }}
        initialValues={initialValues}
        onFinish={onSubmit}
        onValuesChange={_.debounce(onValuesChange, 500)}
        autoComplete="off"
        className="issue-editor-form"
      >
        <Form.Item
          label={t('issue.issueName')}
          name="name"
          rules={[{ required: true, message: t('issue.issueNameRequired') }]}
        >
          <TextArea placeholder={t('issue.enterIssueName')} />
        </Form.Item>
        <Form.Item
          label={t('issue.parentEpic')}
          name="parentIssueId"
          rules={[{ required: true, message: t('issue.parentEpicRequired') }]}
        >
          <TreeSelect
            showSearch
            style={{ width: '100%' }}
            placeholder={t('issue.pleaseSelect')}
            allowClear
            treeDefaultExpandAll
            treeData={milestoneEpicsTreeData}
          />
        </Form.Item>
        <Form.Item
          label={t('issue.sprintSelection')}
          name="sprintSelection"
          rules={[{ required: true }]}
        >
          <Radio.Group value={'auto'}>
            {/* <Radio value={'auto'}>Auto-select</Radio> */}
            <Radio value={'preset'}>{t('issue.preSelect')}</Radio>
            <Radio value={'backlog'}>{t('issue.backlog')}</Radio>
          </Radio.Group>
        </Form.Item>

        <Form.Item label={t('issue.sprint')} name="workPlanId">
          <Select
            allowClear={true}
            options={sprintData}
            disabled={formValues.sprintSelection !== 'preset'}
          />
        </Form.Item>

        <Card
          title={t('issue.insights')}
          className="app-card"
          style={{ display: insights.newTasks.length ? 'block' : 'none' }}
        >
          <Card
            style={{ marginTop: 4 }}
            type="inner"
            title={t('issue.newTasks')}
            bordered={false}
          >
            {insights.newTasks?.map((t: any) => <p>{t}</p>)}
          </Card>
          <Card
            style={{ marginTop: 4 }}
            type="inner"
            title={t('issue.milestoneImpacts')}
            bordered={false}
          >
            {insights.milestones?.map((t: any) => <p>{t}</p>)}
          </Card>
        </Card>

        <Form.Item wrapperCol={{ span: 24 }} style={{ textAlign: 'center' }}>
          <Space>
            {/* <Button
              type="primary"
              className="app-btn"
              onClick={onGetSuggestion}
              disabled={formValues.sprintSelection === 'backlog'}
            >
              Preview
            </Button> */}
            <Button type="primary" className="app-btn" onClick={onSubmit}>
              {t('issue.publish')}
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Spin>
  );
}

function getMilestoneEpicsTreeData(project: ProjectOutput, t: (key: string) => string) {
  return [
    ...project.milestones.map((milestone) => ({
      title: milestone.name,
      value: milestone.id,
      children: milestone.epics.map((epic) => {
        let completionPercentage: number | undefined;
        if (epic.meta && typeof epic.meta === 'object') {
          const totalStoryPoint =
            'totalStoryPoint' in epic.meta
              ? Number(epic.meta.totalStoryPoint)
              : 0;
          const prevStoryPoint =
            'prevStoryPoint' in epic.meta
              ? Number(epic.meta.prevStoryPoint)
              : 0;
          const storyPoint = epic.storyPoint || 0;
          completionPercentage =
            totalStoryPoint !== 0
              ? Math.floor(
                  ((storyPoint + prevStoryPoint) / totalStoryPoint) * 100
                )
              : undefined;
        }
        return {
          title:
            epic.name +
            (completionPercentage !== undefined
              ? ` - ${completionPercentage}%`
              : ''),
          value: epic.id,
          completionPercentage,
        };
      }),
    })),
    {
      title: t('issue.other'),
      value: 'other',
    },
  ];
}

function getSprintDataIDs(project: ProjectOutput) {
  const sprints = project.milestones
    .map((milestone) => milestone.sprints)
    .flat()
    .map((sprint) => ({
      label: `${sprint.name}(${dayjs(sprint.plannedStartDate).format(
        'MM/DD/YYYY'
      )}-${dayjs(sprint.plannedEndDate).format('MM/DD/YYYY')})`,
      value: sprint.id,
    }));

  if (project.backlog) {
    sprints.push({
      label: project.backlog.name,
      value: project.backlog.id,
    });
  }

  return sprints;
}
