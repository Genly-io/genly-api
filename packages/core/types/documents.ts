/*export interface DocumentEntity {
  id: string;
  type: "USER" | "BUSINESS" | "GROUP";
  externalId: string;
  externalUrl?: string;
  name: string;
  username?: string;
  disabled?: boolean;
  pictureUrl?: string;
  externalMissing?: boolean;
}

export interface Document {
  id: string;
  workspaceId: string;
  type: "TEXT" | "VIDEO" | "AUDIO";
  externalId: string;
  externalUrl?: string;
  name: string;
  username?: string;
  entities: {
    [entityId: string]: DocumentEntity;
  };
  lastSync: string;
  lastAuth: string;
  pictureUrl?: string;
  authExpiry?: string;
  requiresUserAuth?: boolean;
  created: string;
  createdBy: string;
  modified: string;
  modifiedBy: string;
}*/

export interface Document {
  id: string; // Unique identifier for the document, typically a UUID.
  workspaceId: string; // Identifier of the workspace this document belongs to.
  title: string; // Title of the document.
  s3Bucket: string; // S3 bucket where the document is stored.
  s3Key: string; // S3 key (path) where the document is stored. Provides direct access to the document in S3.
  type: string; // MIME type of the document, which will be 'application/pdf' for PDFs.
  tags: string[]; // Tags for categorization and search purposes.
  vectorStoreReference: string; // Reference to the document's representation in the OpenSearch vector store.
  size: number; // Size of the document in bytes.
  author: string; // Author or creator of the document.
  createdAt: string; // Timestamp of when the document was created.
  updatedAt: string; // Timestamp of the last update to the document.
  metadata: Record<string, any>; // Additional metadata as a flexible key-value store.

  // New fields specific to PDF documents
  pageCount: string; // The number of pages in the PDF document.
  language: string; // Primary language of the document's content.
  version: string; // PDF version (e.g., 1.4, 1.7).
  encryptionStatus: boolean; // Indicates whether the PDF is encrypted.
  optimized: boolean; // Indicates whether the PDF is optimized for fast web view.
}
