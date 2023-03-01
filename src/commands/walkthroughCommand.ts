import { commands, ConfigurationTarget, workspace } from 'vscode';

export async function hideWalkthrough(): Promise<void> {
  await workspace
    .getConfiguration()
    .update('kdb.hideWalkthrough', true, ConfigurationTarget.Global);

  await commands.executeCommand('workbench.action.openWalkthrough');
}

export async function checkWalkthrough(): Promise<boolean | undefined> {
  return await workspace.getConfiguration().get('kdb.hideWalkthrough');
}
