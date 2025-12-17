import { MetaObject } from "../../../src/models/meta";

export const getMetaResponse: MetaObject = {
  header: {
    ac: "0",
    agg: ":127.0.0.1:5070",
    ai: "",
    api: ".kxi.getMeta",
    client: ":127.0.0.1:5050",
    corr: "CorrHash",
    http: "json",
    logCorr: "logCorrHash",
    protocol: "gw",
    rc: "0",
    rcvTS: "2099-05-22T11:06:33.650000000",
    retryCount: "0",
    to: "2099-05-22T11:07:33.650000000",
    userID: "dummyID",
    userName: "testUser",
  },
  payload: {
    rc: [
      {
        api: 3,
        agg: 1,
        assembly: 1,
        schema: 1,
        rc: "dummy-rc",
        labels: [{ kxname: "dummy-assembly" }],
        started: "2023-10-04T17:20:57.659088747",
      },
    ],
    dap: [],
    api: [],
    agg: [
      {
        aggFn: ".sgagg.aggFnDflt",
        custom: false,
        full: true,
        metadata: {
          description: "dummy desc.",
          params: [{ description: "dummy desc." }],
          return: { description: "dummy desc." },
          misc: {},
        },
        procs: [],
      },
    ],
    assembly: [
      {
        assembly: "dummy-assembly",
        kxname: "dummy-assembly",
        tbls: ["dummyTbl"],
      },
    ],
    schema: [],
  },
};

export const getMetaNoAssemblyResponse: MetaObject = {
  header: {
    ac: "0",
    agg: ":127.0.0.1:5070",
    ai: "",
    api: ".kxi.getMeta",
    client: ":127.0.0.1:5050",
    corr: "CorrHash",
    http: "json",
    logCorr: "logCorrHash",
    protocol: "gw",
    rc: "0",
    rcvTS: "2099-05-22T11:06:33.650000000",
    retryCount: "0",
    to: "2099-05-22T11:07:33.650000000",
    userID: "dummyID",
    userName: "testUser",
  },
  payload: {
    rc: [
      {
        api: 3,
        agg: 1,
        assembly: 1,
        schema: 1,
        rc: "dummy-rc",
        labels: [{ kxname: "dummy-assembly" }],
        started: "2023-10-04T17:20:57.659088747",
      },
    ],
    dap: [],
    api: [],
    agg: [
      {
        aggFn: ".sgagg.aggFnDflt",
        custom: false,
        full: true,
        metadata: {
          description: "dummy desc.",
          params: [{ description: "dummy desc." }],
          return: { description: "dummy desc." },
          misc: {},
        },
        procs: [],
      },
    ],
    assembly: [],
    schema: [],
  },
};
