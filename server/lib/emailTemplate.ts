import { SubscriptionTier } from '@prisma/client';
import { planNamesMap } from './constant';

export const errorTemplate = (error: any) => {
  return `
  <p>Hey</p>
  <p>An error occurred during a credit purchase process: the user could not be found using the associated email address.</p>
  <p>Error Details:</p>
  <b>${error}</b>

  <p>Please investigate this issue promptly to ensure no disruption in the user's experience.</p>
  <p>Best Regards,</p>
  <p>The Omniflow Team</p>`;
};

export const welcomeEmail = (UserName: string) => {
  return `<p>Hey ${UserName},</p>
  <p>Welcome to Omniflow! We're thrilled to have you on board.</p>
  <p>We started Omniflow to help teams automate their entire product development lifecycle. We believe you'll love what you can accomplish with us.</p>
  <p>If you need help getting started, feel free to contact us at <a href="mailto:general@omniflow.team">general@omniflow.team</a>. You may also join our <a href="https://bit.ly/3B88K2g">Slack Community</a> if you need anything.</p>

  <p>Best Regards,</p>
  <p>The Omniflow Team</p>`;
};

export const postProjectCreation = (UserName: string, projectName: string) => {
  return `<p>Hey ${UserName},</p>
  <p>Congratulations on creating your first project "${projectName}" in Omniflow! We hope the process went smoothly.</p>
  <p>We'd love to hear about your experience. How did we do? Please share your feedback with us at <a href="mailto:general@omniflow.team">general@omniflow.team</a>.</p>
  <p>Your thoughts help us make our service better for everyone. You may also join our Slack group to be part of <a href="https://bit.ly/3B88K2g">our community</a>.</p>
  <p>Thanks again for choosing Omniflow!</p>
  
  <p>Best Regards,</p>
  <p>The Omniflow Team</p>`;
};

export const subscriptionExpirationEmail = (
  userName: string,
  organizationName: string | null,
  expirationDate: string | null
) => {
  return `<p>Hey ${userName},</p>
  <p>We wanted to remind you that your subscription with ${organizationName} is set to expire on <strong>${expirationDate}</strong>.</p>
  <p>To avoid any interruption in service, please renew your subscription at your earliest convenience. You can do this by navigating to the Billing page (click on your profile picture, then select Billing).</p>
  <p>If you have any questions or need assistance, feel free to reach out to us at <a href="mailto:general@omniflow.team">general@omniflow.team</a>.</p>

  <p>Thank you for being a valued member of our community!</p>
  <p>Best Regards,</p>
  <p>The Omniflow Team</p>`;
};

export const reminderEmail = (UserName: string) => {
  return `<p>Hey ${UserName},</p>
  <p>It's been a week since you signed up for Omniflow, and we noticed you haven't had the chance to start yet. No worries – we're here to help you get the most out of Omniflow.</p>
  <p>Our users usually start by Adding a Project or Creating a Document. Our AI agents will help you complete days of work in minutes.</p>
  <p>If you have any questions or need assistance, feel free to reach out to us at <a href="mailto:general@omniflow.team">general@omniflow.team</a> or join our <a href="https://bit.ly/3B88K2g">Slack Community</a>.</p> 
  <p>Looking forward to seeing what you'll create!</p>

  <p>Best Regards,</p>
  <p>The Omniflow Team</p>`;
};

export const accountUpgradeDowngrade = (
  UserName: string,
  plan: SubscriptionTier,
  isUpgrade: boolean
) => {
  return `<p>Hey ${UserName},</p>
  <p>Your account has been successfully ${
    isUpgrade ? 'upgraded' : 'downgraded'
  } to the ${planNamesMap[plan]} plan.</p>
  <p>If you have any questions about your new plan or need help with your account, feel free to reach out to us at <a href="mailto:general@omniflow.team">general@omniflow.team</a>. You may also join our <a href="https://bit.ly/3B88K2g">Slack Community</a> to ask questions and get early access to product updates.</p>

  <p>Best Regards,</p>
  <p>The Omniflow Team</p>`;
};

export const accountCancellation = (
  UserName: string | undefined,
  endDate: string | undefined
) => {
  return `<p>Hey ${UserName},</p>
  <p>We're sorry to see you go! Your subscription with Omniflow has been successfully canceled.</p>
  <p>Your subscription will remain active until ${endDate}.</p>
  <p>If there's anything we could have done to make your experience better, we'd love to hear your feedback. Please feel free to email us at <a href="mailto:general@omniflow.team">general@omniflow.team</a>.</p>
  <p>If you ever decide to return, we’d be thrilled to have you back.</p>
  <p>Thank you for giving us a try.</p>

  <p>Best Regards,</p>
  <p>The Omniflow Team</p>`;
};

export const creditsRefill = (UserName: string) => {
  return `<p>Hey ${UserName},</p> 
  <p>Great news! Your Omniflow credits have been successfully refilled.</p>
  <p>Please return to the Omniflow app and continue experiencing the magic.</p>
  <p>If you have any questions, don't hesitate to reach out to us at <a href="mailto:general@omniflow.team">general@omniflow.team</a>.  You may also join our <a href="https://bit.ly/3B88K2g">Slack Community</a> if you need anything.</p>

  <p>Best Regards,</p>
  <p>The Omniflow Team</p>`;
};

export const newUserSignup = (email: string) => {
  return `${email} has just signed up for Omniflow.`;
};

export const referralCommissionEarned = (
  referrerName: string,
  referredUserEmail: string,
  commissionAmount: number,
  purchasedAmount: number
) => {
  return `<p>Hey ${referrerName},</p>
  <p>🎉 Congratulations! You've earned a referral commission!</p>
  <br>
  <p><strong>Commission Details:</strong></p>
  <ul>
    <li>Referred User: ${referredUserEmail}</li>
    <li>Purchase Amount: $${(purchasedAmount / 100).toFixed(2)}</li>
    <li>Your Commission: $${(commissionAmount / 100).toFixed(2)}</li>
  </ul>
  <br>
  <p>Your commission has been tracked and will be included in your monthly referral payment. Keep sharing Omniflow with others to earn more rewards!</p>
  <p>If you have any questions, don't hesitate to reach out to us at <a href="mailto:general@omniflow.team">general@omniflow.team</a>. You may also join our <a href="https://bit.ly/3B88K2g">Slack Community</a> if you need anything.</p>
  <br>
  <p>Best Regards,<br>The Omniflow Team</p>`;
};

export const referralRewardEarned = (
  referrerName: string,
  referredUserEmail: string,
  rewardAmount: number
) => {
  return `<p>Hey ${referrerName},</p>
  <p>🎉 Congratulations! You've earned a referral reward!</p>
  <br>
  <p><strong>Referral Reward Details:</strong></p>
  <ul>
    <li>Referred User: ${referredUserEmail}</li>
    <li>Your Initial Reward: ${rewardAmount.toLocaleString()} credits</li>
  </ul>
  <br>
  <p>Your initial reward of 1,000 Omniflow credits has been automatically added to your account. Additionally, you'll earn 15% commission on the first 6 months of subscription payments made by your referred users!</p>
  <p>Thank you for helping grow the Omniflow community!</p>
  <p>If you have any questions, don't hesitate to reach out to us at <a href="mailto:general@omniflow.team">general@omniflow.team</a>. You may also join our <a href="https://bit.ly/3B88K2g">Slack Community</a> if you need anything.</p>
  <br>
  <p>Best Regards,<br>The Omniflow Team</p>`;
};
