import { User } from '@prisma/client';
import prisma from '../db/prisma';
import {
  CREDITS_ACTIONS,
  OMNIFLOW_INVITE_USER_CREDIT_AWARD,
  GenerationMinimumCredit,
  USER_MAX_CREDITS_PER_MONTH,
  USER_REFILL_CREDITS_PER_DAY,
} from '../lib/constant';
import { AuthenticatedUserWithProfile } from '../types/authTypes';
import { sendEmail } from './emailService';
import { creditsRefill } from '../lib/emailTemplate';
import dayjs from 'dayjs';
import {
  ACTIVE_OPENAI_MODEL_ID_PROD,
  ACTIVE_OPENAI_MODEL_ID_DEV,
} from './llmService/uiux/ai_utils';
import {
  CLAUDE_SONNET_4_PROMPT_PRICE,
  CLAUDE_SONNET_4_CACHE_WRITE_PRICE,
  CLAUDE_SONNET_4_CACHE_READ_PRICE,
  CLAUDE_SONNET_4_COMPLETION_PRICE,
  CLAUDE_SONNET_4_5_PROMPT_PRICE,
  CLAUDE_SONNET_4_5_CACHE_WRITE_PRICE,
  CLAUDE_SONNET_4_5_CACHE_READ_PRICE,
  CLAUDE_SONNET_4_5_COMPLETION_PRICE,
  GPT4O_MINI_PROMPT_PRICE,
  GPT4O_MINI_CACHE_READ_PRICE,
  GPT4O_MINI_COMPLETION_PRICE,
  GPT4O_PROMPT_PRICE,
  GPT4O_COMPLETION_PRICE,
  GPT_5_PROMPT_PRICE,
  GPT_5_COMPLETION_PRICE,
  GEMINI_FLASH_PROMPT_PRICE,
  GEMINI_FLASH_COMPLETION_PRICE,
  GEMINI_PRO_PROMPT_PRICE,
  GEMINI_PRO_COMPLETION_PRICE,
  OmniflowCreditToCostConversion,
  WHISPER_COMPLETION_PRICE,
} from '../../shared/constants';

/**
 * Calculate credits from token usage
 */
export function calculateCreditsFromTokens(
  promptTokens: number,
  completionTokens: number,
  cacheReadTokens: number = 0,
  cacheWriteTokens: number = 0,
  modelName?: string
): number {
  let totalCost = 0;
  const toUSD = (tokens: number, pricePerMTok: number) =>
    (tokens / 1000000) * pricePerMTok;

  const lowerModelName = modelName?.toLowerCase() || '';

  // Claude Sonnet 4.5 models
  if (lowerModelName.includes('claude-sonnet-4-5')) {
    totalCost += toUSD(promptTokens, CLAUDE_SONNET_4_5_PROMPT_PRICE);
    if (cacheWriteTokens > 0) {
      totalCost += toUSD(cacheWriteTokens, CLAUDE_SONNET_4_5_CACHE_WRITE_PRICE);
    }
    totalCost += toUSD(cacheReadTokens, CLAUDE_SONNET_4_5_CACHE_READ_PRICE);
    totalCost += toUSD(completionTokens, CLAUDE_SONNET_4_5_COMPLETION_PRICE);
  }
  // Claude Sonnet 4 models
  else if (lowerModelName.includes('claude-sonnet-4')) {
    totalCost += toUSD(promptTokens, CLAUDE_SONNET_4_PROMPT_PRICE);
    if (cacheWriteTokens > 0) {
      totalCost += toUSD(cacheWriteTokens, CLAUDE_SONNET_4_CACHE_WRITE_PRICE);
    }
    totalCost += toUSD(cacheReadTokens, CLAUDE_SONNET_4_CACHE_READ_PRICE);
    totalCost += toUSD(completionTokens, CLAUDE_SONNET_4_COMPLETION_PRICE);
  } else if (
    lowerModelName.includes('gpt-4o') &&
    !lowerModelName.includes('mini')
  ) {
    // GPT-4o
    totalCost += toUSD(promptTokens, GPT4O_PROMPT_PRICE);
    totalCost += toUSD(completionTokens, GPT4O_COMPLETION_PRICE);
  } else if (lowerModelName.includes('gpt-5')) {
    // GPT-5
    totalCost += toUSD(promptTokens, GPT_5_PROMPT_PRICE);
    totalCost += toUSD(completionTokens, GPT_5_COMPLETION_PRICE);
  } else if (
    modelName === ACTIVE_OPENAI_MODEL_ID_DEV ||
    modelName === ACTIVE_OPENAI_MODEL_ID_PROD ||
    lowerModelName.includes('gpt')
  ) {
    // OpenAI GPT-4o-mini and other GPT models
    totalCost += toUSD(promptTokens - cacheReadTokens, GPT4O_MINI_PROMPT_PRICE);
    totalCost += toUSD(cacheReadTokens, GPT4O_MINI_CACHE_READ_PRICE);
    totalCost += toUSD(completionTokens, GPT4O_MINI_COMPLETION_PRICE);
  } else if (
    lowerModelName.includes('gemini') &&
    lowerModelName.includes('flash')
  ) {
    // Gemini 2.5 Flash
    totalCost += toUSD(promptTokens, GEMINI_FLASH_PROMPT_PRICE);
    totalCost += toUSD(completionTokens, GEMINI_FLASH_COMPLETION_PRICE);
  } else if (
    lowerModelName.includes('gemini') &&
    lowerModelName.includes('pro')
  ) {
    // Gemini 2.5 Pro
    totalCost += toUSD(promptTokens, GEMINI_PRO_PROMPT_PRICE);
    totalCost += toUSD(completionTokens, GEMINI_PRO_COMPLETION_PRICE);
  } else if (lowerModelName.includes('whisper')) {
    // Whisper
    totalCost += toUSD(completionTokens, WHISPER_COMPLETION_PRICE);
  } else {
    // Default fallback (use OpenAI pricing)
    totalCost += toUSD(promptTokens - cacheReadTokens, GPT4O_MINI_PROMPT_PRICE);
    totalCost += toUSD(cacheReadTokens, GPT4O_MINI_CACHE_READ_PRICE);
    totalCost += toUSD(completionTokens, GPT4O_MINI_COMPLETION_PRICE);
  }

  return Math.max(Math.ceil(totalCost / OmniflowCreditToCostConversion), 3);
}

