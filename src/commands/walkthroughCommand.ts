import { writeFile } from 'fs-extra';
import { join } from 'path';
import { ConfigurationTarget, commands, window, workspace } from 'vscode';

export async function hideWalkthrough(): Promise<void> {
  await workspace
    .getConfiguration()
    .update('kdb.hideWalkthrough', true, ConfigurationTarget.Global);

  await commands.executeCommand('workbench.action.openWalkthrough');
}

export async function checkWalkthrough(): Promise<boolean | undefined> {
  return await workspace.getConfiguration().get('kdb.hideWalkthrough');
}

export async function showInstallationDetails(): Promise<void> {
  const QHOME = await workspace.getConfiguration().get<string>('kdb.qHomeDirectory');
  window.showInformationMessage(`Q runtime installed path: ${QHOME}`);
}

export async function updateInstallationDetails(): Promise<void> {
  const QHOME = await workspace.getConfiguration().get<string>('kdb.qHomeDirectory');
  await writeFile(join(__dirname, 'test.md'), `# Q runtime installed location: \n### ${QHOME}`);
}
