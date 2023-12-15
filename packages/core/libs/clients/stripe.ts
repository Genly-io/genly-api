/*import { nanoid } from "nanoid";
import Stripe from "stripe";

import { PaymentMethod } from "../../types/payment_methods";
import { User } from "../../types/users";
import { Subscription } from "../../types/subscriptions";
import { Invoice } from "../../types/invoices";

import { Exception } from "../errors";
import { buildUserFullName } from "../user";
import { dateTimeFromUnixTimestamp, env, nowISODateString } from "../utils";
import { getStripeSecretKey } from "../repositories/config";

function getStripReferralCouponId() {
  return env<string>("STAGE", "dev") === "prod" ? "BerhzNty" : "aQHGUpRj";
}
*/

import Stripe from "stripe";
import { Config } from "sst/node/config";
import { Exception } from "../errors";
import { User } from "../../types/users";
import { buildUserFullName } from "../../repositories/users";
import { PaymentMethod } from "../../types/payment_methods";
import { nanoid } from "nanoid";
import { Subscription } from "../../types/subscriptions";
import { Invoice } from "../../types/invoices";
import { dateTimeFromUnixTimestamp, env, nowISODateString } from "../utils";

function getStripReferralCouponId() {
  //return env<string>("STAGE", "dev") === "prod" ? "BerhzNty" : "aQHGUpRj";
  return "aQHGUpRj";
}

export async function getStripeClient() {
  if (!Config.STRIPE_SECRET_KEY) {
    throw new Exception("500", "Unable to load Stripe secret key");
  }

  return new Stripe(Config.STRIPE_SECRET_KEY, {
    apiVersion: "2023-10-16",
  });
}

function getStripeCouponIdForUser(user: User): string | null {
  if (user.referralId) {
    return getStripReferralCouponId();
  } else {
    return null;
  }
}

export function createStripeCustomer(
  stripe: Stripe,
  user: User
): Promise<Stripe.Customer> {
  const createParams: Stripe.CustomerCreateParams = {
    email: user.email,
  };

  const couponId = getStripeCouponIdForUser(user);

  if (couponId) {
    createParams.coupon = couponId;
  }

  const metaData: Stripe.MetadataParam = {
    userId: user.id,
  };

  if (user.referralId) {
    // Rewardful requires that the "referral" property be set in the customer meta data
    // so that it can identify the referred users for our affiliates.
    metaData.referral = user.referralId;
  }

  createParams.metadata = metaData;

  const name = buildUserFullName(user);

  if (name) {
    createParams.name = name;
  }

  return stripe.customers.create(createParams);
}

export function buildPaymentMethodFromStripePaymentMethod(
  user: User,
  stripePaymentMethod: Stripe.PaymentMethod
): PaymentMethod | null {
  const remoteCustomerId =
    typeof stripePaymentMethod.customer === "string"
      ? stripePaymentMethod.customer
      : stripePaymentMethod.customer?.id;

  if (!remoteCustomerId) {
    return null;
  }

  const paymentMethod: PaymentMethod = {
    id: nanoid(),
    userId: user.id,
    remoteId: stripePaymentMethod.id,
    remoteCustomerId,
    provider: "STRIPE",
    type: "CARD",
    brand: stripePaymentMethod.card
      ? stripePaymentMethod.card.brand
      : "Unknown",
    last4: stripePaymentMethod.card ? stripePaymentMethod.card.last4 : "",
    expMonth: stripePaymentMethod.card ? stripePaymentMethod.card.exp_month : 0,
    expYear: stripePaymentMethod.card ? stripePaymentMethod.card.exp_year : 0,
    created: dateTimeFromUnixTimestamp(
      stripePaymentMethod.created
    ).toISO() as string,
    createdBy: "system",
    modified: nowISODateString() as string,
    modifiedBy: "system",
  };

  return paymentMethod;
}

export function buildInvoiceFromStripeInvoice(
  subscription: Subscription,
  stripeInvoice: Stripe.Invoice,
  overrideProps: Partial<Invoice> = {}
): Invoice | null {
  const remoteCustomerId =
    typeof stripeInvoice.customer === "string"
      ? stripeInvoice.customer
      : stripeInvoice.customer?.id;

  if (!remoteCustomerId) {
    return null;
  }

  let periodStart = dateTimeFromUnixTimestamp(
    stripeInvoice.period_start
  ).toISO() as string;
  let periodEnd = dateTimeFromUnixTimestamp(
    stripeInvoice.period_end
  ).toISO() as string;

  if (
    stripeInvoice.lines &&
    stripeInvoice.lines.object === "list" &&
    stripeInvoice.lines.data.length > 0 &&
    stripeInvoice.lines.data[0].period
  ) {
    // These are the start and end periods for the subscription line item
    // which tell us the period the invoice is charging for.
    periodStart = dateTimeFromUnixTimestamp(
      stripeInvoice.lines.data[0].period.start
    ).toISO() as string;
    periodEnd = dateTimeFromUnixTimestamp(
      stripeInvoice.lines.data[0].period.end
    ).toISO() as string;
  }

  // We only ever store records as a semi-cache to avoid fetching
  // from Stripe so use their id as our internal one in order to
  // maintain consistency between fast web hook messages.
  const invoice: Invoice = {
    id: stripeInvoice.id,
    workspaceId: subscription.workspaceId,
    sourceType: "SUBSCRIPTION",
    sourceId: subscription.id,
    remoteId: stripeInvoice.id,
    remoteCustomerId,
    currency: stripeInvoice.currency,
    periodStart,
    periodEnd,
    status: stripeInvoice.status || "draft",
    total: stripeInvoice.total,
    amountDue: stripeInvoice.amount_due,
    attempted: stripeInvoice.attempted, // Whether Stripe has attempted to collect payment.
    paid: stripeInvoice.paid, // If the invoice is paid or not.
    created: dateTimeFromUnixTimestamp(stripeInvoice.created).toISO() as string,
    createdBy: "system",
    modified: nowISODateString() as string,
    modifiedBy: "system",
    ...overrideProps,
  };

  if (stripeInvoice.hosted_invoice_url) {
    invoice.hostedInvoiceUrl = stripeInvoice.hosted_invoice_url;
  }

  if (stripeInvoice.invoice_pdf) {
    invoice.invoicePdfUrl = stripeInvoice.invoice_pdf;
  }

  return invoice;
}
