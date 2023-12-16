import { query, simpleDBCall } from "../libs/dbClient";
import { Invoice } from "../types/invoices";

const PK_PREFIX = "INVOICE";
const SK_PREFIX = "INVOICEREMOTECUSTOMERID";
const GSI2_PK_PREFIX = "INVOICEWORKSPACE";
const GSI2_SK_PREFIX = "INVOICESOURCE";
const GSI3_PK_PREFIX = "INVOICEREMOTECUSTOMERID";
const GSI3_SK_PREFIX = "INVOICECREATED";

interface InvoiceDbRecord extends Invoice {
  pk: string;
  sk: string;
  gsi2pk: string;
  gsi2sk: string;
  gsi3pk: string;
  gsi3sk: string;
}

function buildPk(remoteId: string) {
  return `${PK_PREFIX}#${remoteId}`;
}

function buildSk(remoteCustomerId: string) {
  return `${SK_PREFIX}#${remoteCustomerId}`;
}

function buildKeys(invoice: Invoice) {
  return [buildPk(invoice.id), buildSk(invoice.workspaceId)];
}

function buildGSI2Pk(workspaceId: string) {
  return `${GSI2_PK_PREFIX}#${workspaceId}`;
}

function buildGSI2Sk(
  sourceType: Invoice["sourceType"],
  sourceId: Invoice["sourceId"],
  created: string
) {
  return `${GSI2_SK_PREFIX}#${sourceType}#${sourceId}#${created}`;
}

function buildGSI2Keys(invoice: Invoice) {
  return [
    buildGSI2Pk(invoice.workspaceId),
    buildGSI2Sk(invoice.sourceType, invoice.sourceId, invoice.created),
  ];
}

function buildGSI3Pk(remoteCustomerId: string) {
  return `${GSI3_PK_PREFIX}#${remoteCustomerId}`;
}

function buildGSI3Sk(created: string, id: string) {
  return `${GSI3_SK_PREFIX}#${created}#${id}`;
}

function buildGSI3Keys(invoice: Invoice) {
  return [
    buildGSI3Pk(invoice.remoteCustomerId),
    buildGSI3Sk(invoice.created, invoice.id),
  ];
}

function invoiceToDbRecord(invoice: Invoice): InvoiceDbRecord {
  const [pk, sk] = buildKeys(invoice);
  const [gsi2pk, gsi2sk] = buildGSI2Keys(invoice);
  const [gsi3pk, gsi3sk] = buildGSI3Keys(invoice);
  const record: InvoiceDbRecord = {
    pk,
    sk,
    gsi2pk,
    gsi2sk,
    gsi3pk,
    gsi3sk,
    id: invoice.id,
    workspaceId: invoice.workspaceId,
    sourceType: invoice.sourceType,
    sourceId: invoice.sourceId,
    remoteId: invoice.remoteId,
    remoteCustomerId: invoice.remoteCustomerId,
    currency: invoice.currency,
    hostedInvoiceUrl: invoice.hostedInvoiceUrl,
    invoicePdfUrl: invoice.invoicePdfUrl,
    periodStart: invoice.periodStart,
    periodEnd: invoice.periodEnd,
    status: invoice.status,
    total: invoice.total,
    amountDue: invoice.amountDue,
    attempted: invoice.attempted,
    paid: invoice.paid,
    created: invoice.created,
    createdBy: invoice.createdBy,
    modified: invoice.modified,
    modifiedBy: invoice.modifiedBy,
  };

  return record;
}

export function dbRecordToInvoice(record: InvoiceDbRecord): Invoice {
  const invoice: Invoice = {
    id: record.id,
    workspaceId: record.workspaceId,
    sourceType: record.sourceType,
    sourceId: record.sourceId,
    remoteId: record.remoteId,
    remoteCustomerId: record.remoteCustomerId,
    currency: record.currency,
    hostedInvoiceUrl: record.hostedInvoiceUrl,
    invoicePdfUrl: record.invoicePdfUrl,
    periodStart: record.periodStart,
    periodEnd: record.periodEnd,
    status: record.status,
    total: record.total,
    amountDue: record.amountDue,
    attempted: record.attempted,
    paid: record.paid,
    created: record.created,
    createdBy: record.createdBy,
    modified: record.modified,
    modifiedBy: record.modifiedBy,
  };

  return invoice;
}

