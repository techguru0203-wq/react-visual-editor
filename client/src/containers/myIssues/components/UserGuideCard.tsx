import { Flex } from 'antd';

import { useAppModal } from '../../../common/components/AppModal';
import { useLanguage } from '../../../common/contexts/languageContext';
import { ReactComponent as DetailsIcon } from '../../../common/icons/details-icon.svg';
import { ReactComponent as VideoIcon } from '../../../common/icons/video-icon.svg';
import { COLORS } from '../../../lib/constants';

const UserGuideCard = () => {
  const { showAppModal } = useAppModal();
  const { t } = useLanguage();
  return (
    <Flex
      vertical
      style={{
        padding: '20px',
        borderRadius: '15px',
        background:
          'linear-gradient(to right, #4117E7 0%, #4117E7 41%, #9610DB 67%, #FE3CC4 99%)',
      }}
    >
      <Flex
        style={{
          color: COLORS.WHITE,
          fontSize: '20px',
          marginBottom: '5px',
        }}
      >
{t('userGuide.title')}
      </Flex>
      <Flex style={{ color: COLORS.LIGHT_GRAY, fontSize: '14px' }}>
{t('userGuide.welcome')}
      </Flex>
      <Flex
        style={{
          paddingTop: '25px',
          justifyContent: 'flex-end',
          color: COLORS.LIGHT_GRAY,
          alignItems: 'center',
        }}
      >
        <Flex style={{ alignItems: 'center', cursor: 'pointer' }}>
          <a
            target="_blank"
            href="https://www.omniflow.team/faq"
            rel="noreferrer"
            style={{
              color: 'inherit',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <DetailsIcon style={{ marginRight: '5px' }} />
{t('userGuide.viewFaq')}
          </a>
        </Flex>
        <Flex
          onClick={() => showAppModal({ type: 'viewTutorial' })}
          style={{
            alignItems: 'center',
            cursor: 'pointer',
            marginLeft: '10px',
          }}
        >
          <VideoIcon style={{ marginLeft: '20px', marginRight: '5px' }} />
{t('userGuide.watchDemo')}
        </Flex>
      </Flex>
    </Flex>
  );
};

export default UserGuideCard;
