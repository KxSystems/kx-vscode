import { MetaResult } from "./metaResult";

export type QueryResult = {
  result: string;
  errored: boolean;
  error: string;
  keys: string[];
  meta: MetaResult[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
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
