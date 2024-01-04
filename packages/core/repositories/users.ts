import { Table } from "sst/node/table";
import { User, UserWorkspaces, UserBilling } from "../types/users";
//import { simpleDBCall, paramsToUpdateExpression } from "../dynamodb";
import { patchObject } from "../libs/utils";
import dynamoDb from "../src/dynamodb";
import { paramsToUpdateExpression, simpleDBCall } from "../libs/dbClient";

const PK_PREFIX = "USER";
const SK_PREFIX = "USER";
const GSI2PK_PREFIX = "REMOTEBILLINGCUSTOMER";
const GSI2SK_PREFIX = "USER";

interface UserDbRecord extends User {
  pk: string;
  sk: string;
  gsi2pk?: string;
  gsi2sk?: string;
}

function buildPk(id: string) {
  return `${PK_PREFIX}#${id}`;
}

function buildSk(id: string) {
  return `${SK_PREFIX}#${id}`;
}

function buildKeys(user: User) {
  return [buildPk(user.id), buildSk(user.id)];
}

function buildGSI2Pk(
  billingProvider: UserBilling["provider"],
  billingCustomerId: UserBilling["customerId"]
) {
  return `${GSI2PK_PREFIX}#${billingProvider}#${billingCustomerId}`;
}

function buildGSI2Sk(id: string) {
  return `${GSI2SK_PREFIX}#${id}`;
}

function buildGSI2Keys(user: User) {
  if (user.billing) {
    return [
      buildGSI2Pk(user.billing.provider, user.billing.customerId),
      buildGSI2Sk(user.id),
    ];
  } else {
    return [undefined, undefined];
  }
}

function userToDbRecord(user: User): UserDbRecord {
  const [pk, sk] = buildKeys(user);
  const [gsi2pk, gsi2sk] = buildGSI2Keys(user);

  const record: UserDbRecord = {
    pk,
    sk,
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    timeZone: user.timeZone,
    workspaces: user.workspaces,
    created: user.created,
    createdBy: user.createdBy,
    modified: user.modified,
    modifiedBy: user.modifiedBy,
  };

  for (const optionalProp of [
    "lastName",
    "profileImage",
    "billing",
    "featureVersion",
    "referralId",
    "referralAffiliate",
  ]) {
    if (user[optionalProp] !== undefined) {
      record[optionalProp] = user[optionalProp];
    }
  }

  if (gsi2pk && gsi2sk) {
    record.gsi2pk = gsi2pk;
    record.gsi2sk = gsi2sk;
  }

  return record;
}

export function dbRecordToUser(record: UserDbRecord): User {
  const user: User = {
    id: record.id,
    email: record.email,
    firstName: record.firstName,
    timeZone: record.timeZone,
    workspaces: record.workspaces,
    created: record.created,
    createdBy: record.createdBy,
    modified: record.modified,
    modifiedBy: record.modifiedBy,
  };

  for (const optionalProp of [
    "lastName",
    "profileImage",
    "billing",
    "featureVersion",
    "referralId",
    "referralAffiliate",
  ]) {
    if (record[optionalProp] !== undefined) {
      user[optionalProp] = record[optionalProp];
    }
  }

  return user;
}

export function isUserDbRecord(record: {
  [key: string]: any;
}): record is UserDbRecord {
  return (
    record.pk &&
    record.sk &&
    record.pk.startsWith(`${PK_PREFIX}#`) &&
    record.sk.startsWith(`${SK_PREFIX}#`)
  );
}

/*export async function createUser(user: User) {
  //await simpleDBCall("put", { Item: userToDbRecord(user) });
  const params = {
    TableName: Table.core.tableName,
    Item: userToDbRecord(user),
  };
  await dynamoDb.put(params);
}*/

export async function createUser(user: User) {
  await simpleDBCall("put", { Item: userToDbRecord(user) });
}

export async function getUser(id: string): Promise<User | null> {
  console.log("getUser", id);
  const response = await simpleDBCall("query", {
    KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
    ExpressionAttributeValues: {
      ":pk": `${PK_PREFIX}#${id}`,
      ":sk": `${SK_PREFIX}#`,
    },
  });

  if (response.Items && response.Items.length) {
    return dbRecordToUser(response.Items[0] as UserDbRecord);
  } else {
    return null;
  }
}

export async function getUserFromBillingCustomerId(
  billingProvider: UserBilling["provider"],
  billingCustomerId: UserBilling["customerId"]
): Promise<User | null> {
  const gsi2pk = buildGSI2Pk(billingProvider, billingCustomerId);

  const response = await dynamoDb.query({
    TableName: Table.core.tableName,
    IndexName: "GSI2",
    KeyConditionExpression: "gsi2pk = :gsi2pk",
    ExpressionAttributeValues: {
      ":gsi2pk": gsi2pk,
    },
  });

  if (response.Items && response.Items.length) {
    return dbRecordToUser(response.Items[0] as UserDbRecord);
  } else {
    return null;
  }
}

export interface UserUpdateProps {
  email?: string;
  firstName?: string;
  lastName?: string | null;
  profileImage?: User["profileImage"];
  timeZone?: string;
  workspaces?: UserWorkspaces;
  billing?: User["billing"] | null;
  modified: string;
  modifiedBy: string;
}

export async function updateUser(user: User, updateProps: UserUpdateProps) {
  const updatedUser = patchObject(user, updateProps);
  const internalUpdateProps: UserUpdateProps & {
    gsi2pk?: string | null;
    gsi2sk?: string | null;
  } = { ...updateProps };

  if (updateProps.billing !== undefined) {
    const [gsi2pk, gsi2sk] = buildGSI2Keys(user);
    internalUpdateProps.gsi2pk = gsi2pk;
    internalUpdateProps.gsi2sk = gsi2sk;
  }

  await simpleDBCall("update", {
    Key: {
      pk: `${PK_PREFIX}#${user.id}`,
      sk: `${SK_PREFIX}#${user.id}`,
    },
    ...paramsToUpdateExpression(internalUpdateProps),
  });

  return updatedUser;
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
/*
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
*/
export async function deleteUser(user: User) {
  const params = {
    TableName: Table.core.tableName,
    Key: {
      pk: `${PK_PREFIX}#${user.id}`,
      sk: `${SK_PREFIX}#${user.id}`,
    },
  };
  await dynamoDb.delete(params);
  return;
}

export function buildUserFullName(user: User) {
  return [user.firstName || "", user.lastName || ""].join(" ").trim();
}
