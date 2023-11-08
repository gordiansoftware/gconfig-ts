import { AssumeRoleCommand, STSClient } from "@aws-sdk/client-sts";
import { SecretsManager } from "@aws-sdk/client-secrets-manager";
import debug from "debug";

import { GCache, GCacheEntry } from "./cache";
import {
  AWSMissingAccessKeyIdException,
  AWSMissingRegionException,
  AWSMissingRoleARNException,
  AWSMissingRoleSessionNameException,
  AWSMissingSecretAccessKeyException,
  AWSMissingSessionTokenException,
  RequiredSecretNotFoundException,
} from "./exceptions";
import { parseEntry } from "./parse";
import { isRunningOnAWS } from "./utils/aws";

const log = debug("gconfig:config");

export enum ConfigValueType {
  String = "string",
  Number = "number",
  Boolean = "boolean",
}

interface EnvConfig {
  awsAccessKeyId?: string;
  awsSecretAccessKey?: string;
  awsRegion?: string;
  awsSessionToken?: string;
  awsRoleArn?: string;
  awsRoleSessionName?: string;
}

export class Config {
  awsPrefix: string;
  secretsmanagerPrefix: string;
  secretsmanagerClient: SecretsManager | null;
  notFoundFn: CallableFunction | null;
  cacheEnv: GCache;
  cacheSecretsmanager: GCache;
  cfg: EnvConfig;

  constructor({
    awsPrefix = "",
    secretsmanagerPrefix = "",
    notFoundFn = null,
  }: {
    awsPrefix: string;
    secretsmanagerPrefix: string;
    notFoundFn: CallableFunction;
  }) {
    this.awsPrefix = awsPrefix;
    this.secretsmanagerPrefix = secretsmanagerPrefix;
    this.secretsmanagerClient = null;
    this.notFoundFn = notFoundFn;
    this.cacheEnv = new GCache();
    this.cacheSecretsmanager = new GCache();
    this.cfg = this.getEnvConfig();
  }

  getEnvConfig(): EnvConfig {
    const makeKey = (key: string) => `${this.awsPrefix}${key}`;
    const keys = {
      awsAccessKeyId: makeKey("AWS_ACCESS_KEY_ID"),
      awsSecretAccessKey: makeKey("AWS_SECRET_ACCESS_KEY"),
      awsRegion: makeKey("AWS_REGION"),
      awsSessionToken: makeKey("AWS_SESSION_TOKEN"),
      awsRoleArn: makeKey("AWS_ROLE_ARN"),
      awsRoleSessionName: makeKey("AWS_ROLE_SESSION_NAME"),
    };
    log("keys: %O", keys);
    const config = {};
    for (const [key, value] of Object.entries(keys)) {
      const v = process.env[value];
      if (v != null) {
        config[key] = v;
      }
    }

    return config;
  }

  async getSecretsmanager(): Promise<SecretsManager> {
    if (!this.secretsmanagerClient) {
      if (isRunningOnAWS()) {
        log("setting up secretsmanager client (in AWS)");
        this.secretsmanagerClient = new SecretsManager();
        return this.secretsmanagerClient;
      }

      if (this.cfg.awsAccessKeyId == null) {
        throw new AWSMissingAccessKeyIdException();
      }

      if (this.cfg.awsSecretAccessKey == null) {
        throw new AWSMissingSecretAccessKeyException();
      }

      if (this.cfg.awsRegion == null) {
        throw new AWSMissingRegionException();
      }

      //  If AWS_SESSION_TOKEN is not provided, assume role.
      if (this.cfg.awsSessionToken == null) {
        if (this.cfg.awsRoleArn == null) {
          throw new AWSMissingRoleARNException();
        }

        if (this.cfg.awsRoleSessionName == null) {
          throw new AWSMissingRoleSessionNameException();
        }

        try {
          const client = new STSClient({
            credentials: {
              accessKeyId: this.cfg.awsAccessKeyId,
              secretAccessKey: this.cfg.awsSecretAccessKey,
            },
            region: this.cfg.awsRegion,
          });

          const command = new AssumeRoleCommand({
            RoleArn: this.cfg.awsRoleArn,
            RoleSessionName: this.cfg.awsRoleSessionName,
          });
          const response = await client.send(command);

          this.cfg.awsAccessKeyId = response.Credentials?.AccessKeyId;
          this.cfg.awsSecretAccessKey = response.Credentials?.SecretAccessKey;
          this.cfg.awsSessionToken = response.Credentials?.SessionToken;
        } catch (err) {
          throw err;
        }
      }

      // session token must be set now.
      if (this.cfg.awsSessionToken == null) {
        throw new AWSMissingSessionTokenException();
      }

      log("setting up secretsmanager client (not in AWS)");
      this.secretsmanagerClient = new SecretsManager({
        credentials: {
          accessKeyId: this.cfg.awsAccessKeyId,
          secretAccessKey: this.cfg.awsSecretAccessKey,
          sessionToken: this.cfg.awsSessionToken,
        },
        region: this.cfg.awsRegion,
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
      const response = await secretsmanagerClient.getSecretValue({
        SecretId: secretKey,
      });
      log("%s was found in secretsmanager", secretKey);
      return response.SecretString;
    } catch (err) {
      throw err;
    }
  }

  async createSecretsmanagerSecret(
    secretId: string,
    secret: string
  ): Promise<void> {
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

  async updateSecretsmanagerSecret(
    secretId: string,
    secret: string
  ): Promise<void> {
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
    typ: ConfigValueType,
    env: string = null,
    secretsmanager: string = null,
    _default: any = null,
    required: boolean = false
  ): Promise<string> {
    let secret = null;

    if (env != null) {
      secret = process.env[env];
      if (secret != null) {
        this.cacheEnv.set(new GCacheEntry(typ, env, secret));
      }
    }

    if (secret == null && secretsmanager != null) {
      try {
        secret = await this.getSecretsmanagerSecret(secretsmanager);
        this.cacheSecretsmanager.set(
          new GCacheEntry(typ, secretsmanager, secret)
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
        this.notFoundFn({ env, secretsmanager, _default, required });
        return null;
      } else {
        throw new RequiredSecretNotFoundException();
      }
    }

    return secret;
  }

  async string({
    env = null,
    secretsmanager = null,
    _default = null,
    required = false,
  }: {
    env?: string;
    secretsmanager?: string;
    _default?: string;
    required?: boolean;
  }): Promise<string> {
    const value = await this.get(
      ConfigValueType.String,
      env,
      secretsmanager,
      _default,
      required
    );
    return parseEntry(ConfigValueType.String, value);
  }

  async number({
    env = null,
    secretsmanager = null,
    _default = null,
    required = false,
  }: {
    env?: string;
    secretsmanager?: string;
    _default?: number;
    required?: boolean;
  }): Promise<number> {
    const value = await this.get(
      ConfigValueType.Number,
      env,
      secretsmanager,
      _default,
      required
    );
    return parseEntry(ConfigValueType.Number, value);
  }

  async boolean({
    env = null,
    secretsmanager = null,
    _default = null,
    required = false,
  }: {
    env?: string;
    secretsmanager?: string;
    _default?: boolean;
    required?: boolean;
  }): Promise<boolean> {
    const value = await this.get(
      ConfigValueType.Boolean,
      env,
      secretsmanager,
      _default,
      required
    );
    return parseEntry(ConfigValueType.Boolean, value);
  }
}
