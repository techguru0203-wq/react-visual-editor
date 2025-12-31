import React, { useEffect, useState } from 'react';
import { Button, Form, Modal, Select, Spin } from 'antd';

import { getSpecialtyTranslationKey, useLanguage } from '../../../common/contexts/languageContext';
import { useSpecialties } from '../../organization/hooks/useSpecialties';

export interface Teammate {
  id: string;
  name: string;
  specialty: string | null;
  velocity: number | null;
}

interface MakeProductModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (roles: string[], teammateIds: string[]) => void;
  teammates: Teammate[];
  loading?: boolean;
}

const MakeProductModal: React.FC<MakeProductModalProps> = ({
  open,
  onClose,
  onSubmit,
  teammates,
  loading = false,
}) => {
  const { t } = useLanguage();
  const [selectedRoles, setSelectedRoles] = useState<string[]>([
    'FULLSTACK_ENGINEER',
  ]);
  const [selectedTeammates, setSelectedTeammates] = useState<string[]>([]);
  const { data: specialties = [], isLoading: specialtiesLoading } =
    useSpecialties();

  const handleOk = () => {
    onSubmit(selectedRoles, selectedTeammates);
  };

  const filteredTeammates = teammates.filter(
    (tm) => tm.specialty && selectedRoles.includes(tm.specialty)
  );

  useEffect(() => {
    // When roles change, clear selected teammates to avoid invalid selections
    setSelectedTeammates([]);
  }, [selectedRoles]);

  return (
    <Modal
      open={open}
      title={t('document.makeProduct')}
      onCancel={onClose}
      onOk={handleOk}
      okText={t('document.submit')}
      confirmLoading={loading}
    >
      <Spin spinning={loading || specialtiesLoading}>
        <Form layout="vertical">
          <Form.Item
            label={t('document.selectTeamRolesLabel')}
            tooltip={t('document.selectTeamRolesTooltip')}
          >
            <Select
              mode="multiple"
              options={specialties.map((s: any) => {
                const displayName = s.displayName || s.name;
                const translationKey = getSpecialtyTranslationKey(displayName);
                const translatedName = translationKey !== displayName ? t(translationKey) : displayName;
                return {
                  label: translatedName,
                  value: s.name,
                };
              })}
              value={selectedRoles}
              onChange={setSelectedRoles}
              placeholder={t('document.selectRolesPlaceholder')}
              disabled={loading || specialtiesLoading}
            />
          </Form.Item>
          {/* <Form.Item label="Assign Teammates">
            <Select
              mode="multiple"
              options={filteredTeammates.map((tm) => {
                const specialtyText = getSpecialtyDisplayName(tm.specialty, t);
                const velocityText = tm.velocity
                  ? `${tm.velocity} pts`
                  : '2 pts'; // Default velocity
                return {
                  label: `${tm.name} (${specialtyText}, ${velocityText})`,
                  value: tm.id,
                };
              })}
              value={selectedTeammates}
              onChange={setSelectedTeammates}
              placeholder={t('document.selectRolesPlaceholder')}
            />
          </Form.Item> */}
          <Form.Item
            wrapperCol={{ offset: 8, span: 8 }}
            style={{ textAlign: 'center' }}
          >
            <Button
              onClick={handleOk}
              block
              type="primary"
              disabled={
                loading || selectedRoles.length === 0
                // || selectedTeammates.length === 0
              }
            >
              {t('document.submit')}
            </Button>
          </Form.Item>
        </Form>
      </Spin>
    </Modal>
  );
};

export default MakeProductModal;
