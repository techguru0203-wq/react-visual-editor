import { useState } from 'react';
import { Document } from '@prisma/client';
import { Flex, message, Rate } from 'antd';

import { useLanguage } from '../../../common/contexts/languageContext';
import { updateDocumentHistoryRatingApi } from '../api/documentHistoryApi';
import { DocHistoryItem } from './DocumentEditor';

interface IProps {
  historyData: DocHistoryItem;
  docData: Partial<Document>;
  userId: string;
  existingRating?: { userId: string; value: number };
  disabled: boolean;
  refresh?: (...args: any) => void;
}

const FeedbackRating = ({
  historyData,
  docData,
  userId,
  existingRating,
  disabled,
  refresh,
}: IProps) => {
  const { t } = useLanguage();
  const [rating, setRating] = useState(existingRating?.value ?? 0);

  const handleRatingChange = async (value: any) => {
    setRating(value);

    // Build the updated rating array
    const ratingUpdate = [
      ...(historyData.rating ?? []).filter((x: any) => x.userId !== userId),
      { userId: userId, value: value },
    ];

    // Call the new API to update rating in DocumentHistory table
    await updateDocumentHistoryRatingApi(
      docData.id!,
      historyData.versionNumber!,
      ratingUpdate
    );
    
    refresh?.();
    message.success(t('document.thankYouForFeedback'));
  };

  const desc = [
    t('document.veryPoor'),
    t('document.needsImprovement'),
    t('document.acceptable'),
    t('document.good'),
    t('document.excellent'),
  ];

  return (
    <Flex aria-disabled={disabled} align="center" gap={4}>
      {!disabled && (
        <h4 style={{ textWrap: 'nowrap', margin: '5px', marginTop: 0 }}>
          {t('document.rateLatestGeneration')}
        </h4>
      )}
      <Rate
        style={{ fontSize: 15 }}
        disabled={disabled}
        tooltips={desc}
        onChange={handleRatingChange}
        value={rating}
      />
    </Flex>
  );
};

export default FeedbackRating;
