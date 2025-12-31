import { Space, Spin, Typography } from 'antd';

import { PlannedStory } from '../types/devPlanTypes';

type DevPlanMilestoneTitleProps = Readonly<{
  value?: PlannedStory;
}>;

export function DevPlanStoryTitle({ value }: DevPlanMilestoneTitleProps) {
  const { Text } = Typography;

  if (!value) {
    return <Spin />;
  }

  return (
    <Space.Compact direction="vertical">
      <Space>
        <Text>
          <Text strong>Story: </Text>
          {value.name}
          <Text type="secondary"> {value.storyPoint} points</Text>
        </Text>
      </Space>
    </Space.Compact>
  );
}
