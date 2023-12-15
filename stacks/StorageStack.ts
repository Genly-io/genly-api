import { Bucket, StackContext, Table } from "sst/constructs";

export function StorageStack({ stack }: StackContext) {
  //adding DynamoDB table called [stage]-[appName]-[tablename] from sst config==>example:  dev-genly-core
  const table = new Table(stack, "core", {
    fields: {
      pk: "string",
      sk: "string",
      gsi2pk: "string",
      gsi2sk: "string",
      gsi3pk: "string",
      gsi3sk: "string",
      gsi4pk: "string",
      gsi4sk: "string",
    },
    primaryIndex: { partitionKey: "pk", sortKey: "sk" },
    globalIndexes: {
      GSI1: { partitionKey: "sk", sortKey: "pk" },
      GSI2: { partitionKey: "gsi2pk", sortKey: "gsi2sk" },
      GSI3: { partitionKey: "gsi3pk", sortKey: "gsi3sk" },
      GSI4: { partitionKey: "gsi4pk", sortKey: "gsi4sk" },
    },
  });

  /**
   * 
      gsi2pk: "string",
      gsi2sk: "string",
      gsi3pk: "string",
      gsi3sk: "string",
      gsi4pk: "string",
      gsi4sk: "string",
   */
  /**
   * 
      GSI2: { partitionKey: "gsi2pk", sortKey: "gsi2sk" },
      GSI3: { partitionKey: "gsi3pk", sortKey: "gsi3sk" },
      GSI4: { partitionKey: "gsi4pk", sortKey: "gsi4sk" },
   */

  const bucket = new Bucket(stack, "Uploads", {
    cors: [
      {
        maxAge: "1 day",
        allowedOrigins: ["*"],
        allowedHeaders: ["*"],
        allowedMethods: ["GET", "PUT", "POST", "DELETE", "HEAD"],
      },
    ],
  });

  return {
    table,
    bucket,
  };
}
