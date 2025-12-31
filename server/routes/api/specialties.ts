import { Request } from 'express';
import { ProfileResponse } from '../../types/response';
import { Access, Specialty } from '@prisma/client';
import prisma from '../../db/prisma';
import { userProfileRequestHandler } from '../../lib/util';
import { SuperAdminCompanyId } from '../../lib/constant';

const router = require('express').Router();
router.use(userProfileRequestHandler);

router.get(
  '/',
  async function (req: Request, res: ProfileResponse<Partial<Specialty>[]>) {
    const currentUser = res.locals.currentUser;

    console.log(
      'in server.routes.api.specialties.get.start:',
      currentUser?.organizationId
    );
    let results;
    try {
      // update issue
      results = await prisma.specialty.findMany({
        where: {
          status: 'ACTIVE',
          organizationId: {
            in: [currentUser?.organizationId, SuperAdminCompanyId],
          },
        },
        select: { name: true, displayName: true, id: true },
      });
    } catch (e) {
      console.log('in server.routes.api.specialties.get.failure:', e);
      res
        .status(500)
        .json({ success: false, errorMsg: 'Network error. Please retry.' });
      return;
    }
    res.status(201).json({ success: true, data: results });
  }
);

router.post(
  '/',
  async function (req: Request, res: ProfileResponse<Partial<Specialty>>) {
    const currentUser = res.locals.currentUser;
    const { displayName } = req.body;
    const name = displayName.replace(' ', '_').toUpperCase();
    console.log(
      'in server.routes.api.specialties.get.start:',
      currentUser?.organizationId
    );
    let result;
    try {
      // update issue
      result = await prisma.specialty.create({
        data: {
          name,
          displayName,
          organizationId: currentUser.organizationId,
          creatorUserId: currentUser.userId,
          access: Access.ORGANIZATION,
        },
        select: { name: true, displayName: true, id: true },
      });
    } catch (e) {
      console.log('in server.routes.api.specialties.create.failure:', e);
      res
        .status(500)
        .json({ success: false, errorMsg: 'Network error. Please retry.' });
      return;
    }
    console.log('in server.routes.api.specialties.create.result:', result);
    res.status(201).json({ success: true, data: result });
  }
);

module.exports = {
  className: 'specialties',
  routes: router,
};
