//import handler from "@genly-api/core/src/handler";
//import { getUser,createUser } from "@genly-api/core/services/users";
/*import { getUser, createUser } from "@genly-api/core/repositories/users";
import { DateTime } from "luxon";
import { User, UserReferralAffiliate } from "@genly-api/core/types/users";
import { Forbidden, BadRequest } from "@genly-api/core/libs/errors";
import { nowISODateString } from "@genly-api/core/libs/utils";

import handler from "@genly-api/core/src/handler";

interface BodyData {
  email: string;
  firstName: string;
  timeZone: string;
  lastName?: string;
  referralId?: string;
  referralAffiliate?: UserReferralAffiliate;
}

export const main = handler(async (event) => {
  const authProvider =
    event.requestContext.authorizer?.iam.cognitoIdentity.amr.findLast((ref) =>
      ref.includes(":")
    );
  // Cognito authentication provider looks like:
  // cognito-idp.us-east-1.amazonaws.com/us-east-1_xxxxxxxxx,cognito-idp.us-east-1.amazonaws.com/us-east-1_aaaaaaaaa:CognitoSignIn:qqqqqqqq-1111-2222-3333-rrrrrrrrrrrr
  // Where us-east-1_aaaaaaaaa is the User Pool id
  // And qqqqqqqq-1111-2222-3333-rrrrrrrrrrrr is the User Pool User Id
  const parts = authProvider.split(":");
  const userPoolIdParts = parts[parts.length - 3].split("/");

  const userPoolId = userPoolIdParts[userPoolIdParts.length - 1];
  const userPoolUserId = parts[parts.length - 1];
  console.log(userPoolId, userPoolUserId);

  if (!event.body) {
    throw new BadRequest("Request body not provided");
  }

  const bodyData: BodyData = JSON.parse(event.body);

  const { timeZone } = bodyData;
  const dateTime = DateTime.local().setZone(timeZone);
  //const id = event.requestContext.authorizer?.iam.cognitoIdentity.identityId;
  const id = userPoolUserId;

  const now = nowISODateString();

  //console.log(event.requestContext.authorizer);
  if (!id) {
    throw new Forbidden("You do not have permission to create a user");
  }
  if (!dateTime.isValid) {
    throw new Error(`Invalid time zone: ${timeZone}`);
  }
  console.log("about to check if user existed");
  const existingUser = await getUser(id);
  console.log("existingUser== ", existingUser);

  if (existingUser) {
    throw new BadRequest("You may not create duplicate users");
  }

  const user: User = {
    id,
    email: bodyData.email,
    firstName: bodyData.firstName,
    timeZone: bodyData.timeZone,
    workspaces: {},
    created: now as string,
    createdBy: id,
    modified: now as string,
    modifiedBy: id,
  };

  console.log("about to create new user");
  await createUser(user);
  console.log("user created");
  return JSON.stringify(user);
});*/
import handler from "@genly-api/core/src/handler";
import { getUser, createUser } from "@genly-api/core/repositories/users";
import { DateTime } from "luxon";
import { User } from "@genly-api/core/types/users";
import { Forbidden, BadRequest } from "@genly-api/core/libs/errors";

interface BodyData {
  email: string;
  firstName: string;
  timeZone: string;
  lastName?: string;
}

export const main = handler(async (event) => {
  if (!event.body) {
    throw new BadRequest("Request body not provided");
  }

  const bodyData: BodyData = JSON.parse(event.body);
  const { timeZone } = bodyData;
  const dateTime = DateTime.local().setZone(timeZone);

  const authProvider =
    event.requestContext.authorizer?.iam.cognitoIdentity.amr.find((ref) =>
      ref.includes(":")
    );
  if (!authProvider) {
    throw new Forbidden("Unable to determine authentication provider");
  }

  const userPoolUserId = authProvider.split(":").pop();
  if (!userPoolUserId) {
    throw new Forbidden("Unable to determine user pool user ID");
  }

  if (!dateTime.isValid) {
    throw new BadRequest(`Invalid time zone: ${timeZone}`);
  }

  const existingUser = await getUser(userPoolUserId);
  if (existingUser) {
    throw new BadRequest("Duplicate user creation attempt");
  }

  const now = new Date().toISOString();
  const user: User = {
    id: userPoolUserId,
    email: bodyData.email,
    firstName: bodyData.firstName,
    timeZone: bodyData.timeZone,
    workspaces: {},
    created: now,
    createdBy: userPoolUserId,
    modified: now,
    modifiedBy: userPoolUserId,
  };

  await createUser(user);
  return JSON.stringify(user);
});
