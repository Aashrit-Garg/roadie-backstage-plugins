/*
 * Copyright 2021 Larder Software Limited
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  ANNOTATION_LOCATION,
  ANNOTATION_VIEW_URL,
  ANNOTATION_ORIGIN_LOCATION,
  ResourceEntity,
} from '@backstage/catalog-model';
import {
  EntityProvider,
  EntityProviderConnection,
} from '@backstage/plugin-catalog-backend';
import { fromTemporaryCredentials } from '@aws-sdk/credential-providers';
import { S3 } from '@aws-sdk/client-s3';
import { STS } from '@aws-sdk/client-sts';
import * as winston from 'winston';
import { Config } from '@backstage/config';
import { AccountConfig } from '../types';

const link2aws = require('link2aws');

/**
 * Provides entities from AWS S3 Bucket service.
 */
export class AWSS3BucketProvider implements EntityProvider {
  private readonly accountId: string;
  private readonly roleArn: string;
  private readonly externalId?: string;
  private readonly region: string;

  private connection?: EntityProviderConnection;
  private logger: winston.Logger;

  static fromConfig(config: Config, options: { logger: winston.Logger }) {
    const accountId = config.getString('accountId');
    const roleArn = config.getString('roleArn');
    const externalId = config.getOptionalString('externalId');
    const region = config.getString('region');

    return new AWSS3BucketProvider(
      { accountId, roleArn, externalId, region },
      options,
    );
  }

  constructor(account: AccountConfig, options: { logger: winston.Logger }) {
    this.accountId = account.accountId;
    this.roleArn = account.roleArn;
    this.externalId = account.externalId;
    this.region = account.region;
    this.logger = options.logger;
  }

  getProviderName(): string {
    return `aws-s3-bucket-${this.accountId}`;
  }

  async connect(connection: EntityProviderConnection): Promise<void> {
    this.connection = connection;
  }

  async run(): Promise<void> {
    if (!this.connection) {
      throw new Error('Not initialized');
    }

    this.logger.info(
      `Providing s3 bucket resources from aws: ${this.accountId}`,
    );
    const s3Resources: ResourceEntity[] = [];

    const credentials = fromTemporaryCredentials({
      params: { RoleArn: this.roleArn, ExternalId: this.externalId },
    });
    const s3 = new S3({ credentials, region: this.region });
    const sts = new STS({ credentials });

    const account = await sts.getCallerIdentity({});

    const defaultAnnotations: { [name: string]: string } = {
      [ANNOTATION_LOCATION]: `${this.getProviderName()}:${this.roleArn}`,
      [ANNOTATION_ORIGIN_LOCATION]: `${this.getProviderName()}:${this.roleArn}`,
    };

    if (account.Account) {
      defaultAnnotations['amazon.com/account-id'] = account.Account;
    }

    const buckets = await s3.listBuckets({});

    for (const bucket of buckets.Buckets || []) {
      if (bucket.Name) {
        const bucketArn = `arn:aws:s3:::${bucket.Name}`;
        const consoleLink = new link2aws.ARN(bucketArn).consoleLink;
        const resource: ResourceEntity = {
          kind: 'Resource',
          apiVersion: 'backstage.io/v1beta1',
          metadata: {
            annotations: {
              ...defaultAnnotations,
              'amazon.com/s3-bucket-arn': bucketArn,
              [ANNOTATION_VIEW_URL]: consoleLink,
            },
            name: bucket.Name,
          },
          spec: {
            owner: 'unknown',
            type: 's3-bucket',
          },
        };

        s3Resources.push(resource);
      }
    }

    await this.connection.applyMutation({
      type: 'full',
      entities: s3Resources.map(entity => ({
        entity,
        locationKey: `aws-s3-bucket-provider:${this.accountId}`,
      })),
    });
  }
}
