import { Table } from "sst/node/table";
import handler from "@genly-api/core/src/handler";
import dynamoDb from "@genly-api/core/src/dynamodb";
import { nanoid } from "nanoid";
import { nowISODateString } from "@genly-api/core/libs/utils";
import { Workspace } from "@genly-api/core/types/workspaces";
import { User } from "@genly-api/core/types/users";
import { Forbidden, BadRequest } from "@genly-api/core/libs/errors";
import { getUser } from "@genly-api/core/repositories/users";
import { createWorkspace } from "@genly-api/core/repositories/workspaces";

interface BodyData {
  name: string;
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

  if (!event.body) {
    throw new BadRequest("Request body not provided");
  }
  let user: User | null = null;
  user = await getUser(userPoolUserId);
  if (!user) {
    throw new Forbidden("User not logged in", "001");
  }
  const bodyData: BodyData = JSON.parse(event.body);
  const now = nowISODateString();
  const workspaceId = nanoid();
  const workspace: Workspace = {
    id: workspaceId,
    name: bodyData.name,
    users: {
      [user.id]: {
        ...user,
        workspaceId,
        role: "OWNER",
      },
    },
    created: now as string,
    createdBy: user.id,
    modified: now as string,
    modifiedBy: user.id,
  };

  const [secret] = await Promise.all([
    /*getCurrentFileAccessSecret(),*/
    createWorkspace(workspace),
  ]);

  let fileAccessToken: string | null = null;
  /*
  if (secret) {
    fileAccessToken = buildFileAccessToken(secret, workspace, user);
  }*/

  //return [workspace, { fileAccessToken }];

  return JSON.stringify(workspace);
});
