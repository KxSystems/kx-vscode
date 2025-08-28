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
import * as vscode from "vscode";

import { InsightsConnection } from "../../../src/classes/insightsConnection";
import { LocalConnection } from "../../../src/classes/localConnection";
import { ext } from "../../../src/extensionVariables";
import { MetaObjectPayload } from "../../../src/models/meta";
import {
  ParamFieldType,
  UDA,
  UDAParam,
  UDARequestBody,
} from "../../../src/models/uda";
import { ConnectionManagementService } from "../../../src/services/connectionManagerService";
import { InsightsNode } from "../../../src/services/kdbTreeProvider";
import * as UDAUtils from "../../../src/utils/uda";

describe("UDA", () => {
  describe("filterUDAParamsValidTypes", () => {
    it("should filter valid types", () => {
      const types = [1, 2, 3];
      const validTypes = new Set([1, 2]);

      sinon.stub(ext, "booleanTypes").value(validTypes);
      sinon.stub(ext, "numberTypes").value(validTypes);
      sinon.stub(ext, "textTypes").value(validTypes);
      sinon.stub(ext, "timestampTypes").value(validTypes);
      sinon.stub(ext, "jsonTypes").value(validTypes);

      const result = UDAUtils.filterUDAParamsValidTypes(types);

      assert.deepStrictEqual(result, [1, 2]);
    });
  });

  describe("getUDAParamType", () => {
    it("should return the correct type string", () => {
      const type = ParamFieldType.Boolean;
      const dataTypes = new Map([["1", "Boolean"]]);

      sinon.stub(ext.constants, "dataTypes").value(dataTypes);

      const result = UDAUtils.getUDAParamType(type);

      assert.strictEqual(result, "boolean");
    });

    it("should return the correct types string", () => {
      const type = [ParamFieldType.Boolean, ParamFieldType.Number];
      const dataTypes = new Map([
        ["1", "Boolean"],
        ["2", "Number"],
      ]);
      const expectedRes = ["boolean", "number"];

      sinon.stub(ext.constants, "dataTypes").value(dataTypes);

      const result = UDAUtils.getUDAParamType(type);

      assert.strictEqual(result.toString(), expectedRes.toString());
    });
  });

  describe("getUDAFieldType", () => {
    it("should return the correct field type", () => {
      const type = 1;

      sinon.stub(ext, "booleanTypes").value(new Set([1]));
      sinon.stub(ext, "numberTypes").value(new Set([2]));
      sinon.stub(ext, "textTypes").value(new Set([3]));
      sinon.stub(ext, "timestampTypes").value(new Set([4]));
      sinon.stub(ext, "jsonTypes").value(new Set([5]));

      const result = UDAUtils.getUDAFieldType(type);

      assert.strictEqual(result, ParamFieldType.Boolean);
    });

    it("should return MultiType for multiple types", () => {
      const types = [1, 2];

      sinon.stub(ext, "booleanTypes").value(new Set([1]));
      sinon.stub(ext, "numberTypes").value(new Set([2]));

      const result = UDAUtils.getUDAFieldType(types);

      assert.strictEqual(result, ParamFieldType.MultiType);
    });
  });

  describe("parseUDAParamTypes", () => {
    it("should return the correct param field type", () => {
      const type = 1;

      sinon.stub(ext, "booleanTypes").value(new Set([1]));
      sinon.stub(ext, "numberTypes").value(new Set([2]));
      sinon.stub(ext, "textTypes").value(new Set([3]));
      sinon.stub(ext, "timestampTypes").value(new Set([4]));
      sinon.stub(ext, "jsonTypes").value(new Set([5]));

      const result = UDAUtils.parseUDAParamTypes(type);

      assert.strictEqual(result, ParamFieldType.Boolean);
    });
  });

  describe("parseUDAParams", () => {
    it("should parse UDA params correctly", () => {
      const params: UDAParam[] = [
        {
          name: "param1",
          type: 1,
          isReq: true,
          description: "",
        },
        {
          name: "param2",
          type: 2,
          isReq: false,
          description: "",
        },
      ];

      sinon.stub(ext, "booleanTypes").value(new Set([1]));
      sinon.stub(ext, "numberTypes").value(new Set([2]));

      const result = UDAUtils.parseUDAParams(params);

      assert.strictEqual(result.length, 2);
      if (typeof result === "string") {
        return;
      }
      assert.strictEqual(result[0].fieldType, ParamFieldType.Boolean);
      assert.strictEqual(result[1].fieldType, ParamFieldType.Number);
    });

    it("should return Invalid if required param is invalid", () => {
      const params: UDAParam[] = [
        {
          name: "param1",
          type: 9999,
          isReq: true,
          description: "",
        },
      ];

      sinon.stub(ext, "booleanTypes").value(new Set([1]));
      sinon.stub(ext, "numberTypes").value(new Set([2]));

      const result = UDAUtils.parseUDAParams(params);

      assert.strictEqual(result, ParamFieldType.Invalid);
    });
  });

  describe("convertTypesToString", () => {
    let dataTypesStub: sinon.SinonStub;

    beforeEach(() => {
      dataTypesStub = sinon.stub(ext.constants, "dataTypes");
    });

    afterEach(() => {
      dataTypesStub.restore();
    });

    it("should convert types to strings", () => {
      const types = [1, 2];
      const dataTypes = new Map([
        ["1", "Boolean"],
        ["2", "Number"],
      ]);

      dataTypesStub.value(dataTypes);

      const result = UDAUtils.convertTypesToString(types);

      assert.deepStrictEqual(result, ["Boolean", "Number"]);
    });

    it("should convert type to string", () => {
      const types = [1];
      const dataTypes = new Map([["1", "Boolean"]]);

      dataTypesStub.value(dataTypes);

      const result = UDAUtils.convertTypesToString(types);

      assert.deepStrictEqual(result, ["Boolean"]);
    });

    it("should handle empty array", () => {
      const types: number[] = [];
      const dataTypes = new Map();

      dataTypesStub.value(dataTypes);

      const result = UDAUtils.convertTypesToString(types);

      assert.deepStrictEqual(result, []);
    });

    it("should return type as string if not found in dataTypes map", () => {
      const types = [3];
      const dataTypes = new Map([
        ["1", "Boolean"],
        ["2", "Number"],
      ]);

      dataTypesStub.value(dataTypes);

      const result = UDAUtils.convertTypesToString(types);

      assert.deepStrictEqual(result, ["3"]);
    });

    it("should handle mixed valid and invalid types", () => {
      const types = [1, 3];
      const dataTypes = new Map([["1", "Boolean"]]);

      dataTypesStub.value(dataTypes);

      const result = UDAUtils.convertTypesToString(types);

      assert.deepStrictEqual(result, ["Boolean", "3"]);
    });
  });

  describe("fixTimeAtUDARequestBody", () => {
    it("should append ':00.000000000' when parameterTypes[key] is [-12] and params[key] is a valid string", () => {
      const input: UDARequestBody = {
        language: "en",
        name: "test",
        parameterTypes: { timeKey: -12 },
        params: { timeKey: "12:30" },
        returnFormat: "json",
        sampleFn: "sample",
        sampleSize: 10,
      };
      const expected: UDARequestBody = {
        ...input,
        params: { timeKey: "12:30:00.000000000" },
      };
      const result = UDAUtils.fixTimeAtUDARequestBody(input);

      assert.deepStrictEqual(result, expected);
    });

    it("should not modify params[key] if parameterTypes[key] is not [-12]", () => {
      const input: UDARequestBody = {
        language: "en",
        name: "test",
        parameterTypes: { timeKey: 1 },
        params: { timeKey: "12:30" },
        returnFormat: "json",
        sampleFn: "sample",
        sampleSize: 10,
      };
      const result = UDAUtils.fixTimeAtUDARequestBody(input);

      assert.deepStrictEqual(result, input);
    });

    it("should not modify params[key] if params[key] is an empty string", () => {
      const input: UDARequestBody = {
        language: "en",
        name: "test",
        parameterTypes: { timeKey: -12 },
        params: { timeKey: "" },
        returnFormat: "json",
        sampleFn: "sample",
        sampleSize: 10,
      };
      const result = UDAUtils.fixTimeAtUDARequestBody(input);

      assert.deepStrictEqual(result, input);
    });

    it("should not modify params[key] if params[key] is undefined", () => {
      const input: UDARequestBody = {
        language: "en",
        name: "test",
        parameterTypes: { timeKey: -12 },
        params: {},
        returnFormat: "json",
        sampleFn: "sample",
        sampleSize: 10,
      };
      const result = UDAUtils.fixTimeAtUDARequestBody(input);

      assert.deepStrictEqual(result, input);
    });

    it("should not modify params[key] if parameterTypes[key] is not an array", () => {
      const input: UDARequestBody = {
        language: "en",
        name: "test",
        parameterTypes: { timeKey: -12 },
        params: { timeKey: "12:30" },
        returnFormat: "json",
        sampleFn: "sample",
        sampleSize: 10,
      };
      const result = UDAUtils.fixTimeAtUDARequestBody(input);

      assert.deepStrictEqual(result, input);
    });

    it("should not modify params[key] if parameterTypes[key] is an empty array", () => {
      const input: UDARequestBody = {
        language: "en",
        name: "test",
        parameterTypes: { timeKey: [] },
        params: { timeKey: "12:30" },
        returnFormat: "json",
        sampleFn: "sample",
        sampleSize: 10,
      };
      const result = UDAUtils.fixTimeAtUDARequestBody(input);

      assert.deepStrictEqual(result, input);
    });

    it("should handle multiple keys in parameterTypes and params", () => {
      const input: UDARequestBody = {
        language: "en",
        name: "test",
        parameterTypes: { timeKey1: -12, timeKey2: 1 },
        params: { timeKey1: "12:30", timeKey2: "value" },
        returnFormat: "json",
        sampleFn: "sample",
        sampleSize: 10,
      };
      const expected: UDARequestBody = {
        ...input,
        params: { timeKey1: "12:30:00.000000000", timeKey2: "value" },
      };
      const result = UDAUtils.fixTimeAtUDARequestBody(input);

      assert.deepStrictEqual(result, expected);
    });
  });

  describe("getIncompatibleError", () => {
    it("should return BadField error message", () => {
      const result = UDAUtils.getIncompatibleError(ParamFieldType.Invalid);

      assert.strictEqual(result, "badField");
    });

    it("should return undefined", () => {
      const result = UDAUtils.getIncompatibleError(ParamFieldType.Boolean);

      assert.strictEqual(result, undefined);
    });
  });

  describe("UDAUtils.createUDAReturn", () => {
    let convertTypesToStringStub: sinon.SinonStub;

    beforeEach(() => {
      convertTypesToStringStub = sinon.stub(UDAUtils, "convertTypesToString");
    });

    afterEach(() => {
      convertTypesToStringStub.restore();
    });

    it("should return correct UDAReturn when metadata has return type and description", () => {
      const metadata = {
        return: {
          type: [1, 2],
          description: "Test description",
        },
      };

      convertTypesToStringStub.withArgs([1, 2]).returns(["type1", "type2"]);

      const result = UDAUtils.createUDAReturn(metadata);

      assert.deepStrictEqual(result, {
        type: ["Boolean", "Number"],
        description: "Test description",
      });
    });

    it("should return empty type array and empty description when metadata is undefined", () => {
      const metadata = undefined;

      convertTypesToStringStub.withArgs([]).returns([]);

      const result = UDAUtils.createUDAReturn(metadata);

      assert.deepStrictEqual(result, {
        type: [],
        description: "",
      });
    });

    it("should return empty type array and empty description when metadata has no return", () => {
      const metadata = undefined;

      convertTypesToStringStub.withArgs([]).returns([]);

      const result = UDAUtils.createUDAReturn(metadata);

      assert.deepStrictEqual(result, {
        type: [],
        description: "",
      });
    });

    it("should return empty type array and provided description when metadata has no return type", () => {
      const metadata = {
        return: {
          description: "Test description",
        },
      };

      convertTypesToStringStub.withArgs([]).returns([]);

      const result = UDAUtils.createUDAReturn(metadata);

      assert.deepStrictEqual(result, {
        type: [],
        description: "Test description",
      });
    });

    it("should return correct type array and empty description when metadata has return type but no description", () => {
      const metadata = {
        return: {
          type: [1, 2],
        },
      };

      convertTypesToStringStub.withArgs([1, 2]).returns(["type1", "type2"]);

      const result = UDAUtils.createUDAReturn(metadata);

      assert.deepStrictEqual(result, {
        type: ["Boolean", "Number"],
        description: "",
      });
    });
  });

  describe("parseUDAList", () => {
    it("should parse UDA list correctly", () => {
      const getMeta: MetaObjectPayload = {
        api: [
          {
            api: "testAPI",
            uda: true,
            params: [
              {
                name: "param1",
                type: 1,
                isReq: true,
                description: "",
              },
            ],
            return: { type: [1], description: "test" },
            description: "",
            aggReturn: {
              type: 0,
              description: "",
            },
            misc: {},
            kxname: [],
            aggFn: "",
            full: false,
            procs: [],
            custom: false,
          },
        ],
        rc: [],
        agg: [],
        assembly: [],
        schema: [],
        dap: [],
      };

      sinon.stub(ext, "booleanTypes").value(new Set([1]));

      const result = UDAUtils.parseUDAList(getMeta);

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].name, "testAPI");
      assert.strictEqual(result[0].params.length, 1);
      assert.strictEqual(result[0].params[0].fieldType, ParamFieldType.Boolean);
    });
  });

  describe("retrieveDataTypeByString", () => {
    it("should retrieve data type by string", () => {
      const dataTypes = new Map([["Boolean", 1]]);

      sinon.stub(ext.constants, "reverseDataTypes").value(dataTypes);

      const result = UDAUtils.retrieveDataTypeByString("Boolean");

      assert.strictEqual(result, 1);
    });

    it("should return 0 if data type not found", () => {
      const dataTypes = new Map([["Boolean", 1]]);

      sinon.stub(ext.constants, "reverseDataTypes").value(dataTypes);

      const result = UDAUtils.retrieveDataTypeByString("Number");

      assert.strictEqual(result, 0);
    });
  });

  describe("isInvalidRequiredParam", () => {
    beforeEach(() => {
      sinon.stub(ext.constants, "allowedEmptyRequiredTypes").value([10, -11]);
      sinon.stub(ext.constants, "reverseDataTypes").value(
        new Map([
          ["Symbol", -11],
          ["String", 10],
          ["InvalidType", -1],
        ]),
      );
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should return true if param.name is 'table' and isReq is true but value is empty", () => {
      const param: UDAParam = {
        name: "table",
        isReq: true,
        value: "",
        type: 10,
        description: "",
      };
      const result = UDAUtils.isInvalidRequiredParam(param);

      assert.strictEqual(result, true);
    });

    it("should return false if param.name is 'table' and isReq is true with a valid value", () => {
      const param = {
        name: "table",
        isReq: true,
        value: "validValue",
        type: 10,
        description: "",
      };
      const result = UDAUtils.isInvalidRequiredParam(param);

      assert.strictEqual(result, false);
    });

    it("should return false if param.type is a number and is in allowedEmptyRequiredTypes", () => {
      const param = {
        name: "param1",
        isReq: true,
        value: "",
        type: 10,
        description: "",
      };
      const result = UDAUtils.isInvalidRequiredParam(param);

      assert.strictEqual(result, false);
    });

    it("should return true if param.type is a number and is not in allowedEmptyRequiredTypes", () => {
      const param = {
        name: "param1",
        isReq: true,
        value: "",
        type: 1,
        description: "",
      };
      const result = UDAUtils.isInvalidRequiredParam(param);

      assert.strictEqual(result, true);
    });

    it("should return false if param.type is an array and contains a value in allowedEmptyRequiredTypes", () => {
      const param = {
        name: "param1",
        isReq: true,
        value: "",
        type: [10],
        description: "",
      };
      const result = UDAUtils.isInvalidRequiredParam(param);

      assert.strictEqual(result, false);
    });

    it("should return true if param.type is an array and does not contain a value in allowedEmptyRequiredTypes", () => {
      const param = {
        name: "param1",
        isReq: true,
        value: "",
        type: [1],
        description: "",
      };
      const result = UDAUtils.isInvalidRequiredParam(param);

      assert.strictEqual(result, true);
    });

    it("should return false if param.type is an array with multiple elements and selectedMultiTypeString resolves to an allowed type", () => {
      const param = {
        name: "param1",
        isReq: true,
        value: "",
        type: [10, -11],
        selectedMultiTypeString: "Symbol",
        description: "",
      };
      const result = UDAUtils.isInvalidRequiredParam(param);

      assert.strictEqual(result, false);
    });

    it("should return true if param.type is an array with multiple elements and selectedMultiTypeString resolves to a disallowed type", () => {
      const param = {
        name: "param1",
        isReq: true,
        value: "",
        type: [10, -11],
        selectedMultiTypeString: "InvalidType",
        description: "",
      };
      const result = UDAUtils.isInvalidRequiredParam(param);

      assert.strictEqual(result, true);
    });

    it("should return true if param.isReq is true and value is empty, and type is not allowed", () => {
      const param = {
        name: "param1",
        isReq: true,
        value: "",
        type: 1,
        description: "",
      };
      const result = UDAUtils.isInvalidRequiredParam(param);

      assert.strictEqual(result, true);
    });

    it("should return false if param.isReq is false, regardless of value or type", () => {
      const param = {
        name: "param1",
        isReq: false,
        value: "",
        type: 1,
        description: "",
      };
      const result = UDAUtils.isInvalidRequiredParam(param);

      assert.strictEqual(result, false);
    });

    it("should return false if param.value is not empty, regardless of type", () => {
      const param = {
        name: "param1",
        isReq: true,
        value: "validValue",
        type: 1,
        description: "",
      };
      const result = UDAUtils.isInvalidRequiredParam(param);

      assert.strictEqual(result, false);
    });

    it("should return true if param.type is an array with multiple elements and selectedMultiTypeString is undefined", () => {
      const param = {
        name: "param1",
        isReq: true,
        value: "",
        type: [10, -11],
        selectedMultiTypeString: undefined,
        description: "",
      };
      const result = UDAUtils.isInvalidRequiredParam(param);

      assert.strictEqual(result, true);
    });
  });

  describe("resolveParamType", () => {
    it("should return the first element of param.type if it is an array with at least one element", () => {
      const param: UDAParam = {
        name: "param1",
        description: "Test parameter",
        isReq: true,
        type: [10, 20],
      };
      const result = UDAUtils.resolveParamType(param);

      assert.strictEqual(result, 10);
    });

    it("should return param.type if it is a number", () => {
      const param: UDAParam = {
        name: "param2",
        description: "Test parameter",
        isReq: false,
        type: 15,
      };
      const result = UDAUtils.resolveParamType(param);

      assert.strictEqual(result, 15);
    });

    it("should throw an error if param.type is an empty array", () => {
      const param: UDAParam = {
        name: "param3",
        description: "Test parameter",
        isReq: true,
        type: [],
      };

      assert.throws(
        () => UDAUtils.resolveParamType(param),
        new Error(
          "Invalid type for parameter: param3. Expected number or array of numbers.",
        ),
      );
    });

    it("should throw an error if param.type is undefined", () => {
      const param: UDAParam = {
        name: "param4",
        description: "Test parameter",
        isReq: false,
        type: undefined as any,
      };

      assert.throws(
        () => UDAUtils.resolveParamType(param),
        new Error(
          "Invalid type for parameter: param4. Expected number or array of numbers.",
        ),
      );
    });

    it("should throw an error if param.type is null", () => {
      const param: UDAParam = {
        name: "param5",
        description: "Test parameter",
        isReq: false,
        type: null as any,
      };

      assert.throws(
        () => UDAUtils.resolveParamType(param),
        new Error(
          "Invalid type for parameter: param5. Expected number or array of numbers.",
        ),
      );
    });

    it("should throw an error if param.type is not a number or an array", () => {
      const param: UDAParam = {
        name: "param6",
        description: "Test parameter",
        isReq: true,
        type: "invalidType" as any,
      };

      assert.throws(
        () => UDAUtils.resolveParamType(param),
        new Error(
          "Invalid type for parameter: param6. Expected number or array of numbers.",
        ),
      );
    });
  });

  describe("createUDARequestBody", () => {
    it("should create UDA request body with correct structure", () => {
      const name = "testUDA";
      const params = { param1: "value1", param2: 123 };
      const parameterTypes = { param1: 10, param2: 1 };
      const returnFormat = "text";
      const result = UDAUtils.createUDARequestBody(
        name,
        params,
        parameterTypes,
        returnFormat,
      );
      const expected: UDARequestBody = {
        language: "q",
        name: "testUDA",
        parameterTypes: { param1: 10, param2: 1 },
        params: { param1: "value1", param2: 123 },
        returnFormat: "text",
        sampleFn: "first",
        sampleSize: 10000,
      };

      assert.deepStrictEqual(result, expected);
    });

    it("should create UDA request body with empty params and parameterTypes", () => {
      const name = "emptyUDA";
      const params = {};
      const parameterTypes = {};
      const returnFormat = "structuredText";
      const result = UDAUtils.createUDARequestBody(
        name,
        params,
        parameterTypes,
        returnFormat,
      );
      const expected: UDARequestBody = {
        language: "q",
        name: "emptyUDA",
        parameterTypes: {},
        params: {},
        returnFormat: "structuredText",
        sampleFn: "first",
        sampleSize: 10000,
      };

      assert.deepStrictEqual(result, expected);
    });

    it("should always set language to 'q', sampleFn to 'first', and sampleSize to 10000", () => {
      const result = UDAUtils.createUDARequestBody("test", {}, {}, "text");

      assert.strictEqual(result.language, "q");
      assert.strictEqual(result.sampleFn, "first");
      assert.strictEqual(result.sampleSize, 10000);
    });
  });

  describe("retrieveUDAtoCreateReqBody", () => {
    let retrieveConnStub,
      isResultsTabVisibleStub,
      validateUDAStub,
      isUDAAvailableStub,
      processUDAParamsStub: sinon.SinonStub;

    const connMngService = new ConnectionManagementService();
    const insights = {
      testInsight: {
        alias: "testInsightsAlias",
        server: "testInsightsName",
        auth: false,
      },
    };
    const insightNode = new InsightsNode(
      ["child1"],
      "testInsightsAlias",
      insights["testInsight"],
      vscode.TreeItemCollapsibleState.None,
    );
    const localConn = new LocalConnection("127.0.0.1:5001", "testLabel", []);
    const insightsConn = new InsightsConnection(insightNode.label, insightNode);
    const mockUDA = {
      name: "testUDA",
      description: "Test UDA",
      params: [
        {
          name: "param1",
          type: 10,
          isReq: true,
          description: "Test param",
          value: "test",
          isVisible: true,
        },
      ],
      return: { type: ["string"], description: "Test return" },
    };

    beforeEach(() => {
      retrieveConnStub = sinon.stub(
        connMngService,
        "retrieveConnectedConnection",
      );
      isResultsTabVisibleStub = sinon.stub(ext, "isResultsTabVisible");
      validateUDAStub = sinon.stub(UDAUtils, "validateUDA");
      processUDAParamsStub = sinon.stub(UDAUtils, "processUDAParams");
      isUDAAvailableStub = sinon.stub(insightsConn, "isUDAAvailable");
    });

    afterEach(() => {
      sinon.restore();
      ext.connectedConnectionList.length = 0;
    });

    it("should return error when UDA is undefined", async () => {
      const result = await UDAUtils.retrieveUDAtoCreateReqBody(
        undefined,
        "testConn",
      );

      assert.deepStrictEqual(result, { error: "UDA is undefined" });
    });

    it("should return error when connection is not found", async () => {
      retrieveConnStub.returns(undefined);

      const result = await UDAUtils.retrieveUDAtoCreateReqBody(
        mockUDA,
        "testConn",
      );

      assert.deepStrictEqual(result, {
        error: "Connection testConn is not valid or not connected.",
      });
    });

    it("should return error when connection is not an InsightsConnection", async () => {
      retrieveConnStub.resolves(localConn);

      const result = await UDAUtils.retrieveUDAtoCreateReqBody(
        mockUDA,
        localConn.connLabel,
      );

      assert.deepStrictEqual(result, {
        error: `Connection ${localConn.connLabel} is not valid or not connected.`,
      });
    });

    it("should set returnFormat to 'structuredText' when isResultsTabVisible is true", async () => {
      isResultsTabVisibleStub.value(true);
      ext.connectedConnectionList.push(insightsConn);
      retrieveConnStub.resolves(insightsConn);
      isUDAAvailableStub.resolves(true);
      validateUDAStub.resolves(null);
      processUDAParamsStub.returns({
        params: { param1: "test" },
        parameterTypes: { param1: 10 },
      });

      const result = await UDAUtils.retrieveUDAtoCreateReqBody(
        mockUDA,
        insightsConn.connLabel,
      );

      assert.equal(result.returnFormat, "structuredText");
    });

    it("should set returnFormat to 'text' when isResultsTabVisible is false", async () => {
      isResultsTabVisibleStub.value(false);
      ext.connectedConnectionList.push(insightsConn);
      retrieveConnStub.resolves(insightsConn);
      isUDAAvailableStub.resolves(true);
      validateUDAStub.resolves(null);
      processUDAParamsStub.returns({
        params: { param1: "test" },
        parameterTypes: { param1: 10 },
      });

      const result = await UDAUtils.retrieveUDAtoCreateReqBody(
        mockUDA,
        insightsConn.connLabel,
      );

      assert.equal(result.returnFormat, "text");
    });

    it("should return validation error when UDA validation fails", async () => {
      isResultsTabVisibleStub.returns(false);
      ext.connectedConnectionList.push(insightsConn);
      retrieveConnStub.resolves(insightsConn);
      isUDAAvailableStub.resolves(false);
      validateUDAStub.resolves({
        error: "UDA testUDA is not available in this connection",
      });
      processUDAParamsStub.returns({
        params: { param1: "test" },
        parameterTypes: { param1: 10 },
      });

      const result = await UDAUtils.retrieveUDAtoCreateReqBody(
        mockUDA,
        insightsConn.connLabel,
      );

      assert.equal(
        JSON.stringify(result),
        JSON.stringify({
          error: "UDA testUDA is not available in this connection",
        }),
      );
    });

    it("should return processUDAParams error when parameter processing fails", async () => {
      isResultsTabVisibleStub.returns(false);
      ext.connectedConnectionList.push(insightsConn);
      retrieveConnStub.resolves(insightsConn);
      isUDAAvailableStub.resolves(true);
      validateUDAStub.resolves(null);
      processUDAParamsStub.returns({
        params: {},
        parameterTypes: {},
        error: {
          error: `The UDA you have selected cannot be queried because it has required fields with types that are not supported.`,
        },
      });
      const mockUDA2 = mockUDA as UDA;

      mockUDA2.incompatibleError = "error";

      const result = await UDAUtils.retrieveUDAtoCreateReqBody(
        mockUDA2,
        insightsConn.connLabel,
      );

      assert.equal(
        JSON.stringify(result),
        JSON.stringify({
          error: `The UDA you have selected cannot be queried because it has required fields with types that are not supported.`,
        }),
      );
    });
  });
});
