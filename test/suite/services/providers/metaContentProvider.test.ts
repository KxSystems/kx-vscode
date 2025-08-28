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
import * as vscode from "vscode";

import { MetaContentProvider } from "../../../../src/services/metaContentProvider";

describe("MetaContentProvider", () => {
  let metaContentProvider: MetaContentProvider;
  let uri: vscode.Uri;

  beforeEach(() => {
    metaContentProvider = new MetaContentProvider();
    uri = vscode.Uri.parse("foo://example.com");
  });

  it("should update content and fire onDidChange event", () => {
    const content = "new content";
    const spy = sinon.spy();

    metaContentProvider.onDidChange(spy);

    metaContentProvider.update(uri, content);

    assert.strictEqual(
      metaContentProvider.provideTextDocumentContent(uri),
      content,
    );
    assert.ok(spy.calledOnceWith(uri));
  });

  it("should provide text document content", () => {
    const content = "content";

    metaContentProvider.update(uri, content);
    assert.strictEqual(
      metaContentProvider.provideTextDocumentContent(uri),
      content,
    );
  });
});
