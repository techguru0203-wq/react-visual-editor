import { Space, Spin, Typography } from 'antd';

import { Sprint } from '../types/devPlanTypes';

type DevPlanMilestoneTitleProps = Readonly<{
  value?: Sprint;
}>;

export function DevPlanSprintTitle({
  value: sprint,
}: DevPlanMilestoneTitleProps) {
  const { Text } = Typography;

  if (!sprint) {
    return <Spin />;
  }

  return (
    <Space.Compact direction="vertical">
      <Space>
        <Text>
          <Text strong>{sprint.name}</Text>({sprint.startDate} -{' '}
          {sprint.endDate})
          <Text type="secondary"> {sprint.storyPoint} points</Text>
        </Text>
      </Space>
    </Space.Compact>
  );
}
