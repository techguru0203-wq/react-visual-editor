import { Select } from 'antd';

import { useLanguage } from '../../../../../common/contexts/languageContext';

type UseStatusColumnArgs<StatusType> = {
  options: Array<{ value: string; label: string }>;
  onChange: (item: { id: string; status: StatusType }) => void;
  editable?: boolean;
};

const STATUS_COLUMN_WIDTH = 120;

export function useStatusColumn<StatusType>({
  options,
  onChange,
  editable = true,
}: UseStatusColumnArgs<StatusType>) {
  const { t } = useLanguage();
  
  return {
    title: t('building.status'),
    key: 'status',
    width: STATUS_COLUMN_WIDTH,
    render: (record: { id: string; status: StatusType }) => (
      <Select
        options={options}
        value={record.status}
        style={{ width: STATUS_COLUMN_WIDTH }}
        onChange={(status) => onChange({ id: record.id, status })}
        disabled={!editable}
      />
    ),
  };
}
