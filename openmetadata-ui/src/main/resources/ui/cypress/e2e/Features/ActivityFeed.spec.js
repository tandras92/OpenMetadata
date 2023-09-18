/*
 *  Copyright 2023 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

// eslint-disable-next-line spaced-comment
/// <reference types="cypress" />

import {
  interceptURL,
  verifyResponseStatusCode,
  visitEntityDetailsPage,
} from '../../common/common';
import { createDescriptionTask } from '../../common/TaskUtils';
import { SEARCH_ENTITY_TABLE } from '../../constants/constants';

// eslint-disable-next-line spaced-comment
/// <reference types="cypress" />

const reactOnFeed = (feedSelector, reaction) => {
  cy.get(feedSelector).within(() => {
    cy.get('[data-testid="feed-actions"]').invoke('show');
    cy.get('[data-testid="feed-actions"]').within(() => {
      cy.get('[data-testid="add-reactions"]').click();
    });
  });
  cy.get('.ant-popover-inner-content')
    .should('be.visible')
    .then(() => {
      cy.get(
        `#reaction-popover [data-testid="reaction-button"][title="${reaction}"]`
      ).click();
    });
};

describe('Activity feed', () => {
  beforeEach(() => {
    cy.login();
    cy.get("[data-testid='welcome-screen-close-btn']").click();
  });

  it('Create feed', () => {
    interceptURL('GET', '/api/v1/permissions/*/name/*', 'entityPermission');
    interceptURL('GET', '/api/v1/feed/count?entityLink=*', 'activityFeed');
    interceptURL(
      'GET',
      '/api/v1/search/query?q=**teamType:Group&from=0&size=15&index=team_search_index',
      'getTeams'
    );
    interceptURL('GET', '/api/v1/users?*', 'getUsers');
    const value = SEARCH_ENTITY_TABLE.table_4;
    const OWNER = 'admin';
    interceptURL('PATCH', `/api/v1/${value.entity}/*`, 'patchOwner');

    visitEntityDetailsPage(
      value.term,
      value.serviceName,
      value.entity,
      undefined,
      value.entityType
    );
    verifyResponseStatusCode('@entityPermission', 200);
    verifyResponseStatusCode('@activityFeed', 200);

    cy.get('[data-testid="edit-owner"]').click();

    cy.get('.ant-tabs [id*=tab-users]').click();
    verifyResponseStatusCode('@getUsers', 200);

    interceptURL(
      'GET',
      `api/v1/search/query?q=*${encodeURI(OWNER)}*`,
      'searchOwner'
    );

    cy.get('[data-testid="owner-select-users-search-bar"]').type(OWNER);

    verifyResponseStatusCode('@searchOwner', 200);

    cy.get(`.ant-popover [title="${OWNER}"]`).click();
    verifyResponseStatusCode('@patchOwner', 200);
  });

  it('Feed widget should be visible', () => {
    cy.get('[data-testid="activity-feed-widget"]').as('feedWidget');
    cy.get('@feedWidget').should('be.visible');
    cy.get('@feedWidget').should('contain', 'All');
    cy.get('@feedWidget').should('contain', '@Mentions');
    cy.get('@feedWidget').should('contain', 'Tasks');
  });

  it('Feed widget should have some feeds', () => {
    cy.get(
      '[data-testid="activity-feed-widget"] [data-testid="message-container"]'
    ).should('have.length.gte', 1);
  });

  it('Emoji reaction on feed should be working fine', () => {
    // Assign reaction for latest feed
    [
      'thumbsUp',
      'thumbsDown',
      'laugh',
      'hooray',
      'confused',
      'heart',
      'eyes',
      'rocket',
    ].map((reaction) =>
      reactOnFeed(
        '[data-testid="activity-feed-widget"] [data-testid="message-container"]:first-child',
        reaction
      )
    );

    // Verify if reaction is working or not
    cy.get(
      '[data-testid="activity-feed-widget"] [data-testid="message-container"]:first-child'
    ).within(() => {
      ['🚀', '😕', '👀', '❤️', '🎉', '😄', '👎', '👍'].map((reaction) =>
        cy
          .get('[data-testid="feed-reaction-container"]')
          .should('contain', reaction)
      );
    });
  });

  it('Remove Emoji reaction from feed', () => {
    // remove reaction for latest feed
    [
      'thumbsUp',
      'thumbsDown',
      'laugh',
      'hooray',
      'confused',
      'heart',
      'eyes',
      'rocket',
    ].map((reaction) =>
      reactOnFeed(
        '[data-testid="activity-feed-widget"] [data-testid="message-container"]:first-child',
        reaction
      )
    );

    // Verify if reaction is working or not
    cy.get('[data-testid="message-container"]')
      .eq(1)
      .find('[data-testid="feed-reaction-container"]')
      .should('not.exist');
  });

  it('User should be able to reply to feed', () => {
    interceptURL('GET', '/api/v1/feed/*', 'fetchFeed');
    cy.get(
      '[data-testid="activity-feed-widget"] [data-testid="message-container"]:first-child'
    ).within(() => {
      cy.get('[data-testid="feed-actions"]').invoke('show');
      cy.get('[data-testid="feed-actions"]').within(() => {
        cy.get('[data-testid="add-reply"]').click();
      });
    });
    verifyResponseStatusCode('@fetchFeed', 200);

    interceptURL('POST', '/api/v1/feed/*/posts', 'postReply');
    interceptURL(
      'GET',
      '/api/v1/search/suggest?q=aa&index=user_search_index%2Cteam_search_index',
      'suggestUser'
    );
    interceptURL(
      'GET',
      // eslint-disable-next-line max-len
      '/api/v1/search/suggest?q=dim_add&index=dashboard_search_index%2Ctable_search_index%2Ctopic_search_index%2Cpipeline_search_index%2Cmlmodel_search_index%2Ccontainer_search_index%2Cglossary_search_index%2Ctag_search_index',
      'suggestAsset'
    );

    cy.get('[data-testid="editor-wrapper"]')
      .scrollIntoView()
      .should('be.visible');
    cy.get(
      '[data-testid="editor-wrapper"] [contenteditable="true"].ql-editor'
    ).as('editor');
    cy.get('@editor').click();
    cy.get('@editor').type('Cypress has replied here. Thanks! @aaron_johnson0');

    verifyResponseStatusCode('@suggestUser', 200);
    cy.get('[data-value="@aaron_johnson0"]').click();
    cy.get('@editor').type(' #dim_add');
    verifyResponseStatusCode('@suggestAsset', 200);
    cy.get('[data-value="#table/dim_address"]').click();

    cy.get('[data-testid="send-button"]')
      .should('be.visible')
      .and('not.be.disabled');
    cy.get('[data-testid="send-button"]').click();

    verifyResponseStatusCode('@postReply', 201);

    cy.get('[data-testid="replies"] .activity-feed-card.activity-feed-card-v1')
      .children('.ant-row')
      .last()
      .invoke('text')
      .should(
        'eq',
        'Cypress has replied here. Thanks! ﻿@aaron_johnson0﻿ ﻿#table/dim_address\n'
      );

    cy.get('[data-testid="closeDrawer"]').click();

    cy.get(
      '[data-testid="activity-feed-widget"] [data-testid="message-container"]:first-child'
    ).within(() => {
      cy.get('[data-testid="thread-count"]').should('contain', 1);
    });
  });

  it('Mention should work for the feed reply', () => {
    interceptURL('GET', '/api/v1/feed/*', 'fetchFeed');
    interceptURL(
      'GET',
      '/api/v1/feed?filterType=MENTIONS&userId=*',
      'mentionsFeed'
    );
    cy.get(
      '[data-testid="activity-feed-widget"] [data-testid="message-container"]:first-child'
    ).within(() => {
      cy.get('[data-testid="feed-actions"]').invoke('show');
      cy.get('[data-testid="feed-actions"]').within(() => {
        cy.get('[data-testid="add-reply"]').click();
      });
    });
    verifyResponseStatusCode('@fetchFeed', 200);

    interceptURL('POST', '/api/v1/feed/*/posts', 'postReply');
    interceptURL(
      'GET',
      '/api/v1/search/suggest?q=aa&index=user_search_index%2Cteam_search_index',
      'suggestUser'
    );

    cy.get('[data-testid="editor-wrapper"]')
      .scrollIntoView()
      .should('be.visible');
    cy.get(
      '[data-testid="editor-wrapper"] [contenteditable="true"].ql-editor'
    ).as('editor');
    cy.get('@editor').click();
    cy.get('@editor').type('Can you resolve this thread for me? @admin');
    cy.get('[data-value="@admin"]').click();

    cy.get('[data-testid="send-button"]')
      .should('be.visible')
      .and('not.be.disabled');
    cy.get('[data-testid="send-button"]').click();

    verifyResponseStatusCode('@postReply', 201);

    cy.get('[data-testid="closeDrawer"]').click();

    let feedText1 = '';
    cy.get(
      '[data-testid="activity-feed-widget"] [data-testid="message-container"]:first-child [data-testid="viewer-container"]'
    )
      .invoke('text')
      .then((text) => (feedText1 = text));

    cy.get('[data-testid="activity-feed-widget"]')
      .contains('@Mentions')
      .click();
    verifyResponseStatusCode('@mentionsFeed', 200);
    // Verify mentioned thread should be there int he mentioned tab
    cy.get(
      '[data-testid="message-container"] > .activity-feed-card [data-testid="viewer-container"]'
    )
      .invoke('text')
      .then((text) => expect(text).to.contain(feedText1));
  });

  it('Assigned task should appear to task tab', () => {
    cy.get('[data-testid="activity-feed-widget"]').contains('Tasks').click();

    const value = SEARCH_ENTITY_TABLE.table_1;
    interceptURL('GET', `/api/v1/${value.entity}/name/*`, 'getEntityDetails');

    visitEntityDetailsPage(value.term, value.serviceName, value.entity);

    cy.get('[data-testid="request-description"]').click();

    verifyResponseStatusCode('@getEntityDetails', 200);

    interceptURL('GET', '/api/v1/search/suggest?q=*', 'suggestApi');

    // create description task
    createDescriptionTask({ ...value, assignee: 'admin' });

    cy.clickOnLogo();

    cy.get('[data-testid="activity-feed-widget"]').contains('Tasks').click();

    cy.get(
      '[data-testid="activity-feed-widget"] [data-testid="no-data-placeholder"]'
    ).should('not.exist');

    cy.get('[data-testid="message-container"]')
      .invoke('text')
      .then((textContent) => {
        const matches = textContent.match(/#(\d+) UpdateDescriptionfortable/);

        expect(matches).to.not.be.null;
      });

    cy.get(`[data-testid="assignee-admin"]`).should('be.visible');
  });
});
