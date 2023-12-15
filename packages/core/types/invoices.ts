import Stripe from "stripe";

export interface Invoice {
  id: string;
  workspaceId: string;
  sourceType: "SUBSCRIPTION";
  sourceId: string;
  remoteId: string;
  remoteCustomerId: string;
  currency: string;
  hostedInvoiceUrl?: string;
  invoicePdfUrl?: string;
  periodStart: string;
  periodEnd: string;
  status: Stripe.Invoice.Status;
  total: number;
  amountDue: number;
  attempted: boolean; // Whether Stripe has attempted to collect payment.
  paid: boolean; // If the invoice is paid or not.
  created: string;
  createdBy: string;
  modified: string;
  modifiedBy: string;
}
