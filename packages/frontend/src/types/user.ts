import { InternalFileImage } from "./files";

export type UserRole = "OWNER" | "ADMIN" | "CREATOR" | "READER";

export interface UserWorkspaceSummary {
  id: string;
  role: UserRole;
}

export interface UserWorkspaces {
  [workspaceId: string]: UserWorkspaceSummary;
}

export interface UserBilling {
  provider: "STRIPE";
  customerId: string;
  couponId?: string;
}

export interface UserReferralAffiliate {
  id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  token: string;
  provider: "REWARDFUL";
}

export interface User {
  email: string;
  firstName: string;
  lastName?: string;
  profileImage?: InternalFileImage;
  timeZone: string;
  workspaces?: UserWorkspaces;
  billing?: UserBilling;
  featureVersion?: string;
  referralId?: string;
  referralAffiliate?: UserReferralAffiliate;
}
