/*import { Table } from "sst/node/table";
import handler from "@genly-api/core/src/handler";
import dynamoDb from "@genly-api/core/src/dynamodb";*/
//import handler from "@genly-api/core/src/handler";
//import { getUser,createUser } from "@genly-api/core/services/users";
import { getUser, createUser } from "@genly-api/core/repositories/users";
import { DateTime } from "luxon";
import { User, UserReferralAffiliate } from "@genly-api/core/types/users";
import { Forbidden, BadRequest } from "@genly-api/core/libs/errors";
import { nowISODateString } from "@genly-api/core/libs/utils";

import handler from "@genly-api/core/src/handler";

import { opensearchProcess } from "@genly-api/core/services/documents/documentProcessor";

export const main = handler(async (event) => {
  opensearchProcess();
  return JSON.stringify("ZAHIA");
  /*
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

  if (!event.body) {
    throw new BadRequest("Request body not provided");
  }

  let user: User | null = null;
  console.log("about to call get user ", userPoolUserId);
  user = await getUser(userPoolUserId);

  if (!user) {
    throw new Forbidden("User not logged in", "001");
  }


  // Return the retrieved item
  return JSON.stringify(user);*/
});
