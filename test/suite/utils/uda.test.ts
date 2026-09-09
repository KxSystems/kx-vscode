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

import * as assert from "assert";
import * as sinon from "sinon";

import { InsightsConnection } from "../../../src/classes/insightsConnection";
import { ext } from "../../../src/extensionVariables";
import { MetaObjectPayload } from "../../../src/models/meta";
import {
  ParamFieldType,
  UDA,
  UDAParam,
  UDARequestBody,
} from "../../../src/models/uda";
import { sourceForParam } from "../../../src/models/uda";
import * as UDAUtils from "../../../src/utils/uda";

/**
 * Only the two things the UDA request path asks a connection: whether it is
 * usable, and whether it knows the UDA. Standing a real InsightsConnection up
 * would drag in auth, endpoints and the tree for no gain.
 */
const connection = (available: boolean) =>
  ({
    isUDAAvailable: async () => available,
  }) as unknown as InsightsConnection;

/** A connection that resolves a target the way the real one does, over a meta
 * naming a single `assembly-qe rdb` tier. */
const scoping = () =>
  ({
    isUDAAvailable: async () => true,
    scopeValue: (value: unknown) =>
      value === "assembly rdb"
        ? { affinity: "soft", assembly: "assembly-qe", tier: "rdb" }
        : undefined,
  }) as unknown as InsightsConnection;

