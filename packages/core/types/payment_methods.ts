export interface PaymentMethod {
  id: string;
  userId: string;
  remoteId: string;
  remoteCustomerId: string;
  provider: "STRIPE";
  type: "CARD";
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  subscriptionIds?: string[];
  created: string;
  createdBy: string;
  modified: string;
  modifiedBy: string;
}
