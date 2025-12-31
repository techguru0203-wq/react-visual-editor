import { FC } from 'react';

import { StatusBadge } from '../../../../../common/components/StatusBadge/StatusBadge';
import { translateProjectPlanStatus } from '../../../../../common/constants';
import { useLanguage } from '../../../../../common/contexts/languageContext';
import { ProjectPlanStatus } from '../../../../../common/types/project.types';

const statusColorMap = {
  [ProjectPlanStatus.NOT_STARTED]: ['#FFF2E2', '#1C1D22'],
  [ProjectPlanStatus.IN_PROGRESS]: ['#5570F129', '#5570F1'],
  [ProjectPlanStatus.PUBLISHED]: ['#32936F29', '#519C66'],
};

export interface ProjectPlanStatusBadgeProps {
  status: ProjectPlanStatus;
}

export const ProjectPlanStatusBadge: FC<ProjectPlanStatusBadgeProps> = (
  props
) => {
  const { status } = props;
  const { t } = useLanguage();
  
  if (!status) {
    return null;
  }
  const [backgroundColor, color] = statusColorMap[status];
  const translatedStatus = translateProjectPlanStatus(status, t);
  
  return (
    <StatusBadge
      backgroundColor={backgroundColor}
      color={color}
      text={translatedStatus}
    />
  );
};
