import * as uuid from "uuid";
import { Table } from "sst/node/table";
import handler from "@genly-api/core/src/handler";
import dynamoDb from "@genly-api/core/src/dynamodb";
import { createSubscription } from "@genly-api/core/repositories/subscriptions";

import { getWorkspace } from "@genly-api/core/repositories/workspaces";
import { getUser, updateUser } from "@genly-api/core/repositories/users";
import { Forbidden, BadRequest } from "@genly-api/core/libs/errors";
import {
  getStripeClient,
  createStripeCustomer,
  buildPaymentMethodFromStripePaymentMethod,
} from "@genly-api/core/libs/clients/stripe";
import {
  nowDateTime,
  dateTimeFromUnixTimestamp,
} from "@genly-api/core/libs/utils";
import { User, UserBilling } from "@genly-api/core/types/users";
import { PaymentMethod } from "@genly-api/core/types/payment_methods";
import {
  queryPaymentMethodsByUserId,
  createPaymentMethod,
} from "@genly-api/core/repositories/payment_methods";
import Stripe from "stripe";
import {
  Subscription,
  SubscriptionPrice,
} from "@genly-api/core/types/subscriptions";
import { nanoid } from "nanoid";

const DEFAULT_TRIAL_PERIOD_DAYS = 14;
const PRICE_TO_BILL_PERIOD = "MONTHLY";

interface BodyData {
  workspaceId: string;
  remotePriceId: string;
  remotePaymentMethodId?: string;
  trial?: string;
}

