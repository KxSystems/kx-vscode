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
import { customElement } from "lit/decorators.js";
import { ServerDetails, ServerType } from "../../models/server";
import { InsightDetails } from "../../models/insights";

import { kdbStyles, newConnectionStyles, vscodeStyles } from "./styles";
import { EditConnectionMessage } from "../../models/messages";
import { repeat } from "lit/directives/repeat.js";
import { LabelColors, Labels } from "../../models/labels";

@customElement("kdb-new-connection-view")
export class KdbNewConnectionView extends LitElement {
  static styles = [vscodeStyles, kdbStyles, newConnectionStyles];
  lblColorsList: LabelColors[] = [];
  lblNamesList: Labels[] = [];
  newLblName = "";
  newLblColorName = "";
  kdbServer: ServerDetails = {
    serverName: "",
    serverPort: "",
    auth: false,
    serverAlias: "",
    managed: false,
    tls: false,
    username: "",
    password: "",
  };
  bundledServer: ServerDetails = {
    serverName: "127.0.0.1",
    serverPort: "",
    auth: false,
    serverAlias: "local",
    managed: false,
    tls: false,
  };
  insightsServer: InsightDetails = {
    alias: "",
    server: "",
    auth: true,
    realm: "",
    insecure: false,
  };
  labels: string[] = [];
  serverType: ServerType = ServerType.KDB;
  isBundledQ: boolean = true;
  oldAlias: string = "";
  editAuth: boolean = false;
  private isModalOpen = false;
  private _connectionData: EditConnectionMessage | undefined = undefined;
  private readonly vscode = acquireVsCodeApi();
  private tabConfig = {
    1: { isBundledQ: true, serverType: ServerType.KDB },
    2: { isBundledQ: false, serverType: ServerType.KDB },
    3: { isBundledQ: false, serverType: ServerType.INSIGHTS },
    default: { isBundledQ: true, serverType: ServerType.KDB },
  };

  get connectionData(): EditConnectionMessage | undefined {
    return this._connectionData;
  }

  set connectionData(value: EditConnectionMessage | undefined) {
    const oldValue = this._connectionData;
    this._connectionData = value;
    this.requestUpdate("connectionData", oldValue);
  }

  openModal() {
    this.isModalOpen = true;
    this.requestUpdate();
  }

  closeModal() {
    this.newLblColorName = "";
    this.newLblName = "";
    this.isModalOpen = false;
    this.requestUpdate();
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener("message", this.handleMessage.bind(this));
  }

