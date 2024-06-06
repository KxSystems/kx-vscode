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

import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { ServerDetails, ServerType } from "../../models/server";
import { InsightDetails } from "../../models/insights";

import { kdbStyles, newConnectionStyles, vscodeStyles } from "./styles";

@customElement("kdb-new-connection-view")
export class KdbNewConnectionView extends LitElement {
  static styles = [vscodeStyles, kdbStyles, newConnectionStyles];
  @state() declare kdbServer: ServerDetails;
  @state() declare bundledServer: ServerDetails;
  @state() declare insightsServer: InsightDetails;
  @state() declare serverType: ServerType;
  @state() declare isBundledQ: boolean;
  private readonly vscode = acquireVsCodeApi();
  private tabConfig = {
    1: { isBundledQ: true, serverType: ServerType.KDB },
    2: { isBundledQ: false, serverType: ServerType.KDB },
    3: { isBundledQ: false, serverType: ServerType.INSIGHTS },
    default: { isBundledQ: true, serverType: ServerType.KDB },
  };

  constructor() {
    super();
    this.isBundledQ = true;
    this.serverType = ServerType.KDB;
    this.kdbServer = {
      serverName: "",
      serverPort: "",
      auth: false,
      serverAlias: "",
      managed: false,
      tls: false,
      username: "",
      password: "",
    };
    this.insightsServer = {
      alias: "",
      server: "",
      auth: true,
      realm: "",
    };
    this.bundledServer = {
      serverName: "127.0.0.1",
      serverPort: "",
      auth: false,
      serverAlias: "local",
      managed: false,
      tls: false,
    };
  }

  get selectConnection(): string {
    if (this.isBundledQ) {
      return "tab-1";
    }
    switch (this.serverType) {
      case ServerType.INSIGHTS:
        return "tab-3";
      case ServerType.KDB:
      default:
        return "tab-2";
    }
  }

  changeTLS() {
    this.kdbServer.tls = !this.kdbServer.tls;
  }

  renderServerNameDesc() {
    return this.isBundledQ
      ? html`<span
          >Name your server "local"; this name has been reserved for use by the
          packaged q in the kdb VS Code extension and must be used to access
          <b>Bundled q.</b></span
        >`
      : html`<span
          >Name the server, <u>but do not use "local";</u> "local" has been
          reserved for use by the pre-packaged q in the kdb VS Code
          extension.</span
        >`;
  }

  renderServerNameField(serverType: ServerType) {
    return this.isBundledQ
      ? html`<vscode-text-field
          class="text-field larger option-title"
          value="${this.bundledServer.serverAlias}"
          readonly
          >Server Name
        </vscode-text-field>`
      : serverType === ServerType.KDB
        ? html`<vscode-text-field
            class="text-field larger option-title"
            placeholder="Server 1"
            value="${this.kdbServer.serverAlias}"
            @input="${(event: Event) =>
              (this.kdbServer.serverAlias = (
                event.target as HTMLSelectElement
              ).value)}"
            >Server Name
          </vscode-text-field>`
        : html`<vscode-text-field
            class="text-field larger option-title"
            placeholder="Insights 1"
            value="${this.insightsServer.alias}"
            @input="${(event: Event) =>
              (this.insightsServer.alias = (
                event.target as HTMLSelectElement
              ).value)}"
            >Server Name
          </vscode-text-field>`;
  }

  renderServerName(serverType: ServerType) {
    return html`
      <div class="row">${this.renderServerNameField(serverType)}</div>
      <div class="row option-description  option-help">
        ${this.renderServerNameDesc()}
      </div>
    `;
  }

  renderPortNumberDesc() {
    return this.isBundledQ
      ? html`<span
          >Ensure the port number you use does not conflict with another
          port.</span
        >`
      : html`<span
          >Ensure <b>Set port number</b> matches the assigned port of your q
          process, and doesn’t conflict with another port.</span
        >`;
  }

  renderPortNumber() {
    return html`
      <div class="row">
        <vscode-text-field
          class="text-field larger option-title"
          value="${this.isBundledQ
            ? this.bundledServer.serverPort
            : this.kdbServer.serverPort}"
          @input="${(event: Event) => {
            const value = (event.target as HTMLSelectElement).value;
            this.isBundledQ
              ? (this.bundledServer.serverPort = value)
              : (this.kdbServer.serverPort = value);
          }}"
          >Set port number</vscode-text-field
        >
      </div>
      <div class="row option-description option-help">
        ${this.renderPortNumberDesc()}
      </div>
    `;
  }

