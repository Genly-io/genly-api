import Stripe from "stripe";
import { PaymentMethod } from "./payment_methods";

export type SubscriptionPrice = {
  remoteId: string;
  remoteItemId: string;
  unitAmount: number; // In cents. No floats, whole integers only.
  currency: string;
  period: "MONTHLY" | "YEARLY";
  quantity: number;
};

export interface Subscription {
  id: string;
  workspaceId: string;
  provider: "STRIPE";
  remoteId: string;
  remoteCustomerId: string;
  remoteProductId: string;
  price: SubscriptionPrice;
  paymentMethod?: PaymentMethod;
  status: Stripe.Subscription.Status;
  periodStart: string;
  periodEnd: string;
  trialStart?: string;
  trialEnd?: string;
  ended: boolean;
  endedAt?: string;
  cancelAtPeriodEnd?: boolean;
  created: string;
  createdBy: string;
  modified: string;
  modifiedBy: string;
}
