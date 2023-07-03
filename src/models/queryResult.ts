export type QueryResult = {
  result: string;
  errored: boolean;
  error: string;
  backtrace: {
    name: string;
    text: string;
    index: number;
  }[];
};

export enum QueryResultType {
  Text,
  JSON,
  Bytes,
  Error,
}

export const queryConstants = {
  error: "!@#ERROR^&*%-",
};
