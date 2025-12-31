import React, { useState } from 'react';
import type { TourProps } from 'antd';
import { Button, Flex, Input, Tour, Typography } from 'antd';

import { useCurrentUser } from '../../../common/contexts/currentUserContext';
import { useLanguage } from '../../../common/contexts/languageContext';
import tourImage from '../../../common/icons/tourImage2.jpg';
import { updateUserProfile } from '../../profile/api/profileApi';
import EditProfilePopUp from '../../profile/components/EditProfilePopUp';

// Help categories now use centralized translations from languageContext
const HelpNeeded: Record<string, string> = {
  improve_workflow: 'ftue.improveWorkflow',
  automate_documents: 'ftue.automateDocuments',
  create_prd: 'ftue.createPrd',
  automate_tasks: 'ftue.automateTasks',
  track_timeline: 'ftue.trackTimeline',
  improve_communication: 'ftue.improveCommunication',
  gain_visibility: 'ftue.gainVisibility',
};

interface FTUEProp {
  openTour: boolean;
}

const FTUETour: React.FC<FTUEProp> = ({ openTour }) => {
  const [open, setOpen] = useState<boolean>(openTour);
  const { user, organization } = useCurrentUser();
  const { language, t } = useLanguage();
  const [neededHelp, setNeededHelp] = useState<string[]>([]);
  const [otherHelpNeeded, setOtherHelpNeeded] = useState<string>('');

  const currentLanguage = language || 'en';
  const helpKeys = Object.keys(HelpNeeded);

  function addHelp(key: string) {
    let helpKeys = [...neededHelp];
    let isKeyIncluded = helpKeys.includes(key);
    if (isKeyIncluded) {
      helpKeys = helpKeys.filter((h) => h !== key);
    } else {
      helpKeys = [...helpKeys, key];
    }
    setNeededHelp(helpKeys);
  }

  const steps: TourProps['steps'] = [
    {
      title: <Typography.Title level={4}>{t('ftue.welcome')}</Typography.Title>,
      description: (
        <Flex vertical>
          <Typography.Paragraph>{t('ftue.description1')}</Typography.Paragraph>
          <Typography.Paragraph>{t('ftue.description2')}</Typography.Paragraph>
        </Flex>
      ),
      cover: <img alt="tour.png" src={tourImage} />,
      nextButtonProps: {
        children: currentLanguage === 'zh' ? '下一步' : undefined,
      },
    },
    {
      title: (
        <Typography.Title level={4}>
          {t('ftue.whatHelpNeeded')}
        </Typography.Title>
      ),
      description: (
        <Flex wrap gap="middle">
          {helpKeys.map((key, i) => {
            return (
              <Button
                key={key}
                type="default"
                onClick={() => addHelp(key)}
                style={{
                  background: neededHelp.includes(key) ? 'lightgray' : 'white',
                }}
              >
                {t(HelpNeeded[key])}
              </Button>
            );
          })}
          <Input.TextArea
            autoSize={{ minRows: 6, maxRows: 10 }}
            placeholder={t('ftue.otherHelpPlaceholder')}
            onBlur={(e) => {
              setOtherHelpNeeded(e.target.value);
            }}
            style={{ width: '100%', fontSize: '14px', marginBottom: '20px' }}
          />
        </Flex>
      ),
      nextButtonProps: {
        children: currentLanguage === 'zh' ? '下一步' : undefined,
        onClick: async () => {
          await updateUserProfile({
            id: user.id,
            organizationId: organization.id,
            email: user.email,
            firstname: user.firstname,
            lastname: user.lastname,
            username: user.username,
            neededHelp: neededHelp.join(',') + ',' + otherHelpNeeded,
          });
        },
      },
      prevButtonProps: {
        children: currentLanguage === 'zh' ? '上一步' : undefined,
      },
    },
    {
      title: (
        <Typography.Title level={4}>{t('ftue.tellUsMore')}</Typography.Title>
      ),
      description: (
        <EditProfilePopUp
          requireCompanyData={false}
          requireProfileData={true}
          closeModal={() => setOpen(false)}
        />
      ),
      nextButtonProps: {
        style: { display: 'none' }, // Hide the finish button
      },
      prevButtonProps: {
        children: currentLanguage === 'zh' ? '上一步' : undefined,
      },
    },
  ];
  return (
    <Tour
      open={open}
      onClose={() => setOpen(false)}
      steps={steps}
      closable={false}
    />
  );
};

export default FTUETour;
