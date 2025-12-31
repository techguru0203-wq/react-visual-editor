import { z } from 'zod';
import { DevPlan } from '../../types/schedulingTypes';
import { DOCTYPE, Document } from '@prisma/client';
import { DevPlanSchema } from '../../types/schedulingSchema';
import dayjs from 'dayjs';

export const DevPlanMetaSchema = z
  .object({
    sprintWeek: z.coerce.number().default(2),
    teammates: z
      .string()
      .default('')
      .transform((value) => value.split(';').filter((s) => s.length))
      .pipe(
        z.array(
          z
            .string()
            .transform((value) => value.split(','))
            .pipe(z.tuple([z.string(), z.string(), z.coerce.number()]))
            .transform((value) => ({
              userId: value[0],
              specialty: value[1],
              storyPointsPerSprint: value[2],
            }))
        )
      ),
    requiredSpecialties: z
      .string()
      .default('')
      .transform((value) => value.split(',').filter((s) => s.length)),
    chosenDocumentIds: z
      .string()
      .default('')
      .transform((value) => value.split(',').filter((s) => s.length)),
    sprintStartDate: z
      .string()
      .nullable().optional()
      .default(dayjs().format('MM/DD/YYYY')),
  })
  .transform((value) => ({
    weeksPerSprint: value.sprintWeek,
    teamMembers: value.teammates,
    requiredSpecialties: value.requiredSpecialties,
    chosenDocumentIds: value.chosenDocumentIds,
    sprintStartDate: value.sprintStartDate,
  }));

export type DevPlanTeamMember = Readonly<{
  userId: string;
  specialty: string;
  storyPointsPerSprint: number;
}>;

export type DevPlanOutput = Readonly<
  Omit<Document, 'content' | 'type' | 'meta'> &
    DevPlan & {
      type: typeof DOCTYPE.DEVELOPMENT_PLAN;
      weeksPerSprint: number;
      teamMembers: ReadonlyArray<DevPlanTeamMember>;
      requiredSpecialties: ReadonlyArray<string>;
      chosenDocumentIds: ReadonlyArray<string>;
      sprintStartDate: string;
    }
>;

export const DevPlanInputSchema = DevPlanSchema.extend({
  weeksPerSprint: z.number(),
  teamMembers: z.array(
    z.object({
      userId: z.string(),
      specialty: z.string(),
      storyPointsPerSprint: z.number(),
    })
  ),
  requiredSpecialties: z
    .string()
    .default('')
    .transform((value) => value.split(',').filter((s) => s.length)),
  chosenDocumentIds: z
    .string()
    .default('')
    .transform((value) => value.split(',').filter((s) => s.length)),
  sprintStartDate: z.string().nullable().optional().default(dayjs().format('MM/DD/YYYY')),
  regenerateMilestones: z.boolean(),
  publishPlan: z.boolean().nullable().optional().default(false),
});
export type DevPlanInput = z.infer<typeof DevPlanInputSchema>;
