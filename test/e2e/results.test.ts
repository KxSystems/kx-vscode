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

import * as assert from "node:assert";

import { activate } from "./utils";
import { Webview, webview } from "./webview";

/**
 * The results view only ever receives: the panel posts what a query returned
 * and the view renders it, so what is asserted here is the table on the page
 * rather than any message going back.
 *
 * The messages are the ones KdbResultsViewProvider sends, carrying what
 * convertToGrid built — that conversion is covered on the extension side in
 * test/suite/webPanels/resultsPanelProvider.test.ts, so nothing here re-checks
 * it. This is the half that turns those column definitions into a table.
 */
describe("Results view", () => {
  let view: Webview;

  const VIEW = "kdb-results-view >>> ";

  // The pager buttons carry no label of any kind, so each is found by the icon
  // it shows, and the page counter by being the one button without an icon.
  const PAGER = {
    First: "bi-chevron-double-left",
    Previous: "bi-chevron-left",
    Next: "bi-chevron-right",
    Last: "bi-chevron-double-right",
  };

  const COLUMNS = [
    { field: "sym", headerName: "sym [symbol]" },
    { field: "price", headerName: "price [float]" },
  ];

  const ROWS = [
    { sym: "AAPL", price: "1.1" },
    { sym: "MSFT", price: "2.2" },
    { sym: "GOOG", price: "3.3" },
    { sym: "AMZN", price: "4.4" },
    { sym: "META", price: "5.5" },
  ];

  const grid = (rows = ROWS) => ({
    command: "setGridDatasource",
    results: rows,
    columnDefs: COLUMNS,
    theme: "legacy",
    themeColor: "ag-theme-alpine-dark",
  });

  const text = (results: string) => ({
    command: "setResultsContent",
    results,
  });

  before(async () => {
    await activate();
  });

  afterEach(() => {
    view.dispose();
  });

  // The page size is an attribute of the element the provider mounts, so it
  // has to be given here too; the tests that page through the results ask for
  // a small one rather than the hundred rows the product uses.
  const show = async (message: any, size?: string) => {
    view = await webview("kdb-results-view", size ? { size } : {});
    await view.send(message);
    await view.eval(
      (root: string) =>
        __until(
          () => __find(`${root}.container`).textContent.trim(),
          "the results to be rendered",
        ),
      VIEW,
    );
  };

  const shown = () =>
    view.eval((root: string) => {
      const table = __find(`${root}table`);
      const cells = (row: any) =>
        [...row.querySelectorAll("td")].map((cell: any) =>
          cell.textContent.trim(),
        );

      return {
        headers: [...table.querySelectorAll("th")].map((header: any) =>
          header.textContent.replace(/\s+/g, " ").trim(),
        ),
        types: [...table.querySelectorAll("th .faint")].map((type: any) =>
          type.textContent.trim(),
        ),
        rows: [...table.querySelectorAll("tbody tr")].map(cells),
      };
    }, VIEW);

  const turn = (button: keyof typeof PAGER) =>
    view.eval(
      async (root: string, icon: string) => {
        __find(`${root}.pager sl-button:has(svg.${icon})`).click();
        await __find("kdb-results-view").updateComplete;
      },
      VIEW,
      PAGER[button],
    );

  const pageLabel = () =>
    view.eval(
      (root: string) =>
        __find(`${root}.pager sl-button:not(:has(svg))`)?.textContent.trim(),
      VIEW,
    );

  it("renders a column per definition and a row per result", async () => {
    await show(grid(ROWS.slice(0, 2)));

    assert.deepStrictEqual(await shown(), {
      headers: ["sym symbol", "price float"],
      types: ["symbol", "float"],
      rows: [
        ["AAPL", "1.1"],
        ["MSFT", "2.2"],
      ],
    });
  });

  it("leaves the type off a column that has none", async () => {
    await show({
      command: "setGridDatasource",
      results: [{ index: "1" }],
      columnDefs: [{ field: "index", headerName: "Index" }],
    });

    const table = await shown();

    assert.deepStrictEqual(table.headers, ["Index"]);
    assert.deepStrictEqual(table.types, []);
  });

  it("pages through the results and back", async () => {
    await show(grid(), "2");

    assert.strictEqual(await pageLabel(), "1 / 3");
    assert.deepStrictEqual((await shown()).rows, [
      ["AAPL", "1.1"],
      ["MSFT", "2.2"],
    ]);

    await turn("Next");
    assert.strictEqual(await pageLabel(), "2 / 3");
    assert.deepStrictEqual((await shown()).rows, [
      ["GOOG", "3.3"],
      ["AMZN", "4.4"],
    ]);

    await turn("Last");
    assert.strictEqual(await pageLabel(), "3 / 3");
    assert.deepStrictEqual((await shown()).rows, [["META", "5.5"]]);

    // The last page is short, so a next from here has nowhere to go.
    await turn("Next");
    assert.strictEqual(await pageLabel(), "3 / 3");

    await turn("Previous");
    assert.strictEqual(await pageLabel(), "2 / 3");

    await turn("First");
    assert.strictEqual(await pageLabel(), "1 / 3");
    assert.deepStrictEqual((await shown()).rows, [
      ["AAPL", "1.1"],
      ["MSFT", "2.2"],
    ]);
  });

  it("shows no pager when everything fits on one page", async () => {
    await show(grid(), "100");

    const pager = await view.eval(
      (root: string) => !!__find(`${root}.pager`),
      VIEW,
    );

    assert.strictEqual(pager, false);
  });

  it("replaces the table when a result is not a table, and puts it back", async () => {
    await show(grid(), "2");
    await view.send(text("42"));

    const plain = await view.eval(async (root: string) => {
      await __until(
        () => !__find(`${root}table`),
        "the table to be taken down",
      );
      return {
        content: __find(`${root}.container`).textContent.trim(),
        pager: !!__find(`${root}.pager`),
      };
    }, VIEW);

    assert.deepStrictEqual(plain, { content: "42", pager: false });

    await view.send(grid(ROWS.slice(0, 1)));
    await view.eval(
      (root: string) => __until(() => __find(`${root}table`), "the table"),
      VIEW,
    );

    assert.deepStrictEqual((await shown()).rows, [["AAPL", "1.1"]]);
  });

  it("renders the content it is sent as markup", async () => {
    // setResultsContent goes through unsafeHTML, so whatever formatResult
    // produces is parsed as HTML rather than shown as text. Pinned here
    // because it is the view's injection surface, not because it is desirable.
    await show(text("<b>a</b>&lt;b&gt;"));

    const rendered = await view.eval(
      (root: string) => ({
        bold: __find(`${root}.container b`)?.textContent,
        text: __find(`${root}.container`).textContent.trim(),
      }),
      VIEW,
    );

    assert.deepStrictEqual(rendered, { bold: "a", text: "a<b>" });
  });
});
