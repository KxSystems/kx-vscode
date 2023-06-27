export enum DataSourceTypes {
  API,
  QSQL,
  SQL,
}

export interface DataSourceFiles {
  name: string;
  dataSource: {
    selectedType: DataSourceTypes;
    api: {
      params: string[];
      selectedApi: string;
    };
    qsql: {
      query: string;
      selectedTarget: string;
    };
    sql: {
      query: string;
    };
  };
}

export const defaultDataSourceFile: DataSourceFiles = {
  name: "DataSource",
  dataSource: {
    selectedType: DataSourceTypes.API,
    api: {
      params: [],
      selectedApi: "",
    },
    qsql: {
      query: "",
      selectedTarget: "",
    },
    sql: {
      query: "",
    },
  },
};
