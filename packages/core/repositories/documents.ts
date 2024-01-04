import { Document } from "../types/documents";
import {
  simpleDBCall,
  paramsToUpdateExpression,
  query,
} from "../libs/dbClient";
import { dateTimeFromISO, patchObject } from "../libs/utils";

const PK_PREFIX = "DOCUMENT";
const SK_PREFIX = "DOCUMENT";
const GSI2PK_PREFIX = "DOCUMENTWORKSPACE";
const GSI3PK_PREFIX = "DOCUMENTSYNC";

interface DocumentDbRecord extends Document {
  pk: string;
  sk: string;
  gsi2pk: string;
  gsi2sk: string;
  gsi3pk: string;
  gsi3sk: string;
}

function buildPk(id: string) {
  return `${PK_PREFIX}#${id}`;
}

function buildSk(type: Document["type"], externalId: string) {
  return `${SK_PREFIX}#${type}#${externalId}`;
}

function buildKeys(document: Document) {
  return [buildPk(document.id), buildSk(document.type, document.s3Bucket)];
}

function buildGSI2Pk(workspaceId: string) {
  return `${GSI2PK_PREFIX}#${workspaceId}`;
}

function buildGSI2Sk(type: Document["type"], externalId: string) {
  return `${type}#${externalId}`;
}

function buildGSI2Keys(document: Document) {
  return [
    buildGSI2Pk(document.workspaceId),
    buildGSI2Sk(document.type, document.s3Bucket),
  ];
}

function buildGSI3Pk(type: Document["type"], batch: string) {
  return `${GSI3PK_PREFIX}#${type}#${batch}`;
}

function buildGSI3Sk(lastSync: string) {
  return `${lastSync}`;
}

function buildGSI3Keys(document: Document) {
  const createdDateTime = dateTimeFromISO(document.createdAt);
  // Use the seconds the document was created to create a batch number so that
  // we don't end up with hot patition keys in dynamo.
  const batch = createdDateTime.toFormat("ss");
  return [buildGSI3Pk(document.type, batch), buildGSI3Sk(document.pageCount)];
}

function documentToDbRecord(document: Document): any {
  return {
    id: document.id,
    workspaceId: document.workspaceId,
    title: document.title,
    s3Bucket: document.s3Bucket,
    s3Key: document.s3Key,
    type: document.type,
    tags: document.tags,
    vectorStoreReference: document.vectorStoreReference,
    size: document.size,
    author: document.author,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    metadata: document.metadata,
    pageCount: document.pageCount,
    language: document.language,
    version: document.version,
    encryptionStatus: document.encryptionStatus,
    optimized: document.optimized,
  };
}

/*
function documentToDbRecord(document: Document): DocumentDbRecord {
  const [pk, sk] = buildKeys(document);
  const [gsi2pk, gsi2sk] = buildGSI2Keys(document);
  const [gsi3pk, gsi3sk] = buildGSI3Keys(document);
  const record: DocumentDbRecord = {
    pk,
    sk,
    gsi2pk,
    gsi2sk,
    gsi3pk,
    gsi3sk,
    id: document.id,
    workspaceId: document.workspaceId,
    type: document.type,
    externalId: document.externalId,
    externalUrl: document.externalUrl,
    name: document.name,
    entities: document.entities,
    lastSync: document.lastSync,
    lastAuth: document.lastAuth,
    created: document.created,
    createdBy: document.createdBy,
    modified: document.modified,
    modifiedBy: document.modifiedBy,
  };

  if (document.username) {
    record.username = document.username;
  }

  if (document.externalUrl) {
    record.externalUrl = document.externalUrl;
  }

  if (document.pictureUrl) {
    record.pictureUrl = document.pictureUrl;
  }

  if (document.authExpiry) {
    record.authExpiry = document.authExpiry;
  }

  if (document.requiresUserAuth !== undefined) {
    record.requiresUserAuth = document.requiresUserAuth;
  }

  return record;
}*/

function dbRecordToDocument(dbRecord: any): Document {
  return {
    id: dbRecord.id,
    workspaceId: dbRecord.workspaceId,
    title: dbRecord.title,
    s3Bucket: dbRecord.s3Bucket,
    s3Key: dbRecord.s3Key,
    type: dbRecord.type,
    tags: dbRecord.tags,
    vectorStoreReference: dbRecord.vectorStoreReference,
    size: dbRecord.size,
    author: dbRecord.author,
    createdAt: dbRecord.createdAt,
    updatedAt: dbRecord.updatedAt,
    metadata: dbRecord.metadata,
    pageCount: dbRecord.pageCount,
    language: dbRecord.language,
    version: dbRecord.version,
    encryptionStatus: dbRecord.encryptionStatus,
    optimized: dbRecord.optimized,
  };
}

