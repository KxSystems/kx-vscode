/*
 * Copyright (c) 1998-2025 KX Systems Inc.
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

import * as assert from "assert";
import * as sinon from "sinon";

import {
  createDefaultDataSourceFile,
  DataSourceFiles,
  DataSourceTypes,
} from "../../../src/models/dataSource";
import * as dataSourceUtils from "../../../src/utils/dataSource";
import * as notificationUtils from "../../../src/utils/notifications";
import { MessageKind } from "../../../src/utils/notifications";
import * as queryUtils from "../../../src/utils/queryUtils";
import * as requestBodyUtils from "../../../src/utils/requestBody";
import * as sharedUtils from "../../../src/utils/shared";

import { ext } from "../../../src/extensionVariables";
import * as udaUtils from "../../../src/utils/uda";

describe("requestBody", () => {
  const dummyDS = createDefaultDataSourceFile();
  dummyDS.dataSource.api.selectedApi = "sampleApi";
  dummyDS.dataSource.api.table = "sampleTable";
  dummyDS.dataSource.api.startTS = "2023.01.01D00:00:00.000000000";
  dummyDS.dataSource.api.endTS = "2023.01.31D23:59:59.999999999";
  dummyDS.dataSource.qsql.selectedTarget = "sampleTarget";
  dummyDS.dataSource.qsql.query = "select from sampleTable";
  dummyDS.dataSource.sql.query = "select * from sampleTable";
  dummyDS.dataSource.uda = {
    name: "sampleUDA",
    description: "sample UDA",
    params: [
      {
        name: "param1",
        description: "sample param",
        isReq: true,
        type: 1,
        value: "sample value",
      },
    ],
    return: { type: [], description: "" },
  };
  describe("scratchpad", () => {
    describe("generateScratchpadQueryReqBody", () => {
      afterEach(() => {
        ext.isResultsTabVisible = false;
      });

      it("should return return format structuredText when isNotebook is true", () => {
        const result = requestBodyUtils.generateScratchpadQueryReqBody(
          "sample expression",
          undefined,
          undefined,
          true,
        );
        assert.strictEqual(result.returnFormat, "structuredText");
      });

      it("should return return format structuredText when isNoterbook is false and resultsTabVisible is true", () => {
        ext.isResultsTabVisible = true;
        const result = requestBodyUtils.generateScratchpadQueryReqBody(
          "sample expression",
          undefined,
          undefined,
          false,
        );
        assert.strictEqual(result.returnFormat, "structuredText");
      });

      it("should return return format structuredText when isNoterbook is false and resultsTabVisible is true", () => {
        const result = requestBodyUtils.generateScratchpadQueryReqBody(
          "sample expression",
          undefined,
          undefined,
          undefined,
        );
        assert.strictEqual(result.returnFormat, "text");
      });

      it("should return language python when isPython is true", () => {
        const result = requestBodyUtils.generateScratchpadQueryReqBody(
          "sample expression",
          undefined,
          true,
          undefined,
        );
        assert.strictEqual(result.language, "python");
      });
    });

    describe("selectAndGenerateScratchpadImportReqBody", () => {
      let sampleDS = dummyDS;
      beforeEach(() => {
        sampleDS = dummyDS;
      });

      it("should return ScratchpadAPIImportReqBody when selectedType is API and query is DS files", async () => {
        sampleDS.dataSource.selectedType = DataSourceTypes.API;
        const result =
          await requestBodyUtils.selectAndGenerateScratchpadImportReqBody(
            sampleDS,
            sampleDS.dataSource.selectedType,
            "varSample",
            "connSample",
            "targetSample",
          );

        assert.ok(result);
        assert.strictEqual(result.language, "q");
        assert.strictEqual(result.output, "varSample");
        assert.strictEqual(result.returnFormat, "text");
        assert.strictEqual(result.sampleFn, "first");
        assert.strictEqual(result.sampleSize, 10000);
        assert.ok(result.params);
      });

      it("should return ScratchpadAPIImportReqBody when selectedType is UDA and query is DS files", async () => {
        sampleDS.dataSource.selectedType = DataSourceTypes.UDA;
        const result =
          await requestBodyUtils.selectAndGenerateScratchpadImportReqBody(
            dummyDS,
            sampleDS.dataSource.selectedType,
            "varSample",
            "connSample",
            "targetSample",
          );

        assert.ok(result);
        assert.strictEqual(result.output, "varSample");
        assert.strictEqual(result.returnFormat, "text");
      });

      it("should return undefined when query is empty ", async () => {
        const result =
          await requestBodyUtils.selectAndGenerateScratchpadImportReqBody(
            "",
            DataSourceTypes.QSQL,
            "varSample",
            "connSample",
            "targetSample",
          );
        assert.strictEqual(result, undefined);
      });

      it("should return QSQLImportReqBody when selectedType is QSQL and query is string", async () => {
        const result =
          await requestBodyUtils.selectAndGenerateScratchpadImportReqBody(
            "select from sampleTable",
            DataSourceTypes.QSQL,
            "varSample",
            "connSample",
            "targetSample",
          );

        assert.ok(result);
        assert.strictEqual(result.language, "q");
        assert.strictEqual(result.output, "varSample");
        assert.strictEqual(result.returnFormat, "text");
        assert.strictEqual(result.sampleFn, "first");
        assert.strictEqual(result.sampleSize, 10000);
        assert.ok(result.params);
      });

      it("should return SQLImportReqBody when selectedType is SQL and query is string", async () => {
        const result =
          await requestBodyUtils.selectAndGenerateScratchpadImportReqBody(
            "select * from sampleTable",
            DataSourceTypes.SQL,
            "varSample",
            "connSample",
            "targetSample",
          );

        assert.ok(result);
        assert.strictEqual(result.language, "sql");
        assert.strictEqual(result.output, "varSample");
        assert.strictEqual(result.returnFormat, "text");
        assert.strictEqual(result.sampleFn, "first");
        assert.strictEqual(result.sampleSize, 10000);
        assert.ok(result.params);
      });
    });

    describe("generateScratchpadSQLImportReqBody", () => {
      it("should return a valid ScratchpadImportSQLReqBody", () => {
        const result = requestBodyUtils.generateScratchpadSQLImportReqBody(
          "select * from sampleTable",
          "varSample",
        );

        assert.ok(result);
        assert.strictEqual(result.language, "sql");
        assert.strictEqual(result.output, "varSample");
        assert.strictEqual(result.returnFormat, "text");
        assert.strictEqual(result.sampleFn, "first");
        assert.strictEqual(result.sampleSize, 10000);
        assert.ok(result.params);
      });
    });

    describe("generateScratchpadQSQLImportReqBody", () => {
      it("should return a valid ScratchpadImportQSQLReqBody", () => {
        const result = requestBodyUtils.generateScratchpadQSQLImportReqBody(
          "select from sampleTable",
          "targetSample",
          "varSample",
          false,
        );

        assert.ok(result);
        assert.strictEqual(result.language, "q");
        assert.strictEqual(result.output, "varSample");
        assert.strictEqual(result.returnFormat, "text");
        assert.strictEqual(result.sampleFn, "first");
        assert.strictEqual(result.sampleSize, 10000);
        assert.ok(result.params);
        assert.ok(result.params.scope);
      });
    });

    describe("generateScratchpadAPIImportReqBody", () => {
      let sampleDS: DataSourceFiles;
      let convertTimeToTimestampStub: sinon.SinonStub;

      beforeEach(() => {
        sampleDS = JSON.parse(JSON.stringify(dummyDS));
        convertTimeToTimestampStub = sinon
          .stub(dataSourceUtils, "convertTimeToTimestamp")
          .returnsArg(0);
      });

      afterEach(() => {
        convertTimeToTimestampStub.restore();
      });

      it("should return a valid ScratchpadImportAPIReqBody with basic parameters", () => {
        const result = requestBodyUtils.generateScratchpadAPIImportReqBody(
          sampleDS,
          "varSample",
        );

        assert.ok(result);
        assert.strictEqual(result.language, "q");
        assert.strictEqual(result.output, "varSample");
        assert.strictEqual(result.returnFormat, "text");
        assert.strictEqual(result.sampleFn, "first");
        assert.strictEqual(result.sampleSize, 10000);
        assert.ok(result.params);
        assert.strictEqual(result.params.table, "sampleTable");
        assert.strictEqual(
          result.params.startTS,
          "2023.01.01D00:00:00.000000000",
        );
        assert.strictEqual(
          result.params.endTS,
          "2023.01.31D23:59:59.999999999",
        );
      });

      it("should add optional parameters when they are defined", () => {
        sampleDS.dataSource.api.fill = "forward";
        sampleDS.dataSource.api.temporality = "snapshot";
        sampleDS.dataSource.api.filter = ["col1", "=", "value1"];
        sampleDS.dataSource.api.groupBy = ["col1"];
        sampleDS.dataSource.api.agg = ["sum", "col2"];
        sampleDS.dataSource.api.sortCols = ["col1"];
        sampleDS.dataSource.api.slice = ["0", "100"];
        sampleDS.dataSource.api.labels = ["env", "prod"];

        const result = requestBodyUtils.generateScratchpadAPIImportReqBody(
          sampleDS,
          "varSample",
        );

        assert.strictEqual(result.params.fill, "forward");
        assert.strictEqual(result.params.temporality, "snapshot");
        assert.deepStrictEqual(result.params.filter, ["col1", "=", "value1"]);
        assert.deepStrictEqual(result.params.groupBy, ["col1"]);
        assert.deepStrictEqual(result.params.agg, ["sum", "col2"]);
        assert.deepStrictEqual(result.params.sortCols, ["col1"]);
        assert.deepStrictEqual(result.params.slice, ["0", "100"]);
        assert.deepStrictEqual(result.params.labels, ["env", "prod"]);
      });

      it("should not add optional parameters when they are undefined", () => {
        sampleDS.dataSource.api.fill = undefined;
        sampleDS.dataSource.api.temporality = undefined;
        sampleDS.dataSource.api.filter = undefined;
        sampleDS.dataSource.api.groupBy = undefined;
        sampleDS.dataSource.api.agg = undefined;
        sampleDS.dataSource.api.sortCols = undefined;
        sampleDS.dataSource.api.slice = undefined;
        sampleDS.dataSource.api.labels = undefined;
        const result = requestBodyUtils.generateScratchpadAPIImportReqBody(
          sampleDS,
          "varSample",
        );

        assert.ok(!result.params.fill);
        assert.ok(!result.params.temporality);
        assert.ok(!result.params.filter);
        assert.ok(!result.params.groupBy);
        assert.ok(!result.params.agg);
        assert.ok(!result.params.sortCols);
        assert.ok(!result.params.slice);
        assert.ok(!result.params.labels);
      });

      it("should not add optional parameters when they are empty strings", () => {
        sampleDS.dataSource.api.fill = "";
        sampleDS.dataSource.api.temporality = "";

        const result = requestBodyUtils.generateScratchpadAPIImportReqBody(
          sampleDS,
          "varSample",
        );

        assert.ok(!result.params.fill);
        assert.ok(!result.params.temporality);
      });

      it("should not add optional parameters when arrays are empty", () => {
        sampleDS.dataSource.api.filter = [];
        sampleDS.dataSource.api.groupBy = [];
        sampleDS.dataSource.api.agg = [];
        sampleDS.dataSource.api.sortCols = [];

        const result = requestBodyUtils.generateScratchpadAPIImportReqBody(
          sampleDS,
          "varSample",
        );

        assert.ok(!result.params.filter);
        assert.ok(!result.params.groupBy);
        assert.ok(!result.params.agg);
        assert.ok(!result.params.sortCols);
      });

      it("should add positive limit when rowCountLimit is set and isRowLimitLast is false", () => {
        sampleDS.dataSource.api.rowCountLimit = "100";
        sampleDS.dataSource.api.isRowLimitLast = false;

        const result = requestBodyUtils.generateScratchpadAPIImportReqBody(
          sampleDS,
          "varSample",
        );

        assert.strictEqual(result.params.limit, 100);
      });

      it("should add negative limit when rowCountLimit is set and isRowLimitLast is true", () => {
        sampleDS.dataSource.api.rowCountLimit = "50";
        sampleDS.dataSource.api.isRowLimitLast = true;

        const result = requestBodyUtils.generateScratchpadAPIImportReqBody(
          sampleDS,
          "varSample",
        );

        assert.strictEqual(result.params.limit, -50);
      });

      it("should not add limit when rowCountLimit is empty string", () => {
        sampleDS.dataSource.api.rowCountLimit = "";

        const result = requestBodyUtils.generateScratchpadAPIImportReqBody(
          sampleDS,
          "varSample",
        );

        assert.ok(!result.params.limit);
      });

      it("should not add limit when rowCountLimit is undefined", () => {
        sampleDS.dataSource.api.rowCountLimit = undefined;

        const result = requestBodyUtils.generateScratchpadAPIImportReqBody(
          sampleDS,
          "varSample",
        );

        assert.ok(!result.params.limit);
      });

      it("should call convertTimeToTimestamp for startTS and endTS", () => {
        requestBodyUtils.generateScratchpadAPIImportReqBody(
          sampleDS,
          "varSample",
        );

        assert.ok(convertTimeToTimestampStub.calledTwice);
        assert.ok(
          convertTimeToTimestampStub.calledWith(
            "2023.01.01D00:00:00.000000000",
          ),
        );
        assert.ok(
          convertTimeToTimestampStub.calledWith(
            "2023.01.31D23:59:59.999999999",
          ),
        );
      });
    });

    describe("generateScratchpadUDAImportReqBody", () => {
      let sampleDS: DataSourceFiles;
      let retrieveUDAtoCreateReqBodyStub: sinon.SinonStub;

      beforeEach(() => {
        sampleDS = JSON.parse(JSON.stringify(dummyDS));
        retrieveUDAtoCreateReqBodyStub = sinon.stub(
          udaUtils,
          "retrieveUDAtoCreateReqBody",
        );
      });

      afterEach(() => {
        retrieveUDAtoCreateReqBodyStub.restore();
      });

      it("should return a valid ScratchpadImportUDAReqBody with all properties", async () => {
        const mockUDABody = {
          params: { param1: "value1", param2: "value2" },
          parameterTypes: { param1: "string", param2: "int" },
          language: "q",
          name: "testUDA",
          sampleFn: "first",
          sampleSize: 5000,
        };
        retrieveUDAtoCreateReqBodyStub.resolves(mockUDABody);

        const result =
          await requestBodyUtils.generateScratchpadUDAImportReqBody(
            sampleDS,
            "udaVariable",
            "testConnection",
          );

        assert.ok(result);
        assert.strictEqual(result.output, "udaVariable");
        assert.strictEqual(result.returnFormat, "text");
        assert.deepStrictEqual(result.params, {
          param1: "value1",
          param2: "value2",
        });
        assert.deepStrictEqual(result.parameterTypes, {
          param1: "string",
          param2: "int",
        });
        assert.strictEqual(result.language, "q");
        assert.strictEqual(result.name, "testUDA");
        assert.strictEqual(result.sampleFn, "first");
        assert.strictEqual(result.sampleSize, 5000);
      });

      it("should call retrieveUDAtoCreateReqBody with correct parameters", async () => {
        const mockUDABody = {
          params: {},
          parameterTypes: {},
          language: "q",
          name: "sampleUDA",
          sampleFn: "first",
          sampleSize: 1000,
        };
        retrieveUDAtoCreateReqBodyStub.resolves(mockUDABody);

        await requestBodyUtils.generateScratchpadUDAImportReqBody(
          sampleDS,
          "testVar",
          "testConn",
        );

        assert.ok(retrieveUDAtoCreateReqBodyStub.calledOnce);
        assert.ok(
          retrieveUDAtoCreateReqBodyStub.calledWith(
            sampleDS.dataSource.uda,
            "testConn",
          ),
        );
      });

      it("should handle UDA with complex parameters", async () => {
        const mockUDABody = {
          params: {
            startDate: "2023-01-01",
            endDate: "2023-12-31",
            columns: ["col1", "col2"],
            filters: { active: true, type: "advanced" },
          },
          parameterTypes: {
            startDate: "date",
            endDate: "date",
            columns: "list",
            filters: "object",
          },
          language: "python",
          name: "complexUDA",
          sampleFn: "last",
          sampleSize: 2500,
        };
        retrieveUDAtoCreateReqBodyStub.resolves(mockUDABody);

        const result =
          await requestBodyUtils.generateScratchpadUDAImportReqBody(
            sampleDS,
            "complexVar",
            "prodConnection",
          );

        assert.ok(result);
        assert.strictEqual(result.output, "complexVar");
        assert.strictEqual(result.language, "python");
        assert.strictEqual(result.name, "complexUDA");
        assert.strictEqual(result.sampleFn, "last");
        assert.strictEqual(result.sampleSize, 2500);
        assert.deepStrictEqual(result.params.startDate, "2023-01-01");
        assert.deepStrictEqual(result.params.endDate, "2023-12-31");
        assert.deepStrictEqual(result.params.columns, ["col1", "col2"]);
        assert.deepStrictEqual(result.params.filters, {
          active: true,
          type: "advanced",
        });
      });

      it("should handle UDA with minimal parameters", async () => {
        const mockUDABody = {
          params: {},
          parameterTypes: {},
          language: "q",
          name: "minimalUDA",
          sampleFn: "first",
          sampleSize: 10000,
        };
        retrieveUDAtoCreateReqBodyStub.resolves(mockUDABody);

        const result =
          await requestBodyUtils.generateScratchpadUDAImportReqBody(
            sampleDS,
            "minVar",
            "devConnection",
          );

        assert.ok(result);
        assert.strictEqual(result.output, "minVar");
        assert.strictEqual(result.returnFormat, "text");
        assert.deepStrictEqual(result.params, {});
        assert.deepStrictEqual(result.parameterTypes, {});
        assert.strictEqual(result.language, "q");
        assert.strictEqual(result.name, "minimalUDA");
        assert.strictEqual(result.sampleFn, "first");
        assert.strictEqual(result.sampleSize, 10000);
      });

      it("should use the original dummyDS UDA configuration", async () => {
        const mockUDABody = {
          params: { param1: "sample value" },
          parameterTypes: { param1: "string" },
          language: "q",
          name: "sampleUDA",
          sampleFn: "first",
          sampleSize: 10000,
        };
        retrieveUDAtoCreateReqBodyStub.resolves(mockUDABody);

        const result =
          await requestBodyUtils.generateScratchpadUDAImportReqBody(
            sampleDS,
            "originalVar",
            "originalConn",
          );

        // Verify it called with the dummyDS UDA configuration
        const expectedUDAConfig = {
          name: "sampleUDA",
          description: "sample UDA",
          params: [
            {
              name: "param1",
              description: "sample param",
              isReq: true,
              type: 1,
              value: "sample value",
            },
          ],
          return: { type: [], description: "" },
        };

        assert.ok(
          retrieveUDAtoCreateReqBodyStub.calledWith(
            expectedUDAConfig,
            "originalConn",
          ),
        );
        assert.ok(result);
        assert.strictEqual(result.name, "sampleUDA");
      });

      it("should handle different variable names correctly", async () => {
        const mockUDABody = {
          params: { test: "value" },
          parameterTypes: { test: "string" },
          language: "q",
          name: "testUDA",
          sampleFn: "first",
          sampleSize: 1000,
        };
        retrieveUDAtoCreateReqBodyStub.resolves(mockUDABody);

        const variableNames = ["var1", "myVariable", "test_var", "Variable123"];

        for (const varName of variableNames) {
          const result =
            await requestBodyUtils.generateScratchpadUDAImportReqBody(
              sampleDS,
              varName,
              "testConn",
            );

          assert.ok(result);
          assert.strictEqual(result.output, varName);
        }
      });

      it("should preserve all udaBody properties in the result", async () => {
        const mockUDABody = {
          params: { customParam: "customValue" },
          parameterTypes: { customParam: "custom" },
          language: "python",
          name: "preserveTestUDA",
          sampleFn: "custom",
          sampleSize: 9999,
          extraProperty: "shouldBeIgnored", // This should not appear in result
        };
        retrieveUDAtoCreateReqBodyStub.resolves(mockUDABody);

        const result =
          await requestBodyUtils.generateScratchpadUDAImportReqBody(
            sampleDS,
            "preserveVar",
            "preserveConn",
          );

        assert.ok(result);
        assert.strictEqual(result.output, "preserveVar");
        assert.strictEqual(result.returnFormat, "text");
        assert.deepStrictEqual(result.params, { customParam: "customValue" });
        assert.deepStrictEqual(result.parameterTypes, {
          customParam: "custom",
        });
        assert.strictEqual(result.language, "python");
        assert.strictEqual(result.name, "preserveTestUDA");
        assert.strictEqual(result.sampleFn, "custom");
        assert.strictEqual(result.sampleSize, 9999);

        // Verify extraProperty is not included
        assert.ok(!("extraProperty" in result));
      });
    });
  });
});
