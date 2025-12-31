import { Badge, List } from 'antd';

import { ProjectMilestone } from '../../../../../../../shared/types';
import { useLanguage } from '../../../../../common/contexts/languageContext';

export function useEpicGoalsColumn() {
  const { t } = useLanguage();

  return {
    title: t('building.goals'),
    key: 'epics',
    ellipsis: true,
    render: (record: ProjectMilestone) => (
      <List
        size="small"
        className="epic-list"
        dataSource={[...record.epics].sort(
          (a, b) => (b.storyPoint || 0) - (a.storyPoint || 0)
        )}
        renderItem={(item) => {
          let storyPoint = item.storyPoint || 0;
          let totalStoryPoint = undefined;

          // TODO: Make these proper attributes of issues
          if (item.meta && typeof item.meta === 'object') {
            if ('prevStoryPoint' in item.meta && item.meta.prevStoryPoint) {
              storyPoint += item.meta.prevStoryPoint as number;
            }
            if ('totalStoryPoint' in item.meta && item.meta.totalStoryPoint) {
              totalStoryPoint = item.meta.totalStoryPoint as number;
            }
          }
          const badgeColor =
            totalStoryPoint && storyPoint === totalStoryPoint
              ? 'green'
              : 'gray';
          return (
            <List.Item>
              <Badge
                className="goal-badge"
                color={badgeColor}
                text={`${item.name} (${
                  storyPoint + (totalStoryPoint ? `/${totalStoryPoint}` : '')
                })`}
              ></Badge>
            </List.Item>
          );
        }}
      />
    ),
  };
}
