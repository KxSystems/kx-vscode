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
import { Webview, webview } from "./utils/webview";

/**
 * The new connection view, driven the way a user drives it: real typing into
 * real Shoelace controls, real clicks, and the real messages the panel
 * exchanges with it. What is asserted is the traffic across the postMessage
 * boundary, which is all the extension side ever sees of this form.
 */
describe("New connection view", () => {
  let view: Webview;

  // Each form is a scope the fields hang off. The new connection form keeps
  // both server types mounted, one tab panel each — named after ConnectionType,
  // so 1 is My q and 2 is Insights — and the same labels and Server Name appear
  // in both, so every field has to be looked up under its own tab. The edit
  // form has no tabs.
  const MY_Q = "kdb-new-connection-view >>> sl-tab-panel[name='1'] ";
  const INSIGHTS = "kdb-new-connection-view >>> sl-tab-panel[name='2'] ";
  const EDIT = "kdb-new-connection-view >>> ";

  before(async () => {
    await activate();
  });

  beforeEach(async () => {
    view = await webview("kdb-new-connection-view");
  });

  afterEach(() => {
    view.dispose();
  });

  const type = (scope: string, fields: Record<string, string>) =>
    view.eval(
      (root: string, values: Record<string, string>) => {
        for (const label of Object.keys(values)) {
          __type(`${root}sl-input[label="${label}"] >>> input`, values[label]);
        }
      },
      scope,
      fields,
    );

  const click = (path: string) =>
    view.eval((selector: string) => __find(selector).click(), path);

  // The primary button is Create Connection on the new form, Update Connection
  // on the edit one; both are the last thing a user touches, so this returns
  // everything the view sent while the test was driving it.
  const submit = (scope: string) =>
    view.eval((root: string) => {
      __find(`${root}sl-button[variant="primary"]`).click();
      return __posted;
    }, scope);

  it("adds a kdb connection from the My q tab", async () => {
    await type(MY_Q, {
      "Server Name": "test server",
      "Define connection address": "127.0.0.1",
      "Set port number": "5001",
    });

    const posted = await submit(MY_Q);

    assert.deepStrictEqual(posted, [
      {
        command: "kdb.connections.add.kdb",
        data: {
          serverName: "127.0.0.1",
          serverPort: "5001",
          serverAlias: "test server",
          auth: false,
          tls: false,
          username: "",
          password: "",
        },
        labels: [],
      },
    ]);
  });

  it("derives auth from the credentials and TLS from the checkbox", async () => {
    await type(MY_Q, {
      "Server Name": "secured",
      "Define connection address": "127.0.0.1",
      "Set port number": "5001",
      Username: "  user  ",
      Password: " secret ",
    });
    await click(`${MY_Q}sl-checkbox >>> input[type="checkbox"]`);

    const [message] = await submit(MY_Q);

    assert.deepStrictEqual(message.data, {
      serverName: "127.0.0.1",
      serverPort: "5001",
      serverAlias: "secured",
      auth: true,
      tls: true,
      username: "user",
      password: "secret",
    });
  });

  it("adds an Insights connection from the Insights tab", async () => {
    await click(`kdb-new-connection-view >>> sl-tab[panel="2"]`);
    await type(INSIGHTS, {
      "Server Name": "insights",
      "Define connection address": "https://insights.example.com",
    });

    // Realm and the SSL checkbox live behind Advanced, and a field inside a
    // closed details cannot be focused, so typing would land in whichever
    // field still had focus.
    await click(`${INSIGHTS}details summary`);
    await type(INSIGHTS, { "Define Realm (optional)": "keycloak" });
    await click(`${INSIGHTS}sl-checkbox >>> input[type="checkbox"]`);

    const posted = await submit(INSIGHTS);

    assert.deepStrictEqual(posted, [
      {
        command: "kdb.connections.add.insights",
        data: {
          alias: "insights",
          server: "https://insights.example.com",
          auth: true,
          realm: "keycloak",
          insecure: true,
        },
        labels: [],
      },
    ]);
  });

  it("offers the labels the panel sent and saves the one picked", async () => {
    await view.send({
      command: "refreshLabels",
      data: [
        { name: "prod", color: { name: "Red", colorHex: "#CD3131" } },
        { name: "dev", color: { name: "Green", colorHex: "#3BB44A" } },
      ],
      colors: [
        { name: "Red", colorHex: "#CD3131" },
        { name: "Green", colorHex: "#3BB44A" },
      ],
    });

    const offered = await view.eval(async (root: string) => {
      const options = () => [
        ...__find(`${root}sl-select#selectLabel`).querySelectorAll("sl-option"),
      ];
      for (let attempt = 0; attempt < 100 && options().length < 2; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      return options().map((option: any) => option.textContent.trim());
    }, MY_Q);

    assert.deepStrictEqual(offered, ["No Label Selected", "prod", "dev"]);

    await view.eval(
      (root: string) => __pick(`${root}sl-select#selectLabel`, "dev"),
      MY_Q,
    );

    await type(MY_Q, { "Server Name": "labelled" });
    const [message] = await submit(MY_Q);

    assert.deepStrictEqual(message.labels, ["dev"]);
  });

  // What the panel sends when a connection is picked from the tree. The view
  // renders the edit form off it, so every edit test starts here.
  const edit = async (data: Record<string, unknown>) => {
    await view.send({ command: "editConnection", data, labels: [] });
    await view.eval(
      (root: string) =>
        __until(
          () => __find(`${root}h2`)?.textContent.trim().startsWith("Edit"),
          "the edit form",
        ),
      EDIT,
    );
  };

  const shownIn = (labels: string[]) =>
    view.eval(
      (root: string, wanted: string[]) => {
        const shown: Record<string, string> = {
          heading: __find(`${root}h2`).textContent.trim(),
          button: __find(
            `${root}sl-button[variant="primary"]`,
          ).textContent.trim(),
        };
        for (const label of wanted) {
          shown[label] = __find(
            `${root}sl-input[label="${label}"] >>> input`,
          )?.value;
        }
        return shown;
      },
      EDIT,
      labels,
    );

  it("fills the kdb edit form and sends back the changes", async () => {
    await edit({
      serverName: "existing",
      serverAddress: "10.0.0.1",
      port: "5010",
      connType: 1,
      tls: true,
    });

    assert.deepStrictEqual(
      await shownIn([
        "Server Name",
        "Define connection address",
        "Set port number",
      ]),
      {
        heading: "Edit My q Connection",
        button: "Update Connection",
        "Server Name": "existing",
        "Define connection address": "10.0.0.1",
        "Set port number": "5010",
      },
    );

    await type(EDIT, { "Set port number": "5020" });
    const [message] = await submit(EDIT);

    assert.deepStrictEqual(message, {
      command: "kdb.connections.edit.kdb",
      oldAlias: "existing",
      editAuth: false,
      labels: [],
      data: {
        serverAlias: "existing",
        serverName: "10.0.0.1",
        serverPort: "5020",
        auth: false,
        tls: true,
        username: "",
        password: "",
      },
    });
  });

  it("reveals the credentials only once editing auth is asked for", async () => {
    await edit({
      serverName: "existing",
      serverAddress: "10.0.0.1",
      port: "5010",
      connType: 1,
    });

    const before = await shownIn(["Username", "Password"]);
    assert.strictEqual(before["Username"], undefined);
    assert.strictEqual(before["Password"], undefined);

    // The first checkbox is "Edit existing auth"; the credentials are rendered
    // only while it is ticked, and TLS is the checkbox after them.
    await click(`${EDIT}sl-checkbox >>> input[type="checkbox"]`);
    await view.eval(
      (root: string) =>
        __until(
          () => __find(`${root}sl-input[label="Username"]`),
          "the credential fields",
        ),
      EDIT,
    );

    await type(EDIT, { Username: "user", Password: "secret" });
    const [message] = await submit(EDIT);

    assert.strictEqual(message.editAuth, true);
    assert.strictEqual(message.data.auth, true);
    assert.strictEqual(message.data.username, "user");
    assert.strictEqual(message.data.password, "secret");
  });

  it("fills the Insights edit form and sends back the changes", async () => {
    await edit({
      serverName: "existing insights",
      serverAddress: "https://insights.example.com",
      connType: 2,
      insecure: true,
    });

    assert.deepStrictEqual(
      await shownIn(["Server Name", "Define connection address"]),
      {
        heading: "Edit Insights Connection",
        button: "Update Connection",
        "Server Name": "existing insights",
        "Define connection address": "https://insights.example.com",
      },
    );

    await type(EDIT, {
      "Define connection address": "https://moved.example.com",
    });
    await click(`${EDIT}details summary`);
    await type(EDIT, { "Define Realm (optional)": "keycloak" });

    const [message] = await submit(EDIT);

    assert.deepStrictEqual(message, {
      command: "kdb.connections.edit.insights",
      oldAlias: "existing insights",
      labels: [],
      data: {
        alias: "existing insights",
        server: "https://moved.example.com",
        auth: true,
        realm: "keycloak",
        insecure: true,
      },
    });
  });
});
