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
