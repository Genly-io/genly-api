import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { Table } from "sst/node/table";
import {
  DynamoDBDocumentClient,
  GetCommand,
  GetCommandInput,
  GetCommandOutput,
  QueryCommand,
  QueryCommandInput,
  QueryCommandOutput,
  PutCommand,
  PutCommandInput,
  PutCommandOutput,
  DeleteCommand,
  DeleteCommandInput,
  DeleteCommandOutput,
  UpdateCommand,
  UpdateCommandInput,
  UpdateCommandOutput,
  ScanCommand,
  ScanCommandInput,
  ScanCommandOutput,
  BatchWriteCommand,
  BatchGetCommand,
  BatchGetCommandOutput,
} from "@aws-sdk/lib-dynamodb";
import { NativeAttributeValue } from "@aws-sdk/util-dynamodb";
import { env } from "./utils";

const DEFAULT_QUERY_PAGE_SIZE = 25;

const tableNames = {
  //core: env("DB_TABLE_NAME"),
  core: Table.core.tableName,
  config: env("CONFIG_DB_TABLE_NAME"),
};

const dynamoDb = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    apiVersion: "2012-08-10",
    region: env("AWS_REGION"),
    maxAttempts: 10, // Retry up to 10 times on provisioned throughput exceptions.
  }),
  {
    marshallOptions: {
      convertEmptyValues: false,
      removeUndefinedValues: true,
    },
  }
);

export function encodeOffsetKey(
  key: Record<string, NativeAttributeValue>
): string {
  return Buffer.from(JSON.stringify(key)).toString("base64");
}

export function decodeOffsetKey(
  key: string
): Record<string, NativeAttributeValue> {
  return JSON.parse(Buffer.from(key, "base64").toString("ascii"));
}

type SimpleDbCallAction =
  | "get"
  | "query"
  | "put"
  | "delete"
  | "update"
  | "scan";
type CommandInputFromSimpleDbCallAction<Action extends SimpleDbCallAction> =
  Action extends "get"
    ? GetCommandInput
    : Action extends "query"
    ? QueryCommandInput
    : Action extends "put"
    ? PutCommandInput
    : Action extends "delete"
    ? DeleteCommandInput
    : Action extends "update"
    ? UpdateCommandInput
    : Action extends "scan"
    ? ScanCommandInput
    : never;
type CommandOutputFromSimpleDbCallAction<Action extends SimpleDbCallAction> =
  Action extends "get"
    ? GetCommandOutput
    : Action extends "query"
    ? QueryCommandOutput
    : Action extends "put"
    ? PutCommandOutput
    : Action extends "delete"
    ? DeleteCommandOutput
    : Action extends "update"
    ? UpdateCommandOutput
    : Action extends "scan"
    ? ScanCommandOutput
    : never;

export function simpleDBCall<Action extends SimpleDbCallAction>(
  action: Action,
  params: Omit<CommandInputFromSimpleDbCallAction<Action>, "TableName">,
  tableName: keyof typeof tableNames = "core"
): Promise<CommandOutputFromSimpleDbCallAction<Action>> {
  const commandInput:
    | GetCommandInput
    | QueryCommandInput
    | PutCommandInput
    | DeleteCommandInput
    | UpdateCommandInput
    | ScanCommandInput = {
    ...params,
    TableName: tableNames[tableName],
  };

  if (action === "get") {
    return dynamoDb.send(
      new GetCommand(commandInput as GetCommandInput)
    ) as Promise<CommandOutputFromSimpleDbCallAction<Action>>;
  } else if (action === "query") {
    return dynamoDb.send(
      new QueryCommand(commandInput as QueryCommandInput)
    ) as Promise<CommandOutputFromSimpleDbCallAction<Action>>;
  } else if (action === "put") {
    return dynamoDb.send(
      new PutCommand(commandInput as PutCommandInput)
    ) as Promise<CommandOutputFromSimpleDbCallAction<Action>>;
  } else if (action === "delete") {
    return dynamoDb.send(
      new DeleteCommand(commandInput as DeleteCommandInput)
    ) as Promise<CommandOutputFromSimpleDbCallAction<Action>>;
  } else if (action === "update") {
    const updateCommandInput = commandInput as UpdateCommandInput;
    // Only allow updates when the record still exists otherwise DynamoDB creates
    // a partial record with only the values specified in the update call.
    if (updateCommandInput.ConditionExpression) {
      updateCommandInput.ConditionExpression = `(${updateCommandInput.ConditionExpression}) AND attribute_exists(pk) AND attribute_exists(sk)`;
    } else {
      updateCommandInput.ConditionExpression =
        "attribute_exists(pk) AND attribute_exists(sk)";
    }

    return dynamoDb.send(new UpdateCommand(updateCommandInput)) as Promise<
      CommandOutputFromSimpleDbCallAction<Action>
    >;
  } else {
    return dynamoDb.send(
      new ScanCommand(commandInput as ScanCommandInput)
    ) as Promise<CommandOutputFromSimpleDbCallAction<Action>>;
  }
}

