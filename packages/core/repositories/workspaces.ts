import { DocumentClient } from "aws-sdk/clients/dynamodb";
import {
  Workspace,
  WorkspaceSubscription,
  WorkspaceUser,
} from "../types/workspaces";
import {
  simpleDBCall,
  paramsToUpdateExpression,
  batchDelete,
  batchPut,
} from "../libs/dbClient";
import { patchObject } from "../libs/utils";
//import dynamoDb from "../src/dynamodb";

const PK_PREFIX = "WORKSPACE";
const META_SK_PREFIX = "META";
const USER_SK_PREFIX = "USER";

export interface WorkspaceMetaDbRecord extends Omit<Workspace, "users"> {
  pk: string;
  sk: string;
}

export interface WorkspaceUserDbRecord extends WorkspaceUser {
  pk: string;
  sk: string;
}

type WorkspaceDbRecord = WorkspaceMetaDbRecord | WorkspaceUserDbRecord;

function workspaceToDbRecord(workspace: Workspace): WorkspaceMetaDbRecord {
  const pk = `${PK_PREFIX}#${workspace.id}`;
  const sk = `${META_SK_PREFIX}#${workspace.id}`;
  const record: WorkspaceMetaDbRecord = {
    pk,
    sk,
    id: workspace.id,
    name: workspace.name,
    created: workspace.created,
    createdBy: workspace.createdBy,
    modified: workspace.modified,
    modifiedBy: workspace.modifiedBy,
  };

  if (workspace.subscription) {
    record.subscription = workspace.subscription;
  }

  if (workspace.hasHadTrial !== undefined) {
    record.hasHadTrial = workspace.hasHadTrial;
  }

  if (workspace.futurePostsCount !== undefined) {
    record.futurePostsCount = workspace.futurePostsCount;
  }

  if (workspace.enabledPlatformEntitiesCount !== undefined) {
    record.enabledPlatformEntitiesCount =
      workspace.enabledPlatformEntitiesCount;
  }

  if (workspace.usedStorage !== undefined) {
    record.usedStorage = workspace.usedStorage;
  }

  return record;
}

function userWithRoleToDbRecord(
  workspaceId: string,
  user: WorkspaceUser
): WorkspaceUserDbRecord {
  const record: WorkspaceUserDbRecord = {
    pk: `${PK_PREFIX}#${workspaceId}`,
    sk: `${USER_SK_PREFIX}#${user.id}`,
    id: user.id,
    workspaceId,
    role: user.role,
    firstName: user.firstName,
    email: user.email,
    timeZone: user.timeZone,
    created: user.created,
    createdBy: user.createdBy,
    modified: user.modified,
    modifiedBy: user.modifiedBy,
  };

  if (user.lastName) {
    record.lastName = user.lastName;
  }

  if (user.profileImage) {
    record.profileImage = user.profileImage;
  }

  return record;
}

export function isWorkspaceMetaDbRecord(record: {
  [key: string]: any;
}): record is WorkspaceMetaDbRecord {
  return (
    record.pk &&
    record.sk &&
    record.pk.startsWith(`${PK_PREFIX}#`) &&
    record.sk.startsWith(`${META_SK_PREFIX}#`)
  );
}

export function isWorkspaceUserDbRecord(record: {
  [key: string]: any;
}): record is WorkspaceUserDbRecord {
  return (
    record.pk &&
    record.sk &&
    record.pk.startsWith(`${PK_PREFIX}#`) &&
    record.sk.startsWith(`${USER_SK_PREFIX}#`)
  );
}

export function isWorkspaceDbRecord(record: {
  [key: string]: any;
}): record is WorkspaceDbRecord {
  return isWorkspaceMetaDbRecord(record) || isWorkspaceUserDbRecord(record);
}

export function dbRecordsToWorkspace(records: WorkspaceDbRecord[]): Workspace {
  return records.reduce<Workspace>(
    (carry, record) => {
      if (isWorkspaceMetaDbRecord(record)) {
        carry.id = record.id;
        carry.name = record.name;
        carry.created = record.created;
        carry.createdBy = record.createdBy;
        carry.modified = record.modified;
        carry.modifiedBy = record.modifiedBy;

        if (record.subscription) {
          carry.subscription = record.subscription;
        }

        if (record.hasHadTrial !== undefined) {
          carry.hasHadTrial = record.hasHadTrial;
        }

        if (record.futurePostsCount !== undefined) {
          carry.futurePostsCount = record.futurePostsCount;
        }

        if (record.enabledPlatformEntitiesCount !== undefined) {
          carry.enabledPlatformEntitiesCount =
            record.enabledPlatformEntitiesCount;
        }

        if (record.usedStorage !== undefined) {
          carry.usedStorage = record.usedStorage;
        }
      } else if (isWorkspaceUserDbRecord(record)) {
        const userId = record.id;
        carry.users[userId] = {
          id: userId,
          workspaceId: record.workspaceId,
          role: record.role,
          email: record.email,
          firstName: record.firstName,
          timeZone: record.timeZone,
          created: record.created,
          createdBy: record.createdBy,
          modified: record.modified,
          modifiedBy: record.modifiedBy,
        };

        if (record.lastName) {
          carry.users[userId].lastName = record.lastName;
        }

        if (record.profileImage) {
          carry.users[userId].profileImage = record.profileImage;
        }
      }

      return carry;
    },
    { users: {} } as Workspace
  );
}

