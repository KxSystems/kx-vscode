/*
 * Copyright (c) 1998-2025 KX Systems Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the
 * License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations under the License.
 */

import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { ext } from "../extensionVariables";
import { MessageKind, notify } from "./notifications";
import { errorMessage } from "./shared";

const logger = "storage";

export async function writeLocalFile(name: string, content: string) {
  /* c8 ignore start */
  try {
    const fsPath = ext.context.globalStorageUri.fsPath;
    await mkdir(fsPath, { recursive: true });
    const target = resolve(fsPath, name);
    await writeFile(target, content);
    return target;
  } catch (error) {
    notify(errorMessage(error), MessageKind.DEBUG, { logger });
  }
  return "";
  /* c8 ignore stop */
}

export function readLocalFile(name: string) {
  /* c8 ignore start */
  try {
    const target = resolve(ext.context.globalStorageUri.fsPath, name);
    return readFileSync(target, { encoding: "utf8" });
  } catch (error) {
    notify(errorMessage(error), MessageKind.DEBUG, { logger });
  }
  return "";
  /* c8 ignore stop */
}

export function getLocalSetting(key: string, value?: any) {
  /* c8 ignore start */
  const settings = readSettigs();
  return settings[key] ?? value;
  /* c8 ignore stop */
}

export async function setLocalSetting(key: string, value: any) {
  /* c8 ignore start */
  const settings = readSettigs();
  settings[key] = value;
  await writeSettigs(settings);
  /* c8 ignore stop */
}

function readSettigs() {
  /* c8 ignore start */
  try {
    const settings = readLocalFile("settings.json");
    if (settings) return JSON.parse(settings);
  } catch (error) {
    notify(errorMessage(error), MessageKind.DEBUG, { logger });
  }
  return {};
  /* c8 ignore stop */
}

function writeSettigs(settings: any) {
  /* c8 ignore start */
  return writeLocalFile("settings.json", JSON.stringify(settings));
  /* c8 ignore stop */
}