export const main = handler(async (event) => {
  const authProvider =
    event.requestContext.authorizer?.iam.cognitoIdentity.amr.findLast((ref) =>
      ref.includes(":")
    );
  // Cognito authentication provider looks like:
  // cognito-idp.us-east-1.amazonaws.com/us-east-1_xxxxxxxxx,cognito-idp.us-east-1.amazonaws.com/us-east-1_aaaaaaaaa:CognitoSignIn:qqqqqqqq-1111-2222-3333-rrrrrrrrrrrr
  // Where us-east-1_aaaaaaaaa is the User Pool id
  // And qqqqqqqq-1111-2222-3333-rrrrrrrrrrrr is the User Pool User Id
  const parts = authProvider.split(":");
  const userPoolIdParts = parts[parts.length - 3].split("/");

  const userPoolId = userPoolIdParts[userPoolIdParts.length - 1];
  const userPoolUserId = parts[parts.length - 1];

  if (!event.body) {
    throw new BadRequest("Request body not provided");
  }

  let user: User | null = null;

  user = await getUser(userPoolUserId);

  if (!user) {
    throw new Forbidden("User not logged in", "001");
  }

  const bodyData: BodyData = JSON.parse(event.body);
  const workspaceId = bodyData.workspaceId;
  const remotePriceId = bodyData.remotePriceId;
  const remotePaymentMethodId = bodyData.remotePaymentMethodId;
  const trial = bodyData.trial !== undefined ? bodyData.trial : true;
  console.log("about to get workspace , id=", workspaceId);
  const workspace = await getWorkspace(workspaceId);
  if (
    !workspace ||
    !workspace.users[userPoolUserId] ||
    workspace.users[userPoolUserId].role !== "OWNER"
  ) {
    throw new Forbidden(
      `User ${userPoolUserId} can not create a subscription for workspace ${workspaceId}`
    );
  }

  if (workspace.subscription) {
    throw new BadRequest(`Workspace ${workspaceId} already has a subscription`);
  }

  if (trial && workspace.hasHadTrial) {
    throw new BadRequest(`Workspace ${workspaceId} has already had a trial`);
  }
  console.log("about to get stripe price , id=", remotePriceId);
  const stripe = await getStripeClient();
  const stripePrice = await stripe.prices.retrieve(remotePriceId);

  if (!stripePrice) {
    throw new BadRequest(`Unknown price id ${remotePriceId}`);
  }
  console.log("about to get remoteCustomerid");
  const now = nowDateTime();
  let remoteCustomerId = user.billing ? user.billing.customerId : null;
  console.log("remoteCustomerId , id=", remoteCustomerId);
  if (!remoteCustomerId) {
    console.log("about to create stripe customer");
    const stripeCustomer = await createStripeCustomer(stripe, user);
    const couponId =
      stripeCustomer.discount && stripeCustomer.discount.coupon
        ? stripeCustomer.discount.coupon.id
        : null;

    const userBilling: UserBilling = {
      provider: "STRIPE",
      customerId: stripeCustomer.id,
    };

    if (couponId) {
      userBilling.couponId = couponId;
    }
    console.log(`about to update user with billing ${userBilling}`);
    await updateUser(user, {
      billing: userBilling,
      modified: now.toISO() as string,
      modifiedBy: user.id,
    });

    remoteCustomerId = stripeCustomer.id;
  }
  console.log(`about to retrieve payment method id=${remotePaymentMethodId}`);
  let paymentMethod: PaymentMethod | undefined;
  if (remotePaymentMethodId) {
    const stripePaymentMethod = await stripe.paymentMethods.retrieve(
      remotePaymentMethodId
    );
    console.log(`got stripe payment method ${stripePaymentMethod}`);
    if (!stripePaymentMethod) {
      throw new BadRequest(
        `Unknown payment method id ${remotePaymentMethodId}`
      );
    }
    console.log(`about to queryPaymentMethodsByUserId id=${user.id}`);
    const existingPaymentMethods = await queryPaymentMethodsByUserId(user.id);
    paymentMethod = existingPaymentMethods.find(
      (candidate) => candidate.remoteId === remotePaymentMethodId
    );

    if (!paymentMethod) {
      await stripe.paymentMethods.attach(stripePaymentMethod.id, {
        customer: remoteCustomerId,
      });
      console.log(`about to buildPaymentMethodFromStripePaymentMethod`);
      paymentMethod = buildPaymentMethodFromStripePaymentMethod(
        user,
        stripePaymentMethod
      );
      console.log(
        `about to createPaymentMethod paymentMethod=${paymentMethod}`
      );
      await createPaymentMethod(paymentMethod);
    }
  }

  const subscriptionId = nanoid();
  const trialStart = trial ? now : null;
  const trialEnd = trial ? now.plus({ days: DEFAULT_TRIAL_PERIOD_DAYS }) : null;
  const subscriptionCreateParams: Stripe.SubscriptionCreateParams = {
    customer: remoteCustomerId,
    items: [{ price: remotePriceId }],
    metadata: {
      subscriptionId,
    },
  };

  if (paymentMethod) {
    subscriptionCreateParams.default_payment_method = paymentMethod.remoteId;
  }

  if (trialEnd) {
    subscriptionCreateParams.trial_end = Math.ceil(trialEnd.toSeconds());

    if (!paymentMethod) {
      // If the user is trialling without a payment method then cancel the
      // subscription at the end of the trial period so that they aren't charged
      // using a different payment method on their account.
      subscriptionCreateParams.cancel_at_period_end = true;
    }
  }
  console.log(
    `about to create subscriptions subscriptionCreateParams=${subscriptionCreateParams}`
  );
  const stripeSubscription = await stripe.subscriptions.create(
    subscriptionCreateParams
  );

  const remoteProductId =
    typeof stripePrice.product === "string"
      ? stripePrice.product
      : stripePrice.product.id;

  const price: SubscriptionPrice = {
    remoteId: remotePriceId,
    remoteItemId: stripeSubscription.items.data[0].id,
    unitAmount: stripePrice.unit_amount || 0,
    currency: stripePrice.currency,
    period: PRICE_TO_BILL_PERIOD,
    quantity: 1,
  };

  const subscription: Subscription = {
    id: subscriptionId,
    workspaceId: workspace.id,
    provider: "STRIPE",
    remoteId: stripeSubscription.id,
    remoteCustomerId:
      typeof stripeSubscription.customer === "string"
        ? stripeSubscription.customer
        : stripeSubscription.customer.id,
    remoteProductId,
    price,
    status: stripeSubscription.status,
    periodStart: dateTimeFromUnixTimestamp(
      stripeSubscription.current_period_start
    ).toISO() as string,
    periodEnd: dateTimeFromUnixTimestamp(
      stripeSubscription.current_period_end
    ).toISO() as string,
    ended: false,
    created: now.toISO() as string,
    createdBy: user.id,
    modified: now.toISO() as string,
    modifiedBy: user.id,
  };

  if (paymentMethod) {
    subscription.paymentMethod = paymentMethod;
  }

  if (trialStart) {
    subscription.trialStart = trialStart.toISO() as string;
  }

  if (trialEnd) {
    subscription.trialEnd = trialEnd.toISO() as string;

    if (!paymentMethod) {
      // If the user is trialling without a payment method then cancel the
      // subscription at the end of the trial period so that they aren't charged
      // using a different payment method on their account.
      subscription.cancelAtPeriodEnd = true;
    }
  }
  console.log(`about to createSubscription subscription=${subscription}`);
  await createSubscription(subscription);

  //return [subscription];

  return JSON.stringify(subscription);
});
