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

import {
  CallHierarchyIncomingCall,
  CallHierarchyIncomingCallsParams,
  CallHierarchyItem,
  CallHierarchyOutgoingCall,
  CallHierarchyOutgoingCallsParams,
  CallHierarchyPrepareParams,
  SymbolKind,
} from "vscode-languageserver";
import AnalyzerUtil from "./analyzerUtil";

export default class CallHierarchyHandler {
  private analyzerUtil: AnalyzerUtil;

  public constructor(analyzer: AnalyzerUtil) {
    this.analyzerUtil = analyzer;
  }

  public onPrepare(params: CallHierarchyPrepareParams): CallHierarchyItem[] {
    const keyword = this.analyzerUtil.getKeywordAtPosition(
      params.textDocument.uri,
      params.position
    );
    if (keyword) {
      const symbolInformation = this.analyzerUtil
        .getSymbolsByUri(params.textDocument.uri)
        .filter((symbol) => symbol.name === keyword.text);
      if (
        symbolInformation.length > 0 &&
        symbolInformation[0].kind === SymbolKind.Function
      ) {
        return [
          {
            name: keyword.text,
            kind: SymbolKind.Function,
            uri: params.textDocument.uri,
            range: keyword.range,
            selectionRange: keyword.range,
          },
        ];
      }
    }
    return [];
  }

  public onIncomingCalls(
    params: CallHierarchyIncomingCallsParams
  ): CallHierarchyIncomingCall[] {
    const containerName = params.item.name;
    if (!containerName) {
      return [];
    }
    const items =
      this.analyzerUtil.getCallHierarchyItemByKeyword(containerName);
    return items.map((item) => ({ from: item, fromRanges: [item.range] }));
  }

  public onOutgoingCalls(
    params: CallHierarchyOutgoingCallsParams
  ): CallHierarchyOutgoingCall[] {
    const globalId = this.analyzerUtil.getGlobalIdByUriContainerName(
      params.item.uri,
      params.item.name
    );
    return globalId
      .map((keyword) =>
        this.analyzerUtil.getCallHierarchyItemByKeyword(keyword)
      )
      .flat(1)
      .map((item) => ({ to: item, fromRanges: [item.range] }));
  }
}
