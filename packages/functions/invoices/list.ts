import { Table } from "sst/node/table";
import dynamoDb from "@genly-api/core/src/dynamodb";
import handler from "@genly-api/core/src/handler";
import Joi, { number } from "joi";

import { Forbidden } from "@genly-api/core/libs/errors";
import {
  queryInvoicesBySubscriptionId,
  queryInvoiceByBillingCustomerId,
} from "@genly-api/core/repositories/invoices";
import { getSubscription } from "@genly-api/core/repositories/subscriptions";
import { getWorkspace } from "@genly-api/core/repositories/workspaces";
import { getUser } from "@genly-api/core/repositories/users";
import { User } from "@genly-api/core/types/users";
//import { buildHandler, RequestHandler } from "../../libs/response";

interface QueryDataBase {
  limit?: number;
  offsetKey?: string;
  asc?: boolean;
}

interface QueryByInvoiceId extends QueryDataBase {
  subscriptionId: string;
}

interface QueryByBillingCustomerId extends QueryDataBase {
  billingCustomerId: string;
}

type QueryData = QueryByInvoiceId | QueryByBillingCustomerId;

const querySchemaBase = Joi.object({
  limit: Joi.number().min(1),
  offsetKey: Joi.string(),
  asc: Joi.boolean(),
});

const queryBySubscriptionIdSchema = querySchemaBase.append({
  subscriptionId: Joi.string().required(),
});

const queryByBillingCustomerIdSchema = querySchemaBase.append({
  billingCustomerId: Joi.string().required(),
});

const querySchema = Joi.alternatives(
  queryBySubscriptionIdSchema,
  queryByBillingCustomerIdSchema
);

function isQueryByInvoiceId(queryData: any): queryData is QueryByInvoiceId {
  return !!queryData.subscriptionId;
}

export const main = handler(async (event) => {
  let queryInvoicesPromise: ReturnType<
    typeof queryInvoicesBySubscriptionId
  > | null = null;
  console.log(`event= ${JSON.stringify(event)}`);
  console.log(`event.pathParameters= ${JSON.stringify(event.pathParameters)}`);
  console.log(
    `event.queryStringParameters= ${JSON.stringify(
      event.queryStringParameters
    )}`
  );

  const queryData = event.queryStringParameters;
  console.log(`queryData= ${queryData}`);
  if (!queryData) {
    throw new Forbidden("Missing query data");
  }
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

  let user: User | null = null;

  user = await getUser(userPoolUserId);

  if (!user) {
    throw new Forbidden("User not logged in", "001");
  }

  if (isQueryByInvoiceId(queryData)) {
    const subscriptionId = queryData.subscriptionId;
    const subscription = await getSubscription(subscriptionId);

    if (!subscription) {
      throw new Forbidden(
        `Unable to fetch invoices for subscription ${subscriptionId}`
      );
    }

    const workspace = await getWorkspace(subscription.workspaceId);

    if (
      !workspace ||
      !workspace.users[user.id] ||
      workspace.users[user.id].role !== "OWNER"
    ) {
      throw new Forbidden(
        `You do not have permission to view invoices for subscription ${subscriptionId}`
      );
    }

    queryInvoicesPromise = queryInvoicesBySubscriptionId(
      workspace.id,
      subscriptionId,
      {
        limit: queryData.limit,
        offsetKey: queryData.offsetKey,
        asc: queryData.asc,
      }
    );
  } else {
    const billingCustomerId = queryData.billingCustomerId;

    if (!user.billing || user.billing.customerId !== billingCustomerId) {
      throw new Forbidden(
        `You do not have permission to view invoices for billing customer ${billingCustomerId}`
      );
    }

    queryInvoicesPromise = queryInvoiceByBillingCustomerId(billingCustomerId, {
      limit: queryData.limit ? parseInt(queryData.limit, 10) : undefined,
      offsetKey: queryData.offsetKey,
      asc: queryData.asc === "true",
    });
  }

  const [invoices, offsetKey] = await queryInvoicesPromise;

  const isLast = !queryData.limit || (!!queryData.limit && !offsetKey);

  //return [invoices, { queryData, offsetKey, isLast }];

  // Return the matching list of items in response body
  return JSON.stringify([invoices, { queryData, offsetKey, isLast }]);
});