  disconnectedCallback() {
    window.removeEventListener("message", this.handleMessage.bind(this));
    super.disconnectedCallback();
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

  handleMessage(event: { data: any }) {
    const message = event.data;
    if (message.command === "editConnection") {
      this.connectionData = message.data;
      this.labels = message.labels;
      this.requestUpdate();
    }
    if (message.command === "refreshLabels") {
      this.lblNamesList = message.data;
      this.lblColorsList = message.colors;
      this.requestUpdate();
    }
  }

  changeTLS() {
    this.kdbServer.tls = !this.kdbServer.tls;
  }

  editAuthOfConn() {
    this.editAuth = !this.editAuth;
    this.requestUpdate();
  }

  renderServerNameDesc(isBundleQ?: boolean) {
    return isBundleQ
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

  renderServerNameField(serverType: ServerType, isBundleQ?: boolean) {
    return isBundleQ
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

  renderServerName(serverType: ServerType, isBundleQ?: boolean) {
    return html`
      <div class="row">
        ${this.renderServerNameField(serverType, isBundleQ)}
      </div>
      <div class="row option-description  option-help">
        ${this.renderServerNameDesc(isBundleQ)}
      </div>
    `;
  }

  renderPortNumberDesc(isBundleQ?: boolean) {
    return isBundleQ
      ? html`<span
          >Ensure the port number you use does not conflict with another
          port.</span
        >`
      : html`<span
          >Ensure <b>Set port number</b> matches the assigned port of your q
          process, and doesn’t conflict with another port.</span
        >`;
  }

  renderPortNumber(isBundleQ?: boolean) {
    return html`
      <div class="row">
        <vscode-text-field
          class="text-field larger option-title"
          value="${isBundleQ
            ? this.bundledServer.serverPort
            : this.kdbServer.serverPort}"
          @input="${(event: Event) => {
            const value = (event.target as HTMLSelectElement).value;
            isBundleQ
              ? (this.bundledServer.serverPort = value)
              : (this.kdbServer.serverPort = value);
          }}"
          >Set port number</vscode-text-field
        >
      </div>
      <div class="row option-description option-help">
        ${this.renderPortNumberDesc(isBundleQ)}
      </div>
    `;
  }

  renderConnAddDesc(serverType: ServerType, isBundleQ?: boolean) {
    return isBundleQ
      ? html`The localhost connection is already set up for you.`
      : serverType === ServerType.KDB
        ? html`Set the IP of your kdb+ database connection.`
        : html`Set the IP of your kdb+ database connection, your Insights
          connection must be deployed for kdb VS Code to access.`;
  }

  renderConnAddress(serverType: ServerType, isBundleQ?: boolean) {
    return isBundleQ
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
      <div class="row mt-1">
        <vscode-text-field
          class="text-field larger option-title"
          value="${this.insightsServer.realm ?? ""}"
          placeholder="insights"
          @input="${(event: Event) => {
            /* istanbul ignore next */
            const value = (event.target as HTMLSelectElement).value;
            /* istanbul ignore next */
            this.insightsServer.realm = value;
          }}"
          >Define Realm (optional)</vscode-text-field
        >
      </div>
      <div class="row option-description  option-help">
        Specify the Keycloak realm for authentication. Use this field to connect
        to a specific realm as configured on your server.
      </div>
    `;
  }

  tabClickAction(tabNumber: number) {
    const config =
      this.tabConfig[tabNumber as keyof typeof this.tabConfig] ??
      this.tabConfig.default;
    this.isBundledQ = config.isBundledQ;
    this.serverType = config.serverType;
  }

  renderLblDropdownColorOptions() {
    return html`
      <vscode-option .value="${undefined}"> No Color Selected </vscode-option>
      ${repeat(
        this.lblColorsList,
        (color) => color,
        (color) =>
          html` <vscode-option .value="${color.name}">
            <span
              ><div
                style="width: 10px; height: 10px; background: ${color.colorHex}; border-radius: 50%; float: left;
    margin-right: 10px; margin-top: 3px;"></div>
              ${color.name}</span
            >
          </vscode-option>`,
      )}
    `;
  }

  renderLblDropdownOptions() {
    return html`
      <vscode-option .value="${undefined}"> No Label Selected </vscode-option>
      ${repeat(
        this.lblNamesList,
        (lbl) => lbl.name,
        (lbl) => html`
          <vscode-option
            .value="${lbl.name}"
            ?selected="${lbl.name === this.labels[0]}">
            <span>
              <div
                style="width: 10px; height: 10px; background: ${lbl.color
                  .colorHex}; border-radius: 50%; float: left; margin-right: 10px; margin-top: 3px;"></div>
              ${lbl.name}
            </span>
          </vscode-option>
        `,
      )}
    `;
  }

  renderNewLabelModal() {
    return html`
      <div class="overlay"></div>
      <dialog class="modal" ?open="${this.isModalOpen}">
        <div class="modal-content">
          <h2>Add a New Label</h2>
          <div class="row">
            <vscode-text-field
              class="text-field larger option-title"
              value="${this.newLblName}"
              @change="${(event: Event) => {
                this.newLblName = (event.target as HTMLInputElement).value;
              }}"
              id="label-name"
              >Label name</vscode-text-field
            >
          </div>
          <div class="row option-title gap-0" style="margin-top: 10px;">
            Label color
          </div>
          <div class="row">
            <vscode-dropdown
              id="label-color"
              value="${this.newLblColorName}"
              @change="${(event: Event) => {
                this.newLblColorName = (event.target as HTMLInputElement).value;
              }}"
              class="dropdown"
              style="width: 18.5em;">
              ${this.renderLblDropdownColorOptions()}
            </vscode-dropdown>
          </div>
          <div class="row" style="margin-top: 10px;">
            <vscode-button
              aria-label="Cancel"
              appearance="secondary"
              @click="${this.closeModal}">
              Cancel
            </vscode-button>
            <vscode-button
              aria-label="Create Label"
              appearance="primary"
              @click="${this.createLabel}">
              Create
            </vscode-button>
          </div>
        </div>
      </dialog>
    `;
  }

  renderNewLblBtn() {
    return html`
      <vscode-button
        aria-label="Create New Label"
        style="height: 26px;    margin-top: 18px;"
        appearance="secondary"
        @click="${this.openModal}">
        Create New Label
      </vscode-button>
    `;
  }

  renderConnectionLabelsSection() {
    return html` <div class="row">
      <div class="col gap-0">
        <div class="row option-title">Connection label (optional)</div>
        <div class="row mt-1">
          <div class="dropdown-container">
            <label for="selectLabel">Label Name</label>
            <vscode-dropdown
              id="selectLabel"
              class="dropdown larger"
              value="${this.labels.length > 0 ? this.labels[0] : ""}"
              @change="${(event: Event) => {
                this.labels.length = 0;
                this.labels.push((event.target as HTMLInputElement).value);
              }}">
              ${this.renderLblDropdownOptions()}
            </vscode-dropdown>
          </div>
          ${this.renderNewLblBtn()}
        </div>
      </div>
    </div>`;
  }

  renderNewConnectionForm() {
    return html`
      <div class="row mt-1 mb-1 content-wrapper">
        ${this.isModalOpen ? this.renderNewLabelModal() : ""}
        <div class="col form-wrapper">
          <div class="header-text-wrapper">
            <div class="row">
              <h2>Add a New Connection</h2>
            </div>
            <div class="row option-description">
              <span
                >If you are new to kdb and q, start with the
                <b>“Bundled q”</b> that comes packaged with the kdb VS Code
                extension.</span
              >
            </div>
            <br />
            <div class="row option-description">
              <span>
                If you are familiar with q and are running a remote q process,
                then use <b>“My q”</b>. Please ensure your remote q process is
                running before connecting it to the kdb VS Code extension
                otherwise you will get a connection error.</span
              >
            </div>
            <br />
            <div class="row option-description">
              <span>
                If you are an Insights user, then use an
                <b>“Insights connection”.</b> You will be required to
                authenticate the connection prior to its availability in the kdb
                VS Code extension.</span
              >
            </div>
          </div>
          <div class="row">
            <vscode-panels activeid="${this.selectConnection}" id="connPanels">
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
                      ${this.renderServerName(ServerType.KDB, true)}
                    </div>
                  </div>
                  <div class="row">
                    <div class="col gap-0">
                      ${this.renderConnAddress(ServerType.KDB, true)}
                    </div>
                  </div>
                  <div class="row">
                    <div class="col gap-0">${this.renderPortNumber(true)}</div>
                  </div>
                  ${this.renderConnectionLabelsSection()}
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
                    <div class="col gap-0">${this.renderPortNumber()}</div>
                  </div>
                  <div class="row option-title">
                    Add Authentication if enabled
                  </div>
                  <div class="row">
                    <div class="col gap-0">
                      <div class="row">
                        <vscode-text-field
                          class="text-field larger option-title"
                          value="${this.kdbServer.username
                            ? this.kdbServer.username
                            : ""}"
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
                          value="${this.kdbServer.password
                            ? this.kdbServer.password
                            : ""}"
                          @input="${(event: Event) =>
                            (this.kdbServer.password = (
                              event.target as HTMLSelectElement
                            ).value)}"
                          >Password</vscode-text-field
                        >
                      </div>
                      <div class="row option-description  option-help">
                        Add required authentication to get access to the server
                        connection if enabled.
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
                  ${this.renderConnectionLabelsSection()}
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
                      <details>
                        <summary>Advanced</summary>
                        ${this.renderRealm()}
                        <div class="row mt-1">
                          <vscode-checkbox
                            .checked="${this.insightsServer.insecure}"
                            @change="${(event: Event) => {
                              this.insightsServer.insecure = (
                                event.target as HTMLInputElement
                              ).checked;
                            }}"
                            >Accept insecure SSL certifcates</vscode-checkbox
                          >
                        </div>
                      </details>
                    </div>
                  </div>
                  ${this.renderConnectionLabelsSection()}
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
    `;
  }

  renderEditConnectionForm() {
    if (!this.connectionData) {
      return html`<div>No connection found to be edited</div>`;
    }
    this.isBundledQ = this.connectionData.connType === 0;
    this.oldAlias = this.connectionData.serverName;
    const connTypeName = this.defineConnTypeName(this.connectionData.connType);
    this.serverType =
      this.connectionData.connType === 2 ? ServerType.INSIGHTS : ServerType.KDB;
    return html`
      <div class="row mt-1 mb-1 content-wrapper">
        <div class="col form-wrapper">
          <div class="header-text-wrapper">
            <div class="row">
              <h2>Edit ${connTypeName} Connection</h2>
            </div>
            <div class="row option-description">
              <span
                >Editing an active connection may require you to
                <b>restart the connection</b>. If so, you will be prompted to
                reconnect after saving your changes.</span
              >
            </div>
          </div>
          <div class="row">${this.renderEditConnFields()}</div>
          <div class="row">${this.renderConnectionLabelsSection()}</div>
        </div>
        <div class="col">
          <div class="row">
            <vscode-button @click="${() => this.editConnection()}"
              >Edit Connection</vscode-button
            >
          </div>
        </div>
      </div>
    `;
  }

  defineConnTypeName(connType: number) {
    if (connType === 0) {
      return "Bundled q";
    } else if (connType === 1) {
      return "My q";
    } else {
      return "Insights";
    }
  }

  renderEditConnFields() {
    if (!this.connectionData) {
      return html`<div>No connection found to be edited</div>`;
    }
    if (this.connectionData.connType === 0) {
      return this.renderBundleQEditForm();
    } else if (this.connectionData.connType === 1) {
      return this.renderMyQEditForm();
    } else {
      return this.renderInsightsEditForm();
    }
  }

  renderBundleQEditForm() {
    if (!this.connectionData) {
      return html`<div>No connection found to be edited</div>`;
    }
    this.bundledServer.serverAlias = "local";
    this.bundledServer.serverPort = this.connectionData.port ?? "";
    this.bundledServer.serverName = this.connectionData.serverAddress;
    return html`
      <div class="col">
        <div class="row">
          <div class="col gap-0">
            ${this.renderServerName(ServerType.KDB, true)}
          </div>
        </div>
        <div class="row">
          <div class="col gap-0">
            ${this.renderConnAddress(ServerType.KDB, true)}
          </div>
        </div>
        <div class="row">
          <div class="col gap-0">${this.renderPortNumber(true)}</div>
        </div>
      </div>
    `;
  }

  renderMyQEditForm() {
    if (!this.connectionData) {
      return html`<div>No connection found to be edited</div>`;
    }
    this.kdbServer.serverAlias = this.connectionData.serverName;
    this.kdbServer.serverPort = this.connectionData.port ?? "";
    this.kdbServer.serverName = this.connectionData.serverAddress;
    this.kdbServer.auth = this.connectionData.auth ?? false;
    this.kdbServer.tls = this.connectionData.tls ?? false;
    return html`
      <div class="col">
        <div class="row">
          <div class="col gap-0">${this.renderServerName(ServerType.KDB)}</div>
        </div>
        <div class="row">
          <div class="col gap-0">${this.renderConnAddress(ServerType.KDB)}</div>
        </div>
        <div class="row">
          <div class="col gap-0">${this.renderPortNumber()}</div>
        </div>
        <div class="row">
          <div class="col gap-0">
            <div class="row option-title">Optional: Edit Auth options</div>
            <div class="row">
              <vscode-checkbox
                value="${this.editAuth}"
                @click="${() => this.editAuthOfConn()}"
                >Edit existing auth on the kdb connection</vscode-checkbox
              >
            </div>
          </div>
        </div>
        ${this.editAuth
          ? html`
              <div class="row">
                <div class="col gap-0">
                  <div class="row">
                    <vscode-text-field
                      class="text-field larger option-title"
                      value="${this.kdbServer.username
                        ? this.kdbServer.username
                        : ""}"
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
                      value="${this.kdbServer.password
                        ? this.kdbServer.password
                        : ""}"
                      @input="${(event: Event) =>
                        (this.kdbServer.password = (
                          event.target as HTMLSelectElement
                        ).value)}"
                      >Password</vscode-text-field
                    >
                  </div>
                  <div class="row option-description  option-help">
                    Add required authentication to get access to the server
                    connection if enabled.
                  </div>
                </div>
              </div>
            `
          : ""}
        <div class="row">
          <div class="col gap-0">
            <div class="row option-title">Optional: Enable TLS Encryption</div>
            <div class="row">
              <vscode-checkbox
                value="${this.kdbServer.tls}"
                @click="${() => this.changeTLS()}"
                >Enable TLS Encryption on the kdb connection</vscode-checkbox
              >
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderInsightsEditForm() {
    if (!this.connectionData) {
      return html`<div>No connection found to be edited</div>`;
    }
    this.insightsServer.alias = this.connectionData.serverName;
    this.insightsServer.server = this.connectionData.serverAddress;
    this.insightsServer.realm = this.connectionData.realm ?? "";
    return html`
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
            <details>
              <summary>Advanced</summary>
              ${this.renderRealm()}
            </details>
          </div>
        </div>
      </div>
    `;
  }

  render() {
    if (!this.connectionData) {
      return html` ${this.renderNewConnectionForm()} `;
    } else {
      return html` ${this.renderEditConnectionForm()} `;
    }
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
        labels: this.labels,
      });
    } else if (this.serverType === ServerType.INSIGHTS) {
      this.vscode.postMessage({
        command: "kdb.newConnection.createNewInsightConnection",
        data: this.data,
        labels: this.labels,
      });
    } else {
      this.vscode.postMessage({
        command: "kdb.newConnection.createNewConnection",
        data: this.data,
        labels: this.labels,
      });
    }
  }

  private createLabel() {
    this.vscode.postMessage({
      command: "kdb.labels.create",
      data: {
        name: this.newLblName,
        colorName: this.newLblColorName,
      },
    });
    setTimeout(() => {
      this.closeModal();
    }, 500);
  }

  private editConnection() {
    if (!this.connectionData) {
      return;
    }
    if (this.connectionData.connType === 0) {
      this.vscode.postMessage({
        command: "kdb.newConnection.editBundledConnection",
        data: this.bundledServer,
        oldAlias: "local",
        labels: this.labels,
      });
    } else if (this.connectionData.connType === 1) {
      this.vscode.postMessage({
        command: "kdb.newConnection.editMyQConnection",
        data: this.data,
        oldAlias: this.oldAlias,
        editAuth: this.editAuth,
        labels: this.labels,
      });
    } else {
      this.vscode.postMessage({
        command: "kdb.newConnection.editInsightsConnection",
        data: this.data,
        oldAlias: this.oldAlias,
        labels: this.labels,
      });
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "kdb-new-connection-view": KdbNewConnectionView;
  }
}