export async function updateOrgCreditsAfterContentGen(
  user: Partial<AuthenticatedUserWithProfile>,
  docType: string,
  tokenInfo: any,
  docId?: string,
  templateDocId?: string,
  modelName?: string
) {
  console.log(
    'in services.creditService.updateOrgCreditsAfterContentGen.start:',
    {
      user,
      tokenInfo,
    }
  );
  // update org credits
  const { userId, organizationId, email } = user;
  const {
    completionTokens,
    promptTokens,
    totalTokens,
    cacheReadTokens = 0,
    cacheWriteTokens = 0,
  } = tokenInfo;

  const usedCredits = calculateCreditsFromTokens(
    promptTokens,
    completionTokens,
    cacheReadTokens,
    cacheWriteTokens,
    modelName
  );
  try {
    // first: update org credits and update lastFreeCreditRunOutDate if newCredits <= GenerationMinimumCredit

    const currentOrg = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { credits: true },
    });

    if (!currentOrg) {
      return;
    }

    const newCredits = currentOrg.credits - usedCredits;

    const updateData: any = {
      credits: { decrement: usedCredits },
    };

    if (newCredits <= GenerationMinimumCredit) {
      updateData.lastFreeCreditRunOutDate = new Date();
    }

    await prisma.organization.update({
      where: { id: organizationId },
      data: updateData,
    });

    // second:insert record into credit history
    const doc = !!docId
      ? await prisma.document.findUnique({
          where: { id: docId },
        })
      : await prisma.templateDocument.findUnique({
          where: { id: templateDocId },
        });
    await prisma.creditAction.create({
      data: {
        userId: userId as string,
        organizationId: organizationId as string,
        amount: -usedCredits,
        status: 'success',
        action: CREDITS_ACTIONS.CREDIT_CONSUME,
        meta: {
          docId,
          templateDocId,
          docName: doc?.name,
          docType,
          email,
          cacheWriteTokens,
          cacheReadTokens,
          completionTokens,
          promptTokens,
          totalTokens,
        },
      },
    });
    // TODO - Hook up email notification
  } catch (error) {
    console.error('Error in updateOrgCreditsAfterContentGen:', error);
  }
  return;
}

