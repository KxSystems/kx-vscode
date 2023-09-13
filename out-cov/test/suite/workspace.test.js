"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
const sinon = __importStar(require("sinon"));
const vscode = __importStar(require("vscode"));
const workspaceHelper = __importStar(require("../../src/utils/workspace"));
describe("Workspace tests", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const testWorkspaceFolder = [
        {
            uri: {
                fsPath: "testPath1",
            },
        },
        {
            uri: {
                fsPath: "testPath2",
            },
        },
    ];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let workspaceMock;
    beforeEach(() => {
        workspaceMock = sinon.stub(vscode.workspace, "workspaceFolders");
    });
    afterEach(() => {
        workspaceMock.restore();
    });
    it("getWorkspaceRoot should throw exception when no workspace opened", () => {
        workspaceMock.value(undefined);
        assert.throws(() => workspaceHelper.getWorkspaceRoot(), Error, "Workspace root should be defined.");
    });
    it("getWorkspaceRoot should return workspace root path", async () => {
        workspaceMock.value(testWorkspaceFolder);
        const result = workspaceHelper.getWorkspaceRoot();
        assert.strictEqual(result, testWorkspaceFolder[0].uri.fsPath);
    });
    it("isWorkspaceOpen should return false when no workspace is opened", () => {
        workspaceMock.value(undefined);
        const result = workspaceHelper.isWorkspaceOpen();
        assert.strictEqual(result, false);
    });
    it("isWorkspaceOpen should return true when workspace is opened", () => {
        workspaceMock.value(testWorkspaceFolder);
        const result = workspaceHelper.isWorkspaceOpen();
        assert.strictEqual(result, true);
    });
});
//# sourceMappingURL=workspace.test.js.map