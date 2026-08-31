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

import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";

import { baseStyles } from "./baseStyles";
import { KdbSelect } from "./kdbSelect";
import { kdbStyles, newConnectionStyles } from "./styles";
import {
  ConnectionType,
  InsightDetails,
  ServerDetails,
  ServerType,
} from "../../models/connectionsModels";
import { LabelColors, Labels } from "../../models/labels";
import { EditConnectionMessage } from "../../models/messages";
import { TEXT } from "../converters";
import { bind, checked, inputDefaults } from "../directives";

const NEW_LABEL = "\u0000new-label";

const AUTH_SECTION = "Authentication & TLS";
const ADVANCED_SECTION = "Advanced";

@customElement("kdb-new-connection-view")
export class KdbNewConnectionView extends LitElement {
  static readonly styles = [baseStyles, kdbStyles, newConnectionStyles];
  selectedTab = ConnectionType.Kdb;
  lblColorsList: LabelColors[] = [];
  lblNamesList: Labels[] = [];
  newLblName = "";
  newLblColorName = "";
  kdbServer: ServerDetails = {
    serverName: "",
    serverPort: "",
    auth: false,
    serverAlias: "",
    tls: false,
    username: "",
    password: "",
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
  oldAlias: string = "";
  editAuth: boolean = false;
  renderId: string = "";
  private isModalOpen = false;
  private readonly openSections = new Set<string>();
  private _connectionData: EditConnectionMessage | undefined = undefined;
  private readonly vscode = acquireVsCodeApi();
  private tabConfig = {
    2: { serverType: ServerType.INSIGHTS },
    default: { serverType: ServerType.KDB },
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

  toggleLabel(name: string, on: boolean) {
    this.labels = on
      ? [...this.labels.filter((label) => label !== name), name]
      : this.labels.filter((label) => label !== name);
    this.requestUpdate();
  }

  get selectConnection(): string {
    switch (this.serverType) {
      case ServerType.INSIGHTS:
        return "tab-2";
      default:
        return "tab-1";
    }
  }

  handleMessage(event: { data: any }) {
    const message = event.data;
    if (message.command === "editConnection") {
      this.connectionData = message.data;
      this.labels = [...new Set<string>(message.labels || [])].filter(Boolean);
      this.requestUpdate();
    }
    if (message.command === "refreshLabels") {
      this.lblNamesList = message.data;
      this.lblColorsList = message.colors;
      this.requestUpdate();
    }
  }

  setKdbServer<K extends keyof ServerDetails>(key: K, value: ServerDetails[K]) {
    this.kdbServer[key] = value;
    this.requestUpdate();
  }

  setInsightsServer<K extends keyof InsightDetails>(
    key: K,
    value: InsightDetails[K],
  ) {
    this.insightsServer[key] = value;
    this.requestUpdate();
  }

  changeTLS() {
    this.setKdbServer("tls", !this.kdbServer.tls);
  }

  editAuthOfConn() {
    this.editAuth = !this.editAuth;
    this.requestUpdate();
  }

  renderSection(title: string, body: unknown) {
    return html`<details
      ?open="${this.openSections.has(title)}"
      @toggle="${(event: Event) => {
        if ((event.target as HTMLDetailsElement).open) {
          this.openSections.add(title);
        } else {
          this.openSections.delete(title);
        }
      }}">
      <summary>${title}</summary>
      <div class="section">${body}</div>
    </details>`;
  }

  renderServerNameDesc() {
    return html`<span>Name the server.</span>`;
  }

  renderServerNameField(serverType: ServerType) {
    /* c8 ignore start */
    return serverType === ServerType.KDB
      ? html`<label class="field"
          ><span class="label">Server Name</span
          ><input
            class="text-field larger"
            required
            placeholder="Server-1"
            ${inputDefaults()}
            ${bind(this.kdbServer.serverAlias)}
            @input="${(event: Event) =>
              this.setKdbServer(
                "serverAlias",
                (event.target as HTMLInputElement).value,
              )}"
        /></label>`
      : html`<label class="field"
          ><span class="label">Server Name</span
          ><input
            class="text-field larger"
            required
            placeholder="Insights-1"
            ${inputDefaults()}
            ${bind(this.insightsServer.alias)}
            @input="${(event: Event) =>
              this.setInsightsServer(
                "alias",
                (event.target as HTMLInputElement).value,
              )}"
        /></label>`;

    /* c8 ignore stop */
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
    return html`<span
      >Ensure <b>Set port number</b> matches the assigned port of your q
      process, and doesn’t conflict with another port.</span
    >`;
  }

  renderPortNumber() {
    /* c8 ignore start */
    return html`
      <div class="row">
        <label class="field"
          ><span class="label">Set port number</span
          ><input
            class="text-field larger"
            required
            placeholder="5001"
            ${inputDefaults()}
            ${bind(this.kdbServer.serverPort)}
            @input="${(event: Event) =>
              this.setKdbServer(
                "serverPort",
                (event.target as HTMLInputElement).value,
              )}"
        /></label>
      </div>
      <div class="row option-description option-help">
        ${this.renderPortNumberDesc()}
      </div>
    `;
    /* c8 ignore stop */
  }

  renderConnAddDesc(serverType: ServerType) {
    return serverType === ServerType.KDB
      ? html`Set the IP of your kdb+ database connection.`
      : html`Set the IP of your kdb+ database connection, your Insights
        connection must be deployed for kdb VS Code to access.`;
  }

  renderConnAddress(serverType: ServerType) {
    /* c8 ignore start */
    return html`
      <div class="row">
        <label class="field"
          ><span class="label">Define connection address</span
          ><input
            class="text-field larger"
            required
            placeholder="${serverType === ServerType.KDB
              ? "127.0.0.1 or localhost"
              : `https://myinsights.example.com`}"
            ${inputDefaults()}
            ${bind(
              serverType === ServerType.KDB
                ? this.kdbServer.serverName
                : this.insightsServer.server,
              TEXT,
              serverType,
            )}
            @input="${(event: Event) => {
              const value = (event.target as HTMLInputElement).value;

              if (serverType === ServerType.KDB) {
                this.setKdbServer("serverName", value);
              } else {
                this.setInsightsServer("server", value);
              }
            }}"
        /></label>
      </div>
      <div class="row option-description option-help">
        ${this.renderConnAddDesc(serverType)}
      </div>
    `;
    /* c8 ignore stop */
  }

  renderRealm() {
    /* c8 ignore start */
    return html`
      <div class="row">
        <label class="field"
          ><span class="label">Define Realm (optional)</span
          ><input
            class="text-field larger"
            ${inputDefaults()}
            ${bind(this.insightsServer.realm ?? "")}
            placeholder="insights"
            @input="${(event: Event) =>
              this.setInsightsServer(
                "realm",
                (event.target as HTMLInputElement).value,
              )}"
        /></label>
      </div>
      <div class="row option-description option-help">
        Specify the Keycloak realm for authentication. Use this field to connect
        to a specific realm as configured on your server.
      </div>
    `;
    /* c8 ignore stop */
  }

  renderInsecureSSL() {
    /* c8 ignore start */
    return html`
      <div class="row">
        <label class="checkbox"
          ><input
            type="checkbox"
            ${checked(this.insightsServer.insecure ?? false)}
            @change="${(event: Event) =>
              this.setInsightsServer(
                "insecure",
                (event.target as HTMLInputElement).checked,
              )}" />
          Accept insecure SSL certifcates
        </label>
      </div>
    `;
    /* c8 ignore stop */
  }

  tabClickAction(tabNumber: number) {
    const config =
      this.tabConfig[tabNumber as keyof typeof this.tabConfig] ??
      this.tabConfig.default;
    this.serverType = config.serverType;
  }

  renderTLSField() {
    return html`<div class="row">
      <label class="checkbox"
        ><input
          type="checkbox"
          ${checked(this.kdbServer.tls)}
          @change="${() => this.changeTLS()}" />
        Enable TLS Encryption on the kdb connection
      </label>
    </div>`;
  }

  renderLblDropdownColorOptions() {
    return this.lblColorsList.map((color) => color.name);
  }

  labelOptions() {
    return [
      ...this.lblNamesList.map((lbl) => ({
        value: lbl.name,
        color: lbl.color?.colorHex,
      })),
      { value: NEW_LABEL, label: "+ Create new label..." },
    ];
  }

  handleLabels(event: Event) {
    const picked = (event.target as KdbSelect).values;
    if (picked.includes(NEW_LABEL)) {
      this.openModal();
      return;
    }
    this.labels = picked;
    this.requestUpdate();
  }

  renderLbls() {
    return html`
      <kdb-select
        class="labels"
        multiple
        empty="Select labels..."
        label="Connection labels"
        .values="${this.labels}"
        .options="${this.labelOptions()}"
        @change="${this.handleLabels}"></kdb-select>
    `;
  }

  renderNewLabelModal() {
    /* c8 ignore start */
    return html`
      <div class="overlay"></div>
      <dialog class="modal" ?open="${this.isModalOpen}">
        <div class="modal-content">
          <h2>Add a New Label</h2>
          <div class="row">
            <label class="field"
              ><span class="label">Label name</span
              ><input
                placeholder="Label name"
                class="text-field larger"
                ${inputDefaults()}
                ${bind(this.newLblName)}
                @input="${(event: Event) => {
                  this.newLblName = (event.target as HTMLInputElement).value;
                  this.requestUpdate();
                }}"
                id="label-name"
            /></label>
          </div>
          <div class="row option-title gap-0" style="margin-top: 10px;">
            Label color
          </div>
          <div class="row">
            <kdb-select
              id="label-color"
              class="dropdown"
              style="width: 18.5em;"
              value="${this.newLblColorName}"
              empty="No Color Selected"
              label="Label color"
              .options="${this.renderLblDropdownColorOptions()}"
              @change="${(event: Event) => {
                this.newLblColorName = (event.target as KdbSelect).value;
                this.requestUpdate();
              }}"></kdb-select>
          </div>
          <div class="row" style="margin-top: 10px;">
            <button
              aria-label="Cancel"
              appearance="secondary"
              @click="${this.closeModal}">
              Cancel
            </button>
            <button
              class="primary"
              aria-label="Create Label"
              @click="${this.createLabel}"
              ?disabled="${this.newLblName === "" ||
              this.newLblColorName === ""}">
              Create
            </button>
          </div>
        </div>
      </dialog>
    `;
    /* c8 ignore stop */
  }

  renderConnectionLabelsSection() {
    return html` <div class="row">
      <div class="col gap-0">
        <div class="row option-title">Connection labels (optional)</div>
        <div class="row mt-1">${this.renderLbls()}</div>
      </div>
    </div>`;
  }

  renderNewMyQConnectionForm() {
    /* c8 ignore start */
    return html`<div class="col">
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
          ${this.renderSection(
            AUTH_SECTION,
            html`
              <div class="row">
                <label class="field"
                  ><span class="label">Username</span
                  ><input
                    class="text-field larger"
                    ${inputDefaults()}
                    ${bind(this.kdbServer.username || "")}
                    @input="${(event: Event) =>
                      this.setKdbServer(
                        "username",
                        (event.target as HTMLInputElement).value,
                      )}"
                /></label>
              </div>
              <div class="row">
                <label class="field"
                  ><span class="label">Password</span
                  ><input
                    type="password"
                    class="text-field larger"
                    ${inputDefaults()}
                    ${bind(this.kdbServer.password || "")}
                    @input="${(event: Event) =>
                      this.setKdbServer(
                        "password",
                        (event.target as HTMLInputElement).value,
                      )}"
                /></label>
              </div>
              <div class="row option-description option-help">
                Add required authentication to get access to the server
                connection if enabled.
              </div>
              ${this.renderTLSField()}
            `,
          )}
        </div>
      </div>
      ${this.renderConnectionLabelsSection()}
      ${this.renderCreateConnectionBtn()}
    </div>`;
    /* c8 ignore stop */
  }

  renderNewInsightsConnectionForm() {
    return html`<div class="col">
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
          ${this.renderSection(
            ADVANCED_SECTION,
            html`${this.renderRealm()} ${this.renderInsecureSSL()}`,
          )}
        </div>
      </div>
      ${this.renderConnectionLabelsSection()}
      ${this.renderCreateConnectionBtn()}
    </div>`;
  }

  renderNewConnectionForm() {
    /* c8 ignore start */
    return html`
      <div class="row mt-1 mb-1 content-wrapper">
        ${this.isModalOpen ? this.renderNewLabelModal() : ""}
        <div class="col form-wrapper">
          <div class="header-text-wrapper">
            <div class="row">
              <h2>Add a New Connection</h2>
            </div>
            <div class="row option-description">
              <span>
                If you are running a q process then use <b>“My q”</b>. Please
                ensure your q process is running before connecting it to the kdb
                VS Code extension otherwise you will get a connection
                error.</span
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
            <div class="col">
              <div class="tabs" role="tablist">
                <button
                  class="tab"
                  role="tab"
                  aria-selected="${this.selectedTab === ConnectionType.Kdb}"
                  @click="${() => {
                    this.serverType = ServerType.KDB;
                    this.selectedTab = ConnectionType.Kdb;
                    this.requestUpdate();
                  }}">
                  My q
                </button>
                <button
                  class="tab"
                  role="tab"
                  aria-selected="${this.selectedTab ===
                  ConnectionType.Insights}"
                  @click="${() => {
                    this.serverType = ServerType.INSIGHTS;
                    this.selectedTab = ConnectionType.Insights;
                    this.requestUpdate();
                  }}">
                  Insights connection
                </button>
              </div>
              <div role="tabpanel">
                ${this.selectedTab === ConnectionType.Kdb
                  ? this.renderNewMyQConnectionForm()
                  : this.renderNewInsightsConnectionForm()}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    /* c8 ignore stop */
  }

  renderCreateConnectionBtn() {
    return html`<div class="row">
      <button class="primary" class="grow" @click="${() => this.save()}">
        Create Connection
      </button>
    </div>`;
  }

  renderEditConnectionForm() {
    if (!this.connectionData) {
      return html`<div>No connection found to be edited</div>`;
    }
    if (
      this.renderId === "" ||
      this.oldAlias !== this.connectionData.serverName
    ) {
      this.oldAlias = this.connectionData.serverName;
      this.renderId = "";
    }
    const connTypeName = this.defineConnTypeName(this.connectionData.connType);
    this.serverType =
      this.connectionData.connType === ConnectionType.Insights
        ? ServerType.INSIGHTS
        : ServerType.KDB;
    return html`
      <div class="row mt-1 mb-1 content-wrapper">
        ${this.isModalOpen ? this.renderNewLabelModal() : ""}
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
          <div class="row">
            <button
              class="primary"
              class="grow"
              @click="${() => this.editConnection()}">
              Update Connection
            </button>
          </div>
        </div>
      </div>
    `;
  }

  defineConnTypeName(connType: number) {
    if (connType === ConnectionType.Insights) {
      return "Insights";
    } else {
      return "My q";
    }
  }

  renderEditConnFields() {
    if (!this.connectionData) {
      return html`<div>No connection found to be edited</div>`;
    }
    if (this.connectionData.connType === 1) {
      return this.renderMyQEditForm();
    } else {
      return this.renderInsightsEditForm();
    }
  }

  renderMyQEditForm() {
    if (!this.connectionData) {
      return html`<div>No connection found to be edited</div>`;
    }

    if (this.renderId === "") {
      this.renderId = this.generateRenderId();
      this.kdbServer.serverAlias = this.connectionData.serverName;
      this.kdbServer.serverPort = this.connectionData.port ?? "";
      this.kdbServer.serverName = this.connectionData.serverAddress;
      this.kdbServer.auth = this.connectionData.auth ?? false;
      this.kdbServer.tls = this.connectionData.tls ?? false;
      if (this.kdbServer.tls) {
        this.openSections.add(AUTH_SECTION);
      }
    }

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
            ${this.renderSection(
              AUTH_SECTION,
              html`
                <div class="row">
                  <label class="checkbox"
                    ><input
                      type="checkbox"
                      ${checked(this.editAuth)}
                      @change="${() => this.editAuthOfConn()}" />
                    Edit existing auth on the kdb connection
                  </label>
                </div>
                ${this.editAuth
                  ? html`
                      <div class="row">
                        <label class="field"
                          ><span class="label">Username</span
                          ><input
                            class="text-field larger"
                            ${inputDefaults()}
                            ${bind(this.kdbServer.username || "")}
                            @input="${(event: Event) =>
                              this.setKdbServer(
                                "username",
                                (event.target as HTMLInputElement).value,
                              )}"
                        /></label>
                      </div>
                      <div class="row">
                        <label class="field"
                          ><span class="label">Password</span
                          ><input
                            type="password"
                            class="text-field larger"
                            ${inputDefaults()}
                            ${bind(this.kdbServer.password || "")}
                            @input="${(event: Event) =>
                              this.setKdbServer(
                                "password",
                                (event.target as HTMLInputElement).value,
                              )}"
                        /></label>
                      </div>
                      <div class="row option-description option-help">
                        Add required authentication to get access to the server
                        connection if enabled.
                      </div>
                    `
                  : ""}
                ${this.renderTLSField()}
              `,
            )}
          </div>
        </div>
      </div>
    `;
  }

  renderInsightsEditForm() {
    if (!this.connectionData) {
      return html`<div>No connection found to be edited</div>`;
    }

    if (this.renderId === "") {
      this.renderId = this.generateRenderId();
      this.insightsServer.alias = this.connectionData.serverName;
      this.insightsServer.server = this.connectionData.serverAddress;
      this.insightsServer.realm = this.connectionData.realm ?? "";
      this.insightsServer.insecure = this.connectionData.insecure ?? false;
      if (this.insightsServer.realm || this.insightsServer.insecure) {
        this.openSections.add(ADVANCED_SECTION);
      }
    }

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
            ${this.renderSection(
              ADVANCED_SECTION,
              html`${this.renderRealm()} ${this.renderInsecureSSL()}`,
            )}
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
        this.kdbServer.auth = this.kdbServer.username !== "";
        return this.kdbServer;
    }
  }

  private save() {
    if (this.serverType === ServerType.INSIGHTS) {
      this.vscode.postMessage({
        command: "kdb.connections.add.insights",
        data: this.data,
        labels: this.labels,
      });
    } else {
      this.vscode.postMessage({
        command: "kdb.connections.add.kdb",
        data: this.data,
        labels: this.labels,
      });
    }
  }

  private createLabel() {
    this.vscode.postMessage({
      command: "kdb.connections.labels.add",
      data: {
        name: this.newLblName,
        colorName: this.newLblColorName,
      },
    });
    setTimeout(() => {
      this.toggleLabel(this.newLblName, true);
      this.closeModal();
    }, 500);
  }

  private editConnection() {
    if (!this.connectionData) {
      return;
    }
    if (this.connectionData.connType === 1) {
      this.vscode.postMessage({
        command: "kdb.connections.edit.kdb",
        data: this.data,
        oldAlias: this.oldAlias,
        editAuth: this.editAuth,
        labels: this.labels,
      });
    } else {
      this.vscode.postMessage({
        command: "kdb.connections.edit.insights",
        data: this.data,
        oldAlias: this.oldAlias,
        labels: this.labels,
      });
    }
  }

  private generateRenderId(): string {
    let counter = 0;
    const timestamp = Date.now().toString(36);
    const uniqueCounter = (counter++).toString(36);
    return `render-${timestamp}-${uniqueCounter}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "kdb-new-connection-view": KdbNewConnectionView;
  }
}
