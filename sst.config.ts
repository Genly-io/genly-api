import { SSTConfig } from "sst";
import { StorageStack } from "./stacks/StorageStack";
import { ApiStack } from "./stacks/apiStacks/ApiStack";
import { AuthStack } from "./stacks/AuthStack";
import { OpenSearchStack } from "./stacks/OpenSearchStack";
import { FrontendStack } from "./stacks/FrontendStack";

export default {
  config(_input) {
    return {
      name: "genly",
      region: "us-east-1",
      profile: _input.profile ? _input.profile : "dev",
      stage: _input.profile ? _input.profile : "dev",
    };
  },
  stacks(app) {
    if (app.stage !== "prod") {
      app.setDefaultRemovalPolicy("destroy");
    }
    app
      .stack(StorageStack)
      .stack(ApiStack)
      .stack(AuthStack)
      .stack(OpenSearchStack)
      .stack(FrontendStack);
  },
} satisfies SSTConfig;
