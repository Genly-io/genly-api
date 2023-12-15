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
import { nowISODateString } from "@genly-api/core/libs/utils";

/*
import Joi from "joi";
import { nanoid } from "nanoid";

import { UserBilling } from "../../../../types/users";

import {
  createStripeCustomer,
  getStripeClient,
} from "../../../../libs/clients/stripe";
import { BadRequest } from "../../../../libs/errors";
import { nowISODateString } from "../../../../libs/utils";
import {
  createPaymentMethod,
  queryPaymentMethodsByUserId,
} from "../../../../libs/repositories/payment_methods";
import { updateUser } from "../../../../libs/repositories/users";
import { buildHandler, RequestHandler } from "../../libs/response";
import { PaymentMethod } from "../../../../types/payment_methods";*/

interface BodyData {
  remotePaymentMethodId: string;
}

export const main = handler(async (event) => {
  const authProvider =
    event.requestContext.authorizer?.iam.cognitoIdentity.amr.findLast((ref) =>
      ref.includes(":")
    );
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
  const stripe = await getStripeClient();
  /**
   * Tester code
   *
   */
  const { token } = JSON.parse(event.body || "{}");

  const paymentMethodTester = await stripe.paymentMethods.create({
    type: "card",
    card: { token },
  });

  const bodyData: BodyData = { remotePaymentMethodId: paymentMethodTester.id };
  console.log("bodyData", bodyData);

  //const bodyData: BodyData = JSON.parse(event.body);

  const now = nowISODateString();
  //const stripe = await getStripeClient();
  const existingPaymentMethods = await queryPaymentMethodsByUserId(user.id);
  const isExisting = existingPaymentMethods.some(
    (paymentMethod) => paymentMethod.remoteId === bodyData.remotePaymentMethodId
  );

  if (isExisting) {
    throw new BadRequest(
      `Payment method ${bodyData.remotePaymentMethodId} already exists`
    );
  }

  const stripePaymentMethod = await stripe.paymentMethods.retrieve(
    bodyData.remotePaymentMethodId
  );

  if (!stripePaymentMethod) {
    throw new BadRequest(
      `Unknown payment method ${bodyData.remotePaymentMethodId}`
    );
  }

  let remoteCustomerId = user.billing ? user.billing.customerId : null;

  if (!remoteCustomerId) {
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

    await updateUser(user, {
      billing: userBilling,
      modified: now as string,
      modifiedBy: user.id,
    });

    remoteCustomerId = stripeCustomer.id;
  }

  const paymentMethod: PaymentMethod = {
    id: nanoid(),
    userId: user.id,
    remoteId: bodyData.remotePaymentMethodId,
    remoteCustomerId,
    provider: "STRIPE",
    type: "CARD",
    brand: stripePaymentMethod.card
      ? stripePaymentMethod.card.brand
      : "Unknown",
    last4: stripePaymentMethod.card ? stripePaymentMethod.card.last4 : "",
    expMonth: stripePaymentMethod.card ? stripePaymentMethod.card.exp_month : 0,
    expYear: stripePaymentMethod.card ? stripePaymentMethod.card.exp_year : 0,
    created: now as string,
    createdBy: user.id,
    modified: now as string,
    modifiedBy: user.id,
  };

  await stripe.paymentMethods.attach(bodyData.remotePaymentMethodId, {
    customer: remoteCustomerId,
  });
  await createPaymentMethod(paymentMethod);

  //return [paymentMethod];
  //return [subscription];

  return JSON.stringify(paymentMethod);
});
