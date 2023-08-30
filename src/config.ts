import { AssumeRoleCommand, STSClient } from "@aws-sdk/client-sts";
import { SecretsManager } from "@aws-sdk/client-secrets-manager";

import { GCache, GCacheEntry } from "./cache";
import {
  AWSMissingAccessKeyIdException,
  AWSMissingRegionException,
  AWSMissingRoleARNException,
  AWSMissingRoleSessionNameException,
  AWSMissingSecretAccessKeyException,
  AWSMissingSessionTokenException,
  RequiredSecretNotFoundException,
} from './exceptions';


export type GConfigValueType = string | number | boolean;

export class Config {
  awsPrefix: string;
  secretsmanagerPrefix: string;
  secretsmanagerClient: SecretsManager | null;
  notFoundFn: CallableFunction | null;
  cacheEnv: GCache;
  cacheSecretsmanager: GCache;

  constructor(
    awsPrefix: string = "",
    secretsmanagerPrefix: string = "",
    notFoundFn: CallableFunction = null,
  ) {
    this.awsPrefix = awsPrefix;
    this.secretsmanagerPrefix = secretsmanagerPrefix;
    this.secretsmanagerClient = null;
    this.notFoundFn = notFoundFn;
    this.cacheEnv = new GCache();
    this.cacheSecretsmanager = new GCache();
  }

  async getSecretsmanager(): Promise<SecretsManager> {
    if (this.secretsmanagerClient == null) {
      let awsAccessKeyId = process.env[`${this.awsPrefix}AWS_ACCESS_KEY_ID`];
      let awsSecretAccessKey = process.env[`${this.awsPrefix}AWS_SECRET_ACCESS_KEY`];
      let awsRegion = process.env[`${this.awsPrefix}AWS_REGION`];

      if (awsAccessKeyId == null) {
        throw new AWSMissingAccessKeyIdException();
      }

      if (awsSecretAccessKey == null) {
        throw new AWSMissingSecretAccessKeyException();
      }

      if (awsRegion == null) {
        throw new AWSMissingRegionException();
      }

      // AWS_SESSION_TOKEN is optional, if not provided, assume role will be used.
      let awsSessionToken = process.env[`${this.awsPrefix}AWS_SESSION_TOKEN`];

      //  If AWS_SESSION_TOKEN is not provided, assume role.
      if (awsSessionToken == null) {
        const awsRoleArn = process.env[`${this.awsPrefix}AWS_ROLE_ARN`];
        const awsRoleSessionName = process.env[`${this.awsPrefix}AWS_ROLE_SESSION_NAME`];

        if (awsRoleArn == null) {
          throw new AWSMissingRoleARNException();
        }

        if (awsRoleSessionName == null) {
          throw new AWSMissingRoleSessionNameException();
        }

        try {
          const client = new STSClient({
            credentials: {
              accessKeyId: awsAccessKeyId,
              secretAccessKey: awsSecretAccessKey,
            },
            region: awsRegion,
          });

          const command = new AssumeRoleCommand({
            RoleArn: awsRoleArn,
            RoleSessionName: awsRoleSessionName,
          });
          const response = await client.send(command);

          awsAccessKeyId = response.Credentials?.AccessKeyId;
          awsSecretAccessKey = response.Credentials?.SecretAccessKey;
          awsSessionToken = response.Credentials?.SessionToken;
        } catch (err) {
          throw err;
        }
      }

      // session token must be set now.
      if (awsSessionToken == null) {
        throw new AWSMissingSessionTokenException();
      }

      this.secretsmanagerClient = new SecretsManager({
        credentials: {
          accessKeyId: awsAccessKeyId,
          secretAccessKey: awsSecretAccessKey,
          sessionToken: awsSessionToken,
        },
        region: awsRegion,
      });
    }

    return this.secretsmanagerClient;
  }

  getSecretsmanagerKey(secretId: string): string {
    if (this.secretsmanagerPrefix != "") {
      return `${this.secretsmanagerPrefix}/${secretId}`;
    }
    return secretId;
  }

  async getSecretsmanagerSecret(secretId: string): Promise<string> {
    const secretsmanagerClient = await this.getSecretsmanager();
    const secretKey = this.getSecretsmanagerKey(secretId);

    try {
      const response = await secretsmanagerClient.getSecretValue({ SecretId: secretKey });
      return response.SecretString;
    } catch (err) {
      throw err;
    }
  }

  async createSecretsmanagerSecret(secretId: string, secret: string): Promise<void> {
    const secretsmanagerClient = await this.getSecretsmanager();
    const secretKey = this.getSecretsmanagerKey(secretId);

    try {
      await secretsmanagerClient.createSecret({
        Name: secretKey,
        SecretString: secret,
      });
    } catch (err) {
      throw err;
    }
  }

  async updateSecretsmanagerSecret(secretId: string, secret: string): Promise<void> {
    const secretsmanagerClient = await this.getSecretsmanager();
    const secretKey = this.getSecretsmanagerKey(secretId);

    try {
      await secretsmanagerClient.updateSecret({
        SecretId: secretKey,
        SecretString: secret,
      });
    } catch (err) {
      throw err;
    }
  }

  async get(
    typ: GConfigValueType,
    env: string = null,
    secretsmanager: string = null,
    _default: any = null,
    required: boolean = false,
    changeCallbackFn: CallableFunction = null,
  ): Promise<string> {
    let secret = null;

    if (env != null) {
      secret = process.env[`${this.awsPrefix}${env}`];
      if (secret != null) {
        this.cacheEnv.set(
          new GCacheEntry(typ, env, secret as string, changeCallbackFn)
        )
      }
    }

    if (secret == null && secretsmanager != null) {
      try {
        secret = await this.getSecretsmanagerSecret(secretsmanager);
        this.cacheSecretsmanager.set(
          new GCacheEntry(typ, secretsmanager, secret, changeCallbackFn)
        );
      } catch (err) {
        if (err.name == "ResourceNotFoundException") {
          secret = null;
        } else if (!required || _default !== null) {
          secret = _default;
        } else {
          throw err;
        }
      }
    }

    if (secret == null && _default !== null) {
      secret = _default;
    }

    if (secret == null && required) {
      if (this.notFoundFn != null) {
        this.notFoundFn({env, secretsmanager, _default, required});
        return null;
      } else {
        throw new RequiredSecretNotFoundException();
      }
    }

    return secret;
  }

  async write(
    value: string,
    env: string = null,
    secretsmanager: string = null,
  ) {
    // TODO: implement.
  }

  async string(): Promise<string> {
    // TODO: implement.
    return "";
  }

  async number(): Promise<number> {
    // TODO: implement.
    return 0;
  }

  async boolean(): Promise<boolean> {
    // TODO: implement.
    return false;
  }
}
