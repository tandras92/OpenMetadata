/*
 *  Copyright 2022 Collate.
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

import { Button, Menu, Space } from 'antd';
import type { ButtonType } from 'antd/lib/button';
import classNames from 'classnames';
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import NextPrevious from 'components/common/next-previous/NextPrevious';
import { PagingHandlerParams } from 'components/common/next-previous/NextPrevious.interface';
import PageLayoutV1 from 'components/containers/PageLayoutV1';
import ExploreSearchCard from 'components/ExploreV1/ExploreSearchCard/ExploreSearchCard';
import Loader from 'components/Loader/Loader';
import {
  SearchedDataProps,
  SourceType,
} from 'components/searched-data/SearchedData.interface';
import { AssetsFilterOptions } from 'constants/Assets.constants';
import { PAGE_SIZE } from 'constants/constants';
import { GLOSSARIES_DOCS } from 'constants/docs.constants';
import { ERROR_PLACEHOLDER_TYPE } from 'enums/common.enum';
import { EntityType } from 'enums/entity.enum';
import { SearchIndex } from 'enums/search.enum';
import { t } from 'i18next';
import { find, startCase } from 'lodash';
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import { useParams } from 'react-router-dom';
import { searchData } from 'rest/miscAPI';
import { getCountBadge } from 'utils/CommonUtils';
import { showErrorToast } from 'utils/ToastUtils';
import './assets-tabs.less';
import {
  AssetsOfEntity,
  AssetsTabsProps,
  AssetsViewType,
} from './AssetsTabs.interface';

export interface AssetsTabRef {
  refreshAssets: () => void;
  closeSummaryPanel: () => void;
}

const AssetsTabs = forwardRef(
  (
    {
      permissions,
      onAssetClick,
      isSummaryPanelOpen,
      onAddAsset,
      type = AssetsOfEntity.GLOSSARY,
      viewType = AssetsViewType.PILLS,
    }: AssetsTabsProps,
    ref
  ) => {
    const [itemCount, setItemCount] = useState<Record<EntityType, number>>({
      table: 0,
      pipeline: 0,
      mlmodel: 0,
      container: 0,
      topic: 0,
      dashboard: 0,
      glossaryTerm: 0,
    } as Record<EntityType, number>);
    const [activeFilter, setActiveFilter] = useState<SearchIndex>(
      SearchIndex.TABLE
    );
    const { glossaryName, fqn } =
      useParams<{ glossaryName: string; fqn: string }>();
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<SearchedDataProps['data']>([]);
    const [total, setTotal] = useState<number>(0);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [selectedCard, setSelectedCard] = useState<SourceType>();

    const tabs = useMemo(() => {
      return AssetsFilterOptions.map((option) => {
        return {
          label: (
            <div className="d-flex justify-between">
              <Space align="center" size="small">
                {option.label}
              </Space>

              <span>
                {getCountBadge(
                  itemCount[option.key],
                  '',
                  activeFilter === option.value
                )}
              </span>
            </div>
          ),
          key: option.value,
          value: option.value,
        };
      });
    }, [itemCount]);

    const queryParam = useMemo(() => {
      if (type === AssetsOfEntity.DOMAIN) {
        return `(domain.fullyQualifiedName:"${fqn}")`;
      } else if (type === AssetsOfEntity.DATA_PRODUCT) {
        return `(dataProducts.fullyQualifiedName:"${fqn}")`;
      } else {
        return `(tags.tagFQN:"${glossaryName}")`;
      }
    }, [type, glossaryName, fqn]);

    const searchIndexes = useMemo(() => {
      const indexesToFetch = [
        SearchIndex.TABLE,
        SearchIndex.TOPIC,
        SearchIndex.DASHBOARD,
        SearchIndex.PIPELINE,
        SearchIndex.MLMODEL,
        SearchIndex.CONTAINER,
      ];
      if (type !== AssetsOfEntity.GLOSSARY) {
        indexesToFetch.push(SearchIndex.GLOSSARY);
      }

      return indexesToFetch;
    }, [type]);

    const fetchCountsByEntity = () => {
      Promise.all(
        searchIndexes.map((index) =>
          searchData('', 0, 0, queryParam, '', '', index)
        )
      )
        .then(
          ([
            tableResponse,
            topicResponse,
            dashboardResponse,
            pipelineResponse,
            mlmodelResponse,
            containerResponse,
            glossaryResponse,
          ]) => {
            const counts = {
              [EntityType.TOPIC]: topicResponse.data.hits.total.value,
              [EntityType.TABLE]: tableResponse.data.hits.total.value,
              [EntityType.DASHBOARD]: dashboardResponse.data.hits.total.value,
              [EntityType.PIPELINE]: pipelineResponse.data.hits.total.value,
              [EntityType.MLMODEL]: mlmodelResponse.data.hits.total.value,
              [EntityType.CONTAINER]: containerResponse.data.hits.total.value,
              [EntityType.GLOSSARY_TERM]:
                type !== AssetsOfEntity.GLOSSARY
                  ? glossaryResponse.data.hits.total.value
                  : 0,
            };

            setItemCount(counts as Record<EntityType, number>);

            find(counts, (count, key) => {
              if (count > 0) {
                const option = AssetsFilterOptions.find((el) => el.key === key);
                if (option) {
                  setActiveFilter(option.value);
                }

                return true;
              }

              return false;
            });
          }
        )
        .catch((err) => {
          showErrorToast(err);
        })
        .finally(() => setIsLoading(false));
    };

    useEffect(() => {
      fetchCountsByEntity();

      return () => {
        onAssetClick && onAssetClick(undefined);
      };
    }, []);

    const fetchAssets = useCallback(
      async ({
        index = activeFilter,
        page = 1,
      }: {
        index?: SearchIndex;
        page?: number;
      }) => {
        try {
          const res = await searchData(
            '',
            page,
            PAGE_SIZE,
            queryParam,
            '',
            '',
            index
          );

          // Extract useful details from the Response
          const totalCount = res?.data?.hits?.total.value ?? 0;
          const hits = res?.data?.hits?.hits;

          // Find EntityType for selected searchIndex
          const entityType = AssetsFilterOptions.find(
            (f) => f.value === activeFilter
          )?.label;

          // Update states
          setTotal(totalCount);
          entityType &&
            setItemCount((prevCount) => ({
              ...prevCount,
              [entityType]: totalCount,
            }));
          setData(hits as SearchedDataProps['data']);

          // Select first card to show summary right panel
          hits[0] && setSelectedCard(hits[0]._source as SourceType);
        } catch (_) {
          // Nothing here
        }
      },
      [activeFilter, currentPage]
    );

    const assetListing = useMemo(
      () =>
        data.length ? (
          <div className="assets-data-container">
            {data.map(({ _source, _id = '' }, index) => (
              <ExploreSearchCard
                className={classNames(
                  'm-b-sm cursor-pointer',
                  selectedCard?.id === _source.id ? 'highlight-card' : ''
                )}
                handleSummaryPanelDisplay={setSelectedCard}
                id={_id}
                key={index}
                showTags={false}
                source={_source}
              />
            ))}
            {total > PAGE_SIZE && data.length > 0 && (
              <NextPrevious
                isNumberBased
                currentPage={currentPage}
                pageSize={PAGE_SIZE}
                paging={{ total }}
                pagingHandler={({ currentPage }: PagingHandlerParams) =>
                  setCurrentPage(currentPage)
                }
              />
            )}
          </div>
        ) : (
          <div className="m-t-xlg">
            <ErrorPlaceHolder
              doc={GLOSSARIES_DOCS}
              heading={t('label.asset')}
              permission={permissions.Create}
              type={ERROR_PLACEHOLDER_TYPE.CREATE}
              onClick={onAddAsset}
            />
          </div>
        ),
      [data, total, currentPage, selectedCard, setSelectedCard]
    );

    const assetsHeader = useMemo(() => {
      if (viewType === AssetsViewType.PILLS) {
        return AssetsFilterOptions.map((option) => {
          const buttonStyle =
            activeFilter === option.value
              ? {
                  ghost: true,
                  type: 'primary' as ButtonType,
                  style: { background: 'white' },
                }
              : {};

          return itemCount[option.key] > 0 ? (
            <Button
              {...buttonStyle}
              className="m-r-sm m-b-sm"
              key={option.value}
              onClick={() => {
                setCurrentPage(1);
                setActiveFilter(option.value);
              }}>
              {startCase(option.label)}{' '}
              <span className="p-l-xs">
                {getCountBadge(
                  itemCount[option.key],
                  '',
                  activeFilter === option.value
                )}
              </span>
            </Button>
          ) : null;
        });
      } else {
        return (
          <Menu
            className="p-t-sm"
            items={tabs}
            selectedKeys={[activeFilter]}
            onClick={(value) => {
              setCurrentPage(1);
              setActiveFilter(value.key as SearchIndex);
              setSelectedCard(undefined);
            }}
          />
        );
      }
    }, [viewType, activeFilter, currentPage, tabs, itemCount]);

    const layout = useMemo(() => {
      if (viewType === AssetsViewType.PILLS) {
        return (
          <>
            {assetsHeader}
            {assetListing}
          </>
        );
      } else {
        return (
          <PageLayoutV1 leftPanel={assetsHeader} pageTitle="">
            {assetListing}
          </PageLayoutV1>
        );
      }
    }, [viewType, assetsHeader, assetListing, selectedCard]);

    useEffect(() => {
      fetchAssets({ index: activeFilter, page: currentPage });
    }, [activeFilter, currentPage]);

    useImperativeHandle(ref, () => ({
      refreshAssets() {
        fetchAssets({});
        fetchCountsByEntity();
      },
      closeSummaryPanel() {
        setSelectedCard(undefined);
      },
    }));

    useEffect(() => {
      if (onAssetClick) {
        onAssetClick(selectedCard ? { details: selectedCard } : undefined);
      }
    }, [selectedCard, onAssetClick]);

    useEffect(() => {
      if (!isSummaryPanelOpen) {
        setSelectedCard(undefined);
      }
    }, [isSummaryPanelOpen]);

    if (isLoading) {
      return <Loader />;
    }

    return (
      <div
        className={classNames(
          'assets-tab-container',
          viewType === AssetsViewType.PILLS ? 'p-md' : ''
        )}
        data-testid="table-container">
        {layout}
      </div>
    );
  }
);

export default AssetsTabs;