  renderConnAddDesc(serverType: ServerType) {
    return this.isBundledQ
      ? html`The localhost connection is already set up for you.`
      : serverType === ServerType.KDB
        ? html`Set the IP of your kdb+ database connection.`
        : html`Set the IP of your kdb+ database connection, your Insights
          connection must be deployed for kdb VS Code to access.`;
  }

  renderConnAddress(serverType: ServerType) {
    return this.isBundledQ
      ? html`
          <div class="row">
            <vscode-text-field
              class="text-field larger option-title"
              value="${this.bundledServer.serverName}"
              readonly
              >Define connection address</vscode-text-field
            >
          </div>
          <div class="row option-description  option-help">
            ${this.renderConnAddDesc(serverType)}
          </div>
        `
      : html`
          <div class="row">
            <vscode-text-field
              class="text-field larger option-title"
              placeholder="${serverType === ServerType.KDB
                ? "127.0.0.1 or localhost"
                : `myinsights.clouddeploy.com`}"
              value="${serverType === ServerType.KDB
                ? this.kdbServer.serverName
                : this.insightsServer.server}"
              @input="${(event: Event) => {
                const value = (event.target as HTMLSelectElement).value;
                if (serverType === ServerType.KDB) {
                  this.kdbServer.serverName = value;
                } else {
                  this.insightsServer.server = value;
                }
              }}"
              >Define connection address</vscode-text-field
            >
          </div>
          <div class="row option-description  option-help">
            ${this.renderConnAddDesc(serverType)}
          </div>
        `;
  }

  renderRealm() {
    return html`
      <div class="row">
        <vscode-text-field
          class="text-field larger option-title"
          value="${this.insightsServer.realm}"
          placeholder="insights"
          @input="${(event: Event) => {
            /* istanbul ignore next */
            const value = (event.target as HTMLSelectElement).value;
            /* istanbul ignore next */
            this.insightsServer.realm = value;
          }}"
          >Define realm (Optional)</vscode-text-field
        >
      </div>
      <div class="row option-description  option-help">
        Set the realm of your Insights connection.
      </div>
    `;
  }

  tabClickAction(tabNumber: number) {
    const config =
      this.tabConfig[tabNumber as keyof typeof this.tabConfig] ||
      this.tabConfig.default;
    this.isBundledQ = config.isBundledQ;
    this.serverType = config.serverType;
  }

