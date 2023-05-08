import { MetaResult } from "./metaResult";

export type QueryResult = {
  result: boolean;
  type: number;
  keys: string[];
  meta: MetaResult[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
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