export async function getWorkspace(id: string) {
  const result = await simpleDBCall("query", {
    KeyConditionExpression: "pk = :pk",
    ExpressionAttributeValues: {
      ":pk": `${PK_PREFIX}#${id}`,
    },
  });

  return result.Items && result.Items.length
    ? dbRecordsToWorkspace(result.Items as WorkspaceDbRecord[])
    : null;
}

export interface WorkspaceUpdateProps {
  name?: string;
  users?: {
    [userId: string]: WorkspaceUser | null;
  };
  subscription?: WorkspaceSubscription | null;
  hasHadTrial?: boolean;
  futurePostsCount?: number;
  postedQueuedPostsCount?: Workspace["postedQueuedPostsCount"];
  enabledPlatformEntitiesCount?: number;
  usedStorage?: number;
  modified: string;
  modifiedBy: string;
}
export async function updateWorkspace(
  workspace: Workspace,
  props: WorkspaceUpdateProps
) {
  const promises: Array<Promise<any>> = [];
  const pk = `${PK_PREFIX}#${workspace.id}`;
  const sk = `${META_SK_PREFIX}#${workspace.id}`;
  const updateMetaRecordProps: Omit<WorkspaceUpdateProps, "users"> = {
    modified: props.modified,
    modifiedBy: props.modifiedBy,
  };

  if (props.name) {
    updateMetaRecordProps.name = props.name;
  }

  if (props.subscription !== undefined) {
    updateMetaRecordProps.subscription = props.subscription;
  }

  if (props.hasHadTrial !== undefined) {
    updateMetaRecordProps.hasHadTrial = props.hasHadTrial;
  }

  if (props.postedQueuedPostsCount !== undefined) {
    updateMetaRecordProps.postedQueuedPostsCount = props.postedQueuedPostsCount;
  }

  if (props.futurePostsCount !== undefined) {
    updateMetaRecordProps.futurePostsCount = props.futurePostsCount;
  }

  if (props.enabledPlatformEntitiesCount !== undefined) {
    updateMetaRecordProps.enabledPlatformEntitiesCount =
      props.enabledPlatformEntitiesCount;
  }

  if (props.usedStorage !== undefined) {
    updateMetaRecordProps.usedStorage = props.usedStorage;
  }

  if (Object.keys(updateMetaRecordProps).length > 2) {
    promises.push(
      simpleDBCall("update", {
        Key: {
          pk,
          sk,
        },
        ...paramsToUpdateExpression(updateMetaRecordProps),
      })
    );
  }

  if (props.users) {
    const toCreate: WorkspaceUser[] = [];
    const toDelete: DocumentClient.DeleteRequest[] = [];

    for (const [userId, user] of Object.entries(props.users)) {
      const sk = `${USER_SK_PREFIX}#${userId}`;

      if (user) {
        if (workspace.users[userId]) {
          promises.push(
            simpleDBCall("update", {
              Key: { pk, sk },
              ...paramsToUpdateExpression(user),
            })
          );
        } else {
          toCreate.push(user);
        }
      } else {
        toDelete.push({ Key: { pk, sk } });
      }
    }

    if (toCreate.length) {
      promises.push(
        batchPut(
          toCreate.map((user) => {
            return {
              Item: userWithRoleToDbRecord(workspace.id, user),
            };
          })
        )
      );
    }

    if (toDelete.length) {
      promises.push(batchDelete(toDelete));
    }
  }

  await Promise.all(promises);

  const updatedWorkspace = patchObject(workspace, {
    ...updateMetaRecordProps,
    users: { ...workspace.users },
  });

  if (props.users) {
    for (const [userId, user] of Object.entries(props.users)) {
      if (user) {
        updatedWorkspace.users[userId] = user;
      } else {
        delete updatedWorkspace.users[userId];
      }
    }
  }

  return updatedWorkspace;
}

export async function createWorkspace(workspace: Workspace) {
  const promises: Array<Promise<any>> = [
    simpleDBCall("put", {
      Item: workspaceToDbRecord(workspace),
    }),
    batchPut(
      Object.values(workspace.users).map((user) => {
        return {
          Item: userWithRoleToDbRecord(workspace.id, user),
        };
      })
    ),
  ];
  await Promise.all(promises);
  return workspace;
}

export async function deleteWorkspace(workspace: Workspace) {
  const pk = `${PK_PREFIX}#${workspace.id}`;
  const sk = `${META_SK_PREFIX}#${workspace.id}`;
  return await batchDelete(
    [{ Key: { pk, sk } }].concat(
      Object.keys(workspace.users).map((userId) => {
        return { Key: { pk, sk: `${USER_SK_PREFIX}#${userId}` } };
      })
    )
  );
}

export async function queryWorkspacesByUserId(userId: string) {
  const result = await simpleDBCall("query", {
    IndexName: "GSI1",
    KeyConditionExpression: "begins_with(pk, :pk) AND sk = :sk",
    ExpressionAttributeValues: {
      ":pk": `${PK_PREFIX}#`,
      ":sk": `${USER_SK_PREFIX}#${userId}`,
    },
  });

  if (result.Items) {
    const workspaceIds = (result.Items as WorkspaceUserDbRecord[]).map(
      (item) => item.workspaceId
    );
    const workspaces = await Promise.all(
      workspaceIds.map((workspaceId) => getWorkspace(workspaceId))
    );
    return workspaces.filter((workspace) => workspace !== null) as Workspace[];
  } else {
    return [];
  }
}
