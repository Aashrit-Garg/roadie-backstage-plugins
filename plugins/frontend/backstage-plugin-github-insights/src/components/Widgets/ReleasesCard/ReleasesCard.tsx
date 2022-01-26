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

import React from 'react';
import { Link, List, ListItem, Chip } from '@material-ui/core';
import LocalOfferOutlinedIcon from '@material-ui/icons/LocalOfferOutlined';
import { Alert } from '@material-ui/lab';
import {
  InfoCard,
  Progress,
  MissingAnnotationEmptyState,
} from '@backstage/core-components';
import { Entity } from '@backstage/catalog-model';
import { useRequest } from '../../../hooks/useRequest';
import { useEntityGithubScmIntegration } from '../../../hooks/useEntityGithubScmIntegration';
import { useProjectEntity } from '../../../hooks/useProjectEntity';
import {
  isGithubInsightsAvailable,
  GITHUB_INSIGHTS_ANNOTATION,
} from '../../utils/isGithubInsightsAvailable';
import { useEntity } from '@backstage/plugin-catalog-react';
import { styles as useStyles } from '../../utils/styles';

type Release = {
  id: number;
  html_url: string;
  tag_name: string;
  prerelease: boolean;
  name: string;
};

type Props = {
  /** @deprecated The entity is now grabbed from context instead */
  entity?: Entity;
};

const ReleasesCard = (_props: Props) => {
  const classes = useStyles();
  const { entity } = useEntity();

  const { owner, repo } = useProjectEntity(entity);
  const { value, loading, error } = useRequest(entity, 'releases', 0, 5);
  const { hostname } = useEntityGithubScmIntegration(entity);

  const projectAlert = isGithubInsightsAvailable(entity);
  if (!projectAlert) {
    return (
      <MissingAnnotationEmptyState annotation={GITHUB_INSIGHTS_ANNOTATION} />
    );
  }

  if (loading) {
    return <Progress />;
  } else if (error) {
    return error?.message.includes('Not Found') ? (
      <Alert severity="error">
        There was an issue with fetching this information. Check that you are
        logged into GitHub if this is a private repository.
      </Alert>
    ) : (
      <Alert severity="error">{error?.message}</Alert>
    );
  }

  return value?.length && owner && repo ? (
    <InfoCard
      title="Releases"
      deepLink={{
        link: `//${hostname}/${owner}/${repo}/releases`,
        title: 'Releases',
        onClick: e => {
          e.preventDefault();
          window.open(`//${hostname}/${owner}/${repo}/releases`);
        },
      }}
      className={classes.infoCard}
    >
      <List>
        {value.map((release: Release) => (
          <ListItem className={classes.listItem} key={release.id}>
            <Link
              href={release.html_url}
              color="inherit"
              target="_blank"
              rel="noopener noreferrer"
            >
              <p className={classes.releaseTitle}>{release.name}</p>
              <LocalOfferOutlinedIcon
                fontSize="inherit"
                className={classes.releaseTagIcon}
              />{' '}
              {release.tag_name}
              {/* by {release.author.login} */}
            </Link>
            {release.prerelease && (
              <Chip color="primary" size="small" label="Pre-release" />
            )}
          </ListItem>
        ))}
      </List>
    </InfoCard>
  ) : (
    <></>
  );
};

export default ReleasesCard;