describe("UDA", () => {
  afterEach(() => {
    sinon.restore();
  });

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

  describe("getUDAFieldType", () => {
    it("should ask for a type before a value when two share a widget", () => {
      const result = UDAUtils.getUDAFieldType([-11, 11]);

      assert.strictEqual(result, ParamFieldType.MultiType);
    });

    it("should take a GUID list as JSON", () => {
      const result = UDAUtils.getUDAFieldType(2);

      assert.strictEqual(result, ParamFieldType.JSON);
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
      sinon.stub(ext, "textTypes").value(new Set([3]));
      sinon.stub(ext, "timestampTypes").value(new Set([4]));
      sinon.stub(ext, "jsonTypes").value(new Set([5]));

      const result = UDAUtils.parseUDAParams(params);
      assert.strictEqual(result.length, 2);
      if (typeof result === "string") {
        return;
      }
      assert.strictEqual(result[0].fieldType, ParamFieldType.Boolean);
      assert.strictEqual(result[1].fieldType, ParamFieldType.Number);
    });

    it("should take a UDA that lists no params at all", () => {
      assert.deepStrictEqual(UDAUtils.parseUDAParams(undefined), []);
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

  describe("sourceForParam", () => {
    it("should recognise a table parameter", () => {
      assert.strictEqual(
        sourceForParam("table", ParamFieldType.Text),
        "tables",
      );
    });

    it("should recognise the conventional column parameters", () => {
      for (const name of ["column", "columns", "sortCols", "groupBy", "by"]) {
        assert.strictEqual(
          sourceForParam(name, ParamFieldType.Text),
          "columns",
          name,
        );
      }
    });

    it("should leave anything else alone", () => {
      assert.strictEqual(sourceForParam("sym", ParamFieldType.Text), undefined);
    });

    it("should not claim a parameter that is not a symbol", () => {
      assert.strictEqual(
        sourceForParam("table", ParamFieldType.Number),
        undefined,
      );
      assert.strictEqual(
        sourceForParam("columns", ParamFieldType.JSON),
        undefined,
      );
    });

    it("should give a scope the targets dropdown whatever it registers", () => {
      for (const fieldType of [
        ParamFieldType.JSON,
        ParamFieldType.Text,
        ParamFieldType.Invalid,
        undefined,
      ]) {
        assert.strictEqual(
          sourceForParam("scope", fieldType),
          "targets",
          `${fieldType}`,
        );
      }
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

    it("should take a single type that is not in an array", () => {
      dataTypesStub.value(new Map([["-11", "Symbol"]]));

      assert.deepStrictEqual(
        UDAUtils.convertTypesToString(-11 as unknown as number[]),
        ["Symbol"],
      );
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

  describe("getIncompatibleError", () => {
    const described = {
      description: "a described UDA",
      params: [{ name: "table" }],
      return: { type: [98], description: "the rows" },
    };

    it("should return BadField error message", () => {
      const result = UDAUtils.getIncompatibleError(
        described,
        ParamFieldType.Invalid,
      );

      assert.strictEqual(result, "badField");
    });

    it("should return undefined", () => {
      const result = UDAUtils.getIncompatibleError(
        described,
        ParamFieldType.Boolean,
      );
      assert.strictEqual(result, undefined);
    });

    it("should report a UDA the meta says nothing about", () => {
      const result = UDAUtils.getIncompatibleError({}, []);

      assert.strictEqual(result, "noMetadata");
    });

    it("should take a description on its own as metadata", () => {
      const result = UDAUtils.getIncompatibleError(
        { description: "takes no arguments" },
        [],
      );

      assert.strictEqual(result, undefined);
    });
  });

  describe("UDAUtils.createUDAReturn", () => {
    it("should return correct UDAReturn when metadata has return type and description", () => {
      const metadata = {
        return: {
          type: [1, 2],
          description: "Test description",
        },
      };
      const result = UDAUtils.createUDAReturn(metadata);

      assert.deepStrictEqual(result, {
        type: ["Boolean List", "GUID List"],
        description: "Test description",
      });
    });

    it("should return empty type array and empty description when metadata is undefined", () => {
      const metadata = undefined;
      const result = UDAUtils.createUDAReturn(metadata);

      assert.deepStrictEqual(result, {
        type: [],
        description: "",
      });
    });

    it("should return empty type array and empty description when metadata has no return", () => {
      const metadata = { api: ".uda.noReturn" };
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
      const result = UDAUtils.createUDAReturn(metadata);

      assert.deepStrictEqual(result, {
        type: ["Boolean List", "GUID List"],
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
      sinon.stub(ext, "jsonTypes").value(new Set([5]));

      const result = UDAUtils.parseUDAList(getMeta);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].name, "testAPI");
      assert.strictEqual(result[0].params.length, 1);
      assert.strictEqual(result[0].params[0].fieldType, ParamFieldType.Boolean);
    });

    it("should parse a UDA registered without a return", () => {
      const getMeta = {
        api: [
          {
            api: "noReturnAPI",
            uda: true,
            params: [],
          },
        ],
      } as unknown as MetaObjectPayload;

      const result = UDAUtils.parseUDAList(getMeta);

      assert.strictEqual(result.length, 1);
      assert.deepStrictEqual(result[0].return, { type: [], description: "" });
    });
  });

  describe("parsePreviewApi", () => {
    beforeEach(() => {
      sinon.stub(ext, "booleanTypes").value(new Set([-1]));
      sinon.stub(ext, "numberTypes").value(new Set([-7]));
      sinon.stub(ext, "textTypes").value(new Set([-11]));
      sinon.stub(ext, "timestampTypes").value(new Set([-12]));
      sinon.stub(ext, "jsonTypes").value(new Set([98, 99]));
    });

    /** The preview entry as the meta of a 1.20 deployment registers it. */
    const meta = (api: unknown[]) => <MetaObjectPayload>(<unknown>{ api });

    const preview = {
      api: ".kxi.preview",
      uda: false,
      description: "Efficiently fetch a small preview of a table.",
      params: [
        { name: "table", type: -11, isReq: true, description: "Table." },
        {
          name: "startTS",
          type: -12,
          isReq: false,
          default: "1707-09-22T00:12:43.145224193",
          description: "Start.",
        },
        {
          name: "endTS",
          type: -12,
          isReq: false,
          default: "2292-04-10T23:47:16.854775807",
          description: "End.",
        },
        {
          name: "limit",
          type: -7,
          isReq: false,
          default: 1000,
          description: "",
        },
      ],
      return: { type: 98, description: "Table." },
    };

    it("offers nothing when the deployment has no preview API", () => {
      assert.strictEqual(UDAUtils.parsePreviewApi(meta([])), undefined);
      assert.strictEqual(
        UDAUtils.parsePreviewApi(<MetaObjectPayload>{}),
        undefined,
      );
    });

    it("takes it despite the uda flag being false", () => {
      const result = UDAUtils.parsePreviewApi(meta([preview]));

      assert.strictEqual(result?.name, ".kxi.preview");
      assert.strictEqual(
        result?.description,
        "Efficiently fetch a small preview of a table.",
      );
    });

    it("builds the form out of the parameters the meta registers", () => {
      const params = UDAUtils.parsePreviewApi(meta([preview]))?.params || [];

      assert.deepStrictEqual(
        params.map((param) => [param.name, param.fieldType, param.isVisible]),
        [
          ["table", ParamFieldType.Text, true],
          ["startTS", ParamFieldType.Timestamp, false],
          ["endTS", ParamFieldType.Timestamp, false],
          ["limit", ParamFieldType.Number, false],
        ],
      );
      // The table name is picked from the connection, the way getData asks it.
      assert.strictEqual(params[0].source, "tables");
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

    it("should return the type picked for a multi-typed parameter", () => {
      sinon.stub(ext.constants, "reverseDataTypes").value(
        new Map([
          ["Symbol", -11],
          ["Long", -7],
        ]),
      );
      const param: UDAParam = {
        name: "value",
        description: "Test parameter",
        isReq: true,
        type: [-11, -7],
        selectedMultiTypeString: "Long",
      };

      assert.strictEqual(UDAUtils.resolveParamType(param), -7);
    });

    it("should fall back to the first type when no type was picked", () => {
      const param: UDAParam = {
        name: "value",
        description: "Test parameter",
        isReq: true,
        type: [-11, -7],
      };

      assert.strictEqual(UDAUtils.resolveParamType(param), -11);
    });
  });

  describe("processUDAParams", () => {
    beforeEach(() => {
      sinon.stub(ext.constants, "allowedEmptyRequiredTypes").value([10, -11]);
      sinon.stub(ext.constants, "reverseDataTypes").value(
        new Map([
          ["Symbol", -11],
          ["Long", -7],
        ]),
      );
    });

    const uda = (params: UDAParam[]): UDA => ({
      name: ".uda.test",
      description: "",
      params,
    });

    it("sends a boolean parameter answered false rather than rejecting it", () => {
      const result = UDAUtils.processUDAParams(
        uda([
          {
            name: "flag",
            description: "",
            isReq: true,
            type: [-1],
            isVisible: true,
            value: false,
          },
        ]),
      );

      assert.strictEqual(result.error, undefined);
      assert.deepStrictEqual(result.params, { flag: false });
      assert.deepStrictEqual(result.parameterTypes, { flag: -1 });
    });

    it("sends a number parameter answered zero rather than rejecting it", () => {
      const result = UDAUtils.processUDAParams(
        uda([
          {
            name: "multiplier",
            description: "",
            isReq: true,
            type: [-7],
            isVisible: true,
            value: 0,
          },
        ]),
      );

      assert.strictEqual(result.error, undefined);
      assert.deepStrictEqual(result.params, { multiplier: 0 });
    });

    it("still rejects a required parameter left blank", () => {
      const result = UDAUtils.processUDAParams(
        uda([
          {
            name: "multiplier",
            description: "",
            isReq: true,
            type: [-7],
            isVisible: true,
            value: "",
          },
        ]),
      );

      assert.deepStrictEqual(result.error, {
        error: "The UDA: .uda.test requires the parameter: multiplier.",
      });
    });

    it("sends the type picked for a multi-typed parameter", () => {
      const result = UDAUtils.processUDAParams(
        uda([
          {
            name: "value",
            description: "",
            isReq: true,
            type: [-11, -7],
            selectedMultiTypeString: "Long",
            isVisible: true,
            value: 42,
          },
        ]),
      );

      assert.strictEqual(result.error, undefined);
      assert.deepStrictEqual(result.parameterTypes, { value: -7 });
    });

    it("sends a dictionary parameter as a dictionary, not as its text", () => {
      const result = UDAUtils.processUDAParams(
        uda([
          {
            name: "labels",
            description: "",
            isReq: false,
            type: [99],
            isVisible: true,
            value: '{"kxname":"db","region":"emea"}',
          },
        ]),
      );

      assert.strictEqual(result.error, undefined);
      assert.deepStrictEqual(result.params, {
        labels: { kxname: "db", region: "emea" },
      });
      assert.deepStrictEqual(result.parameterTypes, { labels: 99 });
    });

    it("sends the label values as the lists the rows wrote", () => {
      const result = UDAUtils.processUDAParams(
        uda([
          {
            name: "labels",
            description: "",
            isReq: false,
            type: [99],
            isVisible: true,
            value: '{"region":["emea","apac"]}',
          },
        ]),
      );

      assert.strictEqual(result.error, undefined);
      assert.deepStrictEqual(result.params, {
        labels: { region: ["emea", "apac"] },
      });
    });

    it("sends a list parameter as a list", () => {
      const result = UDAUtils.processUDAParams(
        uda([
          {
            name: "syms",
            description: "",
            isReq: false,
            type: [11],
            isVisible: true,
            value: '["AAPL","MSFT"]',
          },
        ]),
      );

      assert.strictEqual(result.error, undefined);
      assert.deepStrictEqual(result.params, { syms: ["AAPL", "MSFT"] });
    });

    it("leaves a text parameter as the text it is", () => {
      const result = UDAUtils.processUDAParams(
        uda([
          {
            name: "query",
            description: "",
            isReq: false,
            type: [10],
            isVisible: true,
            value: '["AAPL","MSFT"]',
          },
        ]),
      );

      assert.strictEqual(result.error, undefined);
      assert.deepStrictEqual(result.params, { query: '["AAPL","MSFT"]' });
    });

    it("reports a dictionary parameter that is not valid JSON", () => {
      const result = UDAUtils.processUDAParams(
        uda([
          {
            name: "labels",
            description: "",
            isReq: false,
            type: [99],
            isVisible: true,
            value: "kxname=db",
          },
        ]),
      );

      assert.deepStrictEqual(result.params, {});
      assert.deepStrictEqual(result.parameterTypes, {});
      assert.match(result.error?.error ?? "", /labels parameter is not valid/);
    });

    it("drops a JSON parameter shown but never filled in", () => {
      const result = UDAUtils.processUDAParams(
        uda([
          {
            name: "labels",
            description: "",
            isReq: false,
            type: [99],
            isVisible: true,
            value: "",
          },
        ]),
      );

      assert.strictEqual(result.error, undefined);
      assert.deepStrictEqual(result.params, {});
      assert.deepStrictEqual(result.parameterTypes, {});
    });

    it("drops an optional number parameter left blank", () => {
      const result = UDAUtils.processUDAParams(
        uda([
          {
            name: "limit",
            description: "",
            isReq: false,
            type: [-7],
            isVisible: true,
            value: "",
          },
        ]),
      );

      assert.strictEqual(result.error, undefined);
      assert.deepStrictEqual(result.params, {});
      assert.deepStrictEqual(result.parameterTypes, {});
    });

    it("keeps an optional symbol parameter answered with nothing", () => {
      const result = UDAUtils.processUDAParams(
        uda([
          {
            name: "fill",
            description: "",
            isReq: false,
            type: [-11],
            isVisible: true,
            value: "",
          },
        ]),
      );

      assert.deepStrictEqual(result.params, { fill: "" });
    });

    it("reports a value the type will not take", () => {
      const result = UDAUtils.processUDAParams(
        uda([
          {
            name: "asOf",
            description: "",
            isReq: true,
            type: [-14],
            isVisible: true,
            value: "yesterday",
          },
        ]),
      );

      assert.deepStrictEqual(result.params, {});
      assert.match(
        result.error?.error ?? "",
        /asOf parameter expects a Date value, like 2000\.01\.01/,
      );
    });

    it("reports a number outside what the type holds", () => {
      const result = UDAUtils.processUDAParams(
        uda([
          {
            name: "size",
            description: "",
            isReq: true,
            type: [-5],
            isVisible: true,
            value: "70000",
          },
        ]),
      );

      assert.match(result.error?.error ?? "", /between -32766 and 32766/);
    });

    it("takes the q null and infinity literals as values", () => {
      const result = UDAUtils.processUDAParams(
        uda([
          {
            name: "size",
            description: "",
            isReq: true,
            type: [-7],
            isVisible: true,
            value: "0W",
          },
        ]),
      );

      assert.strictEqual(result.error, undefined);
      assert.deepStrictEqual(result.params, { size: "0W" });
    });

    it("refuses to send an optional parameter of an unsupported type", () => {
      const result = UDAUtils.processUDAParams(
        uda([
          {
            name: "fn",
            description: "",
            isReq: false,
            type: [],
            fieldType: ParamFieldType.Invalid,
            isVisible: true,
            value: "{x}",
          },
        ]),
      );

      assert.match(
        result.error?.error ?? "",
        /cannot send the parameter: fn\. Its type is not supported/,
      );
    });

    it("says which UDAs the meta describes nothing about", () => {
      const result = UDAUtils.processUDAParams({
        name: ".uda.bare",
        description: "",
        params: [],
        incompatibleError: "noMetadata",
      });

      assert.match(result.error?.error ?? "", /no metadata associated with it/);
    });

    it("leaves scope as the target string for the connection to resolve", () => {
      const result = UDAUtils.processUDAParams(
        uda([
          {
            name: "scope",
            description: "",
            isReq: false,
            type: [99],
            isVisible: true,
            value: "assembly rdb",
          },
        ]),
      );

      assert.strictEqual(result.error, undefined);
      assert.deepStrictEqual(result.params, { scope: "assembly rdb" });
      assert.deepStrictEqual(result.parameterTypes, { scope: 99 });
    });
  });
  describe("validateUDA", () => {
    it("refuses a UDA that is not there at all", async () => {
      const result = await UDAUtils.validateUDA(undefined, connection(true));

      assert.deepStrictEqual(result, { error: "UDA not found" });
    });

    it("refuses a UDA with no name", async () => {
      const result = await UDAUtils.validateUDA(
        { name: "", description: "", params: [] },
        connection(true),
      );

      assert.deepStrictEqual(result, { error: "UDA name not found" });
    });

    it("refuses a UDA the connection does not report", async () => {
      const result = await UDAUtils.validateUDA(
        { name: ".uda.gone", description: "", params: [] },
        connection(false),
      );

      assert.deepStrictEqual(result, {
        error: "UDA .uda.gone is not available in this connection",
      });
    });

    it("accepts a UDA the connection reports", async () => {
      const result = await UDAUtils.validateUDA(
        { name: ".uda.here", description: "", params: [] },
        connection(true),
      );

      assert.strictEqual(result, null);
    });
  });

  describe("createUDARequestBody", () => {
    it("builds the body the scratchpad expects", () => {
      const body = UDAUtils.createUDARequestBody(
        ".uda.test",
        { x: "44" },
        { x: -6 },
        "text",
      );

      assert.deepStrictEqual(body, {
        language: "q",
        name: ".uda.test",
        params: { x: "44" },
        parameterTypes: { x: -6 },
        returnFormat: "text",
        sampleFn: "first",
        sampleSize: 10000,
      });
    });
  });

  describe("retrieveUDAtoCreateReqBody", () => {
    beforeEach(() => {
      sinon.stub(ext.constants, "allowedEmptyRequiredTypes").value([10, -11]);
      sinon.stub(ext.constants, "reverseDataTypes").value(
        new Map([
          ["Symbol", -11],
          ["Long", -7],
        ]),
      );
      sinon.stub(ext, "isResultsTabVisible").value(false);
    });

    const uda = (params: UDAParam[] = []): UDA => ({
      name: ".uda.test",
      description: "",
      params,
    });

    const multiplier = (value: unknown): UDAParam => ({
      name: "multiplier",
      description: "",
      isReq: true,
      type: [-7],
      isVisible: true,
      value,
    });

    it("refuses a UDA that is not there at all", async () => {
      const result = await UDAUtils.retrieveUDAtoCreateReqBody(
        undefined,
        connection(true),
      );

      assert.deepStrictEqual(result, { error: "UDA is undefined" });
    });

    it("passes on the reason the UDA did not validate", async () => {
      const result = await UDAUtils.retrieveUDAtoCreateReqBody(
        uda(),
        connection(false),
      );

      assert.deepStrictEqual(result, {
        error: "UDA .uda.test is not available in this connection",
      });
    });

    it("passes on the reason a parameter did not validate", async () => {
      const result = await UDAUtils.retrieveUDAtoCreateReqBody(
        uda([multiplier("")]),
        connection(true),
      );

      assert.deepStrictEqual(result, {
        error: "The UDA: .uda.test requires the parameter: multiplier.",
      });
    });

    it("carries the parameters and their types through to the body", async () => {
      const result = await UDAUtils.retrieveUDAtoCreateReqBody(
        uda([multiplier("3")]),
        connection(true),
      );

      assert.deepStrictEqual(result, {
        language: "q",
        name: ".uda.test",
        params: { multiplier: "3" },
        parameterTypes: { multiplier: -7 },
        returnFormat: "text",
        sampleFn: "first",
        sampleSize: 10000,
      });
    });

    it("carries the type picked for a multi-typed parameter", async () => {
      const result = await UDAUtils.retrieveUDAtoCreateReqBody(
        uda([
          {
            name: "value",
            description: "",
            isReq: true,
            type: [-11, -7],
            selectedMultiTypeString: "Long",
            isVisible: true,
            value: 44,
          },
        ]),
        connection(true),
      );

      assert.deepStrictEqual(result.parameterTypes, { value: -7 });
      assert.deepStrictEqual(result.params, { value: 44 });
    });

    it("resolves the target the scope holds into a dictionary", async () => {
      const result = await UDAUtils.retrieveUDAtoCreateReqBody(
        uda([
          {
            name: "scope",
            description: "",
            isReq: false,
            type: [99],
            isVisible: true,
            value: "assembly rdb",
          },
        ]),
        scoping(),
      );

      assert.deepStrictEqual(result.params, {
        scope: { affinity: "soft", assembly: "assembly-qe", tier: "rdb" },
      });
      assert.deepStrictEqual(result.parameterTypes, { scope: 99 });
    });

    it("drops a scope the connection has nothing to make of", async () => {
      const result = await UDAUtils.retrieveUDAtoCreateReqBody(
        uda([
          {
            name: "scope",
            description: "",
            isReq: false,
            type: [99],
            isVisible: true,
            value: "",
          },
          multiplier("3"),
        ]),
        scoping(),
      );

      assert.deepStrictEqual(result.params, { multiplier: "3" });
      assert.deepStrictEqual(result.parameterTypes, { multiplier: -7 });
    });

    it("drops a blank optional parameter of the preview API", async () => {
      const result = await UDAUtils.retrieveUDAtoCreateReqBody(
        {
          name: ".kxi.preview",
          description: "",
          params: [
            {
              name: "table",
              description: "",
              isReq: true,
              type: [-11],
              isVisible: true,
              value: "trade",
            },
            {
              name: "limit",
              description: "",
              isReq: false,
              type: [-7],
              isVisible: true,
              value: "",
            },
          ],
        },
        connection(true),
      );

      // Nothing in the box means the documented default — a thousand rows over
      // the whole range — rather than a blank for the gateway to cast.
      assert.deepStrictEqual(result.params, { table: "trade" });
      assert.deepStrictEqual(result.parameterTypes, { table: -11 });
    });

    it("keeps a preview parameter that was answered", async () => {
      const result = await UDAUtils.retrieveUDAtoCreateReqBody(
        {
          name: ".kxi.preview",
          description: "",
          params: [
            {
              name: "table",
              description: "",
              isReq: true,
              type: [-11],
              isVisible: true,
              value: "trade",
            },
            {
              name: "limit",
              description: "",
              isReq: false,
              type: [-7],
              isVisible: true,
              value: 25,
            },
          ],
        },
        connection(true),
      );

      assert.deepStrictEqual(result.params, { table: "trade", limit: 25 });
    });

    it("leaves a UDA's own blank parameter alone", async () => {
      const result = await UDAUtils.retrieveUDAtoCreateReqBody(
        uda([
          multiplier("3"),
          {
            name: "fill",
            description: "",
            isReq: false,
            type: [-11],
            isVisible: true,
            value: "",
          },
        ]),
        connection(true),
      );

      assert.deepStrictEqual(result.params, { multiplier: "3", fill: "" });
    });

    it("asks for structured text while the results tab is up", async () => {
      sinon.stub(ext, "isResultsTabVisible").value(true);

      const result = await UDAUtils.retrieveUDAtoCreateReqBody(
        uda(),
        connection(true),
      );

      assert.strictEqual(result.returnFormat, "structuredText");
    });
  });
  describe("toScratchpadParams", () => {
    beforeEach(() => {
      sinon.stub(ext, "jsonTypes").value(new Set([0, 11, 98, 99]));
    });

    const body = (
      params: { [key: string]: any },
      parameterTypes: { [key: string]: number },
    ): UDARequestBody => ({
      language: "q",
      name: ".uda.test",
      params,
      parameterTypes,
      returnFormat: "structuredText",
      sampleFn: "first",
      sampleSize: 10000,
    });

    it("sends a dictionary as the text the scratchpad parses", () => {
      const result = UDAUtils.toScratchpadParams(
        body({ labels: { kxname: ["db"] } }, { labels: 99 }),
      );

      assert.deepStrictEqual(result, { labels: '{"kxname":["db"]}' });
    });

    it("sends a list as text too", () => {
      const result = UDAUtils.toScratchpadParams(
        body({ syms: ["aa", "bb"] }, { syms: 11 }),
      );

      assert.deepStrictEqual(result, { syms: '["aa","bb"]' });
    });

    it("sends a resolved scope as text", () => {
      const result = UDAUtils.toScratchpadParams(
        body(
          { scope: { affinity: "soft", assembly: "a", tier: "hdb" } },
          { scope: 99 },
        ),
      );

      assert.deepStrictEqual(result, {
        scope: '{"affinity":"soft","assembly":"a","tier":"hdb"}',
      });
    });

    it("leaves a value of any other type as it is", () => {
      const result = UDAUtils.toScratchpadParams(
        body(
          { table: "trade", multiplier: 44, on: false },
          { table: -11, multiplier: -7, on: -1 },
        ),
      );

      assert.deepStrictEqual(result, {
        table: "trade",
        multiplier: 44,
        on: false,
      });
    });

    it("leaves a JSON parameter with nothing in it alone", () => {
      const result = UDAUtils.toScratchpadParams(
        body({ labels: "" }, { labels: 99 }),
      );

      assert.deepStrictEqual(result, { labels: "" });
    });
  });

  describe("recastParams", () => {
    beforeEach(() => {
      sinon.stub(ext.constants, "reverseDataTypes").value(
        new Map([
          ["Symbol", -11],
          ["Long", -7],
        ]),
      );
    });

    const multi = (over: Partial<UDAParam> = {}): UDAParam => ({
      name: "value",
      description: "",
      isReq: true,
      type: [-11, -7],
      isVisible: true,
      ...over,
    });

    const uda = (params: UDAParam[]): UDA => ({
      name: ".uda.test",
      description: "",
      params,
    });

    it("names a parameter whose chosen type is not the first registered", () => {
      const result = UDAUtils.recastParams(
        uda([multi({ selectedMultiTypeString: "Long" })]),
      );

      assert.deepStrictEqual(result, ["value"]);
    });

    it("stays quiet when the first type is the one chosen", () => {
      const result = UDAUtils.recastParams(
        uda([multi({ selectedMultiTypeString: "Symbol" })]),
      );

      assert.deepStrictEqual(result, []);
    });

    it("stays quiet when no type has been chosen", () => {
      assert.deepStrictEqual(UDAUtils.recastParams(uda([multi()])), []);
    });

    it("stays quiet for a parameter of a single type", () => {
      const result = UDAUtils.recastParams(
        uda([multi({ type: [-7], selectedMultiTypeString: "Long" })]),
      );

      assert.deepStrictEqual(result, []);
    });

    it("ignores a parameter that is not on the form", () => {
      const result = UDAUtils.recastParams(
        uda([multi({ isVisible: false, selectedMultiTypeString: "Long" })]),
      );

      assert.deepStrictEqual(result, []);
    });

    it("takes a UDA with no parameters at all", () => {
      assert.deepStrictEqual(
        UDAUtils.recastParams({ name: "x", description: "", params: [] }),
        [],
      );
    });
  });
});
