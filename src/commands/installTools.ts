import { copy, ensureDir } from 'fs-extra';
import { env } from 'node:process';
import { join } from 'path';
import {
  ConfigurationTarget,
  InputBoxOptions,
  ProgressLocation,
  QuickPickItem,
  Uri,
  window,
  workspace,
} from 'vscode';
import { ext } from '../extensionVariables';
import { Server } from '../models/server';
import { convertBase64License, delay, getHash } from '../utils/core';
import { openUrl } from '../utils/openUrl';
import { findPid, killPort } from '../utils/shell';
import { validateServerPort } from '../validators/kdbValidator';
import extract = require('extract-zip');

export async function installTools(): Promise<void> {
  let file: Uri[] | undefined;

  const picks: QuickPickItem[] = [
    {
      label: 'Select / Enter a license',
      detail: 'Select if you have already registered and have a license key.',
    },
    {
      label: 'Acquire license',
      detail: 'Select if you are new or need to register for a new license key.',
    },
  ];

  const licenseTypeResult: QuickPickItem | undefined = await window.showQuickPick(picks, {
    placeHolder: 'Provide a license key.',
  });

  if (licenseTypeResult?.label === 'Acquire license') {
    let licenseCancel;
    await openUrl(ext.kdbDownload);
    await window
      .showInformationMessage(
        'After receiving the email with license, click continue to proceed.',
        'Continue',
        'Cancel'
      )
      .then(async res => {
        if (res === 'Cancel') {
          licenseCancel = true;
        }
      });
    if (licenseCancel) {
      return;
    }
  }

  const licensePicks: QuickPickItem[] = [
    {
      label: 'Paste license string (base64 string from email)',
      detail: 'Paste in the base64 encoded license string from the email ',
    },
    {
      label: 'Select license file',
      detail: 'Select a file saved with the license',
    },
  ];

  const licenseResult: QuickPickItem | undefined = await window.showQuickPick(licensePicks, {
    placeHolder: 'Select an option for license',
  });

  if (licenseResult === undefined) {
    return;
  } else if (licenseResult.label == 'Paste license string (base64 string from email)') {
    const licenseInput: InputBoxOptions = {
      prompt: 'Paste the base64 encoded license string',
      placeHolder: 'encoded license',
      ignoreFocusOut: true,
    };

    await window.showInputBox(licenseInput).then(async encodedLicense => {
      if (encodedLicense !== undefined) {
        file = [await convertBase64License(encodedLicense)];
      }
    });
  } else {
    file = await window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      openLabel: 'Select a license file',
    });
  }

  if (!file) {
    throw new Error();
  }

  window
    .withProgress(
      {
        location: ProgressLocation.Notification,
        title: 'Installation of Q',
        cancellable: true,
      },
      async (progress, token) => {
        token.onCancellationRequested(() => {
          console.log('User cancelled the installation.');
        });

        progress.report({ increment: 0 });

        progress.report({ increment: 10, message: 'Checking for running process...' });
        await delay(1000);
        const result = await findPid(5001);
        if (Number.isNaN(result)) {
          // move the license file
          progress.report({ increment: 30, message: 'Moving license file...' });
          await delay(1000);
          await ensureDir(ext.context.globalStorageUri.fsPath);
          await copy(file![0].fsPath, join(ext.context.globalStorageUri.fsPath, ext.kdbLicName));

          // get the bits for Q
          /*
          progress.report({ increment: 50, message: 'Getting the binaries...' });
          await delay(1000);
          if (process.platform == 'win32') {
            const gpath = join(ext.context.globalStorageUri.fsPath, 'w64.zip');
            if (!(await existsSync(gpath))) {
              const response = await fetch(ext.kdbUrl);
              await writeFile(gpath, await response.buffer());
            }
            await extract(gpath, { dir: ext.context.globalStorageUri.fsPath });
          } else if (process.platform == 'darwin') {
            const gpath = join(ext.context.globalStorageUri.fsPath, 'm64.zip');
            if (!(await existsSync(gpath))) {
              const response = await fetch(ext.kdbUrl);
              await writeFile(gpath, await response.buffer());
            }
            await extract(gpath, { dir: ext.context.globalStorageUri.fsPath });
          } else {
            throw new Error('OS not supports, only Windows and Mac are supported.');
          }
          */

          // add the env var for the process
          progress.report({ increment: 70, message: 'Setting up environment...' });
          await delay(1000);
          env.QHOME = ext.context.globalStorageUri.fsPath;

          // persist the QHOME to global settings
          await workspace
            .getConfiguration()
            .update('kdb.qHomeDirectory', env.QHOME, ConfigurationTarget.Global);
        }

        return new Promise<void>(resolve => {
          resolve();
        });
      }
    )
    .then(async () => {
      window
        .showInformationMessage(
          `Installation of Q runtime completed successfully to ${ext.context.globalStorageUri.fsPath}`,
          'Start Q',
          'Cancel'
        )
        .then(async startResult => {
          if (startResult === 'Start Q') {
            const portInput: InputBoxOptions = {
              prompt: 'Enter the desired port number for Q',
              placeHolder: '5001',
              ignoreFocusOut: true,
              validateInput: (value: string | undefined) => validateServerPort(value),
            };
            window.showInputBox(portInput).then(async port => {
              if (port) {
                /*
                const workingDirectory = join(
                  ext.context.globalStorageUri.fsPath,
                  process.platform == 'win32' ? 'w64' : 'm64'
                );
                await executeCommand(workingDirectory, 'q', '-p', port);
                */

                let servers: Server | undefined = workspace.getConfiguration().get('kdb.servers');
                if (servers != undefined && servers[getHash(`localhost:${port}`)]) {
                  await window.showErrorMessage(`Server localhost:${port} already exists.`);
                } else {
                  const key = getHash(`localhost${port}local`);
                  if (servers === undefined) {
                    servers = {
                      key: {
                        auth: false,
                        serverName: 'localhost',
                        serverPort: port,
                        serverAlias: 'local',
                      },
                    };
                  } else {
                    servers[key] = {
                      auth: false,
                      serverName: 'localhost',
                      serverPort: port,
                      serverAlias: 'local',
                    };
                  }
                  await workspace
                    .getConfiguration()
                    .update('kdb.servers', servers, ConfigurationTarget.Global);
                  const newServers: Server | undefined = workspace
                    .getConfiguration()
                    .get('kdb.servers');
                  if (newServers != undefined) {
                    ext.serverProvider.refresh(newServers);
                  }
                }
              }
            });
          }
        });
    });
}

export async function stopQ(): Promise<void> {
  await killPort(5001);
}