/*export function dbRecordToDocument(record: DocumentDbRecord): Document {
  const document: Document = {
    id: record.id,
    workspaceId: record.workspaceId,
    type: record.type,
    externalId: record.externalId,
    externalUrl: record.externalUrl,
    name: record.name,
    entities: record.entities,
    lastSync: record.lastSync,
    lastAuth: record.lastAuth,
    created: record.created,
    createdBy: record.createdBy,
    modified: record.modified,
    modifiedBy: record.modifiedBy,
  };

  if (record.username) {
    document.username = record.username;
  }

  if (record.externalUrl) {
    document.externalUrl = record.externalUrl;
  }

  if (record.pictureUrl) {
    document.pictureUrl = record.pictureUrl;
  }

  if (record.authExpiry) {
    document.authExpiry = record.authExpiry;
  }

  if (record.requiresUserAuth !== undefined) {
    document.requiresUserAuth = record.requiresUserAuth;
  }

  return document;
}*/

export function isDocumentDbRecord(
  record: Record<string, any>
): record is DocumentDbRecord {
  return (
    record.pk &&
    record.sk &&
    record.pk.startsWith(`${PK_PREFIX}#`) &&
    record.sk.startsWith(`${SK_PREFIX}#`)
  );
}

export async function createDocument(document: Document) {
  await simpleDBCall("put", { Item: documentToDbRecord(document) });
  return document;
}

export async function getDocument(id: string): Promise<Document | null> {
  const response = await simpleDBCall("query", {
    KeyConditionExpression: "pk = :pk",
    ExpressionAttributeValues: {
      ":pk": buildPk(id),
    },
  });

  if (response.Items && response.Items.length) {
    return dbRecordToDocument(response.Items[0] as DocumentDbRecord);
  } else {
    return null;
  }
}

export async function getDocumentByWorkspaceAndExternalId(
  workspaceId: string,
  type: Document["type"],
  externalId: string
): Promise<Document | null> {
  const response = await simpleDBCall("query", {
    IndexName: "GSI2",
    KeyConditionExpression: "gsi2pk = :gsi2pk AND gsi2sk = :gsi2sk",
    ExpressionAttributeValues: {
      ":gsi2pk": buildGSI2Pk(workspaceId),
      ":gsi2sk": buildGSI2Sk(type, externalId),
    },
  });

  if (response.Items && response.Items.length) {
    return dbRecordToDocument(response.Items[0] as DocumentDbRecord);
  } else {
    return null;
  }
}

export async function queryDocumentsByExternalId(
  type: Document["type"],
  externalId: string
): Promise<Document | null> {
  const sk = buildSk(type, externalId);
  const response = await simpleDBCall("query", {
    IndexName: "GSI1",
    KeyConditionExpression: "sk = :sk AND begins_with(pk, :pk)",
    ExpressionAttributeValues: {
      ":sk": sk,
      ":pk": PK_PREFIX,
    },
  });

  if (response.Items && response.Items.length) {
    return dbRecordToDocument(response.Items[0] as DocumentDbRecord);
  } else {
    return null;
  }
}

export async function queryDocumentsByWorkspaceId(
  workspaceId: string
): Promise<Document[]> {
  const [records] = await query({
    IndexName: "GSI2",
    KeyConditionExpression: "gsi2pk = :gsi2pk",
    ExpressionAttributeValues: {
      ":gsi2pk": buildGSI2Pk(workspaceId),
    },
  });

  return (records as DocumentDbRecord[]).map(dbRecordToDocument);
}

export async function queryDocumentsByWorkspaceIdAndType(
  workspaceId: string,
  type: Document["type"]
): Promise<Document[]> {
  const [records] = await query({
    IndexName: "GSI2",
    KeyConditionExpression: "gsi2pk = :gsi2pk AND begins_with(gsi2sk, :gsi2sk)",
    ExpressionAttributeValues: {
      ":gsi2pk": buildGSI2Pk(workspaceId),
      ":gsi2sk": type,
    },
  });

  return (records as DocumentDbRecord[]).map(dbRecordToDocument);
}

