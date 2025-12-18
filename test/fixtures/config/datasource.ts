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
