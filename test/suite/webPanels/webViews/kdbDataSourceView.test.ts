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

import "../../../fixtures";
import * as assert from "assert";
import { html, TemplateResult } from "lit";
import * as sinon from "sinon";

import {
  DataSourceTypes,
  createAgg,
  createFilter,
  createGroup,
  createLabel,
  createSort,
} from "../../../../src/models/dataSource";
import {
  DataSourceCommand,
  DataSourceMessage2,
} from "../../../../src/models/messages";
import { MetaObjectPayload } from "../../../../src/models/meta";
import { ParamFieldType, UDA, UDAParam } from "../../../../src/models/uda";
import { KdbDataSourceView } from "../../../../src/webview/components/kdbDataSourceView";

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