export function batchDelete(
  deleteRequests: {
    Key: Record<string, NativeAttributeValue> | undefined;
  }[]
) {
  if (!Table.core.tableName) {
    throw new Error("Missing table name");
  }

  const deletePromises: any = [];

  for (let i = 0; i < deleteRequests.length; i += 25) {
    const deleteRequestChunk = deleteRequests.slice(i, i + 25);
    const requestItems = deleteRequestChunk.map((deleteRequest) => ({
      DeleteRequest: deleteRequest,
    }));

    if (requestItems.length) {
      deletePromises.push(
        dynamoDb.send(
          new BatchWriteCommand({
            RequestItems: {
              [Table.core.tableName]: requestItems,
            },
          })
        )
      );
    }
  }

  return Promise.all(deletePromises);
}

export function batchPut(
  putRequests: {
    Item: Record<string, NativeAttributeValue> | undefined;
  }[]
) {
  if (!Table.core.tableName) {
    throw new Error("Missing table name");
  }

  const putPromises: any = [];

  for (let i = 0; i < putRequests.length; i += 25) {
    const putRequestChunk = putRequests.slice(i, i + 25);
    const requestItems = putRequestChunk.map((putRequest) => ({
      PutRequest: putRequest,
    }));

    if (requestItems.length) {
      putPromises.push(
        dynamoDb.send(
          new BatchWriteCommand({
            RequestItems: {
              [Table.core.tableName]: requestItems,
            },
          })
        )
      );
    }
  }

  return Promise.all(putPromises);
}

export async function batchGet(
  getRequests: Record<string, NativeAttributeValue>[],
  table: keyof typeof tableNames = "core"
) {
  const tableName = tableNames[table];

  if (!tableName) {
    throw new Error("Missing table name");
  }

  const getPromises: Promise<BatchGetCommandOutput>[] = [];

  for (let i = 0; i < getRequests.length; i += 25) {
    const getRequestChunk = getRequests.slice(i, i + 25);
    const requestItems = getRequestChunk.map((getRequest) => getRequest);

    if (requestItems.length) {
      getPromises.push(
        dynamoDb.send(
          new BatchGetCommand({
            RequestItems: {
              [tableName]: {
                Keys: getRequests,
              },
            },
          })
        )
      );
    }
  }

  const results = await Promise.all(getPromises);
  const items = results.reduce<Record<string, NativeAttributeValue>[]>(
    (carry, result) => {
      if (result.Responses) {
        carry = carry.concat(result.Responses[tableName] || []);
      }
      return carry;
    },
    []
  );

  // NOTE: DynamoDB doesn't enforce any ordering on the response items so they
  // won't necessarily return in the order of the request items so let's fix that
  // here.
  items.sort((a, b) => {
    const aIndex = getRequests.findIndex((keys) => {
      return Object.keys(keys).every((key) => {
        return keys[key] === a[key];
      });
    });
    const bIndex = getRequests.findIndex((keys) => {
      return Object.keys(keys).every((key) => {
        return keys[key] === b[key];
      });
    });

    return aIndex - bIndex;
  });

  return items;
}

export async function query(
  queryRequest: Omit<QueryCommandInput, "TableName" | "ExclusiveStartKey">,
  lastKey?: string
): Promise<[Record<string, NativeAttributeValue>[], string | undefined]> {
  let items: Record<string, NativeAttributeValue>[] = [];
  let newLastKey: Record<string, NativeAttributeValue> | undefined = lastKey
    ? decodeOffsetKey(lastKey)
    : undefined;
  let remainingLimit: number | null = queryRequest.Limit
    ? queryRequest.Limit
    : null;

  do {
    const commandInput: QueryCommandInput = {
      ...queryRequest,
      TableName: Table.core.tableName,
      Limit: remainingLimit
        ? Math.min(remainingLimit, DEFAULT_QUERY_PAGE_SIZE)
        : DEFAULT_QUERY_PAGE_SIZE,
    };

    if (newLastKey) {
      commandInput.ExclusiveStartKey = newLastKey;
    }

    const page = await dynamoDb.send(new QueryCommand(commandInput));

    if (page.Items && page.Items.length) {
      if (remainingLimit !== null) {
        remainingLimit = Math.max(0, remainingLimit - page.Items.length);
      }

      items = items.concat(page.Items);
    }

    newLastKey = page.LastEvaluatedKey;
  } while (!!newLastKey && (remainingLimit === null || remainingLimit > 0));

  return [items, newLastKey ? encodeOffsetKey(newLastKey) : undefined];
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
