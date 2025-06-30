/*
 * Copyright (c) 1998-2025 Kx Systems Inc.
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
  selectedTab = ConnectionType.BundledQ;
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
  labels: string[] = [""];
  serverType: ServerType = ServerType.KDB;
  isBundledQ: boolean = true;
  oldAlias: string = "";
  editAuth: boolean = false;
  renderId: string = "";
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

  /* istanbul ignore next */
  renderServerNameField(serverType: ServerType, isBundleQ?: boolean) {
    return isBundleQ
      ? html`<sl-input
          class="text-field larger option-title"
          value="${live(this.bundledServer.serverAlias)}"
          readonly
          label="Server Name"></sl-input>`
      : serverType === ServerType.KDB
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
        <sl-input
          class="text-field larger option-title"
          value="${live(
            isBundleQ
              ? this.bundledServer.serverPort
              : this.kdbServer.serverPort,
          )}"
          @input="${(event: Event) => {
            /* istanbul ignore next */
            const value = (event.target as HTMLInputElement).value;
            /* istanbul ignore next */
            if (isBundleQ) {
              this.bundledServer.serverPort = value;
            } else {
              this.kdbServer.serverPort = value;
            }
          }}"
          label="Set port number"></sl-input>
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
            <sl-input
              class="text-field larger option-title"
              value="${live(this.bundledServer.serverName)}"
              readonly
              label="Define connection address"></sl-input>
          </div>
          <div class="row option-description option-help">
            ${this.renderConnAddDesc(serverType)}
          </div>
        `
      : html`
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
                /* istanbul ignore next */
                const value = (event.target as HTMLInputElement).value;
                /* istanbul ignore next */
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
  }

  renderRealm() {
    return html`
      <div class="row mt-1">
        <sl-input
          class="text-field larger option-title"
          value="${live(this.insightsServer.realm ?? "")}"
          placeholder="insights"
          @input="${(event: Event) => {
            /* istanbul ignore next */
            const value = (event.target as HTMLInputElement).value;
            /* istanbul ignore next */
            this.insightsServer.realm = value;
          }}"
          label="Define Realm (optional)"></sl-input>
      </div>
      <div class="row option-description option-help">
        Specify the Keycloak realm for authentication. Use this field to connect
        to a specific realm as configured on your server.
      </div>
    `;
  }

  renderInsecureSSL() {
    return html`
      <div class="row mt-1">
        <sl-checkbox
          .checked="${this.insightsServer.insecure ?? false}"
          @sl-change="${(event: Event) => {
            /* istanbul ignore next */
            this.insightsServer.insecure = (
              event.target as HTMLInputElement
            ).checked;
          }}">
          Accept insecure SSL certifcates
        </sl-checkbox>
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
                /* istanbul ignore next */
                this.newLblName = (event.target as HTMLInputElement).value;
                /* istanbul ignore next */
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
                /* istanbul ignore next */
                this.newLblColorName = (event.target as HTMLInputElement).value;
                /* istanbul ignore next */
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

  renderNewBundleqConnectionForm() {
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
        ${this.renderConnectionLabelsSection()}
        ${this.renderCreateConnectionBtn()}
      </div>
    `;
  }

  /* istanbul ignore next */
  renderNewMyQConnectionForm() {
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
            <div class="tabs">
              <sl-tab-group>
                <sl-tab
                  slot="nav"
                  panel="${ConnectionType.BundledQ}"
                  ?active="${live(
                    this.selectedTab === ConnectionType.BundledQ,
                  )}"
                  @click="${() => {
                    /* istanbul ignore next */
                    this.selectedTab = ConnectionType.BundledQ;
                    this.serverType = ServerType.KDB;
                    this.isBundledQ = true;
                  }}"
                  >Bundle q</sl-tab
                >
                <sl-tab
                  slot="nav"
                  panel="${ConnectionType.Kdb}"
                  ?active="${live(this.selectedTab === ConnectionType.Kdb)}"
                  @click="${() => {
                    /* istanbul ignore next */
                    this.isBundledQ = false;
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
                    /* istanbul ignore next */
                    this.isBundledQ = false;
                    this.serverType = ServerType.INSIGHTS;
                    this.selectedTab = ConnectionType.Insights;
                  }}"
                  >Insights connection
                </sl-tab>
                <sl-tab-panel
                  name="${ConnectionType.BundledQ}"
                  ?active="${live(
                    this.selectedTab === ConnectionType.BundledQ,
                  )}">
                  ${this.renderNewBundleqConnectionForm()}
                </sl-tab-panel>
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
    this.isBundledQ = this.connectionData.connType === ConnectionType.BundledQ;
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
    if (connType === ConnectionType.BundledQ) {
      return "Bundled q";
    } else if (connType === ConnectionType.Kdb) {
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

    if (this.renderId === "") {
      this.renderId = this.generateRenderId();
      this.bundledServer.serverAlias = "local";
      this.bundledServer.serverPort = this.connectionData.port ?? "";
      this.bundledServer.serverName = this.connectionData.serverAddress;
    }

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
    if (this.isBundledQ) {
      this.vscode.postMessage({
        command: "kdb.connections.add.bundleq",
        data: this.bundledServer,
        labels: this.labels,
      });
    } else if (this.serverType === ServerType.INSIGHTS) {
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
    if (this.connectionData.connType === 0) {
      this.vscode.postMessage({
        command: "kdb.connections.edit.bundleq",
        data: this.bundledServer,
        oldAlias: "local",
        labels: this.labels,
      });
    } else if (this.connectionData.connType === 1) {
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
