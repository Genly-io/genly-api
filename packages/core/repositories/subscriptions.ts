//import { paramsToUpdateExpression, query, simpleDBCall } from "../dynamodb";
import { PaymentMethod } from "../types/payment_methods";
import { Subscription } from "../types/subscriptions";
import { patchObject } from "../libs/utils";
import dynamoDb from "../src/dynamodb";
import { Table } from "sst/node/table";

const PK_PREFIX = "SUBSCRIPTION";
const SK_PREFIX = "REMOTESUBSCRIPTION";
const GSI2PK_PREFIX = "SUBSCRIPTIONWORKSPACE";
const GSI2SK_PREFIX = "SUBSCRIPTION";

interface SubscriptionDbRecord extends Subscription {
  pk: string;
  sk: string;
  gsi2pk: string;
  gsi2sk: string;
}

function buildPk(id: string) {
  return `${PK_PREFIX}#${id}`;
}

function buildSk(provider: Subscription["provider"], remoteId: string) {
  return `${SK_PREFIX}#${provider}#${remoteId}`;
}

function buildKeys(subscription: Subscription) {
  return [
    buildPk(subscription.id),
    buildSk(subscription.provider, subscription.remoteId),
  ];
}

function buildGSI2Pk(workspaceId: string) {
  return `${GSI2PK_PREFIX}#${workspaceId}`;
}

function buildGSI2Sk(ended: boolean, endedAt?: string) {
  return `${GSI2SK_PREFIX}#${ended ? "1" : "0"}#${endedAt || ""}`;
}

function buildGSI2Keys(subscription: Subscription) {
  return [
    buildGSI2Pk(subscription.workspaceId),
    buildGSI2Sk(subscription.ended, subscription.endedAt),
  ];
}

function subscriptionToDbRecord(
  subscription: Subscription
): SubscriptionDbRecord {
  const [pk, sk] = buildKeys(subscription);
  const [gsi2pk, gsi2sk] = buildGSI2Keys(subscription);

  const record: SubscriptionDbRecord = {
    pk,
    sk,
    gsi2pk,
    gsi2sk,
    id: subscription.id,
    workspaceId: subscription.workspaceId,
    provider: subscription.provider,
    remoteId: subscription.remoteId,
    remoteCustomerId: subscription.remoteCustomerId,
    remoteProductId: subscription.remoteProductId,
    price: subscription.price,
    status: subscription.status,
    periodStart: subscription.periodStart,
    periodEnd: subscription.periodEnd,
    ended: subscription.ended,
    created: subscription.created,
    createdBy: subscription.createdBy,
    modified: subscription.modified,
    modifiedBy: subscription.modifiedBy,
  };

  if (subscription.paymentMethod) {
    record.paymentMethod = subscription.paymentMethod;
  }

  if (subscription.trialStart) {
    record.trialStart = subscription.trialStart;
  }

  if (subscription.trialEnd) {
    record.trialEnd = subscription.trialEnd;
  }

  if (subscription.endedAt) {
    record.endedAt = subscription.endedAt;
  }

  if (subscription.cancelAtPeriodEnd !== undefined) {
    record.cancelAtPeriodEnd = subscription.cancelAtPeriodEnd;
  }

  return record;
}

export function dbRecordToSubscription(
  record: SubscriptionDbRecord
): Subscription {
  const subscription: Subscription = {
    id: record.id,
    remoteId: record.remoteId,
    workspaceId: record.workspaceId,
    provider: record.provider,
    remoteCustomerId: record.remoteCustomerId,
    remoteProductId: record.remoteProductId,
    price: record.price,
    status: record.status,
    periodStart: record.periodStart,
    periodEnd: record.periodEnd,
    ended: record.ended,
    created: record.created,
    createdBy: record.createdBy,
    modified: record.modified,
    modifiedBy: record.modifiedBy,
  };

  if (record.paymentMethod) {
    subscription.paymentMethod = record.paymentMethod;
  }

  if (record.trialStart) {
    subscription.trialStart = record.trialStart;
  }

  if (record.trialEnd) {
    subscription.trialEnd = record.trialEnd;
  }

  if (record.endedAt) {
    subscription.endedAt = record.endedAt;
  }

  if (record.cancelAtPeriodEnd !== undefined) {
    subscription.cancelAtPeriodEnd = record.cancelAtPeriodEnd;
  }

  return subscription;
}

export function isSubscriptionDbRecord(record: {
  [key: string]: any;
}): record is SubscriptionDbRecord {
  return (
    record.pk &&
    record.sk &&
    record.pk.startsWith(`${PK_PREFIX}#`) &&
    record.sk.startsWith(`${SK_PREFIX}#`)
  );
}

export async function createSubscription(subscription: Subscription) {
  //await simpleDBCall("put", { Item: subscriptionToDbRecord(subscription) });

  const params = {
    TableName: Table.core.tableName,
    Item: subscriptionToDbRecord(subscription),
  };
  await dynamoDb.put(params);

  return subscription;
}

export async function getSubscription(
  id: string
): Promise<Subscription | null> {
  const pk = buildPk(id);

  const response = await dynamoDb.query({
    TableName: Table.core.tableName,
    KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
    ExpressionAttributeValues: {
      ":pk": pk,
      ":sk": `${SK_PREFIX}#`,
    },
  });

  if (response.Items && response.Items.length) {
    return dbRecordToSubscription(response.Items[0] as SubscriptionDbRecord);
  } else {
    return null;
  }
}

