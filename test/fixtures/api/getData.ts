import { GetDataObjectPayload } from "../../../src/models/data";

export const getDataResponse: GetDataObjectPayload = {
  results: {
    count: 2,
    columns: [
      {
        name: "time",
        type: "timestamps",
        values: [
          "2025.01.01D00:00:00.000000000",
          "2025.01.01D00:00:00.000000000",
        ],
        order: [0, 1],
      },
      { name: "val", type: "ints", values: ["2", "3"], order: [0, 1] },
    ],
  },
  error: "",
};

export const getDataIntResponse: GetDataObjectPayload = {
  results: {
    count: 2,
    columns: [
      { name: "a", type: "ints", values: ["1", "3", "5"], order: [0, 1, 2] },
      { name: "b", type: "ints", values: ["2", "4", "6"], order: [0, 1, 2] },
    ],
  },
  error: "",
};
