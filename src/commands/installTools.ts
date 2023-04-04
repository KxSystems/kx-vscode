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
import {
  licenseAquire,
  licenseFileInput,
  licenseItems,
  licensePlaceholder,
  licenseString,
  licenseStringInput,
  licenseTypePlaceholder,
  licenseTypes,
  licenseWorkflow,
} from '../models/items/license';
import { onboardingInput, onboardingWorkflow } from '../models/items/onboarding';
import { Server } from '../models/server';
import { convertBase64License, delay, getHash, getServers, updateServers } from '../utils/core';
import { openUrl } from '../utils/openUrl';
import { Telemetry } from '../utils/telemetryClient';
import { validateServerPort } from '../validators/kdbValidator';

export async function installTools(): Promise<void> {
  let file: Uri[] | undefined;

  const licenseTypeResult: QuickPickItem | undefined = await window.showQuickPick(licenseItems, {
    placeHolder: licensePlaceholder,
  });

  if (licenseTypeResult?.label === licenseAquire) {
    let licenseCancel;
    await openUrl(ext.kdbDownload);
    await window
      .showInformationMessage(
        licenseWorkflow.prompt,
        licenseWorkflow.option1,
        licenseWorkflow.option2
      )
      .then(async res => {
        if (res === licenseWorkflow.option2) {
          licenseCancel = true;
        }
      });
    if (licenseCancel) return;
  }

  const licenseResult: QuickPickItem | undefined = await window.showQuickPick(licenseTypes, {
    placeHolder: licenseTypePlaceholder,
  });

  if (licenseResult === undefined) {
    return;
  } else if (licenseResult.label == licenseString) {
    const licenseInput: InputBoxOptions = {
      prompt: licenseStringInput.prompt,
      placeHolder: licenseStringInput.placeholder,
      ignoreFocusOut: true,
    };

    await window.showInputBox(licenseInput).then(async encodedLicense => {
      if (encodedLicense !== undefined) {
        file = [await convertBase64License(encodedLicense)];
      }
    });
  } else {
    file = await window.showOpenDialog({
      canSelectFiles: licenseFileInput.canSelectFiles,
      canSelectFolders: licenseFileInput.canSelectFolders,
      canSelectMany: licenseFileInput.canSelectMany,
      openLabel: licenseFileInput.openLabel,
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
          ext.outputChannel.appendLine('User cancelled the installation.');
        });

        progress.report({ increment: 0 });

        // move the license file
        progress.report({ increment: 30, message: 'Moving license file...' });
        await delay(500);
        await ensureDir(ext.context.globalStorageUri.fsPath);
        await copy(file![0].fsPath, join(ext.context.globalStorageUri.fsPath, ext.kdbLicName));

        // add the env var for the process
        progress.report({ increment: 60, message: 'Setting up environment...' });
        await delay(500);
        env.QHOME = ext.context.globalStorageUri.fsPath;

        // persist the QHOME to global settings
        await workspace
          .getConfiguration()
          .update('kdb.qHomeDirectory', env.QHOME, ConfigurationTarget.Global);
      }
    )
    .then(async () => {
      window
        .showInformationMessage(
          onboardingWorkflow.prompt(ext.context.globalStorageUri.fsPath),
          onboardingWorkflow.option1,
          onboardingWorkflow.option2
        )
        .then(async startResult => {
          if (startResult === onboardingWorkflow.option1) {
            const portInput: InputBoxOptions = {
              prompt: onboardingInput.prompt,
              placeHolder: onboardingInput.placeholder,
              ignoreFocusOut: true,
              validateInput: (value: string | undefined) => validateServerPort(value),
            };
            window.showInputBox(portInput).then(async port => {
              if (port) {
                let servers: Server | undefined = getServers();
                if (servers != undefined && servers[getHash(`localhost:${port}`)]) {
                  Telemetry.sendEvent(
                    `Server localhost:${port} already exists in configuration store.`
                  );
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
                  await updateServers(servers);
                  const newServers = getServers();
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
