//import handler from "@genly-api/core/src/handler";
//import { getUser,createUser } from "@genly-api/core/services/users";
import { getUser, createUser } from "@genly-api/core/repositories/users";
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

  const existingUser = await getUser(id);

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
  await createUser(user);
  return JSON.stringify(user);
});