export function isInvoiceDbRecord(record: {
  [key: string]: any;
}): record is InvoiceDbRecord {
  return (
    record.pk &&
    record.sk &&
    record.pk.startsWith(`${PK_PREFIX}#`) &&
    record.sk.startsWith(`${SK_PREFIX}#`)
  );
}

export async function createOrUpdateInvoice(invoice: Invoice) {
  // Only create or update the invoice if there isn't an existing
  // record or if the current record is older than the new one.
  await simpleDBCall("put", {
    Item: invoiceToDbRecord(invoice),
    ConditionExpression:
      "attribute_not_exists(modified) OR modified <= :modified",
    ExpressionAttributeValues: {
      ":modified": invoice.modified,
    },
  });
  return invoice;
}

export async function getInvoice(remoteId: string): Promise<Invoice | null> {
  const pk = buildPk(remoteId);
  const response = await simpleDBCall("query", {
    KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
    ExpressionAttributeValues: {
      ":pk": pk,
      ":sk": `${SK_PREFIX}#`,
    },
  });

  if (response.Items && response.Items.length) {
    return dbRecordToInvoice(response.Items[0] as InvoiceDbRecord);
  } else {
    return null;
  }
}

export async function queryInvoiceByBillingCustomerId(
  billingCustomerId: string,
  options?: {
    limit?: number;
    offsetKey?: string;
    asc?: boolean;
  }
): Promise<[Invoice[], string | undefined]> {
  const { limit, offsetKey, asc = true } = options || {};
  const gsi3pk = buildGSI3Pk(billingCustomerId);
  const [records, newOffsetKey] = await query(
    {
      IndexName: "GSI3",
      KeyConditionExpression: "gsi3pk = :gsi3pk",
      ExpressionAttributeValues: {
        ":gsi3pk": gsi3pk,
      },
      Limit: limit,
      ScanIndexForward: asc,
    },
    offsetKey
  );

  if (records.length) {
    return [
      (records as InvoiceDbRecord[]).map(dbRecordToInvoice),
      newOffsetKey,
    ];
  } else {
    return [[], undefined];
  }
}

export async function queryInvoicesByWorkspaceId(
  workspaceId: string
): Promise<Invoice[]> {
  const gsi2pk = buildGSI2Pk(workspaceId);
  const [records] = await query({
    IndexName: "GSI2",
    KeyConditionExpression: "gsi2pk = :gsi2pk",
    ExpressionAttributeValues: {
      ":gsi2pk": gsi2pk,
    },
  });

  if (records.length) {
    return (records as InvoiceDbRecord[]).map(dbRecordToInvoice);
  } else {
    return [];
  }
}

export async function queryInvoicesBySource(
  workspaceId: string,
  sourceType: Invoice["sourceType"],
  sourceId: string,
  options?: {
    limit?: number;
    offsetKey?: string;
    asc?: boolean;
  }
): Promise<[Invoice[], string | undefined]> {
  const { limit, offsetKey, asc = true } = options || {};
  const gsi2pk = buildGSI2Pk(workspaceId);
  const [records, newOffsetKey] = await query(
    {
      IndexName: "GSI2",
      KeyConditionExpression:
        "gsi2pk = :gsi2pk AND begins_with(gsi2sk, :gsi2sk)",
      ExpressionAttributeValues: {
        ":gsi2pk": gsi2pk,
        ":gsi2sk": `${GSI2_SK_PREFIX}#${sourceType}#${sourceId}`,
      },
      Limit: limit,
      ScanIndexForward: asc,
    },
    offsetKey
  );

  if (records.length) {
    return [
      (records as InvoiceDbRecord[]).map(dbRecordToInvoice),
      newOffsetKey,
    ];
  } else {
    return [[], undefined];
  }
}

export async function queryInvoicesBySubscriptionId(
  workspaceId: string,
  subscriptionId: string,
  options?: {
    limit?: number;
    offsetKey?: string;
    asc?: boolean;
  }
): Promise<[Invoice[], string | undefined]> {
  return queryInvoicesBySource(
    workspaceId,
    "SUBSCRIPTION",
    subscriptionId,
    options
  );
}

export async function deleteInvoice(invoice: Invoice) {
  const [pk, sk] = buildKeys(invoice);
  await simpleDBCall("delete", {
    Key: {
      pk,
      sk,
    },
  });
  return;
}
