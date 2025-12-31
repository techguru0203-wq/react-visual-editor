import {
  Issue,
  Organization,
  SubscriptionStatus,
  SubscriptionTier,
  WorkPlan,
} from '@prisma/client';
import * as CryptoJS from 'crypto-js';
import dayjs from 'dayjs';
import PizZip from 'pizzip';

import {
  GenerationMinimumCredit,
  SubscriptionTierIndex,
  USER_MAX_CREDITS_PER_MONTH,
} from '../constants';

export function calculateHealthScore(record: Issue | WorkPlan) {
  let { completedStoryPoint, storyPoint, plannedStartDate, plannedEndDate } =
    record;
  let expectedVelocity =
    (storyPoint || 0) /
    dayjs(plannedEndDate).diff(dayjs(plannedStartDate), 'day');
  let daysPassed = dayjs().diff(dayjs(plannedStartDate), 'day');
  let velocity = daysPassed > 0 ? (completedStoryPoint || 0) / daysPassed : 0;

  let healthScore = Math.floor((velocity / expectedVelocity) * 100);
  let healthCode;
  if (healthScore >= 90) {
    healthCode = 'green';
  } else if (healthScore > 70) {
    healthCode = 'orange';
  } else if (healthScore > 50) {
    healthCode = 'yellow';
  } else {
    healthCode = 'red';
  }
  return { healthScore, healthCode };
}

function str2xml(str: string) {
  if (str.charCodeAt(0) === 65279) {
    // BOM sequence
    str = str.substr(1);
  }
  return new DOMParser().parseFromString(str, 'text/xml');
}

export function getParagraphsFromWordFile(content: any) {
  const zip = new PizZip(content);
  const xml = str2xml(zip.files['word/document.xml'].asText());
  const paragraphsXml = xml.getElementsByTagName('w:p');
  const paragraphs = [];

  for (let i = 0, len = paragraphsXml.length; i < len; i++) {
    let fullText = '';
    const textsXml = paragraphsXml[i].getElementsByTagName('w:t');
    for (let j = 0, len2 = textsXml.length; j < len2; j++) {
      const textXml = textsXml[j];
      if (textXml.childNodes) {
        fullText += textXml.childNodes[0].nodeValue;
      }
    }
    if (fullText) {
      paragraphs.push(fullText);
    }
  }
  return paragraphs;
}

export function checkIsGenerationLocked(organization: Partial<Organization>) {
  return (organization?.credits ?? 0) <= GenerationMinimumCredit;
}

export function isFeatureLocked(
  subscriptionStatus: string,
  subscriptionTier: string,
  targetSubscriptionTier: string = 'PRO'
) {
  return (
    subscriptionStatus === SubscriptionStatus.CANCELED ||
    subscriptionStatus === SubscriptionStatus.EXPIRED ||
    SubscriptionTierIndex[subscriptionTier] <
      SubscriptionTierIndex[targetSubscriptionTier]
  );
}

export const SubscriptionTierUserMax: Record<string, number> = {
  Free: 5,
  STARTER: 1000000, // 5
  PRO: 1000000, // 10
  BUSINESS: 1000000,
  ENTERPRISE: 1000000,
};

export function isInvitingTeamLocked(
  userCount: number,
  subscriptionTier: string
) {
  return userCount >= SubscriptionTierUserMax[subscriptionTier];
}

export function createIntercomHmac(userId: string): string {
  const hmac = CryptoJS.HmacSHA256(
    userId,
    process.env.REACT_APP_INTERCOM_SECRET_KEY as string
  );
  let result = hmac.toString(CryptoJS.enc.Hex);
  console.log('in app.createIntercomHmac:', userId, result);
  return result;
}

export function getOutOfCreditTitle(
  org: {
    subscriptionTier?: string | null;
    monthFreeCreditUsed?: number | null;
  },
  t: (key: string) => string
): string {
  const tier = org?.subscriptionTier ?? SubscriptionTier.FREE;
  const used = org?.monthFreeCreditUsed ?? 0;
  const monthlyCreditUseUpMessage = t('app.monthlyCreditsUsedUp');

  if (tier === SubscriptionTier.FREE) {
    return used >= USER_MAX_CREDITS_PER_MONTH
      ? monthlyCreditUseUpMessage
      : t('app.outOfCredits');
  }

  return monthlyCreditUseUpMessage;
}