export async function queryDocumentsLastSyncBefore(
  type: Document["type"],
  lastSync: string,
  batchFrom = "00",
  batchTo = "59"
): Promise<Document[]> {
  const batchStart = parseInt(batchFrom, 10);
  const batchEnd = parseInt(batchTo, 10);
  const batchIds: string[] = [];

  for (let i = batchStart; i <= batchEnd; i++) {
    if (i < 10) {
      batchIds.push(`0${i}`);
    } else {
      batchIds.push("" + i);
    }
  }

  const batchedDocuments = await Promise.all(
    batchIds.map(async (batch) => {
      const gsi3pk = buildGSI3Pk(type, batch);
      const [records] = await query({
        IndexName: "GSI3",
        KeyConditionExpression: "gsi3pk = :gsi3pk AND gsi3sk < :gsi3sk",
        ExpressionAttributeValues: {
          ":gsi3pk": gsi3pk,
          ":gsi3sk": "" + lastSync,
        },
      });

      return (records as DocumentDbRecord[]).map(dbRecordToDocument);
    })
  );

  return batchedDocuments.reduce((carry, documents) => carry.concat(documents));
}

export async function deleteDocument(document: Document) {
  const [pk, sk] = buildKeys(document);
  await simpleDBCall("delete", {
    Key: {
      pk,
      sk,
    },
  });
  return document;
}

/*
interface UpdateDocumentUpdateProps {
  externalUrl?: string | null;
  name?: string;
  username?: string | null;
  pictureUrl?: string | null;
  entities?: Document["metadata"];
  lastSync?: string;
  lastAuth?: string;
  authExpiry?: string | null;
  requiresUserAuth?: boolean | null;
  modified: string;
  modifiedBy: string;
}*/

interface UpdateDocumentUpdateProps {
  workspaceId?: string; // Optional: New identifier of the workspace this document belongs to.
  title?: string; // Optional: New title of the document.
  s3Bucket?: string; // Optional: New S3 bucket where the document is stored.
  s3Key?: string; // Optional: New S3 key (path) where the document is stored.
  type?: string; // Optional: New MIME type of the document.
  tags?: string[]; // Optional: New tags for categorization and search purposes.
  vectorStoreReference?: string; // Optional: New reference to the document's representation in the OpenSearch vector store.
  size?: number; // Optional: New size of the document in bytes.
  author?: string; // Optional: New author or creator of the document.
  updatedAt?: string; // Optional: New timestamp of the last update to the document.
  metadata?: Record<string, any>; // Optional: New additional metadata as a flexible key-value store.

  // Fields specific to PDF documents
  pageCount?: number; // Optional: New number of pages in the PDF document.
  language?: string; // Optional: New primary language of the document's content.
  version?: string; // Optional: New PDF version (e.g., 1.4, 1.7).
  encryptionStatus?: boolean; // Optional: New indication of whether the PDF is encrypted.
  optimized?: boolean; // Optional: New indication of whether the PDF is optimized for fast web view.
}

export async function updateDocument(
  document: Document,
  updateProps: UpdateDocumentUpdateProps
): Promise<Document> {
  const updatedDocument = patchObject(document, updateProps as any);
  const localUpdateProps: UpdateDocumentUpdateProps & {
    gsi2pk?: string | null;
    gsi2sk?: string | null;
    gsi3pk?: string | null;
    gsi3sk?: string | null;
  } = { ...(updateProps as any) };

  const [oldGSI2pk, oldGSI2sk] = buildGSI2Keys(document);
  const [newGSI2pk, newGSI2sk] = buildGSI2Keys(updatedDocument);
  const [oldGSI3pk, oldGSI3sk] = buildGSI3Keys(document);
  const [newGSI3pk, newGSI3sk] = buildGSI3Keys(updatedDocument);

  if (oldGSI2pk !== newGSI2pk || oldGSI2sk !== newGSI2sk) {
    localUpdateProps.gsi2pk = newGSI2pk;
    localUpdateProps.gsi2sk = newGSI2sk;
  }

  if (oldGSI3pk !== newGSI3pk || oldGSI3sk !== newGSI3sk) {
    localUpdateProps.gsi3pk = newGSI3pk;
    localUpdateProps.gsi3sk = newGSI3sk;
  }

  const [pk, sk] = buildKeys(document);

  await simpleDBCall("update", {
    Key: {
      pk,
      sk,
    },
    ...paramsToUpdateExpression(localUpdateProps),
  });

  return updatedDocument;
}
