import { Request } from 'express';
import { ProfileResponse } from '../../types/response';
import { CreditAction } from '@prisma/client';
import prisma from '../../db/prisma';
import { userProfileRequestHandler } from '../../lib/util';

const router = require('express').Router();
router.use(userProfileRequestHandler);

// get credit history for org
router.get(
  '/',
  async function (req: Request, res: ProfileResponse<CreditAction[]>) {
    const { userId, organizationId } = res.locals.currentUser;

    console.log(
      'in routes.api.credits.getOrgCreditHistory:',
      userId,
      organizationId
    );
    let data;
    try {
      // update issue
      data = await prisma.creditAction.findMany({
        where: {
          organizationId,
        },
      });
    } catch (e) {
      console.error('in routes.api.credits.getOrgCreditHistory.failure:', e);
      res
        .status(500)
        .json({ success: false, errorMsg: 'Network error. Please retry.' });
      return;
    }
    res.status(200).json({ success: true, data });
  }
);

module.exports = {
  className: 'credits',
  routes: router,
};
