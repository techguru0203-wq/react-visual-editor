import {
  Badge,
  Card,
  Descriptions,
  Empty,
  Flex,
  List,
  Progress,
  Result,
  Tooltip,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import GaugeChart from 'react-gauge-chart';

import { useAppModal } from '../../../../common/components/AppModal';
import { useCurrentUser } from '../../../../common/contexts/currentUserContext';
import { useLanguage } from '../../../../common/contexts/languageContext';
import { isFeatureLocked } from '../../../../common/util/app';
import { SUBSCRIPTIONTIERS } from '../../../../lib/constants';
import {
  computeSnapshotData,
  getPassedTimeTooltip,
  getRiskTooltip,
} from '../../hooks/snapshotData';
import { RiskLevel } from '../../types/projectReportingTypes';
import { useProject } from '../Project';
import { ProjectRiskScore } from './ProjectRiskScore';

export function ProjectSnapshot() {
  const { project } = useProject();
  let { overall, planning, building } = computeSnapshotData(
    project,
    project.buildables,
    project.milestones
  );
  console.log('in containers.project.components.ProjectReporting:', project);

  const { showAppModal } = useAppModal();
  let { user, subscriptionStatus, subscriptionTier } = useCurrentUser();
  const { t } = useLanguage();
  let isPageLocked = isFeatureLocked(
    subscriptionStatus as string,
    subscriptionTier as string,
    SUBSCRIPTIONTIERS.BUSINESS
  );
  if (isPageLocked) {
    return (
      <Empty description="">
        {t('project.upgradeToScale').split('Scale Plan').map((part, index) => (
          index === 0 ? (
            <span key={index}>{part}</span>
          ) : (
            <span key={index}>
              <a
                href="/"
                onClick={(e) => {
                  e.preventDefault();
                  showAppModal({
                    type: 'updateSubscription',
                    payload: {
                      email: user.email,
                      source: 'secondaryMenu',
                      destination: 'ReporterPage',
                    },
                  });
                  console.log('Upgrade to Scale Plan');
                  return;
                }}
              >
                {t('project.scalePlan')}
              </a>
              {part}
            </span>
          )
        ))}
      </Empty>
    );
  }

  const { Text } = Typography;
  return (
    <div className="project-reporting">
      <section className="project-progress">
        <Card
          title={t('reporting.overallProject')}
          bordered={false}
          className="app-card"
          style={{ marginTop: '10px' }}
        >
          <ProjectRiskScore project={project} data={overall} />
        </Card>
        <Card title={t('reporting.planning')} bordered={false} className="app-card">
          <Flex wrap="wrap" gap="small" justify="space-around">
            {planning.map((p, key) => (
              <Flex
                justify="space-around"
                style={{ flexWrap: 'wrap' }}
                key={key}
              >
                <Flex vertical style={{ width: '160px' }}>
                  <Text ellipsis={true} type="secondary">
                    {t('reporting.riskScore').replace('{name}', p.name)}
                  </Text>
                  <Tooltip title={getRiskTooltip(p)}>
                    <GaugeChart
                      style={{ width: '90%' }}
                      nrOfLevels={20}
                      arcsLength={[
                        RiskLevel.LOW,
                        RiskLevel.MEDIUM,
                        RiskLevel.HIGH,
                      ]}
                      colors={['#5BE12C', '#F5CD19', '#EA4228']}
                      textColor="black"
                      needleColor="lightgray"
                      percent={p.metrics.riskScore as number}
                      arcWidth={0.1}
                      arcPadding={0.02}
                    />
                  </Tooltip>
                </Flex>
                <Flex
                  vertical
                  justify="space-between"
                  style={{ flex: 2, maxWidth: '360px' }}
                >
                  <Descriptions className="project" title=" " />
                  <Flex>
                    <Tooltip title={getPassedTimeTooltip(p)}>
                      <Progress
                        percent={p.metrics.pastTimePercentage as number}
                        size="small"
                      />
                    </Tooltip>
                    <Text type="secondary" className="metric-label">
                      {t('reporting.timeUsed')}
                    </Text>
                  </Flex>
                  <Flex>
                    <Tooltip title={p.metrics.progress + '% of work completed'}>
                      <Progress
                        percent={p.metrics.progress as number}
                        size="small"
                      />
                    </Tooltip>
                    <Text type="secondary" className="metric-label">
                      {t('reporting.workProgress')}
                    </Text>
                  </Flex>
                  <Flex>
                    <Tooltip
                      title={
                        'current velocity is ' +
                        p.metrics.velocity +
                        '% of expected velocity'
                      }
                    >
                      <Progress
                        percent={p.metrics.velocity as number}
                        size="small"
                      />
                    </Tooltip>
                    <Text type="secondary" className="metric-label">
                      {t('reporting.velocity')}
                    </Text>
                  </Flex>
                </Flex>
                {/* <Flex vertical style={{ flex: 2, maxWidth: '500px' }}>
                <Descriptions className="project-overview" title="Insights" />
                <List
                  size="small"
                  className="epic-list"
                  dataSource={p.insights}
                  renderItem={(item: any) => {
                    let badgeColor = 'gray';
                    return (
                      <List.Item>
                        <Badge color={badgeColor} text={item}></Badge>
                      </List.Item>
                    );
                  }}
                />
              </Flex> */}
              </Flex>
            ))}
          </Flex>
          {/* <div>
            <Descriptions className="project-overview" title="Insights" />
            <List
              size="small"
              className="epic-list"
              dataSource={['test abc', 'test 123', 'test 456']}
              renderItem={(item: any) => {
                let badgeColor = 'gray';
                return (
                  <List.Item>
                    <Badge color={badgeColor} text={item}></Badge>
                  </List.Item>
                );
              }}
            />
          </div> */}
        </Card>
        <Card title={t('reporting.building')} bordered={false} className="app-card">
          {building.length === 0 ? (
            overall.stage === 'Planning' ? (
              <Empty description={t('reporting.publishPrdFirst')} />
            ) : (
              <Result
                status="success"
                title={t('reporting.milestonesCompleted')}
                subTitle={t('reporting.goodJobCompleted')}
              />
            )
          ) : (
            building.map((p, key) => (
              <Flex
                justify="space-around"
                key={key}
                style={{ marginBottom: '10px', flexWrap: 'wrap' }}
              >
                <Flex vertical style={{ width: '160px' }}>
                  <Text ellipsis={true} type="secondary">
                    {t('reporting.riskScore').replace('{name}', p.name)}
                  </Text>
                  <Tooltip title={getRiskTooltip(p)}>
                    {/* <Progress
                    type="circle"
                    percent={p.metrics.riskScore as number}
                    strokeColor={conicColors}
                    size={80}
                  /> */}
                    <GaugeChart
                      style={{ width: '90%' }}
                      nrOfLevels={20}
                      arcsLength={[
                        RiskLevel.LOW,
                        RiskLevel.MEDIUM,
                        RiskLevel.HIGH,
                      ]}
                      colors={['#5BE12C', '#F5CD19', '#EA4228']}
                      textColor="black"
                      needleColor="lightgray"
                      percent={p.metrics.riskScore as number}
                      arcWidth={0.1}
                      arcPadding={0.02}
                    />
                  </Tooltip>
                </Flex>
                <Flex
                  vertical
                  justify="space-between"
                  className="metric-block"
                  style={{ minWidth: '260px' }}
                >
                  <Descriptions className="project" title=" " />
                  <Flex>
                    <Tooltip
                      title={
                        t('reporting.timeTooltip')
                          .replace('{pastTime}', (p.metrics.pastTime || 0).toString())
                          .replace('{totalTime}', (p.metrics.totalTime || 0).toString())
                          .replace('{dueDate}', dayjs(p.metrics.plannedEndDate).format('MM/DD/YYYY'))
                      }
                    >
                      <Progress
                        percent={p.metrics.pastTimePercentage as number}
                        size="small"
                      />
                    </Tooltip>
                    <Text type="secondary" className="metric-label">
                      {t('reporting.timeUsed')}
                    </Text>
                  </Flex>
                  <Flex>
                    <Tooltip title={p.metrics.progress + '% of work completed'}>
                      <Progress
                        percent={p.metrics.progress as number}
                        size="small"
                      />
                    </Tooltip>
                    <Text type="secondary" className="metric-label">
                      {t('reporting.workProgress')}
                    </Text>
                  </Flex>
                  <Flex>
                    <Tooltip
                      title={t('reporting.velocityTooltip').replace('{velocity}', (p.metrics.velocity || 0).toString())}
                    >
                      <Progress
                        percent={p.metrics.velocity as number}
                        size="small"
                      />
                    </Tooltip>
                    <Text type="secondary" className="metric-label">
                      {t('reporting.devVelocity')}
                    </Text>
                  </Flex>
                </Flex>
                <Flex vertical style={{ flex: 2, minWidth: '260px' }}>
                  <Descriptions className="project" title="Insights" />
                  <List
                    size="small"
                    className="epic-list"
                    dataSource={p.insights}
                    renderItem={(item: any) => {
                      return (
                        <List.Item>
                          <Badge color="gray" text={item}></Badge>
                        </List.Item>
                      );
                    }}
                  />
                </Flex>
              </Flex>
            ))
          )}
        </Card>
      </section>
    </div>
  );
}
