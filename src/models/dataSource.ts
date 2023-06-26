export enum DataSourceTypes {
  API,
  QSQL,
  SQL,
}

export interface DataSourceFiles {
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
}

export const defaultDataSourceFile: DataSourceFiles = {
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
};
