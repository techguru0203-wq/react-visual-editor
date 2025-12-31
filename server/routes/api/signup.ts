import { Router } from 'express';
import prisma from '../../db/prisma';
import { RecordStatus, User, UserRole } from '@prisma/client';

import { StandardResponse } from '../../types/response';
import { sendEmail } from '../../services/emailService';
import { DEFAULT_DEV_VELOCITY, USER_SIGN_UP_CREDITS } from '../../lib/constant';
import { newUserSignup, welcomeEmail } from '../../lib/emailTemplate';
import { processReferral } from '../../services/referralService';

const router = Router();

// Sign up as a new user with a new organization
router.post('/', async function (request, response: StandardResponse<User>) {
  console.log('request in signup route', request.body);

  const {
    newUserId,
    email,
    organizationName,
    organizationWebsite,
    referralCode,
  } = request.body;

  try {
    // create the organization
    const org = await prisma.organization.create({
      data: {
        name: organizationName || '',
        website: organizationWebsite,
        credits: USER_SIGN_UP_CREDITS,
      },
    });

    const createdUser = await prisma.user.create({
      data: {
        id: newUserId,
        email: email,
        username: email.split('@')[0],
        firstname: ' ',
        lastname: ' ',
        role: UserRole.ADMIN,
        organizationId: org.id,
        velocity: DEFAULT_DEV_VELOCITY,
        status: RecordStatus.ACTIVE,
      },
    });

    // Process referral if referral code was provided
    if (referralCode) {
      try {
        await processReferral(
          referralCode,
          newUserId,
          email
        );
      } catch (referralError) {
        console.error('Error processing referral for:', email, referralError);
        // Don't fail signup if referral processing fails
      }
    }

    // send email to admin to notify new user signup
    await sendEmail({
      email: email,
      subject: 'Welcome to Omniflow 👋',
      body: welcomeEmail(createdUser.username),
    });

    // send email to admin
    await sendEmail({
      email: 'tingzhen.ming@gmail.com',
      subject: 'Omniflow new user sign up',
      body: newUserSignup(email),
    });

    response.status(200).json({ success: true, data: createdUser });
  } catch (e) {
    console.error('server.routes.api.user.signup.post failure:', e);
    response.status(500).json({ success: false, errorMsg: e as string });
    return;
  }
});

export const className = 'signup';
export const routes = router;
