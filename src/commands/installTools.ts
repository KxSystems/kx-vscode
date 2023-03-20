import { copy, ensureDir, existsSync } from 'fs-extra';
import { writeFile } from 'fs/promises';
import fetch from 'node-fetch';
import { env } from 'node:process';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  InputBoxOptions,
  ProgressLocation,
  QuickPickItem,
  QuickPickOptions,
  Uri,
  window,
} from 'vscode';
import { ext } from '../extensionVariables';
import { delay } from '../utils/core';
import { executeCommand } from '../utils/cpUtils';
import { openUrl } from '../utils/openUrl';
import { findPid, killPort } from '../utils/shell';
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

  const options: QuickPickOptions = { placeHolder: 'Provide a license key.' };

  const result: QuickPickItem | undefined = await window.showQuickPick(picks, options);
  if (result === undefined || result.label === 'Acquire license') {
    await openUrl(ext.kdbDownload);
    await window
      .showInformationMessage(
        'After receiving the email with license, please restart vscode.',
        'More info'
      )
      .then(async (result: string) => {
        if (result === 'More info') {
          await openUrl('https://www.bing.com'); // TODO: update to real url
        }
      });
  } else {
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
    const licenseOptions: QuickPickOptions = { placeHolder: 'Select an option for license' };
    const licenseResult: QuickPickItem | undefined = await window.showQuickPick(
      licensePicks,
      licenseOptions
    );
    if (licenseResult === undefined) {
      return;
    } else if (licenseResult.label == 'Paste license string (base64 string from email)') {
      const licenseInput: InputBoxOptions = {
        prompt: 'Paste the base64 encoded license string',
        placeHolder: 'encoded license',
      };
      await window.showInputBox(licenseInput).then(async (encodedLicense: string) => {
        if (encodedLicense !== undefined) {
          const decodedLicense = Buffer.from(encodedLicense, 'base64');
          await writeFile(join(tmpdir(), 'kc.lic'), decodedLicense);
          file = [Uri.parse(join(tmpdir(), 'kc.lic'))];
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

            // install the KX developer tools to use the lint for language server
            // await ensureDir(ext.context.globalStorageUri.fsPath);
            // const response = await fetch(ext.kxdevUrl);
            // const gpath = join(ext.context.globalStorageUri.fsPath, 'wdev.zip');
            // await writeFile(gpath, await response.buffer());
            // await extract(gpath, { dir: ext.context.globalStorageUri.fsPath });

            // add the env var for the process
            progress.report({ increment: 70, message: 'Setting up environment...' });
            await delay(1000);
            env.QHOME = ext.context.globalStorageUri.fsPath;

            progress.report({ increment: 100, message: 'Starting Q...' });
            await delay(1000);
          }

          return new Promise<void>(resolve => {
            resolve();
          });
        }
      )
      .then(async () => {
        window.showInformationMessage('Installation of Q runtime completed successfully!');
        const workingDirectory = join(
          ext.context.globalStorageUri.fsPath,
          process.platform == 'win32' ? 'w64' : 'm64'
        );
        await executeCommand(workingDirectory, 'q', '-p', '5001');
      });
  }
}

export async function stopQ(): Promise<void> {
  await killPort(5001);
}
