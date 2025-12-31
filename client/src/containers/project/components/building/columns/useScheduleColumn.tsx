import { Typography } from 'antd';
import dayjs from 'dayjs';

import { useLanguage } from '../../../../../common/contexts/languageContext';

type Record = {
  id: string;
  plannedStartDate?: string | Date | null;
  plannedEndDate?: string | Date | null;
};

export function useScheduleColumn() {
  const { t } = useLanguage();
  
  return {
    title: t('building.schedule'),
    key: 'schedule',
    ellipsis: true,
    render: (record: Record) => (
      <Typography.Text>
        {record.plannedStartDate && record.plannedEndDate
          ? dayjs(record.plannedStartDate).format('MM/DD/YYYY') +
            ' - ' +
            dayjs(record.plannedEndDate).format('MM/DD/YYYY')
          : ''}
      </Typography.Text>
    ),
  };
}
