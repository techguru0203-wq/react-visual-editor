export interface SubscriptionProductItem {
  amount: number;
  amountExcludingTax: number;
  tier: string;
  description: string;
  interval: string;
  period: {
    end: number;
    start: number;
  };
  seats: number;
}

export interface InvoicePaymentData {
  evtId: string;
  invoiceId: string;
  amountPaid: number;
  amountDue: number;
  currency: string;
  paymentMethod: string;
  customerEmail: string;
  customerName: string;
  stripeCustomerId: string;
  invoiceUrl: string;
  discount: {
    id: string;
    name: string;
    percent_off: number;
  };
  productInfo: SubscriptionProductItem;
  status: string;
  subscriptionId: string;
}

export interface CreditPurchasePaymentData {
  id: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  customerEmail: string;
  customerName: string;
  receiptUrl: string;
  status: string;
}

export interface SubscriptionCancelData {
  stripeCustomerId: string;
  canceledDate: number;
  eventId: string;
  currentUser?: any;
}
