import { Router } from 'express';
import prisma from '../../db/prisma';
import { GenerationMinimumCredit } from '../../lib/constant';
import { sendEmail } from '../../services/emailService';
import { Prisma } from '@prisma/client';

const router = Router();

router.post('/submit', async (req, res) => {
  try {
    const { userId, organizationId } = res.locals.currentUser;
    const { npsScore, likes, dislikes } = req.body;

    if (!npsScore || npsScore < 1 || npsScore > 10) {
      return res.status(400).json({
        success: false,
        errorMsg: 'NPS score must be between 1 and 10',
      });
    }

    // Get user and organization info
    const [user, organization] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, firstname: true, username: true },
      }),
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: { name: true },
      }),
    ]);

    if (!user || !organization) {
      return res.status(404).json({
        success: false,
        errorMsg: 'User or organization not found',
      });
    }

    // Send email to general@omniflow.team and tingzhen@omniflow.team
    const emailBody = `
New Feedback Submission from ${user.firstname || user.username} (${
      user.email
    })\n\n

Organization: ${organization.name || 'N/A'}\n\n

NPS Score: ${npsScore}/10\n\n

What they like:
${likes || 'N/A'}\n\n

What they don't like:
${dislikes || 'N/A'}\n\n
`;

    const recipients = ['general@omniflow.team'];

    // Write to Notion and send emails in parallel
    await Promise.all([
      ...recipients.map((email) =>
        sendEmail({
          email,
          subject: `New Omniflow Feedback - NPS: ${npsScore}/10`,
          body: emailBody,
        })
      ),
    ]);

    // Set feedbackSent to true in organization meta using PostgreSQL jsonb operator
    const metaUpdate = { feedbackSent: true };
    const metaUpdateJson = JSON.stringify(metaUpdate);

    try {
      const result = await prisma.$executeRawUnsafe(
        `UPDATE "organizations" SET meta = COALESCE(meta, '{}'::jsonb) || $1::jsonb WHERE id = $2`,
        metaUpdateJson,
        organizationId
      );
      console.log(
        'Updated organization meta with feedbackSent=true for organizationId:',
        organizationId,
        'Rows affected:',
        result
      );
    } catch (updateError) {
      console.error('Error updating organization meta:', updateError);
      throw updateError;
    }

    return res.json({
      success: true,
    });
  } catch (error) {
    console.error('Error submitting feedback:', error);
    return res.status(500).json({
      success: false,
      errorMsg: 'Failed to submit feedback',
    });
  }
});

router.get('/should-show', async (req, res) => {
  try {
    const { userId, organizationId } = res.locals.currentUser;

    if (!organizationId) {
      console.error(
        'organizationId is undefined in currentUser:',
        res.locals.currentUser
      );
      res.setHeader('Content-Type', 'application/json');
      return res.json({ shouldShow: false });
    }

    // Check if user is first-time (has only 1 project) and has run out of credit
    const [organization, projectCount] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: { credits: true, meta: true },
      }),
      prisma.project.count({
        where: {
          organizationId,
          creatorUserId: userId,
          status: {
            in: ['CREATED', 'STARTED', 'PAUSED'],
          },
        },
      }),
    ]);

    if (!organization) {
      res.setHeader('Content-Type', 'application/json');
      return res.json({ shouldShow: false });
    }

    // Check if feedback has already been sent
    const meta = (organization.meta as Prisma.JsonObject) || {};
    if (meta.feedbackSent === true) {
      return res.json({ shouldShow: false });
    }

    const hasRunOutOfCredit =
      (organization.credits ?? 0) <= GenerationMinimumCredit;

    const shouldShowValue = hasRunOutOfCredit;

    return res.json({
      shouldShow: shouldShowValue,
    });
  } catch (error) {
    console.error('Error checking if should show feedback:', error);
    res.setHeader('Content-Type', 'application/json');
    return res.json({ shouldShow: false });
  }
});

export const className = 'feedback';
export const routes = router;
export default router;
