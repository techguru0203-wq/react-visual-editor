import { Request } from 'express';
import { AuthenticatedResponse } from '../../types/response';
import { WorkPlan } from '@prisma/client';
import prisma from '../../db/prisma';

const router = require('express').Router();

// update issue
router.post('/update', async function (req: Request, res: AuthenticatedResponse<WorkPlan>) {
  const currentUser = res.locals.currentUser;

  let workPlanData = req.body;
  console.log(
    'in server.routes.api.workplans.update.start:',
    currentUser?.userId,
    workPlanData
  );
  let updateResult;
  try {
    // update issue
    updateResult = await prisma.workPlan.update({
      where: {
        id: workPlanData.id,
      },
      data: workPlanData,
    });
  } catch (e) {
    console.log('in server.routes.api.workplans.update.failure:', e);
    res
      .status(500)
      .json({ success: false, errorMsg: 'Network error. Please retry.' });
    return;
  }
  console.log('in server.routes.api.workplans.update.result:', updateResult);
  res
    .status(201)
    .json({ success: true, data: updateResult });
});

module.exports = {
  className: 'workplans',
  routes: router,
};