export async function updateOrgCreditsAfterUserInvite(
  inviterUser: User,
  inviteeEmail: string
) {
  console.log(
    'in services.creditService.updateOrgCreditsAfterUserInvite.start:',
    {
      inviterUser,
      inviteeEmail,
    }
  );
  // update org credits
  const { id: userId, organizationId } = inviterUser;

  try {
    // first: update org credits
    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        credits: {
          increment: OMNIFLOW_INVITE_USER_CREDIT_AWARD,
        },
      },
    });

    // second:insert record into credit history
    await prisma.creditAction.create({
      data: {
        userId: userId as string,
        organizationId: organizationId as string,
        amount: OMNIFLOW_INVITE_USER_CREDIT_AWARD,
        status: 'success',
        action: CREDITS_ACTIONS.CREDIT_INVITER_REWARD,
        meta: {
          inviteeEmail,
          inviterEmail: inviterUser.email,
        },
      },
    });
    // TODO - Hook up email notification
  } catch (error) {
    console.error('Error in updateOrgCreditsAfterUserInvite:', error);
  }
  return;
}

export async function updateOrgCreditsReFill(
  userId: string,
  organizationId: string,
  email: string,
  firstname: string
) {
  console.log('in services.creditService.updateOrgCreditsReFill.start:', {
    organizationId,
  });

  try {
    const updatedOrg = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        credits: true,
        monthFreeCreditUsed: true,
        lastFreeCreditRunOutDate: true,
        subscriptionTier: true,
        name: true,
      },
    });

    const today = dayjs();

    let lastFreeCreditRunOutDate =
      updatedOrg && updatedOrg.lastFreeCreditRunOutDate
        ? dayjs(updatedOrg.lastFreeCreditRunOutDate)
        : null;

    // Reset monthly vest flag if last vest wasn't in the current month
    const shouldResetVestMonth =
      lastFreeCreditRunOutDate &&
      !lastFreeCreditRunOutDate.isSame(today, 'month');

    // if updateOrg is null, set it to USER_MAX_CREDITS_PER_MONTH, so that the user would not be refilled
    let newMonthFreeCreditUsed = updatedOrg
      ? updatedOrg.monthFreeCreditUsed
      : USER_MAX_CREDITS_PER_MONTH;

    if (shouldResetVestMonth) {
      // update in local variables and update to the db later
      newMonthFreeCreditUsed = 0;
      lastFreeCreditRunOutDate = null;
    }

    // Check if refill is allowed today
    const shouldRefillToday =
      (!lastFreeCreditRunOutDate ||
        !lastFreeCreditRunOutDate.isSame(today, 'day')) &&
      newMonthFreeCreditUsed < USER_MAX_CREDITS_PER_MONTH;

    if (
      updatedOrg &&
      updatedOrg?.subscriptionTier === 'FREE' &&
      updatedOrg.credits <= GenerationMinimumCredit &&
      shouldRefillToday
    ) {
      const incrementAmount = Math.min(
        USER_MAX_CREDITS_PER_MONTH - newMonthFreeCreditUsed,
        USER_REFILL_CREDITS_PER_DAY
      );

      // Update credits, monthFreeCreditUsed and set lastFreeCreditRunOutDate today
      newMonthFreeCreditUsed = newMonthFreeCreditUsed + incrementAmount;
      // set to today's date in order to avoid refilling when users run out credits on the same day after refill
      lastFreeCreditRunOutDate = dayjs(new Date());

      await prisma.$transaction([
        prisma.organization.update({
          where: { id: organizationId },
          data: {
            credits: { increment: incrementAmount },
            monthFreeCreditUsed: newMonthFreeCreditUsed,
            lastFreeCreditRunOutDate: lastFreeCreditRunOutDate?.toDate(),
          },
        }),
        prisma.creditAction.create({
          data: {
            userId: userId as string,
            organizationId: organizationId as string,
            amount: incrementAmount,
            status: 'success',
            action: CREDITS_ACTIONS.CREDIT_REFILL,
            meta: { email },
          },
        }),
      ]);

      // Hook up email notification
      await sendEmail({
        email: email,
        subject: 'Congrats! Your Omniflow credits have been refilled.',
        body: creditsRefill(`${firstname || 'there'}`),
      });
    }
  } catch (error) {
    console.error('Error in updateOrgCreditsAfterUserInvite:', error);
  }
  return;
}
