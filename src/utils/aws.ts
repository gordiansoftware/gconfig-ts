import debug from "debug";
const log = debug("gconfig:utils:aws");

/**
 * Checks if the current execution environment is AWS.
 *
 * This function looks for environment variables that are
 * set by AWS services. For example, AWS Lambda sets various
 * environment variables such as `AWS_LAMBDA_FUNCTION_NAME`,
 * and EC2 instances have `AWS_EC2_METADATA_DISABLED`.
 *
 * @returns {boolean} `true` if the code is running on AWS, otherwise `false`.
 */
export function isRunningOnAWS(): boolean {
  // Check for AWS Lambda environment variables
  if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
    log("Running on AWS because AWS_LAMBDA_FUNCTION_NAME is set");
    return true;
  }

  // Check for an EC2 instance environment variable
  if (process.env.AWS_EC2_METADATA_DISABLED !== undefined) {
    log("Running on AWS because AWS_EC2_METADATA_DISABLED is set");
    return true;
  }

  // Check for an ECS container environment variables
  if (process.env.ECS_CONTAINER_METADATA_URI || process.env.ECS_AGENT_URI) {
    log(
      "Running on AWS because ECS_CONTAINER_METADATA_URI or ECS_AGENT_URI is set"
    );
    return true;
  }

  // Add additional AWS service environment checks if necessary

  // If none of the AWS-specific variables are set, we're likely not running on AWS
  log("no AWS-specific environment found, assuming not running on AWS");
  return false;
}
