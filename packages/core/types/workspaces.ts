import { User, UserRole } from "./users";
import { Subscription } from "./subscriptions";

export type WorkspaceSubscription = Pick<
  Subscription,
  "id" | "provider" | "status" | "remoteProductId" | "price"
>;

export interface WorkspaceUser extends Omit<User, "workspaces" | "billing"> {
  workspaceId: string;
  role: UserRole;
}

export interface Workspace {
  id: string;
  name: string;
  users: {
    [userId: string]: WorkspaceUser;
  };
  subscription?: WorkspaceSubscription;
  hasHadTrial?: boolean;
  futurePostsCount?: number;
  postedQueuedPostsCount?: {
    periodStart: string;
    periodEnd: string;
    count: number;
  };
  enabledPlatformEntitiesCount?: number;
  usedStorage?: number; // Bytes.
  created: string;
  createdBy: string;
  modified: string;
  modifiedBy: string;

  /*[key: string]:
    | string
    | boolean
    | number
    | WorkspaceUser
    | WorkspaceSubscription
    | object
    | undefined;*/
}
