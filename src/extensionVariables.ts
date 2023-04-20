import { ChildProcess } from 'node:child_process';
import { ExtensionContext, extensions, OutputChannel } from 'vscode';
import { LanguageClient } from 'vscode-languageclient/node';
import { AzureAccountExtensionApi } from './azure-account.api';
import { Connection } from './models/connection';
import { KdbNode, KdbTreeProvider } from './services/kdbTreeProvider';
import AuthSettings from './utils/secretStorage';

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace ext {
  export let context: ExtensionContext;
  export let outputChannel: OutputChannel;
  export let consolePanel: OutputChannel;
  export let serverProvider: KdbTreeProvider;

  export let connection: Connection | undefined;
  export let connectionNode: KdbNode | undefined;
  export const maxRetryCount = 5;

  export let secretSettings: AuthSettings;

  export let azureAccount: AzureAccountExtensionApi;

  export function getRuntimePath(): string {
    return 'C:\\Users\\caleteet\\Downloads\\w64\\w64\\q.exe';
  }

  export let localProcessObj: ChildProcess;

  export const kdbLicName = 'kc.lic';
  export const kdbInstallUrl = 'https://kx.com/kdb-personal-edition-download/';
  export const kdbDownloadPrefixUrl = 'https://nexus.dl.kx.com/repository/kdb/4.0/';

  export const kxdevUrl =
    'https://downloads.kx.com/dl/index.php/9OeP-W7XAT7WtsH-I9lzPDKWiHw_oA8fK90mHgvuprPYhwcapsU1LNfQSoHOFinKpsgQ3VM5PWf7KjCpNgP9EqL_HvnorJxm0-ihvNzk2_rREPf8R1S1-Dt_Lz5uwxOhEWEcEO3PlFgY0dqsqt0Yd1cLLKhbKykjxKTR82XF1W6_ODzkJ0k3SNW4vt6xUkpdetckxbLdD1sUVYz1M0cMsAWsUWodLUpXcEi7ssuWfvvO-p8O2M-c-rAy9e8kz1ylEmh7OsWmX5-Zz8N1cvUyMQF54x3LEEFTpaJi96ZvmnjRMOSfkREHYVYsfzHM6XBALxVxxljdcmk6ttxqPEDuZUXQf6gdpjEeN5XPqrcv-zqKZhJ6A-PO6A1beCh5qlfJ3EyJFpdPBm0xnh8vCCENZ9BMGjAXUs8HQ7fukxWVRKX_sKLFeFFFKVsUJUJrgqop518iojQnKlx7QZnvArd0KA';

  export let client: LanguageClient;

  const extensionId = 'kx.kxdb-vscode';
  const packageJSON = extensions.getExtension(extensionId)!.packageJSON;
  export const extensionName = packageJSON.name;
  export const extensionVersion = packageJSON.version;
  export const extensionKey = packageJSON.aiKey;

  export const functions: Array<string> = [];
  export const variables: Array<string> = [];
  export const tables: Array<string> = [];
  // eslint-disable-next-line prefer-const
  export let keywords: Array<string> = [];

  export const constants = {
    names: [
      '',
      'boolean',
      'guid',
      '',
      'byte',
      'short',
      'int',
      'long',
      'real',
      'float',
      'char',
      'symbol',
      'timestamp',
      'month',
      'date',
      'datetime',
      'timespan',
      'minute',
      'second',
      'time',
      'symbol',
    ],
    types: [
      '',
      'b',
      'g',
      '',
      '',
      'h',
      'i',
      'j',
      'e',
      'f',
      'c',
      's',
      'p',
      'm',
      'd',
      'z',
      'n',
      'u',
      'v',
      't',
      's',
    ],
    listSeparator: [
      ';',
      '',
      ' ',
      '',
      '',
      ' ',
      ' ',
      ' ',
      ' ',
      ' ',
      '',
      '',
      ' ',
      ' ',
      ' ',
      ' ',
      ' ',
      ' ',
      ' ',
      ' ',
    ],
    listPrefix: ['(', '', '', '', '0x', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    listSuffix: [
      ')',
      'b',
      '',
      '',
      '',
      'h',
      'i',
      '',
      'e',
      'f',
      '',
      '',
      '',
      'm',
      '',
      '',
      '',
      '',
      '',
      '',
    ],

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    base: new Date(2000, 0) as any,
    days: 1000 * 60 * 60 * 24,
    hours: 1000 * 60 * 60,
    minutes: 1000 * 60,
    seconds: 1000,
  };
}