export async function getSubscriptionByRemoteId(
  provider: Subscription["provider"],
  remoteId: string
): Promise<Subscription | null> {
  const sk = buildSk(provider, remoteId);

  const response = await dynamoDb.query({
    TableName: Table.core.tableName,
    IndexName: "GSI1",
    KeyConditionExpression: "begins_with(pk, :pk) AND sk = :sk",
    ExpressionAttributeValues: {
      ":pk": `${PK_PREFIX}#`,
      ":sk": sk,
    },
  });

  if (response.Items && response.Items.length) {
    return dbRecordToSubscription(response.Items[0] as SubscriptionDbRecord);
  } else {
    return null;
  }
}

export async function querySubscriptionsByWorkspaceId(
  workspaceId: string
): Promise<Subscription[]> {
  const gsi2pk = buildGSI2Pk(workspaceId);
  //const [records]
  const response = await dynamoDb.query({
    TableName: Table.core.tableName,
    IndexName: "GSI2",
    KeyConditionExpression: "gsi2pk = :gsi2pk AND begins_with(gsi2sk, :gsi2sk)",
    ExpressionAttributeValues: {
      ":gsi2pk": gsi2pk,
      ":gsi2sk": `${GSI2SK_PREFIX}`,
    },
  });

  return (response.Items as SubscriptionDbRecord[]).map((item) =>
    dbRecordToSubscription(item)
  );
}

export interface SubscriptionUpdateProps {
  paymentMethod?: PaymentMethod;
  status?: Subscription["status"];
  periodStart?: string;
  periodEnd?: string;
  price?: Subscription["price"];
  trialStart?: string;
  trialEnd?: string;
  ended?: boolean;
  endedAt?: string;
  cancelAtPeriodEnd?: boolean;
  modified: string;
  modifiedBy: string;
}
export async function updateSubscription(
  subscription: Subscription,
  props: SubscriptionUpdateProps
) {
  const [pk, sk] = buildKeys(subscription);
  const params = {
    TableName: Table.core.tableName,
    Key: {
      pk,
      sk,
    },
    ...paramsToUpdateExpression(props),
  };

  await dynamoDb.update(params);

  return patchObject(subscription, props);
}

export async function deleteSubscription(subscription: Subscription) {
  const [pk, sk] = buildKeys(subscription);

  const params = {
    TableName: Table.core.tableName,
    Key: {
      pk,
      sk,
    },
  };
  await dynamoDb.delete(params);

  return;
}

export function buildSafeAttributeNameKeys(
  seed: string,
  name: string
): [string, Array<[string, string]>] {
  // Check the name for nested attribute accessing, e.g. foo.bar
  // It should also handle list indexing, e.g. foo[0].bar[2]
  const parts = name.split(".");
  let expressionKey = "";
  const nameKeys: Array<[string, string]> = [];

  parts.forEach((part, index) => {
    // Logic for if the attribute name includes a list index e.g. foo[1]
    // In this case we need to generate a safe name for the
    // attribute "foo" but preserve the list index part.
    // e.g.
    //  foo[1]       -> #param00[1]
    //  foo[1][2]    -> #param00[1][2]
    //  foo[1][2][3] -> #param00[1][2][3]
    const [attrName, ...listIndexParts] = part.split("[");
    const listIndex =
      listIndexParts.length > 0 ? `[${listIndexParts.join("[")}` : "";
    const nameKey = `#${seed}${index}`;

    if (index === 0) {
      expressionKey = `${nameKey}${listIndex}`;
    } else {
      expressionKey = `${expressionKey}.${nameKey}${listIndex}`;
    }

    nameKeys.push([nameKey, attrName]);
  });

  return [expressionKey, nameKeys];
}
type ParamsToUpdateExpressionParams = {
  [attributeName: string]: any;
};
export function paramsToUpdateExpression(
  params: ParamsToUpdateExpressionParams
): {
  UpdateExpression: string;
  ExpressionAttributeNames: { [key: string]: string };
  ExpressionAttributeValues: { [key: string]: any };
} {
  const setExpressions: string[] = [];
  const removeExpressions: string[] = [];
  const nameKeysToNames: { [key: string]: string } = {};
  const valueKeysToValues: { [key: string]: any } = {};

  let index = 0;
  for (const [name, value] of Object.entries(params)) {
    const [expressionKey, nameKeys] = buildSafeAttributeNameKeys(
      `param${index}`,
      name
    );
    const valueKey = `:paramVal${index}`;

    if (value === undefined || value === null) {
      removeExpressions.push(`${expressionKey}`);
    } else {
      setExpressions.push(`${expressionKey} = ${valueKey}`);
      valueKeysToValues[valueKey] = value;
    }

    nameKeys.forEach(([nameKey, nameVal]) => {
      nameKeysToNames[nameKey] = nameVal;
    });

    index++;
  }

  const hasSetExpression = setExpressions.length > 0;
  const hasRemoveExpression = removeExpressions.length > 0;
  const setExpression = `SET ${setExpressions.join(", ")}`;
  const removeExpression = `REMOVE ${removeExpressions.join(", ")}`;

  return {
    UpdateExpression: `${hasSetExpression ? setExpression : ""} ${
      hasRemoveExpression ? removeExpression : ""
    }`,
    ExpressionAttributeNames: nameKeysToNames,
    ExpressionAttributeValues: valueKeysToValues,
  };
}
