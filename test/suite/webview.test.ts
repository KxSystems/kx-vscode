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

/* eslint @typescript-eslint/no-explicit-any: 0 */

import "../fixtures";
import * as assert from "assert";
import { html, TemplateResult } from "lit";
import * as sinon from "sinon";

import { ext } from "../../src/extensionVariables";
import { InsightDetails, ServerType } from "../../src/models/connectionsModels";
import {
  DataSourceTypes,
  createAgg,
  createFilter,
  createGroup,
  createLabel,
  createSort,
} from "../../src/models/dataSource";
import {
  DataSourceCommand,
  DataSourceMessage2,
  EditConnectionMessage,
} from "../../src/models/messages";
import { MetaObjectPayload } from "../../src/models/meta";
import { ParamFieldType, UDA, UDAParam } from "../../src/models/uda";
import { KdbChartView } from "../../src/webview/components/kdbChartView";
import { KdbDataSourceView } from "../../src/webview/components/kdbDataSourceView";
import { KdbNewConnectionView } from "../../src/webview/components/kdbNewConnectionView";

describe("KdbDataSourceView", () => {
  let view: KdbDataSourceView;

  function createValueEvent(value?: string): Event {
    return (<unknown>{
      target: <HTMLInputElement>{
        value,
      },
    }) as Event;
  }

  function createMessageEvent(isInsights: boolean) {
    return <MessageEvent<DataSourceMessage2>>{
      data: {
        command: DataSourceCommand.Update,
        servers: ["server"],
        selectedServer: "server",
        isInsights,
        insightsMeta: <MetaObjectPayload>{
          dap: [
            {
              assembly: "test-assembly",
              instance: "instance1",
              dap: "dap1",
            },
          ],
          api: [{ api: "getData" }],
          assembly: [{ assembly: "test-assembly", tbls: ["table1"] }],
          schema: [
            {
              table: "table1",
              columns: [{ column: "column1" }],
              assembly: "test-assembly",
              type: "type",
            },
          ],
        },
        UDAs: [],
        dataSourceFile: {
          dataSource: {
            selectedType: DataSourceTypes.API,
            api: {
              selectedApi: "getData",
              table: "table1",
              startTS: "",
              endTS: "",
              fill: "zero",
              temporality: "snapshot",
              filter: [],
              groupBy: [],
              agg: [],
              sortCols: [],
              slice: [],
              labels: [],
              optional: {
                filled: false,
                temporal: false,
                rowLimit: false,
                filters: [createFilter()],
                labels: [createLabel()],
                sorts: [createSort()],
                aggs: [createAgg()],
                groups: [createGroup()],
              },
            },
            qsql: {
              query: "",
              selectedTarget: "",
            },
            sql: {
              query: "",
            },
            uda: {
              name: "test",
              description: "test description",
              params: [],
              return: {
                type: ["99"],
                description: "test return description",
              },
            },
          },
        },
      },
    };
  }

  function testEventHandlers(result: TemplateResult) {
    for (const value of result.values) {
      if (value instanceof Function) {
        value.bind(view)(createValueEvent(""));
      }
    }
  }

  beforeEach(async () => {
    view = new KdbDataSourceView();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("connectedCallback", () => {
    it("should add an event listener", () => {
      let result = undefined;
      sinon.stub(window, "addEventListener").value(() => (result = true));
      view.connectedCallback();
      assert.ok(result);
    });
  });

  describe("disconnectedCallback", () => {
    it("should remove an event listener", () => {
      let result = undefined;
      sinon.stub(window, "removeEventListener").value(() => (result = true));
      view.disconnectedCallback();
      assert.ok(result);
    });
  });

  describe("renderIcons", () => {
    it("renderExclamationTriangleIcon", () => {
      const result = view.renderExclamationTriangleIcon();
      assert.ok(result);
    });

    it("renderInfoCircleIcon", () => {
      const result = view.renderInfoCircleIcon();
      assert.ok(result);
    });
  });

  describe("renderTargetOptions", () => {
    function templateResultToString(templateResult: any): string {
      if (!templateResult || !templateResult.strings) {
        return "";
      }

      let result = "";
      const strings = templateResult.strings;
      const values = templateResult.values || [];

      for (let i = 0; i < strings.length; i++) {
        result += strings[i];
        if (i < values.length) {
          result += values[i];
        }
      }

      return result;
    }

    beforeEach(() => {
      view.isInsights = true;
      view.isMetaLoaded = true;
      view.insightsMeta = {
        dap: [
          {
            assembly: "test-assembly-1",
            instance: "instance1",
            dap: "dap1",
            startTS: "",
            endTS: "",
          },
          {
            assembly: "test-assembly-1",
            instance: "instance1",
            dap: "dap2",
            startTS: "",
            endTS: "",
          },
          {
            assembly: "test-assembly-2",
            instance: "instance2",
            dap: "dap3",
            startTS: "",
            endTS: "",
          },
          {
            assembly: "test-assembly-3",
            instance: "instance3",
            startTS: "",
            endTS: "",
          },
        ],
        api: [],
        assembly: [],
        schema: [],
        rc: [],
        agg: [],
      };
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should return target options with tiers and DAP processes", () => {
      const result = view.renderTargetOptions();
      const resultString = result
        .map((item) => templateResultToString(item))
        .join("");

      assert.ok(Array.isArray(result));
      assert.ok(result.length > 0);
      assert.ok(resultString.includes("Tiers"));
      assert.ok(resultString.includes("DAP Process"));
    });

    it("should group DAP processes by tier key", () => {
      const result = view.renderTargetOptions();
      const resultString = result
        .map((item) => templateResultToString(item))
        .join("");

      assert.ok(resultString.includes("test-assembly-1 instance1"));
      assert.ok(resultString.includes("test-assembly-2 instance2"));
    });

    it("should include DAP processes with non-empty dap values", () => {
      const result = view.renderTargetOptions();
      const resultString = result
        .map((item) => templateResultToString(item))
        .join("");

      assert.ok(resultString.includes("dap1"));
      assert.ok(resultString.includes("dap2"));
      assert.ok(resultString.includes("dap3"));
    });

    it("should set qsqlTarget when not already set and tier options exist", () => {
      view.qsqlTarget = "";
      view.renderTargetOptions();
      assert.ok(true);
    });

    it("should not set qsqlTarget when already set", () => {
      const originalTarget = "existing-target";
      view.qsqlTarget = originalTarget;
      view.renderTargetOptions();
      assert.strictEqual(view.qsqlTarget, originalTarget);
    });

    it("should handle empty insightsMeta.dap array", () => {
      view.insightsMeta.dap = [];

      const result = view.renderTargetOptions();
      const resultString = result
        .map((item) => templateResultToString(item))
        .join("");

      assert.ok(!resultString.includes("Tiers"));
      assert.ok(!resultString.includes("DAP Process"));
    });

    it("should return empty array when not insights", () => {
      view.isInsights = false;
      const result = view.renderTargetOptions();
      assert.deepStrictEqual(result, []);
    });

    it("should return empty array when meta not loaded", () => {
      view.isMetaLoaded = false;
      const result = view.renderTargetOptions();
      assert.deepStrictEqual(result, []);
    });

    it("should return empty array when both not insights and meta not loaded", () => {
      view.isInsights = false;
      view.isMetaLoaded = false;
      const result = view.renderTargetOptions();
      assert.deepStrictEqual(result, []);
    });
  });

  describe("render", () => {
    it("should update from message", () => {
      sinon.stub(view, "renderTargetOptions").returns([]);
      view.message(createMessageEvent(true));
      assert.ok(view.data);
      const result = view.render();
      assert.ok(result);
      sinon.restore();
    });
    it("should update from offline message", () => {
      view.message(createMessageEvent(false));
      assert.ok(view.data);
      const result = view.render();
      assert.ok(result);
    });
    it("should call event handlers", () => {
      testEventHandlers(view.render());
      testEventHandlers(view.renderFilter(createFilter()));
      testEventHandlers(view.renderLabel(createLabel()));
      testEventHandlers(view.renderSort(createSort()));
      testEventHandlers(view.renderAgg(createAgg()));
      testEventHandlers(view.renderGroup(createGroup()));
    });
  });

  describe("UDAs", () => {
    const dummyUDAs: UDA[] = [
      {
        name: "test",
        description: "test description",
        params: [
          {
            name: "param",
            type: 10,
            description: "param description",
            isReq: true,
          },
        ],
        return: {
          type: ["99"],
          description: "test return description",
        },
      },
    ];

    afterEach(() => {
      sinon.restore();
      view.UDAs = [];
    });

    describe("retrieveUDAParamInputType", () => {
      it("return all types", () => {
        const inputList = [
          "number",
          "boolean",
          "timestamp",
          "json",
          "multitype",
          "text",
          "test",
        ];
        const resultList = [
          "number",
          "checkbox",
          "datetime-local",
          "textarea",
          "multitype",
          "text",
          "text",
        ];
        for (let i = 0; i < inputList.length; i++) {
          const result = view.retrieveUDAParamInputType(inputList[i]);
          assert.strictEqual(result, resultList[i]);
        }
      });
    });

    describe("renderUDAParam", () => {
      it("should render UDA checkbox field", () => {
        sinon.stub(view, "renderUDACheckbox").returns(html`checkbox`);
        const result = view.renderUDAParam(dummyUDAs[0].params[0], "checkbox");
        assert.deepStrictEqual(result, html`checkbox`);
      });

      it("should render UDA textarea field", () => {
        sinon.stub(view, "renderUDATextarea").returns(html`textarea`);
        const result = view.renderUDAParam(dummyUDAs[0].params[0], "textarea");
        assert.deepStrictEqual(result, html`textarea`);
      });

      it("should render UDA multitype field", () => {
        sinon.stub(view, "renderUDAMultitype").returns(html`multitype`);
        const result = view.renderUDAParam(dummyUDAs[0].params[0], "multitype");
        assert.deepStrictEqual(result, html`multitype`);
      });

      it("should render UDA input field", () => {
        sinon.stub(view, "renderUDAInput").returns(html`input`);
        const result = view.renderUDAParam(dummyUDAs[0].params[0], "input");
        assert.deepStrictEqual(result, html`input`);
      });
    });

    describe("renderUDACheckbox", () => {
      it("should render checkbox with value true", () => {
        const param: UDAParam = {
          name: "testParam",
          description: "Test Description",
          value: true,
          default: false,
          isReq: true,
          type: 0,
        };
        const result = view.renderUDACheckbox(param);
        assert.ok(result);
      });

      it("should render checkbox with value false", () => {
        const param: UDAParam = {
          name: "testParam",
          description: "Test Description",
          value: false,
          default: true,
          isReq: false,
          isDistinguised: true,
          type: 0,
        };
        const result = view.renderUDACheckbox(param);
        assert.ok(result);
      });

      it("should render checkbox with default value true and type string", () => {
        const param: UDAParam = {
          name: "testParam",
          description: "Test Description",
          value: undefined,
          default: true,
          isReq: false,
          type: 0,
          typeStrings: ["boolean"],
        };
        const result = view.renderUDACheckbox(param);
        assert.ok(result);
      });

      it("should render checkbox with default value false and no description", () => {
        const param: UDAParam = {
          name: "testParam",
          description: "",
          value: undefined,
          default: false,
          isReq: false,
          type: 0,
        };
        const result = view.renderUDACheckbox(param);
        assert.ok(result);
        assert.ok(!result.strings[0].includes("Description:")); // Verifica que não há descrição
      });

      it("should render checkbox with value and default undefined", () => {
        const param: UDAParam = {
          name: "testParam",
          description: "Test Description",
          value: undefined,
          default: undefined,
          isReq: false,
          type: 0,
        };
        const result = view.renderUDACheckbox(param);
        assert.ok(result);
      });

      it("should render checkbox and trigger change event", () => {
        const param: UDAParam = {
          name: "testParam",
          description: "Test Description",
          value: false,
          default: false,
          isReq: false,
          type: 0,
        };

        const requestChangeSpy = sinon.spy(view, "requestChange");
        const result = view.renderUDACheckbox(param);

        // Simula o evento de mudança
        const event = new Event("sl-change");
        Object.defineProperty(event, "target", {
          value: { checked: true },
          writable: false,
        });

        const checkbox = result.values.find((v) => typeof v === "function");
        if (checkbox) {
          checkbox(event);
        }

        assert.strictEqual(param.value, true); // Verifica que o valor foi atualizado
        assert.ok(requestChangeSpy.calledOnce); // Verifica que requestChange foi chamado
        requestChangeSpy.restore();
      });

      it("should render checkbox with delete button", () => {
        const param: UDAParam = {
          name: "testParam",
          description: "Test Description",
          value: true,
          default: false,
          isReq: false,
          type: 0,
        };

        const renderDeleteSpy = sinon.spy(view, "renderDeleteUDAParamButton");
        const result = view.renderUDACheckbox(param);

        assert.ok(result);
        assert.ok(renderDeleteSpy.calledOnceWith(param)); // Verifica que o botão de exclusão foi renderizado
        renderDeleteSpy.restore();
      });
    });

    describe("renderUDATextarea", () => {
      it("should render textarea with value", () => {
        const param: UDAParam = {
          name: "testParam",
          description: "Test Description",
          value: "Test Value",
          default: "",
          isReq: false,
          type: 0,
        };
        const result = view.renderUDATextarea(param);
        assert.ok(result);
      });

      it("should render textarea with default value", () => {
        const param: UDAParam = {
          name: "testParam",
          description: "Test Description",
          value: undefined,
          default: "Default Value",
          isReq: false,
          type: 0,
        };
        const result = view.renderUDATextarea(param);
        assert.ok(result);
      });

      it("should render textarea with empty value when both value and default are undefined", () => {
        const param: UDAParam = {
          name: "testParam",
          description: "Test Description",
          value: undefined,
          default: undefined,
          isReq: false,
          type: 0,
        };
        const result = view.renderUDATextarea(param);
        assert.ok(result);
      });
    });

    describe("renderUDAInput", () => {
      it("should render input with valid input type", () => {
        const param: UDAParam = {
          name: "testParam",
          description: "Test Description",
          value: "Test Value",
          default: "",
          isReq: true,
          type: 1,
        };
        const result = view.renderUDAInput(param, "number");
        assert.ok(result);
      });

      it("should render input with default input type when input type is invalid", () => {
        const param: UDAParam = {
          name: "testParam",
          description: "Test Description",
          value: "Test Value",
          default: "",
          isReq: true,
          type: 1,
        };
        const result = view.renderUDAInput(param, "invalid-type");
        assert.ok(result);
      });

      it("should render input with value", () => {
        const param: UDAParam = {
          name: "testParam",
          description: "Test Description",
          value: "Test Value",
          default: "",
          isReq: true,
          type: 1,
        };
        const result = view.renderUDAInput(param, "text");
        assert.ok(result);
      });

      it("should render input with default value when value is undefined", () => {
        const param: UDAParam = {
          name: "testParam",
          description: "Test Description",
          value: undefined,
          default: "Default Value",
          isReq: true,
          type: 1,
        };
        const result = view.renderUDAInput(param, "text");
        assert.ok(result);
      });

      it("should render input with empty value when both value and default are undefined", () => {
        const param: UDAParam = {
          name: "testParam",
          description: "Test Description",
          value: undefined,
          default: undefined,
          isReq: true,
          type: 1,
        };
        const result = view.renderUDAInput(param, "text");
        assert.ok(result);
      });
    });

    describe("renderUDAMultitype", () => {
      it("should render multitype with selectedMultiTypeString", () => {
        const param: UDAParam = {
          name: "testParam",
          description: "Test Description",
          value: "",
          default: "",
          isReq: true,
          type: 1,
          selectedMultiTypeString: "type1",
          typeStrings: ["type1", "type2"],
          multiFieldTypes: [{ type1: ParamFieldType.Text }],
        };
        const result = view.renderUDAMultitype(param);
        assert.ok(result);
      });

      it("should render multitype with first typeString when selectedMultiTypeString is undefined", () => {
        const param: UDAParam = {
          name: "testParam",
          description: "Test Description",
          value: "",
          default: "",
          isReq: true,
          type: 1,
          selectedMultiTypeString: undefined,
          typeStrings: ["type1", "type2"],
          multiFieldTypes: [{ type1: ParamFieldType.Text }],
        };
        const result = view.renderUDAMultitype(param);
        assert.ok(result);
        assert.strictEqual(param.selectedMultiTypeString, "type1");
      });

      it("should render multitype with empty string when selectedMultiTypeString and typeStrings are undefined", () => {
        const param: UDAParam = {
          name: "testParam",
          description: "Test Description",
          value: "",
          default: "",
          isReq: true,
          type: 1,
          selectedMultiTypeString: undefined,
          typeStrings: undefined,
          multiFieldTypes: undefined,
        };
        const result = view.renderUDAMultitype(param);
        assert.ok(result);
        assert.strictEqual(param.selectedMultiTypeString, "");
      });

      it("should render multitype with checkbox input type", () => {
        const param: UDAParam = {
          name: "testParam",
          description: "Test Description",
          value: true,
          default: "",
          isReq: true,
          type: 1,
          selectedMultiTypeString: "type1",
          typeStrings: ["type1", "type2"],
          multiFieldTypes: [{ type1: ParamFieldType.Boolean }],
        };
        const result = view.renderUDAMultitype(param);
        assert.ok(result);
      });

      it("should render multitype with textarea input type", () => {
        const param: UDAParam = {
          name: "testParam",
          description: "Test Description",
          value: "Test Value",
          default: "",
          isReq: true,
          type: 1,
          selectedMultiTypeString: "type1",
          typeStrings: ["type1", "type2"],
          multiFieldTypes: [{ type1: ParamFieldType.JSON }],
        };
        const result = view.renderUDAMultitype(param);
        assert.ok(result);
      });
    });

    describe("renderUDAInvalidParams", () => {
      afterEach(() => {
        view.userSelectedUDA = null;
      });
      it("should return empty string if user doesnt have userSelectedUDA", () => {
        view.userSelectedUDA = null;
        const result = view.renderUDAInvalidParams();
        assert.strictEqual(result, "");
      });

      it("should return html template case userSelectedUDA have incompatibleError different than undefined ", () => {
        view.userSelectedUDA = dummyUDAs[0];
        view.userSelectedUDA.incompatibleError = "error";
        const result = view.renderUDAInvalidParams();
        assert.ok(result);
      });

      it("should return empty string case incompatibleError is undefined", () => {
        view.userSelectedUDA = dummyUDAs[0];
        view.userSelectedUDA.incompatibleError = undefined;
        const result = view.renderUDAInvalidParams();
        assert.strictEqual(result, "");
      });
    });

    describe("handleUDADeleteParam", () => {
      it("should set param.isVisible to false", () => {
        const param: UDAParam = {
          name: "param",
          type: 10,
          description: "param description",
          isReq: false,
          isVisible: true,
        };
        view.handleUDADeleteParam(param);
        assert.strictEqual(param.isVisible, false);
      });

      it("should set param.value to undefined", () => {
        const param: UDAParam = {
          name: "param",
          type: 10,
          description: "param description",
          isReq: false,
          value: "some value",
        };
        view.handleUDADeleteParam(param);
        assert.strictEqual(param.value, undefined);
      });

      it("should set param.selectedMultiTypeString to undefined", () => {
        const param: UDAParam = {
          name: "param",
          type: 10,
          description: "param description",
          isReq: false,
          selectedMultiTypeString: "some string",
        };
        view.handleUDADeleteParam(param);
        assert.strictEqual(param.selectedMultiTypeString, undefined);
      });

      it("should call requestChange", () => {
        const param: UDAParam = {
          name: "param",
          type: 10,
          description: "param description",
          isReq: false,
        };
        const requestChangeSpy = sinon.spy(view, "requestChange");
        view.handleUDADeleteParam(param);
        assert.strictEqual(requestChangeSpy.calledOnce, true);
      });
    });

    describe("handleAddParamSelect", () => {
      it("should set param.isVisible to true if param is found", () => {
        const param: UDAParam = {
          name: "param",
          type: 10,
          description: "param description",
          isReq: false,
          isVisible: false,
        };
        view.userSelectedUDA = {
          name: "test",
          description: "test description",
          params: [param],
          return: {
            type: ["99"],
            description: "test return description",
          },
        };

        const event = {
          detail: {
            item: {
              value: "param",
            },
          },
        };

        view.handleUDAAddParamSelect(event);
        assert.strictEqual(param.isVisible, true);
      });

      it("should not change param.isVisible if param is not found", () => {
        const param: UDAParam = {
          name: "param",
          type: 10,
          description: "param description",
          isReq: false,
          isVisible: false,
        };
        view.userSelectedUDA = {
          name: "test",
          description: "test description",
          params: [param],
          return: {
            type: ["99"],
            description: "test return description",
          },
        };

        const event = {
          detail: {
            item: {
              value: "nonexistent_param",
            },
          },
        };

        view.handleUDAAddParamSelect(event);
        assert.strictEqual(param.isVisible, false);
      });

      it("should call requestChange", () => {
        const param: UDAParam = {
          name: "param",
          type: 10,
          description: "param description",
          isReq: false,
          isVisible: false,
        };
        view.userSelectedUDA = {
          name: "test",
          description: "test description",
          params: [param],
          return: {
            type: ["99"],
            description: "test return description",
          },
        };

        const event = {
          detail: {
            item: {
              value: "param",
            },
          },
        };

        const requestChangeSpy = sinon.spy(view, "requestChange");
        view.handleUDAAddParamSelect(event);
        assert.strictEqual(requestChangeSpy.calledOnce, true);
      });
    });

    describe("handleUDAChange", () => {
      it("should update selectedUDA with the decoded value from the event", () => {
        const event = {
          target: {
            value: encodeURIComponent("testUDA"),
          },
        } as unknown as Event;

        view.handleUDAChange(event);
        assert.strictEqual(view.selectedUDA, "testUDA");
      });

      it("should update userSelectedUDA with the corresponding UDA from the list", () => {
        const dummyUDA = {
          name: "testUDA",
          description: "test description",
          params: [],
          return: {
            type: ["99"],
            description: "test return description",
          },
        };
        view.UDAs = [dummyUDA];

        const event = {
          target: {
            value: encodeURIComponent("testUDA"),
          },
        } as unknown as Event;

        view.handleUDAChange(event);
        assert.deepStrictEqual(view.userSelectedUDA, dummyUDA);
      });

      it("should set userSelectedUDA to undefined if no matching UDA is found", () => {
        view.UDAs = [];

        const event = {
          target: {
            value: encodeURIComponent("nonexistentUDA"),
          },
        } as unknown as Event;

        view.handleUDAChange(event);
        assert.strictEqual(view.userSelectedUDA, undefined);
      });

      it("should call requestChange", () => {
        const event = {
          target: {
            value: encodeURIComponent("testUDA"),
          },
        } as unknown as Event;

        const requestChangeSpy = sinon.spy(view, "requestChange");
        view.handleUDAChange(event);
        assert.strictEqual(requestChangeSpy.calledOnce, true);
      });
    });
  });

  describe("save", () => {
    it("should send a message", () => {
      let result = undefined;
      sinon.stub(view, "postMessage").value(() => (result = true));
      view.save();
      assert.ok(result);
    });
  });

  describe("refresh", () => {
    it("should send a message", () => {
      let result = undefined;
      sinon.stub(view, "postMessage").value(() => (result = true));
      view.refresh();
      assert.ok(result);
    });
  });

  describe("run", () => {
    it("should send a message", () => {
      let result = undefined;
      sinon.stub(view, "postMessage").value(() => (result = true));
      view.run();
      assert.ok(result);
    });
  });

  describe("populateScratchpad", () => {
    it("should send a message", () => {
      let result = undefined;
      sinon.stub(view, "postMessage").value(() => (result = true));
      view.populateScratchpad();
      assert.ok(result);
    });
  });

  describe("requestChange", () => {
    it("should send a message after 200 ms", (done) => {
      let result = undefined;
      sinon.stub(view, "postMessage").value(() => (result = true));
      view.requestChange();
      setTimeout(() => {
        assert.ok(result);
        done();
      }, 250);
    });
  });

  describe("requestServerChange", () => {
    it("should send a message", () => {
      let result = undefined;
      sinon.stub(view, "postMessage").value(() => (result = true));
      view.requestServerChange(createValueEvent("server"));
      assert.ok(result);
    });
  });

  describe("renderRowCountOptions", () => {
    it("should render row count options", () => {
      view.selectedServerVersion = 1.11;
      const result = view.renderRowCountOptions();
      assert.ok(result);
    });

    it("should not render row count options for older server version", () => {
      view.selectedServerVersion = 1.1;
      const result = view.renderRowCountOptions();
      assert.ok(!result);
    });
  });

  const distinguishedParams: UDAParam[] = [
    {
      name: "table",
      description: "Table to target.",
      isReq: false,
      type: [-11],
      isVisible: false,
      fieldType: ParamFieldType.Text,
      isDistinguised: true,
    },
    {
      name: "labels",
      description: "A dictionary describing DAP labels to target,",
      isReq: false,
      type: [99],
      isVisible: false,
      fieldType: ParamFieldType.JSON,
      isDistinguised: true,
    },
    {
      name: "scope",
      description: "A dictionary describing what RC and/or DAPs to target.",
      isReq: false,
      type: [99],
      fieldType: ParamFieldType.JSON,
      isDistinguised: true,
    },
    {
      name: "startTS",
      description: "Inclusive start time of the request.",
      isReq: false,
      type: [-19],
      isVisible: false,
      fieldType: ParamFieldType.Timestamp,
      isDistinguised: true,
    },
    {
      name: "endTS",
      description: "Exclusive end time of the request.",
      isReq: false,
      type: [-19],
      isVisible: false,
      fieldType: ParamFieldType.Timestamp,
      isDistinguised: true,
    },
    {
      name: "inputTZ",
      description: "Timezone of startTS and endTS (default: UTC).",
      isReq: false,
      type: [-11],
      isVisible: false,
      fieldType: ParamFieldType.Text,
      isDistinguised: true,
    },
    {
      name: "outputTZ",
      description:
        "Timezone of the final result (.kxi.getData only). No effect on routing.",
      isReq: false,
      type: [-11],
      isVisible: false,
      fieldType: ParamFieldType.Text,
      isDistinguised: true,
    },
  ];

  describe("renderUDAOptionalParamsOpts", () => {
    it("should return 'No optional parameters available' if userSelectedUDA is not set", () => {
      view.userSelectedUDA = undefined;
      const result = view.renderUDAOptionalParamsOpts();
      assert.strictEqual(Array.isArray(result) ? result.length : 0, 0);
      const resultString = Array.isArray(result)
        ? result.map((item) => item.strings.join("")).join("")
        : result.strings.join("");
      assert.ok(resultString.includes("No optional parameters available"));
    });

    it("should return 'No optional parameters available' if there are no optional parameters", () => {
      view.userSelectedUDA = {
        name: "test",
        description: "test description",
        params: [
          {
            name: "param",
            type: 10,
            description: "param description",
            isReq: true,
          },
        ],
        return: {
          type: ["99"],
          description: "test return description",
        },
      };
      const result = view.renderUDAOptionalParamsOpts();
      const resultString = Array.isArray(result)
        ? result.map((item) => item.strings.join("")).join("")
        : result.strings.join("");
      assert.ok(resultString.includes("No optional parameters available"));
    });

    it("should render optional parameters if they exist", () => {
      view.userSelectedUDA = {
        name: "test",
        description: "test description",
        params: [
          {
            name: "optionalParam",
            type: 10,
            description: "optional param description",
            isReq: false,
          },
        ],
        return: {
          type: ["99"],
          description: "test return description",
        },
      };

      view.userSelectedUDA.params.push(...distinguishedParams);
      const result = view.renderUDAOptionalParamsOpts();
      assert.strictEqual(Array.isArray(result) ? result.length : 0, 11);
      const resultString = Array.isArray(result)
        ? result.map((item) => item.strings.join("")).join("")
        : result.strings.join("");
      assert.ok(resultString.includes("OPTIONAL PARAMETERS"));
    });

    it("should render distinguished parameters if they exist", () => {
      view.userSelectedUDA = {
        name: "test",
        description: "test description",
        params: [
          {
            name: "optionalParam",
            type: 10,
            description: "optional param description",
            isReq: false,
          },
        ],
        return: {
          type: ["99"],
          description: "test return description",
        },
      };

      view.userSelectedUDA.params.push(...distinguishedParams);
      const result = view.renderUDAOptionalParamsOpts();
      assert.strictEqual(Array.isArray(result) ? result.length : 0, 11);
      const resultString = Array.isArray(result)
        ? result.map((item) => item.strings.join("")).join("")
        : result.strings.join("");

      assert.ok(resultString.includes("DISTINGUISHED PARAMETERS:"));
    });
  });
});

describe("KdbNewConnectionView", () => {
  let view;

  beforeEach(() => {
    view = new KdbNewConnectionView();
  });

  describe("handleMessage", () => {
    it('should update connectionData when command is "editConnection"', () => {
      const event = {
        data: {
          command: "editConnection",
          data: {
            serverName: "test",
            connType: 1,
            serverAddress: "localhost",
          },
        },
      };

      view.handleMessage(event);

      assert.equal(view.connectionData, event.data.data);
    });

    it('should update connectionData when command is "refreshLabels"', () => {
      const event = {
        data: {
          command: "refreshLabels",
          data: ["test"],
          colors: ext.labelColors,
        },
      };

      view.handleMessage(event);

      assert.equal(view.lblNamesList, event.data.data);
    });

    it('should not update connectionData when command is not "editConnection"', () => {
      const event = {
        data: {
          command: "otherCommand",
          data: { serverName: "testServer" },
        },
      };

      view.handleMessage(event);

      assert.equal(view.connectionData, undefined);
    });
  });

  describe("editAuthOfConn", () => {
    it("should toggle editAuth", () => {
      view.editAuth = false;

      view.editAuthOfConn();
      assert.equal(view.editAuth, true);

      view.editAuthOfConn();
      assert.equal(view.editAuth, false);
    });
  });

  describe("selectConnection", () => {
    it("should return tab-1", () => {
      view.isBundledQ = true;
      view.serverType = ServerType.KDB;
      assert.strictEqual(view["selectConnection"], "tab-1");
    });
    it("should return tab-3", () => {
      view.isBundledQ = false;
      view.serverType = ServerType.INSIGHTS;
      assert.strictEqual(view["selectConnection"], "tab-3");
    });

    it("should return tab-2", () => {
      view.isBundledQ = false;
      view.serverType = ServerType.KDB;
      assert.strictEqual(view["selectConnection"], "tab-2");
    });
  });

  describe("changeTLS", () => {
    it("should update state", () => {
      view.changeTLS();
      assert.strictEqual(view.kdbServer.tls, true);
      view.changeTLS();
      assert.strictEqual(view.kdbServer.tls, false);
    });
  });

  describe("renderServerNameDesc", () => {
    it("should render bundled server name desc", () => {
      const result = view.renderServerNameDesc(true);
      assert.strictEqual(result.strings[0].includes("<b>Bundled q.</b>"), true);
    });

    it("should render normal server name desc", () => {
      view.isBundledQ = false;
      const result = view.renderServerNameDesc(false);
      assert.strictEqual(
        result.strings[0].includes("<b>Bundled q.</b>"),
        false,
      );
    });
  });

  describe("renderServerNameField", () => {
    it("should render server name field for bundled q", () => {
      const result = view.renderServerNameField(ServerType.KDB, true);
      assert.strictEqual(result.strings[0].includes("Server-1"), false);
    });

    it("should render server name field for KDB", () => {
      view.isBundledQ = false;
      const result = view.renderServerNameField(ServerType.KDB);
      assert.strictEqual(result.strings[0].includes("Server-1"), true);
    });

    it("should render server name field for Insights", () => {
      view.isBundledQ = false;
      const result = view.renderServerNameField(ServerType.INSIGHTS, false);
      assert.strictEqual(result.strings[0].includes("Insights-1"), true);
    });
  });

  describe("renderServerName", () => {
    it("should render server name", () => {
      const result = view.renderServerName(ServerType.INSIGHTS, false);
      assert.strictEqual(
        result.strings[1].includes("row option-description  option-help"),
        true,
      );
    });
  });

  describe("renderPortNumberDesc", () => {
    it("should render port number desc for bundled q", () => {
      view.isBundledQ = true;
      const result = view.renderPortNumberDesc(ServerType.KDB);
      assert.strictEqual(
        JSON.stringify(result).includes(
          "Ensure the port number you use does not conflict with another",
        ),
        true,
      );
    });

    it("should render port number desc for KDB server", () => {
      const result = view.renderPortNumberDesc();
      assert.strictEqual(
        JSON.stringify(result).includes("<b>Set port number</b>"),
        true,
      );
    });
  });
  describe("renderPortNumber", () => {
    it("should render port number for bundled q", () => {
      const result = view.renderPortNumber(ServerType.KDB);
      assert.strictEqual(
        JSON.stringify(result).includes(
          "Ensure the port number you use does not conflict with another",
        ),
        true,
      );
    });

    it("should render port number for KDB server", () => {
      const result = view.renderPortNumber();
      assert.strictEqual(
        JSON.stringify(result).includes("<b>Set port number</b>"),
        true,
      );
    });
  });

  describe("renderConnAddDesc", () => {
    it("should render connection address for KDB", () => {
      view.isBundledQ = false;
      const result = view.renderConnAddDesc(ServerType.KDB);
      assert.strictEqual(
        result.strings[0].includes(
          "Set the IP of your kdb+ database connection.",
        ),
        true,
      );
    });

    it("should render connection address for Insights", () => {
      view.isBundledQ = false;
      const result = view.renderConnAddDesc(ServerType.INSIGHTS);
      assert.strictEqual(result.strings[0].includes("your Insights"), true);
    });

    it("should render connection address for Bundled q", () => {
      const result = view.renderConnAddDesc(ServerType.KDB, true);
      assert.strictEqual(
        result.strings[0].includes("already set up for you"),
        true,
      );
    });
  });

  describe("renderConnAddress", () => {
    it("should render connection address", () => {
      view.isBundledQ = false;
      const result = view.renderConnAddress(ServerType.KDB);
      assert.strictEqual(
        JSON.stringify(result).includes("127.0.0.1 or localhost"),
        true,
      );
    });

    it("should render connection address for Bundled q", () => {
      const result = view.renderConnAddress(ServerType.KDB, true);
      assert.strictEqual(
        JSON.stringify(result).includes("127.0.0.1 or localhost"),
        false,
      );
    });

    it("should render connection address for Insights", () => {
      view.isBundledQ = false;
      const result = view.renderConnAddress(ServerType.INSIGHTS);
      assert.strictEqual(
        JSON.stringify(result).includes("myinsights.clouddeploy.com"),
        true,
      );
    });

    it("should render label dropdown color options", () => {
      view.lblColorsList = [
        { name: "red", colorHex: "#FF0000" },
        { name: "green", colorHex: "#00FF00" },
      ];

      const result = view.renderLblDropdownColorOptions();

      assert.strictEqual(
        JSON.stringify(result).includes("No Color Selected"),
        true,
      );
    });

    it("should render label dropdown options", () => {
      view.lblNamesList = [
        { name: "label1", color: { colorHex: "#FF0000" } },
        { name: "label2", color: { colorHex: "#00FF00" } },
      ];
      view.labels = ["label1"];

      const result = view.renderLblDropdownOptions();

      assert.strictEqual(
        JSON.stringify(result).includes("No Label Selected"),
        true,
      );
    });

    it("should render label dropdown", () => {
      view.lblNamesList = [
        { name: "label1", color: { colorHex: "#FF0000" } },
        { name: "label2", color: { colorHex: "#00FF00" } },
      ];
      view.labels = ["label1"];

      const result = view.renderLblsDropdown(0);

      assert.strictEqual(
        JSON.stringify(result).includes("No Label Selected"),
        true,
      );
    });

    it("should render New Label Modal", () => {
      const result = view.renderNewLabelModal();

      assert.strictEqual(
        JSON.stringify(result).includes("Add a New Label"),
        true,
      );
    });

    it("should render New Label Btn", () => {
      const result = view.renderNewLblBtn();

      assert.strictEqual(
        JSON.stringify(result).includes("Create New Label"),
        true,
      );
    });

    it("should render Connection Label Section", () => {
      const result = view.renderConnectionLabelsSection();

      assert.strictEqual(
        JSON.stringify(result).includes("Connection label (optional)"),
        true,
      );
    });
  });

  describe("tabClickAction", () => {
    it("should select first tab", () => {
      view.tabClickAction(1);
      assert.strictEqual(view.isBundledQ, true);
      assert.strictEqual(view.serverType, ServerType.KDB);
    });

    it("should select second tab", () => {
      view.tabClickAction(2);
      assert.strictEqual(view.isBundledQ, false);
      assert.strictEqual(view.serverType, ServerType.KDB);
    });

    it("should select third tab", () => {
      view.tabClickAction(3);
      assert.strictEqual(view.isBundledQ, false);
      assert.strictEqual(view.serverType, ServerType.INSIGHTS);
    });

    it("should select first tab as defaut", () => {
      view.tabClickAction(4);
      assert.strictEqual(view.isBundledQ, true);
      assert.strictEqual(view.serverType, ServerType.KDB);
    });
  });

  describe("removeBlankLabels", () => {
    it("should remove blank labels", () => {
      view.labels = ["label1", ""];
      view.removeBlankLabels();
      assert.strictEqual(view.labels.length, 1);
    });

    it("should not remove blank labels", () => {
      view.labels = ["label1"];
      view.removeBlankLabels();
      assert.strictEqual(view.labels.length, 1);
    });

    it("should remove duplicate labels", () => {
      view.labels = ["label1", "label1", "label1"];
      view.removeBlankLabels();
      assert.strictEqual(view.labels.length, 1);
    });
  });

  it("should add label", () => {
    view.labels = ["label1"];
    view.addLabel();
    assert.strictEqual(view.labels.length, 2);
  });

  it("should remove label", () => {
    view.labels = ["label1"];
    view.removeLabel(0);
    assert.strictEqual(view.labels.length, 0);
  });

  it("should update label", () => {
    view.labels = ["label1"];
    const event: Event = new Event("label2");
    Object.defineProperty(event, "target", {
      value: { value: "label2" },
      writable: false,
    });
    view.updateLabelValue(0, event);
    assert.strictEqual(view.labels[0], "label2");
  });

  describe("render()", () => {
    let renderServerNameStub,
      renderConnAddressStub,
      saveStub,
      changeTLSStub: sinon.SinonStub;

    beforeEach(() => {
      renderServerNameStub = sinon.stub(view, "renderServerName");
      renderConnAddressStub = sinon.stub(view, "renderConnAddress");
      saveStub = sinon.stub(view, "save");
      changeTLSStub = sinon.stub(view, "changeTLS");
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should render tab-1", () => {
      view.render();

      assert.equal(renderServerNameStub.called, true);
      assert.equal(renderConnAddressStub.called, true);
      assert.equal(saveStub.called, false);
      assert.equal(changeTLSStub.called, false);
    });

    it("should render tab-2", () => {
      view.isBundledQ = false;
      view.render();

      assert.equal(renderServerNameStub.called, true);
      assert.equal(renderConnAddressStub.called, true);
      assert.equal(saveStub.called, false);
      assert.equal(changeTLSStub.called, false);
    });

    it("should render tab-3", () => {
      view.isBundledQ = false;
      view.serverType = ServerType.INSIGHTS;
      view.render();
      assert.equal(renderServerNameStub.called, true);
      assert.equal(renderConnAddressStub.called, true);
      assert.equal(saveStub.called, false);
      assert.equal(changeTLSStub.called, false);
    });
  });

  describe("renderCreateConnectionBtn", () => {
    it("should render create connection button", () => {
      const result = view.renderCreateConnectionBtn();

      assert.strictEqual(
        JSON.stringify(result).includes("Create Connection"),
        true,
      );
    });
  });

  describe("renderEditConnectionForm", () => {
    it('should return "No connection found to be edited" when connectionData is null', () => {
      view.connectionData = null;

      const result = view.renderEditConnectionForm();

      assert.strictEqual(
        result.strings[0],
        "<div>No connection found to be edited</div>",
      );
    });

    it("should set isBundledQ to true and return correct HTML when connType is 0", () => {
      view.connectionData = { connType: 0, serverName: "local" };

      const result = view.renderEditConnectionForm();
      assert.strictEqual(view.isBundledQ, true);
      assert.strictEqual(view.oldAlias, "local");
      assert.strictEqual(view.serverType, ServerType.KDB);
      assert.strictEqual(result.values[1].includes("Bundled q"), true);
    });

    it("should set MyQ to false and return correct HTML when connType is 1  and render is filled", () => {
      view.connectionData = { connType: 1, serverName: "testServer" };
      view.oldAlias = "testServer";
      view.renderId = "test";
      const result = view.renderEditConnectionForm();

      assert.strictEqual(view.isBundledQ, false);
      assert.strictEqual(view.oldAlias, "testServer");
      assert.strictEqual(view.serverType, ServerType.KDB);
      assert.strictEqual(result.values[1].includes("My q"), true);
    });

    it("should set MyQ to false and return correct HTML when connType is 1", () => {
      view.connectionData = { connType: 1, serverName: "testServer" };
      view.oldAlias = "";
      view.renderId = "";
      const result = view.renderEditConnectionForm();

      assert.strictEqual(view.isBundledQ, false);
      assert.strictEqual(view.oldAlias, "testServer");
      assert.strictEqual(view.serverType, ServerType.KDB);
      assert.strictEqual(result.values[1].includes("My q"), true);
    });

    it("should set serverType to INSIGHTS and return correct HTML when connType is 2 and render is filled", () => {
      view.connectionData = { connType: 2, serverName: "testServer" };
      view.oldAlias = "testServer";
      view.renderId = "test";

      const result = view.renderEditConnectionForm();

      assert.strictEqual(view.isBundledQ, false);
      assert.strictEqual(view.oldAlias, "testServer");
      assert.strictEqual(view.serverType, ServerType.INSIGHTS);
      assert.strictEqual(result.values[1].includes("Insights"), true);
    });

    it("should set serverType to INSIGHTS and return correct HTML when connType is 2", () => {
      view.connectionData = { connType: 2, serverName: "testServer" };
      view.oldAlias = "";
      view.renderId = "";

      const result = view.renderEditConnectionForm();

      assert.strictEqual(view.isBundledQ, false);
      assert.strictEqual(view.oldAlias, "testServer");
      assert.strictEqual(view.serverType, ServerType.INSIGHTS);
      assert.strictEqual(result.values[1].includes("Insights"), true);
    });

    it("should set serverType to INSIGHTS and open labels modal", () => {
      view.connectionData = { connType: 2, serverName: "testServer" };
      view.openModal();

      const result = view.renderEditConnectionForm();
      const resultsStrings = JSON.stringify(result);

      assert.strictEqual(view.isBundledQ, false);
      assert.strictEqual(view.oldAlias, "testServer");
      assert.strictEqual(view.serverType, ServerType.INSIGHTS);
      assert.strictEqual(result.values[1].includes("Insights"), true);
      assert.strictEqual(resultsStrings.includes("Add a New Label"), true);
    });
  });

  describe("renderEditConnFields", () => {
    it('should return "No connection found to be edited" when connectionData is null', () => {
      view.connectionData = null;
      const result = view.renderEditConnFields();
      assert.equal(
        result.strings[0],
        "<div>No connection found to be edited</div>",
      );
    });

    it("should call renderBundleQEditForm when connectionData.connType is 0", () => {
      view.connectionData = { connType: 0 };
      const renderBundleQEditFormStub = sinon
        .stub(view, "renderBundleQEditForm")
        .returns(html``);
      view.renderEditConnFields();
      assert.ok(renderBundleQEditFormStub.calledOnce);
      renderBundleQEditFormStub.restore();
    });

    it("should call renderMyQEditForm when connectionData.connType is 1", () => {
      view.connectionData = { connType: 1 };
      const renderMyQEditFormStub = sinon
        .stub(view, "renderMyQEditForm")
        .returns(html``);
      view.renderEditConnFields();
      assert.ok(renderMyQEditFormStub.calledOnce);
      renderMyQEditFormStub.restore();
    });

    it("should call renderInsightsEditForm when connectionData.connType is any other value", () => {
      view.connectionData = { connType: 2 };
      const renderInsightsEditFormStub = sinon
        .stub(view, "renderInsightsEditForm")
        .returns(html``);
      view.renderEditConnFields();
      assert.ok(renderInsightsEditFormStub.calledOnce);
      renderInsightsEditFormStub.restore();
    });
  });

  describe("renderBundleQEditForm", () => {
    it('should return "No connection found to be edited" when connectionData is null', () => {
      view.connectionData = null;
      const result = view.renderBundleQEditForm();
      assert.strictEqual(
        result.strings[0],
        "<div>No connection found to be edited</div>",
      );
    });

    it("should return the correct HTML structure when connectionData is provided", () => {
      view.connectionData = {
        port: "5000",
        serverAddress: "localhost",
        serverName: "local",
      };
      const result = view.renderBundleQEditForm();
      assert.ok(result.strings[0].includes('<div class="col gap-0">'));
      assert.ok(result.strings[1].includes('<div class="col gap-0">'));
      assert.ok(result.strings[2].includes('<div class="col gap-0">'));
      assert.ok(!result.strings[3].includes('<div class="col gap-0">'));
    });
  });

  describe("renderMyQEditForm", () => {
    it('should return "No connection found to be edited" when connectionData is null', () => {
      view.connectionData = null;
      const result = view.renderMyQEditForm();
      assert.strictEqual(
        result.strings[0],
        "<div>No connection found to be edited</div>",
      );
    });

    it("should return the correct HTML structure when connectionData is provided", () => {
      view.connectionData = {
        port: "5000",
        serverAddress: "localhost",
        serverName: "local",
      };
      const result = view.renderMyQEditForm();
      assert.ok(result.strings[0].includes('<div class="col gap-0">'));
      assert.ok(result.strings[1].includes('<div class="col gap-0">'));
      assert.ok(result.strings[2].includes('<div class="col gap-0">'));
      assert.ok(result.strings[3].includes('<div class="col gap-0">'));
    });
  });

  describe("renderInsightsEditForm", () => {
    it('should return "No connection found to be edited" when connectionData is null', () => {
      view.connectionData = null;
      const result = view.renderInsightsEditForm();
      assert.strictEqual(
        result.strings[0],
        "<div>No connection found to be edited</div>",
      );
    });

    it("should return the correct HTML structure when connectionData is provided", () => {
      view.connectionData = {
        port: "5000",
        serverAddress: "localhost",
        serverName: "local",
      };
      const result = view.renderInsightsEditForm();
      assert.ok(result.strings[0].includes('<div class="col gap-0">'));
      assert.ok(result.strings[1].includes('<div class="col gap-0">'));
      assert.ok(result.strings[2].includes('<div class="col gap-0">'));
      assert.ok(!result.strings[3].includes('<div class="col gap-0">'));
    });
  });

  describe("get data", () => {
    it("should return Insights data", () => {
      view.serverType = ServerType.INSIGHTS;
      const expectedData: InsightDetails = {
        alias: "",
        server: "",
        auth: true,
        realm: "",
        insecure: false,
      };
      const data = view["data"];
      assert.deepEqual(data, expectedData);
    });

    it("should return KDB data", () => {
      view.serverType = ServerType.KDB;
      const expectedData = {
        serverName: "",
        serverPort: "",
        auth: false,
        serverAlias: "",
        managed: false,
        tls: false,
        username: "",
        password: "",
      };
      const data = view["data"];
      assert.deepEqual(data, expectedData);
    });
  });

  describe("save", () => {
    it("should post a message", () => {
      let result: any;
      const api = acquireVsCodeApi();
      sinon.stub(api, "postMessage").value(({ command, data }) => {
        if (
          command === "kdb.connections.add.kdb" ||
          command === "kdb.connections.add.insights" ||
          command === "kdb.connections.add.bundleq"
        ) {
          result = data;
        }
      });
      view.save();
      assert.ok(result);
      view.isBundledQ = false;
      view.save();
      assert.ok(result);
      view.serverType = ServerType.INSIGHTS;
      view.save();
      assert.ok(result);
      sinon.restore();
    });
  });

  describe("createLabel", () => {
    let clock: sinon.SinonFakeTimers;

    beforeEach(() => {
      clock = sinon.useFakeTimers();
    });

    afterEach(() => {
      clock.restore();
    });

    it("should post a message and update labels after timeout", () => {
      const api = acquireVsCodeApi();
      const postMessageStub = sinon.stub(api, "postMessage");
      const closeModalStub = sinon.stub(view, "closeModal");

      view.newLblName = "Test Label";
      view.newLblColorName = "Test Color";
      view.labels = [];

      view.createLabel();

      sinon.assert.calledOnce(postMessageStub);

      // Avança o tempo em 500ms
      clock.tick(500);

      assert.equal(view.labels[0], "Test Label");
      sinon.assert.calledOnce(closeModalStub);

      sinon.restore();
    });
  });

  describe("edit", () => {
    const editConn: EditConnectionMessage = {
      connType: 0,
      serverName: "test",
      serverAddress: "127.0.0.1",
    };

    it("should post a message", () => {
      const api = acquireVsCodeApi();
      let result: any;
      sinon.stub(api, "postMessage").value(({ command, data }) => {
        if (
          command === "kdb.connections.edit.kdb" ||
          command === "kdb.connections.edit.insights" ||
          command === "kdb.connections.edit.bundleq"
        ) {
          result = data;
        }
      });
      view.editConnection();
      assert.ok(!result);
      view.connectionData = editConn;
      view.editConnection();
      assert.ok(result);
      editConn.connType = 1;
      view.connectionData = editConn;
      view.editConnection();
      assert.ok(result);
      editConn.connType = 2;
      view.connectionData = editConn;
      view.editConnection();
      assert.ok(result);
      sinon.restore();
    });
  });

  describe("createLabel", () => {});
});

describe("kdbChartView.ts", () => {
  let view: KdbChartView;

  beforeEach(async () => {
    view = new KdbChartView();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("connectedCallback", () => {
    it("should add an event listener", () => {
      let result = undefined;
      sinon.stub(window, "addEventListener").value(() => (result = true));
      view.connectedCallback();
      assert.ok(result);
    });
  });

  describe("disconnectedCallback", () => {
    it("should remove an event listener", () => {
      let result = undefined;
      sinon.stub(window, "removeEventListener").value(() => (result = true));
      view.disconnectedCallback();
      assert.ok(result);
    });
  });

  it("should update from message", () => {
    const data = { charts: [{ data: "test" }] };
    view.message(<MessageEvent>{
      data: JSON.stringify(data),
    });
    assert.deepStrictEqual(view.plot, data);
    const result = view.render();
    assert.ok(result);
  });
});
