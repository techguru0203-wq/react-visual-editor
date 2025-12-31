import { CalendarFilled, PlusOutlined } from '@ant-design/icons';
import { Button, Flex, Tooltip, Typography } from 'antd';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router';

import { useLanguage } from '../../../common/contexts/languageContext';
import { ReactComponent as LayerIcon } from '../../../common/icons/layer-icon.svg';
import { ReactComponent as WelcomeGraphic } from '../../../common/icons/welcome_graphic.svg';
import { calculateHealthScore } from '../../../common/util/app';
import { COLORS } from '../../../lib/constants';
import { IssueOutput } from '../../issues/types/issueTypes';
import {
  DashboardPath,
  DevPlansPath,
  DocumentsPath,
  HomePath,
} from '../../nav/paths';

export function IssuesTable({
  issues,
}: {
  issues: ReadonlyArray<IssueOutput>;
}) {
  const { t } = useLanguage();

  // Helper function to translate issue type
  const translateIssueType = (type: string) => {
    const typeMap: Record<string, string> = {
      BUILDABLE: t('issueType.buildable'),
      EPIC: t('issueType.epic'),
      STORY: t('issueType.story'),
      TASK: t('issueType.task'),
      SUBTASK: t('issueType.subtask'),
      BUG: t('issueType.bug'),
    };
    return typeMap[type] || type;
  };

  // Helper function to translate issue status
  const translateIssueStatus = (status: string) => {
    const statusMap: Record<string, string> = {
      CREATED: t('issueStatus.created'),
      STARTED: t('issueStatus.started'),
      GENERATING: t('issueStatus.generating'),
      INREVIEW: t('issueStatus.inreview'),
      APPROVED: t('issueStatus.approved'),
      COMPLETED: t('issueStatus.completed'),
      CANCELED: t('issueStatus.canceled'),
      OVERWRITTEN: t('issueStatus.overwritten'),
    };
    return statusMap[status] || status;
  };

  // Helper function to translate document type names
  const translateDocumentTypeName = (name: string) => {
    const typeMap: Record<string, string> = {
      PRD: t('document.prd'),
      PROTOTYPE: t('document.prototype'),
      Prototype: t('document.prototype'),
      'Design Prototype': t('document.designPrototype'),
      UI_DESIGN: t('document.uiDesign'),
      'UI/UX Design': t('document.uiDesign'),
      TECH_DESIGN: t('document.techDesign'),
      'Technical Design': t('document.techDesign'),
      'Tech Design': t('document.techDesign'),
      DEVELOPMENT_PLAN: t('document.developmentPlan'),
      'Development Plan': t('document.developmentPlan'),
      QA_PLAN: t('document.qaPlan'),
      'QA Plan': t('document.qaPlan'),
      'QA & Test Plan': t('document.qaPlan'),
      RELEASE_PLAN: t('document.releasePlan'),
      'Release Plan': t('document.releasePlan'),
      PRODUCT: t('document.product'),
      Product: t('document.product'),
      BUSINESS: t('document.business'),
      Business: t('document.business'),
      MARKETING: t('document.marketing'),
      Marketing: t('document.marketing'),
      SALES: t('document.sales'),
      Sales: t('document.sales'),
      SUPPORT: t('document.support'),
      Support: t('document.support'),
      ENGINEERING: t('document.engineering'),
      Engineering: t('document.engineering'),
      OTHER: t('document.other'),
      Other: t('document.other'),
    };
    return typeMap[name] || name;
  };

  let data: Array<any> = [];
  issues.forEach((issue, index) => {
    data.push({
      id: issue.id,
      key: index,
      createdAt: issue.createdAt,
      name: issue.name,
      nameTranslated: translateDocumentTypeName(issue.name),
      shortName: issue.shortName,
      projectInfo:
        issue.project?.name +
        (issue.workPlan ? `:${issue.workPlan?.name}` : ''),
      projectId: issue.projectId,
      parentIssue: issue.parentIssue,
      ownerUserId: issue.ownerUserId,
      storyPoint: issue.storyPoint,
      progress: issue.progress,
      pointInfo: (issue.completedStoryPoint || 0) + '/' + issue.storyPoint,
      plannedStartDate: issue.plannedStartDate,
      plannedEndDate: issue.plannedEndDate,
      description: issue.description,
      descriptionTranslated: translateDocumentTypeName(issue.description || ''),
      schedule: [
        issue.plannedStartDate
          ? dayjs(issue.plannedStartDate).format('MM/DD/YYYY')
          : dayjs(issue.createdAt).format('MM/DD/YYYY'),
        issue.plannedEndDate
          ? dayjs(issue.plannedEndDate).format('MM/DD/YYYY')
          : '',
      ]
        .filter((date) => date)
        .join(' - '),
      health: calculateHealthScore(issue),
      status: issue.status,
      statusTranslated: translateIssueStatus(issue.status),
      type: issue.type,
      typeTranslated: translateIssueType(issue.type),
      updatedAt: issue.updatedAt,
      documents: issue.documents,
    });
  });

  const navigate = useNavigate();
  const handleIssueClick = (record: any) => {
    if (record.type === 'BUILDABLE') {
      let doc = record.documents.length ? record.documents[0] : null;
      if (doc && doc.type === 'DEVELOPMENT_PLAN') {
        navigate(`/${DevPlansPath}/${doc.id}`);
      } else {
        navigate(`/${DocumentsPath}/${doc.id}`);
      }
    } else {
      navigate(`/${DashboardPath}/${record.shortName}`);
    }
  };

  return data
    .sort((a, b) => {
      return dayjs(b.updatedAt).unix() - dayjs(a.updatedAt).unix();
    })
    .map((issue, index) => (
      <Flex
        className="issue-item"
        vertical
        key={index}
        onClick={() => handleIssueClick(issue)}
      >
        <Flex style={{ color: COLORS.GRAY, fontSize: '11px' }}>
          {issue.nameTranslated}
        </Flex>
        <Flex
          style={{
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '5px 0',
          }}
        >
          <div
            style={{
              fontSize: '13px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              marginRight: '40px',
            }}
          >
            {issue.descriptionTranslated}
          </div>
          <Flex
            style={{
              alignItems: 'center',
              fontSize: '14px',
              textTransform: 'capitalize',
            }}
          >
            <div
              style={{
                height: '10px',
                width: '10px',
                borderRadius: '50%',
                backgroundColor: COLORS.PRIMARY,
                marginRight: '10px',
              }}
            ></div>
            {issue.statusTranslated}
          </Flex>
        </Flex>
        <Flex
          style={{ fontSize: '12px', gap: 8, justifyContent: 'space-between' }}
        >
          <Flex align="center">
            <CalendarFilled
              style={{
                marginRight: '6px',
                fontSize: '13px',
                color: COLORS.GRAY,
              }}
            />
            <Tooltip title={t('myIssues.plannedSchedule')}>
              {issue.schedule}
            </Tooltip>
          </Flex>
          <Flex
            style={{ marginLeft: 'auto' }}
            align="center"
            className="project-name"
          >
            <LayerIcon style={{ marginRight: '6px' }} />
            <Tooltip title={t('myIssues.projectOrWorkPlanName')} style={{}}>
              {issue.projectInfo}
            </Tooltip>
          </Flex>
        </Flex>
      </Flex>
    ));
}

