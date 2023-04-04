import { ConfigurationTarget, commands, window, workspace } from 'vscode';

export async function hideWalkthrough(): Promise<void> {
  await workspace
    .getConfiguration()
    .update('kdb.hideWalkthrough', true, ConfigurationTarget.Global);

  await commands.executeCommand('workbench.action.openWalkthrough');
}

export async function showWalkthrough(): Promise<boolean> {
  const walkthroughResult = await !workspace.getConfiguration().get('kdb.hideWalkthrough');
  if (walkthroughResult === undefined || walkthroughResult === false) {
    return false;
  }
  return true;
}

export async function showInstallationDetails(): Promise<void> {
  const QHOME = await workspace.getConfiguration().get<string>('kdb.qHomeDirectory');
  window.showInformationMessage(`Q runtime installed path: ${QHOME}`);
}
