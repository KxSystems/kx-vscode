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
