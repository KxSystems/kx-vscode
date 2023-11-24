/*
 * Copyright (c) 1998-2023 Kx Systems Inc.
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

/* eslint @typescript-eslint/no-explicit-any: 0 */

import "../fixtures";
import * as assert from "assert";
import * as sinon from "sinon";
import { DataSourceMessage } from "../../src/models/messages";
import { MetaObjectPayload } from "../../src/models/meta";
import { createDefaultDataSourceFile } from "../../src/models/dataSource";
import { KdbDataSourceView } from "../../src/webview/components/kdbDataSourceView";

describe("KdbDataSourceView", () => {
  let view: KdbDataSourceView;

  beforeEach(async () => {
    view = new KdbDataSourceView();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("connectedCallback", () => {
    it("should add message event listener", () => {
      let cb: any;
      sinon
        .stub(global.window, "addEventListener")
        .value((event: string, listener: any) => {
          if (event === "message") {
            cb = listener;
          }
        });
      view.connectedCallback();
      const dataSourceFile = createDefaultDataSourceFile();
      dataSourceFile.dataSource.api.optional = {
        filled: false,
        temporal: false,
        startTS: "",
        endTS: "",
        filters: [],
        labels: [],
        sorts: [],
        aggs: [],
        groups: [],
      };
      const message: DataSourceMessage = {
        isInsights: true,
        insightsMeta: <MetaObjectPayload>{
          dap: {},
        },
        dataSourceName: "test",
        dataSourceFile,
      };
      const event = {
        data: message,
      };
      cb(event);
      assert.strictEqual(view.isInsights, true);
      assert.strictEqual(view.isMetaLoaded, true);
    });
  });

  describe("disconnectedCallback", () => {
    it("should remove message event listener", () => {
      let result = false;
      sinon
        .stub(global.window, "removeEventListener")
        .value((event: string) => {
          if (event === "message") {
            result = true;
          }
        });
      view.disconnectedCallback();
      assert.strictEqual(result, true);
    });
  });
});
