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

import * as assert from "assert";
import * as sinon from "sinon";

import { ext } from "../../../../src/extensionVariables";
import { CompletionProvider } from "../../../../src/services/completionProvider";
import { KdbNode } from "../../../../src/services/kdbTreeProvider";

describe("CompletionProvider", () => {
  it("should provide completion items", () => {
    sinon.stub(ext, "connectionNode").value(sinon.createStubInstance(KdbNode));
    sinon.stub(ext, "functions").value(["test"]);
    const provider = new CompletionProvider();
    const items = provider.provideCompletionItems();
    assert.ok(items);
  });
});
