/*
 * Copyright (c) 1998-2026 KX Systems Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the
 * License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations under the License.
 */

import {
  DataSourceFiles,
  DataSourceTypes,
} from "../../../src/models/dataSource";

type DataSource = DataSourceFiles["dataSource"];

export function createMockDatasource(
  dataSourceOverrides?: Partial<DataSource>,
): DataSourceFiles {
  return {
    name: "mockDatasource",
    insightsNode: "mockNode",
    dataSource: {
      selectedType: DataSourceTypes.API,
      api: {
        selectedApi: "getData",
        table: "mock_table",
        startTS: "2023-09-10T09:30",
        endTS: "2023-09-19T12:30",
        fill: "",
        filter: [],
        groupBy: [],
        labels: [],
        slice: [],
        sortCols: [],
        temporality: "",
        agg: [],
      },
      qsql: {
        selectedTarget: "mock_table rdb",
        query: "mock QSQL query",
      },
      sql: {
        query: "mock SQL query",
      },
      uda: {
        name: "test query",
        description: "test description",
        params: [],
      },
      ...dataSourceOverrides,
    },
  };
}
