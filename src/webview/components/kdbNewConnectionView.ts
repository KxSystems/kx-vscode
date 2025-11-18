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

import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";
import { live } from "lit/directives/live.js";
import { repeat } from "lit/directives/repeat.js";

import { kdbStyles, newConnectionStyles, shoelaceStyles } from "./styles";
import {
  ConnectionType,
  InsightDetails,
  ServerDetails,
  ServerType,
} from "../../models/connectionsModels";
import { LabelColors, Labels } from "../../models/labels";
import { EditConnectionMessage } from "../../models/messages";

@customElement("kdb-new-connection-view")
export class KdbNewConnectionView extends LitElement {
  static readonly styles = [shoelaceStyles, kdbStyles, newConnectionStyles];
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
  labels: string[] = [""];
  serverType: ServerType = ServerType.KDB;
  oldAlias: string = "";
  editAuth: boolean = false;
  renderId: string = "";
  private isModalOpen = false;
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

  removeBlankLabels() {
    this.labels = Array.from(
      new Set(
        this.labels.filter((label) => label !== "" && label !== undefined),
      ),
    );
  }

  addLabel() {
    this.labels.push("");
    this.requestUpdate();
  }

  removeLabel(index: number) {
    this.labels.splice(index, 1);
    this.requestUpdate();
  }

