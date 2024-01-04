import { Api, Config, StackContext, use } from "sst/constructs";
import { StorageStack } from "../StorageStack";
import userRoutes from "./routes/users";
import invoiceRoutes from "./routes/invoices";
import userPreferenceRoutes from "./routes/userPreferences";
import subscriptionRoutes from "./routes/subscriptions";
import workspaceRoutes from "./routes/workspaces";
import paymentMethodRoutes from "./routes/paymentMethods";

export function ApiStack({ stack }: StackContext) {
  const { table } = use(StorageStack);
  const STRIPE_SECRET_KEY = new Config.Secret(stack, "STRIPE_SECRET_KEY");
  //Create the API
  const api = new Api(stack, "Api", {
    defaults: {
      authorizer: "iam",
      function: {
        bind: [table, STRIPE_SECRET_KEY],
      },
    },
    cors: true,
    routes: {
      ...userRoutes,
      ...userPreferenceRoutes,
      ...subscriptionRoutes,
      ...invoiceRoutes,
      ...workspaceRoutes,
      ...paymentMethodRoutes,
    },
    /**
     * 
      "GET /notes": "packages/functions/src/list.main",
      "GET /notes/{id}": "packages/functions/src/get.main",
      "POST /notes": "packages/functions/src/create.main",
      "PUT /notes/{id}": "packages/functions/src/update.main",
      "DELETE /notes/{id}": "packages/functions/src/delete.main",
      "POST /billing": "packages/functions/src/billing.main",
     */
  });

  //Show the API endpoint in the output
  stack.addOutputs({
    ApiEndpoint: api.url,
  });

  //Return the API Ressource
  return {
    api,
  };
}
