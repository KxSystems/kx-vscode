import { createHash } from 'crypto';
import { writeFile } from 'fs/promises';
import { env } from 'node:process';
import { tmpdir } from 'os';
import { join } from 'path';
import { Uri, window, workspace } from 'vscode';
import { installTools } from '../commands/installTools';
import { ext } from '../extensionVariables';
import { QueryResult } from '../models/queryResult';
import { ServerDetails } from '../models/server';
import { executeCommand } from './cpUtils';
import { findPid } from './shell';

export function getHash(input: string): string {
  return createHash('sha256').update(input).digest('base64');
}

export function getServerName(server: ServerDetails): string {
  return server.serverAlias != ''
    ? `${server.serverName}:${server.serverPort} [${server.serverAlias}]`
    : `${server.serverName}:${server.serverPort}`;
}

export function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function checkLocalInstall(): Promise<void> {
  const QHOME = await workspace.getConfiguration().get<string>('kdb.qHomeDirectory');
  if (QHOME) {
    env.QHOME = QHOME || undefined;
  }
  if (env.QHOME === undefined || env.QHOME.length === 0) {
    window
      .showInformationMessage('Local Q installation not found!', 'Install new instance', 'Cancel')
      .then(async result => {
        if (result === 'Install new instance') {
          await installTools();
        }
      });
  } else {
    ext.outputChannel.appendLine(`Installation of Q found here: ${env.QHOME}`);
  }
}

export async function checkLocalInstallRunning(): Promise<void> {
  const result = await findPid(5001);
  if (isNaN(result)) {
    window
      .showInformationMessage('Local Q instance is not running', 'Locate Q install', 'Cancel')
      .then(async result => {
        if (result === 'Locate Q install') {
          const directory = await window.showOpenDialog({
            canSelectFolders: true,
            canSelectFiles: false,
            openLabel: 'Select the Q installation directory (QHOME)',
          });

          if (!directory) {
            throw new Error();
          }

          env.QHOME = directory[0].fsPath;
          const workingDirectory = join(
            directory[0].fsPath,
            process.platform == 'win32' ? 'w64' : 'm64'
          );
          await executeCommand(workingDirectory, 'q', '-p', '5001');
        } else {
          return;
        }
      });
  }
}

export async function convertBase64License(
  encodedLicense: string,
  tempDir: string = tmpdir()
): Promise<Uri> {
  const decodedLicense = Buffer.from(encodedLicense, 'base64');
  await writeFile(join(tempDir, 'kc.lic'), decodedLicense);
  return Uri.parse(join(tmpdir(), 'kc.lic'));
}

export function isTable(result: QueryResult): boolean {
  if (!result.result || !result.meta || result.meta.length === 0) {
    return false;
  }
  return true;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function formatTable(headers_: any, rows_: any, opts: any) {
  if (!opts) {
    opts = {};
  }

  const data = new Array(rows_.length);
  for (let i = 0; i < rows_.lenth; ++i) {
    data[i] = typeof rows_[i] === 'object' ? Object.values(rows_[i]) : rows_[i];
  }

  const hsep = opts.hsep === undefined ? ' ' : opts.hsep;
  const align = opts.align || [];
  const keys = opts.keys || [];
  const stringLength =
    opts.stringLength ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function (s: any) {
      return String(s).length;
    };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dotsizes = reduce(
    data,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function (acc: any, row: any) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      forEach(row, function (c: any, ix: any) {
        const [left, right] = dotoffsets(c);

        if (!acc[ix]) {
          acc[ix] = [left, right];
        } else {
          if (left > acc[ix][0]) {
            acc[ix][0] = left;
          }
          if (right > acc[ix][1]) {
            acc[ix][1] = right;
          }
        }
      });
      return acc;
    },
    []
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = map(data, function (row: any) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return map(row, function (c_: any, ix: any) {
      const c = String(c_);
      if (align[ix] === '.') {
        const [left, right] = dotoffsets(c);
        const test = /\./.test(c);
        const [maxLeft, maxRight] = dotsizes[ix];
        const leftSize = maxLeft - left;
        const rightSize = (maxRight === 0 || test ? 0 : 1) + maxRight - right;
        return ' '.repeat(leftSize) + c + ' '.repeat(rightSize);
      } else {
        return c;
      }
    });
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sizes = reduce(
    rows,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function (acc: any, row: any) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      forEach(row, function (c: any, ix: any) {
        const n = stringLength(c);
        if (!acc[ix] || n > acc[ix]) {
          acc[ix] = n;
        }
      });
      return acc;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    headers_.map((x: any) => x.length)
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let result = map(rows, function (row: any) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return map(row, function (c: any, ix: any) {
      const n = sizes[ix] - stringLength(c) || 0;
      const s = Array(Math.max(n + 1, 1)).join(' ');
      if (align[ix] === 'r' /* || align[ix] === '.'*/) {
        return s + c;
      }

      if (align[ix] === 'c') {
        return Array(Math.ceil(n / 2 + 1)).join(' ') + c + Array(Math.floor(n / 2 + 1)).join(' ');
      }

      return c + s;
    }).join(hsep);
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const headers = map(headers_, function (c: any, ix: any) {
    return c + ' '.repeat(Math.max(0, sizes[ix] - c.length));
  });

  let columnSeparatorIndex = 0;
  for (let i = 0; i < keys.length; ++i) {
    columnSeparatorIndex += headers[i].length;
  }

  const header = headers.join(hsep);
  const separator = '-'.repeat(header.length);

  result.unshift(separator);
  result.unshift(header);

  if (columnSeparatorIndex > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const insertAt = (str: any, sub: any, pos: any) =>
      `${str.slice(0, pos)}${sub}${str.slice(pos)}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    result = result.map((x: any) => insertAt(x, '|', columnSeparatorIndex + 1));
  }

  return result.join('\n');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function reduce(xs: any, f: any, init: any) {
  if (xs.reduce) {
    return xs.reduce(f, init);
  }

  let i = 0;
  const acc = arguments.length >= 3 ? init : xs[i++];
  for (; i < xs.length; i++) {
    f(acc, xs[i], i);
  }

  return acc;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function forEach(xs: any, f: any) {
  if (xs.forEach) {
    return xs.forEach(f);
  }

  for (let i = 0; i < xs.length; i++) {
    f.call(xs, xs[i], i);
  }
}

function dotoffsets(c: string) {
  const m = /\.[^.]*$/.exec(c);
  return m ? [m.index, c.length - m.length - 1] : [c.length, 0];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function map(xs: any, f: any) {
  if (xs.map) {
    return xs.map(f);
  }

  const res = [];
  for (let i = 0; i < xs.length; i++) {
    res.push(f.call(xs, xs[i], i));
  }
}
