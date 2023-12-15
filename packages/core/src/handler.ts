import { Context, APIGatewayProxyEvent } from "aws-lambda";
import { Exception } from "../libs/errors";

export default function handler(
  lambda: (evt: APIGatewayProxyEvent, context: Context) => Promise<string>
) {
  return async function (event: APIGatewayProxyEvent, context: Context) {
    let body, statusCode;
    console.log("handler function");
    try {
      // Run the Lambda
      body = await lambda(event, context);
      statusCode = 200;
    } catch (e) {
      if (e instanceof Exception) {
        console.error(`Error captured: `, e);
        statusCode = e.statusCode;
        body = JSON.stringify({
          error: e.message,
        });
      } else {
        statusCode = 500;
        body = JSON.stringify({
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // Return HTTP response
    return {
      body,
      statusCode,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
    };
  };
}
