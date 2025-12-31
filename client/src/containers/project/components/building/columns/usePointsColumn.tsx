import { Input } from 'antd';
import _ from 'lodash';

import { useLanguage } from '../../../../../common/contexts/languageContext';
import { PROGRESS_COLUMN_WIDTH } from './useProgressColumn';

type UsePointsColumnArgs = {
  onChange: (item: { id: string; storyPoint: number }) => void;
  editable?: boolean;
};

export default function usePointsColumn({
  onChange,
  editable = true,
}: UsePointsColumnArgs) {
  const { t } = useLanguage();
  
  return {
    title: t('building.points'),
    key: 'storyPoint',
    width: PROGRESS_COLUMN_WIDTH,
    render: (record: { id: string; storyPoint?: number | null }) => (
      <Input
        defaultValue={record.storyPoint || ''}
        onPressEnter={(e) => {
          const storyPoint = parseInt(e.currentTarget.value);
          console.log('value:', storyPoint);
          _.debounce(() => {
            console.log('e:', storyPoint);
            if (storyPoint) {
              onChange({ id: record.id, storyPoint });
            }
          }, 1000)();
        }}
        disabled={!editable}
      />
    ),
  };
}
