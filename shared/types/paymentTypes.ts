import { Payment } from "@prisma/client";

export type PaymentOutout = Readonly<Payment & {
  id: string;
  payerUserId: string;
  subscriptionTier: string;
}>;