  updateLabelValue(pos: number, event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    this.labels[pos] = decodeURIComponent(value);
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

  renderServerNameDesc() {
    return html`<span>Name the server.</span>`;
  }

  renderServerNameField(serverType: ServerType) {
    /* c8 ignore start */
    return serverType === ServerType.KDB
      ? html`<sl-input
          class="text-field larger option-title"
          placeholder="Server-1"
          value="${live(this.kdbServer.serverAlias)}"
          @input="${(event: Event) =>
            (this.kdbServer.serverAlias = (
              event.target as HTMLInputElement
            ).value)}"
          label="Server Name"></sl-input>`
      : html`<sl-input
          class="text-field larger option-title"
          placeholder="Insights-1"
          value="${live(this.insightsServer.alias)}"
          @input="${(event: Event) =>
            (this.insightsServer.alias = (
              event.target as HTMLInputElement
            ).value)}"
          label="Server Name"></sl-input>`;

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
        <sl-input
          class="text-field larger option-title"
          value="${live(this.kdbServer.serverPort)}"
          @input="${(event: Event) => {
            const value = (event.target as HTMLInputElement).value;
            this.kdbServer.serverPort = value;
          }}"
          label="Set port number"></sl-input>
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
        <sl-input
          class="text-field larger option-title"
          placeholder="${serverType === ServerType.KDB
            ? "127.0.0.1 or localhost"
            : `myinsights.clouddeploy.com`}"
          value="${live(
            serverType === ServerType.KDB
              ? this.kdbServer.serverName
              : this.insightsServer.server,
          )}"
          @input="${(event: Event) => {
            const value = (event.target as HTMLInputElement).value;

            if (serverType === ServerType.KDB) {
              this.kdbServer.serverName = value;
            } else {
              this.insightsServer.server = value;
            }
          }}"
          label="Define connection address"></sl-input>
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
      <div class="row mt-1">
        <sl-input
          class="text-field larger option-title"
          value="${live(this.insightsServer.realm ?? "")}"
          placeholder="insights"
          @input="${(event: Event) => {
            const value = (event.target as HTMLInputElement).value;
            this.insightsServer.realm = value;
          }}"
          label="Define Realm (optional)"></sl-input>
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
      <div class="row mt-1">
        <sl-checkbox
          .checked="${this.insightsServer.insecure ?? false}"
          @sl-change="${(event: Event) => {
            this.insightsServer.insecure = (
              event.target as HTMLInputElement
            ).checked;
          }}">
          Accept insecure SSL certifcates
        </sl-checkbox>
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

  renderLblDropdownColorOptions() {
    return html`
      <sl-option> No Color Selected </sl-option>
      ${repeat(
        this.lblColorsList,
        (color) => color,
        (color) =>
          html` <sl-option .value="${color.name}">
            <span
              ><div
                style="width: 10px; height: 10px; background: ${color.colorHex}; border-radius: 50%; float: left;
    margin-right: 10px; margin-top: 3px;"></div>
              ${color.name}</span
            >
          </sl-option>`,
      )}
    `;
  }

  renderLblsDropdown(pos: number) {
    return html`
      <div class="lbl-dropdown-container-field-wrapper">
        <sl-select
          id="selectLabel"
          class="dropdown larger"
          value="${live(
            this.labels[pos] === undefined
              ? ""
              : encodeURIComponent(this.labels[pos]),
          )}"
          @sl-change="${(event: Event) => {
            this.updateLabelValue(pos, event);
          }}">
          ${this.renderLblDropdownOptions(pos)}
        </sl-select>
        <sl-button-group>
          <sl-button
            aria-label="Remove Label"
            variant="neutral"
            @click="${() => this.removeLabel(pos)}"
            >-</sl-button
          >
          <sl-button
            aria-label="Add Label"
            variant="neutral"
            @click="${this.addLabel}"
            >+</sl-button
          >
        </sl-button-group>
      </div>
    `;
  }

  renderLblDropdownOptions(_pos: number) {
    return html`
      <sl-option> No Label Selected </sl-option>
      ${repeat(
        this.lblNamesList,
        (lbl) => lbl,
        (lbl) => {
          return html`
            <sl-option .value="${encodeURIComponent(lbl.name)}">
              <span>
                <div
                  style="width: 10px; height: 10px; background: ${lbl.color
                    .colorHex}; border-radius: 50%; float: left; margin-right: 10px; margin-top: 3px;"></div>
                ${lbl.name}
              </span>
            </sl-option>
          `;
        },
      )}
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
            <sl-input
              label="Label name"
              placeholder="Label name"
              class="text-field larger"
              value="${live(this.newLblName)}"
              @sl-input="${(event: Event) => {
                this.newLblName = (event.target as HTMLInputElement).value;
                this.requestUpdate();
              }}"
              id="label-name"></sl-input>
          </div>
          <div class="row option-title gap-0" style="margin-top: 10px;">
            Label color
          </div>
          <div class="row">
            <sl-select
              id="label-color"
              value="${live(this.newLblColorName)}"
              @sl-change="${(event: Event) => {
                this.newLblColorName = (event.target as HTMLInputElement).value;
                this.requestUpdate();
              }}"
              class="dropdown"
              style="width: 18.5em;">
              ${this.renderLblDropdownColorOptions()}
            </sl-select>
          </div>
          <div class="row" style="margin-top: 10px;">
            <sl-button
              variant="neutral"
              aria-label="Cancel"
              appearance="secondary"
              @click="${this.closeModal}">
              Cancel
            </sl-button>
            <sl-button
              variant="primary"
              aria-label="Create Label"
              @click="${this.createLabel}"
              ?disabled="${this.newLblName === "" ||
              this.newLblColorName === ""}">
              Create
            </sl-button>
          </div>
        </div>
      </dialog>
    `;
    /* c8 ignore stop */
  }

  renderNewLblBtn() {
    return html`
      <sl-button
        variant="neutral"
        aria-label="Create New Label"
        style="height: 26px;    margin-top: 18px;"
        appearance="secondary"
        @click="${this.openModal}">
        Create New Label
      </sl-button>
    `;
  }

  renderConnectionLabelsSection() {
    return html` <div class="row">
      <div class="col gap-0">
        <div class="row option-title">Connection label (optional)</div>
        <div class="row mt-1">
          <div class="dropdown-container lbl-dropdown-container">
            <label for="selectLabel">Label Name</label>
            ${this.labels.length === 0
              ? this.renderLblsDropdown(0)
              : this.labels.map((_, i) => this.renderLblsDropdown(i))}
          </div>
          ${this.renderNewLblBtn()}
        </div>
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
      <div class="row option-title">Add Authentication if enabled</div>
      <div class="row">
        <div class="col gap-0">
          <div class="row">
            <sl-input
              class="text-field larger option-title"
              label="Username"
              .value="${this.kdbServer.username || ""}"
              @sl-input="${(event: Event) =>
                (this.kdbServer.username = (
                  event.target as HTMLInputElement
                ).value)}"></sl-input>
          </div>
          <div class="row">
            <sl-input
              type="password"
              class="text-field larger option-title"
              label="Password"
              .value="${this.kdbServer.password || ""}"
              @sl-input="${(event: Event) =>
                (this.kdbServer.password = (
                  event.target as HTMLInputElement
                ).value)}"></sl-input>
          </div>
          <div class="row option-description  option-help">
            Add required authentication to get access to the server connection
            if enabled.
          </div>
        </div>
      </div>
      <div class="row">
        <div class="col gap-0">
          <div class="row option-title">Optional: Enable TLS Encryption</div>
          <div class="row">
            <sl-checkbox
              .checked="${this.kdbServer.tls}"
              @sl-change="${() => this.changeTLS()}">
              Enable TLS Encryption on the kdb connection
            </sl-checkbox>
          </div>
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
          <details>
            <summary>Advanced</summary>
            ${this.renderRealm()} ${this.renderInsecureSSL()}
          </details>
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
            <div class="tabs">
              <sl-tab-group>
                <sl-tab
                  slot="nav"
                  panel="${ConnectionType.Kdb}"
                  ?active="${live(this.selectedTab === ConnectionType.Kdb)}"
                  @click="${() => {
                    this.serverType = ServerType.KDB;
                    this.selectedTab = ConnectionType.Kdb;
                  }}"
                  >My q
                </sl-tab>
                <sl-tab
                  slot="nav"
                  panel="${ConnectionType.Insights}"
                  ?active="${live(
                    this.selectedTab === ConnectionType.Insights,
                  )}"
                  @click="${() => {
                    this.serverType = ServerType.INSIGHTS;
                    this.selectedTab = ConnectionType.Insights;
                  }}"
                  >Insights connection
                </sl-tab>
                <sl-tab-panel
                  name="${ConnectionType.Kdb}"
                  ?active="${live(this.selectedTab === ConnectionType.Kdb)}">
                  ${this.renderNewMyQConnectionForm()}
                </sl-tab-panel>
                <sl-tab-panel
                  name="${ConnectionType.Insights}"
                  ?active="${live(
                    this.selectedTab === ConnectionType.Insights,
                  )}">
                  ${this.renderNewInsightsConnectionForm()}
                </sl-tab-panel>
              </sl-tab-group>
            </div>
          </div>
        </div>
      </div>
    `;
    /* c8 ignore stop */
  }

  renderCreateConnectionBtn() {
    return html`<div class="row">
      <sl-button variant="primary" class="grow" @click="${() => this.save()}"
        >Create Connection</sl-button
      >
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
            <sl-button
              variant="primary"
              class="grow"
              @click="${() => this.editConnection()}"
              >Update Connection</sl-button
            >
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
            <div class="row option-title">Optional: Edit Auth options</div>
            <div class="row">
              <sl-checkbox
                .checked="${this.editAuth}"
                @sl-change="${() => this.editAuthOfConn()}">
                Edit existing auth on the kdb connection
              </sl-checkbox>
            </div>
          </div>
        </div>
        ${this.editAuth
          ? html`
              <div class="row">
                <div class="col gap-0">
                  <div class="row">
                    <sl-input
                      class="text-field larger option-title"
                      label="Username"
                      .value="${this.kdbServer.username || ""}"
                      @sl-input="${(event: Event) =>
                        (this.kdbServer.username = (
                          event.target as HTMLInputElement
                        ).value)}"></sl-input>
                  </div>
                  <div class="row">
                    <sl-input
                      type="password"
                      class="text-field larger option-title"
                      label="Password"
                      .value="${this.kdbServer.password || ""}"
                      @sl-input="${(event: Event) =>
                        (this.kdbServer.password = (
                          event.target as HTMLInputElement
                        ).value)}"></sl-input>
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
              <sl-checkbox
                .checked="${this.kdbServer.tls}"
                @sl-change="${() => this.changeTLS()}">
                Enable TLS Encryption on the kdb connection
              </sl-checkbox>
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

    if (this.renderId === "") {
      this.renderId = this.generateRenderId();
      this.insightsServer.alias = this.connectionData.serverName;
      this.insightsServer.server = this.connectionData.serverAddress;
      this.insightsServer.realm = this.connectionData.realm ?? "";
      this.insightsServer.insecure = this.connectionData.insecure ?? false;
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
            <details>
              <summary>Advanced</summary>
              ${this.renderRealm()} ${this.renderInsecureSSL()}
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
        this.kdbServer.auth = this.kdbServer.username !== "";
        return this.kdbServer;
    }
  }

  private save() {
    this.removeBlankLabels();
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
      this.labels.push(this.newLblName);
      this.removeBlankLabels();
      this.closeModal();
    }, 500);
  }

  private editConnection() {
    if (!this.connectionData) {
      return;
    }
    this.removeBlankLabels();
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
