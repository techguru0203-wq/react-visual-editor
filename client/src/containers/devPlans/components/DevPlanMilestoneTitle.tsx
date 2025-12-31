import { Space, Spin, Typography } from 'antd';

import { Milestone } from '../types/devPlanTypes';

type DevPlanMilestoneTitleProps = Readonly<{
  value?: Milestone;
}>;

export function DevPlanMilestoneTitle({ value }: DevPlanMilestoneTitleProps) {
  const { Text } = Typography;

  if (!value) {
    return <Spin />;
  }

  return (
    <Space.Compact direction="vertical">
      <Text strong>
        {value.name}{' '}
        <Text style={{ fontWeight: '400' }}>
          ({value.startDate} - {value.endDate})
        </Text>
      </Text>
      {value.epics.map((epic) => {
        const completedStoryPoint =
          epic.storyPoint + (epic.prevStoryPoint || 0);
        const completedPercentage =
          epic.totalStoryPoint &&
          Math.round((completedStoryPoint / epic.totalStoryPoint) * 100);

        return (
          <Text key={epic.name} type="secondary" style={{ paddingLeft: '1em' }}>
            {epic.name}
            {completedPercentage
              ? ` - ${completedPercentage}% completion (${completedStoryPoint}/${epic.totalStoryPoint} points)`
              : ''}
          </Text>
        );
      })}
    </Space.Compact>
  );
}
