import React from 'react';
import { IssueStatus } from '@prisma/client';
import { Spin, Typography } from 'antd';
import dayjs from 'dayjs';

import { ProjectBuildable } from '../../../../shared/types';
import { useOrganizationUsers } from '../../containers/organization/hooks/useOrganizationUsers';
import { getSpecialtyDisplayName } from '../../containers/profile/profileUtils';
import { useLanguage } from '../contexts/languageContext';

import './Issue.scss';

interface IssueProps {
  data: ProjectBuildable;
  onClick?: React.MouseEventHandler;
}
export default function Issue({ data, onClick }: IssueProps) {
  const { t } = useLanguage();
  const { data: orgUsers, isLoading, isError, error } = useOrganizationUsers();
  if (isError) {
    throw error;
  }

  const {
    id,
    shortName,
    name,
    status = 'N.A.',
    ownerUserId,
    progress = 'N.A.',
    plannedEndDate,
  } = data;
  const owner = (orgUsers || []).find((user) => user.id === ownerUserId);
  return (
    <Spin spinning={isLoading}>
      <div
        className="issue"
        data-name={name}
        data-id={id}
        data-shortname={shortName}
        onClick={onClick}
      >
        <div className="title">{name}</div>
        <div className="status">{status}</div>
        <div
          className={
            (status === IssueStatus.COMPLETED && 'checkmark') ||
            (status === IssueStatus.STARTED && 'progress') ||
            ''
          }
        ></div>
        <div className="separator"></div>
        <div className="info">
          <div className="info-item">
            <div className="info-item-title">{t('common.owner')}</div>
            <Typography.Text
              style={{ width: 60 }}
              ellipsis={{
                tooltip: `${owner?.username} (${getSpecialtyDisplayName(
                  owner?.specialty,
                  t
                )})`,
              }}
            >
              {owner?.username}
            </Typography.Text>
          </div>
          <div className="info-item">
            <div className="info-item-title">{t('common.progress')}</div>
            <div>{progress}%</div>
          </div>
          <div className="info-item">
            <div className="info-item-title">ETA</div>
            <div>{dayjs(plannedEndDate).format('MM/DD/YYYY')}</div>
          </div>
        </div>
      </div>
    </Spin>
  );
}