export function EmptyProject() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  return (
    <Flex
      vertical
      style={{
        flexGrow: 1,
        alignItems: 'center',
        justifyContent: 'center',
        border: `solid 1px ${COLORS.LIGHT_GRAY}`,
        borderRadius: '10px',
        marginBottom: '10px',
      }}
    >
      <div
        style={{
          textAlign: 'center',
          color: COLORS.GRAY,
          marginBottom: '20px',
          marginTop: '-50px',
        }}
      >
        <Flex
          flex={1}
          align="center"
          justify="center"
          style={{ marginTop: '48px' }}
        >
          <WelcomeGraphic />
        </Flex>
        <Flex vertical align="center" justify="center">
          <Typography.Title level={4}>{t('welcome.title')}</Typography.Title>
          <Typography.Text style={{ textAlign: 'center' }}>
            {t('welcome.description').replace('{addProjectLink}', '')}
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                navigate('/' + HomePath);
              }}
            >
              {t('welcome.addFirstProject')}
            </a>
            {t('welcome.description').includes(',')
              ? t('welcome.description').split('{addProjectLink}')[1]
              : ''}
          </Typography.Text>
        </Flex>
      </div>
      <Button
        id="add-project-btn"
        type="primary"
        icon={<PlusOutlined />}
        size={'middle'}
        onClick={() => {
          navigate('/' + HomePath);
          // showAppModal({ type: 'addProject' })
        }}
      >
        {t('welcome.newProject')}
      </Button>
    </Flex>
  );
}
