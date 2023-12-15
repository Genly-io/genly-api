import { paramsToUpdateExpression, simpleDBCall } from "../libs/dbClient";
import { PaymentMethod } from "../types/payment_methods";
import { patchObject } from "../libs/utils";

const PK_PREFIX = "PAYMENTMETHOD";
const SK_PREFIX = "USER";
const GSI2_PK_PREFIX = "REMOTEPAYMENTMETHOD";
const GSI2_SK_PREFIX = "PAYMENTMETHOD";

interface PaymentMethodDbRecord extends PaymentMethod {
  pk: string;
  sk: string;
  gsi2pk: string;
  gsi2sk: string;
}

function buildPk(id: string) {
  return `${PK_PREFIX}#${id}`;
}

function buildSk(userId: string) {
  return `${SK_PREFIX}#${userId}`;
}

function buildKeys(paymentMethod: PaymentMethod) {
  return [buildPk(paymentMethod.id), buildSk(paymentMethod.userId)];
}

function buildGSI2Pk(remoteId: string) {
  return `${GSI2_PK_PREFIX}#${remoteId}`;
}

function buildGSI2Sk(id: string) {
  return `${GSI2_SK_PREFIX}#${id}`;
}

function buildGSI2Keys(paymentMethod: PaymentMethod) {
  return [buildGSI2Pk(paymentMethod.remoteId), buildGSI2Sk(paymentMethod.id)];
}

function paymentMethodToDbRecord(
  paymentMethod: PaymentMethod
): PaymentMethodDbRecord {
  const [pk, sk] = buildKeys(paymentMethod);
  const [gsi2pk, gsi2sk] = buildGSI2Keys(paymentMethod);
  const record: PaymentMethodDbRecord = {
    pk,
    sk,
    gsi2pk,
    gsi2sk,
    id: paymentMethod.id,
    userId: paymentMethod.userId,
    remoteId: paymentMethod.remoteId,
    remoteCustomerId: paymentMethod.remoteCustomerId,
    provider: paymentMethod.provider,
    type: paymentMethod.type,
    brand: paymentMethod.brand,
    last4: paymentMethod.last4,
    expMonth: paymentMethod.expMonth,
    expYear: paymentMethod.expYear,
    created: paymentMethod.created,
    createdBy: paymentMethod.createdBy,
    modified: paymentMethod.modified,
    modifiedBy: paymentMethod.modifiedBy,
  };

  if (paymentMethod.subscriptionIds) {
    record.subscriptionIds = paymentMethod.subscriptionIds;
  }

  return record;
}

export function dbRecordToPaymentMethod(
  record: PaymentMethodDbRecord
): PaymentMethod {
  const paymentMethod: PaymentMethod = {
    id: record.id,
    userId: record.userId,
    remoteId: record.remoteId,
    remoteCustomerId: record.remoteCustomerId,
    provider: record.provider,
    type: record.type,
    brand: record.brand,
    last4: record.last4,
    expMonth: record.expMonth,
    expYear: record.expYear,
    created: record.created,
    createdBy: record.createdBy,
    modified: record.modified,
    modifiedBy: record.modifiedBy,
  };

  if (record.subscriptionIds) {
    paymentMethod.subscriptionIds = record.subscriptionIds;
  }

  return paymentMethod;
}

export function isPaymentMethodDbRecord(record: {
  [key: string]: any;
}): record is PaymentMethodDbRecord {
  return (
    record.pk &&
    record.sk &&
    record.pk.startsWith(`${PK_PREFIX}#`) &&
    record.sk.startsWith(`${SK_PREFIX}#`)
  );
}

export async function createPaymentMethod(paymentMethod: PaymentMethod) {
  await simpleDBCall("put", { Item: paymentMethodToDbRecord(paymentMethod) });
  return paymentMethod;
}

export async function getPaymentMethod(
  id: string
): Promise<PaymentMethod | null> {
  const pk = buildPk(id);
  const response = await simpleDBCall("query", {
    KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
    ExpressionAttributeValues: {
      ":pk": pk,
      ":sk": `${SK_PREFIX}#`,
    },
  });

  if (response.Items && response.Items.length) {
    return dbRecordToPaymentMethod(response.Items[0] as PaymentMethodDbRecord);
  } else {
    return null;
  }
}

export async function getPaymentMethodByRemoteId(
  remoteId: string
): Promise<PaymentMethod | null> {
  const gsi2pk = buildGSI2Pk(remoteId);
  const response = await simpleDBCall("query", {
    IndexName: "GSI2",
    KeyConditionExpression: "gsi2pk = :gsi2pk",
    ExpressionAttributeValues: {
      ":gsi2pk": gsi2pk,
    },
  });

  if (response.Items && response.Items.length) {
    return dbRecordToPaymentMethod(response.Items[0] as PaymentMethodDbRecord);
  } else {
    return null;
  }
}

export async function queryPaymentMethodsByUserId(
  userId: string
): Promise<PaymentMethod[]> {
  const sk = buildSk(userId);
  const response = await simpleDBCall("query", {
    IndexName: "GSI1",
    KeyConditionExpression: "begins_with(pk, :pk) AND sk = :sk",
    ExpressionAttributeValues: {
      ":pk": `${PK_PREFIX}#`,
      ":sk": sk,
    },
  });

  if (response.Items && response.Items.length) {
    return (response.Items as PaymentMethodDbRecord[]).map(
      dbRecordToPaymentMethod
    );
  } else {
    return [];
  }
}

interface PaymentMethodUpdateProps {
  subscriptionIds?: string[];
  modified: string;
  modifiedBy: string;
}
export async function updatePaymentMethod(
  paymentMethod: PaymentMethod,
  props: PaymentMethodUpdateProps
) {
  const [pk, sk] = buildKeys(paymentMethod);
  await simpleDBCall("update", {
    Key: {
      pk,
      sk,
    },
    ...paramsToUpdateExpression(props),
  });

  return patchObject(paymentMethod, props);
}

export async function deletePaymentMethod(paymentMethod: PaymentMethod) {
  const [pk, sk] = buildKeys(paymentMethod);
  await simpleDBCall("delete", {
    Key: {
      pk,
      sk,
    },
  });
  return;
}
