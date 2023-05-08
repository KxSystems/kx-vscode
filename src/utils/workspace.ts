import { workspace } from "vscode";

export function getWorkspaceRoot(
  ignoreException: boolean = false
): string | undefined {
  const workspaceRoot =
    workspace.workspaceFolders && workspace.workspaceFolders[0].uri.fsPath;

  if (workspaceRoot === undefined && !ignoreException) {
    const error = new Error("Workspace root should be defined");
    throw error;
  }

  return workspaceRoot;
}

export function isWorkspaceOpen(): boolean {
  return !!(
    workspace.workspaceFolders && workspace.workspaceFolders[0].uri.fsPath
  );
}
