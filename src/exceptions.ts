export class AWSMissingAccessKeyIdException extends Error {
  constructor() {
    super("AWS_ACCESS_KEY_ID not found in the environment variables.");
    this.name = "AWSMissingAccessKeyIdException";
  }
}

export class AWSMissingSecretAccessKeyException extends Error {
  constructor() {
    super("AWS_SECRET_ACCESS_KEY not found in the environment variables.");
    this.name = "AWSMissingSecretAccessKeyException";
  }
}

export class AWSMissingRegionException extends Error {
  constructor() {
    super("AWS_REGION not found in the environment variables.");
    this.name = "AWSMissingRegionException";
  }
}

export class AWSMissingRoleARNException extends Error {
  constructor() {
    super("AWS_ROLE_ARN is not provided.");
    this.name = "AWSMissingRoleARNException";
  }
}

export class AWSMissingRoleSessionNameException extends Error {
  constructor() {
    super("AWS_ROLE_SESSION_NAME is not provided.");
    this.name = "AWSMissingRoleSessionNameException";
  }
}

export class AWSMissingSessionTokenException extends Error {
  constructor() {
    super("AWS_SESSION_TOKEN not found in the environment variables.");
    this.name = "AWSMissingSessionTokenException";
  }
}

export class AWSInvalidCredentialsException extends Error {
  constructor() {
    super("Invalid credentials provided to the Config class.");
    this.name = "AWSInvalidCredentialsException";
  }
}

export class AWSInvalidSessionException extends Error {
  constructor() {
    super("A boto3.Session is not provided to the Config class.");
    this.name = "AWSInvalidSessionException";
  }
}

export class RequiredSecretNotFoundException extends Error {
  constructor() {
    super("A required secret is not found in the environment variables or Secrets Manager.");
    this.name = "RequiredSecretNotFoundException";
  }
}

export class SecretValueNoneException extends Error {
  constructor() {
    super("A secret value is None.");
    this.name = "SecretValueNoneException";
  }
}

export class SecretNotCachedException extends Error {
  constructor() {
    super("A secret is not cached.");
    this.name = "SecretNotCachedException";
  }
}