  render() {
    return html`
      <div class="row mt-1 mb-1 content-wrapper">
        <div class="col form-wrapper">
          <div class="header-text-wrapper">
            <div class="row">
              <h2>Add a New Connection</h2>
            </div>
            <div class="row option-description">
              <span
                >If you are new to kdb and q, start with the
                <b>“Bundled q”</b> that comes packaged with the
                kdb VS Code extension.</span
              >
              </div>
              <br />
              <div class="row option-description"><span>
                If you are familiar with q and are running a remote q process,
                then use <b>“My q”</b>. Please ensure your remote q process is running
                before connecting it to the kdb VS Code extension otherwise you
                will get a connection error.</span>
              </div>
              <br />
              <div class="row option-description"><span>
                If you are an Insights user, then use an <b>“Insights connection”.</b>
                You will be required to authenticate the connection prior to its
                availability in the kdb VS Code extension.</span>
              </div>          
            </div>          
            <div class="row">
              <vscode-panels activeid="${this.selectConnection}">
              <vscode-panel-tab
                  id="tab-1"
                  @click="${() => this.tabClickAction(1)}"
                  >Bundled q</vscode-panel-tab
                >
                <vscode-panel-tab
                  id="tab-2"
                  @click="${() => this.tabClickAction(2)}"
                  >My q</vscode-panel-tab
                >
                <vscode-panel-tab
                  id="tab-3"
                  @click="${() => this.tabClickAction(3)}"
                  >Insights connection</vscode-panel-tab
                >
                <vscode-panel-view id="view-1" class="panel">
                <div class="col">
                  <div class="row">
                    <div class="col gap-0">
                      ${this.renderServerName(ServerType.KDB)}
                    </div>
                  </div>
                  <div class="row">
                    <div class="col gap-0">
                      ${this.renderConnAddress(ServerType.KDB)}
                    </div>
                  </div>
                  <div class="row">
                    <div class="col gap-0">
                      ${this.renderPortNumber()}
                    </div>
                  </div>
                </div>
                </vscode-panel-view>
                <vscode-panel-view id="view-2" class="panel">
                  <div class="col">
                    <div class="row">
                      <div class="col gap-0">
                        ${this.renderServerName(ServerType.KDB)}
                      </div>
                    </div>
                    <div class="row">
                      <div class="col gap-0">
                        ${this.renderConnAddress(ServerType.KDB)}
                      </div>
                    </div>
                    <div class="row">
                      <div class="col gap-0">
                        ${this.renderPortNumber()}
                      </div>
                    </div>
                    <div class="row option-title">
                      Add Authentication if enabled
                    </div>
                    <div class="row">
                      <div class="col gap-0">
                        <div class="row">
                          <vscode-text-field
                            class="text-field larger option-title"
                            value="${
                              this.kdbServer.username
                                ? this.kdbServer.username
                                : ""
                            }"   
                            @input="${(event: Event) =>
                              (this.kdbServer.username = (
                                event.target as HTMLSelectElement
                              ).value)}"
                            >Username</vscode-text-field
                          >
                        </div>
                        <div class="row">
                          <vscode-text-field
                            type="password"
                            class="text-field larger option-title"
                            value="${
                              this.kdbServer.password
                                ? this.kdbServer.password
                                : ""
                            }"
                            @input="${(event: Event) =>
                              (this.kdbServer.password = (
                                event.target as HTMLSelectElement
                              ).value)}"
                            >Password</vscode-text-field
                          >
                        </div>
                        <div class="row option-description  option-help">
                          Add required authentication to get access to the
                          server connection if enabled.
                        </div>
                      </div>
                    </div>
                    <div class="row">
                      <div class="col gap-0">
                        <div class="row option-title">
                          Optional: Enable TLS Encryption
                        </div>
                        <div class="row">
                          <vscode-checkbox
                            value="${this.kdbServer.tls}"
                            @click="${() => this.changeTLS()}"
                            >Enable TLS Encryption on the kdb
                            connection</vscode-checkbox
                          >
                        </div>
                      </div>
                    </div>
                  </div>
                </vscode-panel-view>
                <vscode-panel-view id="view-3" class="panel">
                  <div class="col">
                    <div class="row">
                      <div class="col gap-0">
                        ${this.renderServerName(ServerType.INSIGHTS)}
                      </div>
                    </div>
                    <div class="row">
                      <div class="col gap-0">
                        ${this.renderConnAddress(ServerType.INSIGHTS)}
                      </div>
                    </div>
                    <div class="row">
                      <div class="col gap-0">
                        ${this.renderRealm()}
                      </div>
                    </div>
                  </div>
                </vscode-panel-view>
              </vscode-panels>
            </div>
          </div>
          <div class="col">
            <div class="row">
              <vscode-button @click="${() => this.save()}"
                >Create Connection</vscode-button
              >
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private get data(): ServerDetails | InsightDetails {
    switch (this.serverType) {
      case ServerType.INSIGHTS:
        return this.insightsServer;
      case ServerType.KDB:
      default:
        this.kdbServer.username = this.kdbServer.username!.trim();
        this.kdbServer.password = this.kdbServer.password!.trim();
        this.kdbServer.auth =
          this.kdbServer.username !== "" && this.kdbServer.password !== "";
        return this.kdbServer;
    }
  }

  private save() {
    if (this.isBundledQ) {
      this.vscode.postMessage({
        command: "kdb.newConnection.createNewBundledConnection",
        data: this.bundledServer,
      });
    } else if (this.serverType === ServerType.INSIGHTS) {
      this.vscode.postMessage({
        command: "kdb.newConnection.createNewInsightConnection",
        data: this.data,
      });
    } else {
      this.vscode.postMessage({
        command: "kdb.newConnection.createNewConnection",
        data: this.data,
      });
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "kdb-new-connection-view": KdbNewConnectionView;
  }
}
