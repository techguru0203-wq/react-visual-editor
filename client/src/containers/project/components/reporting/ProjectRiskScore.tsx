import { Project } from '@prisma/client';
import {
  Badge,
  Descriptions,
  Flex,
  List,
  Progress,
  Tooltip,
  Typography,
} from 'antd';
import GaugeChart from 'react-gauge-chart';

import { useLanguage } from '../../../../common/contexts/languageContext';
import { getPassedTimeTooltip, getRiskTooltip } from '../../hooks/snapshotData';
import { ISnapShotData, RiskLevel } from '../../types/projectReportingTypes';

type ProjectRiskScoreProps = Readonly<{
  project: Project;
  data: ISnapShotData['overall'];
}>;

export function ProjectRiskScore({ project, data }: ProjectRiskScoreProps) {
  const { t } = useLanguage();
  const { Text, Title } = Typography;
  // assign due date to plannedEndDate for Project
  data.metrics.plannedEndDate = project.dueDate;
  return (
    <Flex wrap="wrap" gap="small" justify="space-around">
      <Flex vertical style={{ flexBasis: '150px' }}>
        <Title level={5} className="reporting-title">
          {t('reporting.riskScore').replace(' - {name}', '')}
        </Title>
        <Tooltip title={getRiskTooltip(data)}>
          <GaugeChart
            nrOfLevels={20}
            arcsLength={[RiskLevel.LOW, RiskLevel.MEDIUM, RiskLevel.HIGH]}
            colors={['#5BE12C', '#F5CD19', '#EA4228']}
            textColor="black"
            needleColor="lightgray"
            percent={data.metrics.riskScore as number}
            arcWidth={0.1}
            arcPadding={0.02}
            style={{ width: 260 }}
          />
        </Tooltip>
      </Flex>
      <Flex vertical flex={1} justify="space-between" className="metric-block">
        <Descriptions className="project" title="" />
        <Flex>
          <Tooltip title={getPassedTimeTooltip(data)}>
            <Progress percent={data.metrics.pastTimePercentage as number} />
          </Tooltip>
          <Text type="secondary" className="metric-label">
            {t('reporting.timeUsed')}
          </Text>
        </Flex>
        <Flex>
          <Tooltip title={data.metrics.progress + '% of work completed'}>
            <Progress percent={data.metrics.progress as number} />
          </Tooltip>
          <Text type="secondary" className="metric-label">
            {t('reporting.workProgress')}
          </Text>
        </Flex>
        <Flex>
          <Tooltip
            title={
              'current velocity is ' +
              data.metrics.velocity +
              '% of expected velocity'
            }
          >
            <Progress percent={data.metrics.velocity as number} />
          </Tooltip>
          <Text type="secondary" className="metric-label">
            {t('reporting.velocity')}
          </Text>
        </Flex>
      </Flex>
      <Flex vertical flex={2} style={{ minWidth: '260px' }}>
        <Descriptions className="project" title={t('reporting.insights')} />
        <List
          size="small"
          className="epic-list"
          dataSource={data.insights}
          renderItem={(item: any) => {
            let badgeColor = 'gray';
            return (
              <List.Item style={{ wordBreak: 'break-word' }}>
                <Badge color={badgeColor} text={item}></Badge>
              </List.Item>
            );
          }}
        />
      </Flex>
    </Flex>
  );
}
