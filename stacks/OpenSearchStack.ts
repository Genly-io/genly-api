import { StackContext } from "sst/constructs";
//import * as opensearch from "@aws-cdk/aws-opensearchservice";
import * as opensearch from "aws-cdk-lib/aws-opensearchservice";

export function OpenSearchStack({ stack }: StackContext) {
  // Define the OpenSearch domain
  const domain = new opensearch.Domain(stack, "Domain", {
    version: opensearch.EngineVersion.OPENSEARCH_1_2,
    capacity: {
      //masterNodes: 1,
      dataNodes: 1,
      //masterNodeInstanceType: "t3.small.search",
      dataNodeInstanceType: "t3.small.search",
    },
    ebs: {
      volumeSize: 10, // Adjust the size as needed
    },
    zoneAwareness: {
      enabled: false, // Set true for high availability across zones
    },
    //removalPolicy: stack.removalPolicy, // Or use sst.RemovalPolicy.DESTROY for dev
  });

  // Output the domain endpoint
  stack.addOutputs({
    DomainEndpoint: domain.domainEndpoint,
    DomainName: domain.domainName,
    DomainId: domain.domainId,
  });
  return {
    domain,
  };
}
