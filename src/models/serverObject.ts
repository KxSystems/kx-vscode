/*
 * Copyright (c) 1998-2023 Kx Systems Inc.
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

import { loadServerObjects } from "../commands/serverCommand";
import { ext } from "../extensionVariables";

export interface ServerObject {
  id: number;
  pid: number;
  name: string;
  fname: string;
  typeNum: number;
  namespace: string;
  context: object;
  isNs: boolean;
}

export async function loadNamespaces(root?: string): Promise<ServerObject[]> {
  const serverObjects = await loadServerObjects();
  if (serverObjects !== undefined) {
    const ns = serverObjects.filter((value) => {
      return value.isNs ? value : undefined;
    });
    return getNamespaces(ns, root);
  }
  return new Array<ServerObject>();
}

export async function loadDictionaries(ns: string): Promise<ServerObject[]> {
  const serverObjects = await loadServerObjects();
  if (serverObjects !== undefined) {
    const dicts = serverObjects.filter((value) => {
      return value.typeNum === 99 && !value.isNs && value.namespace === ns
        ? value
        : undefined;
    });
    return dicts;
  }
  return new Array<ServerObject>();
}

export async function loadFunctions(ns: string): Promise<ServerObject[]> {
  const serverObjects = await loadServerObjects();
  if (serverObjects !== undefined) {
    const dicts = serverObjects.filter((value) => {
      return value.typeNum === 100 && !value.isNs && value.namespace === ns
        ? value
        : undefined;
    });
    return dicts;
  }
  return new Array<ServerObject>();
}

export async function loadTables(ns: string): Promise<ServerObject[]> {
  const serverObjects = await loadServerObjects();
  if (serverObjects !== undefined) {
    const dicts = serverObjects.filter((value) => {
      return value.typeNum === 98 && !value.isNs && value.namespace === ns
        ? value
        : undefined;
    });
    return dicts;
  }
  return new Array<ServerObject>();
}

export async function loadVariables(ns: string): Promise<ServerObject[]> {
  const serverObjects = await loadServerObjects();
  const views = await loadViews();

  if (serverObjects !== undefined) {
    const dicts = serverObjects.filter((value) => {
      return views.indexOf(value.name) === -1 &&
        value.typeNum === -7 &&
        !value.isNs &&
        value.namespace === ns
        ? value
        : undefined;
    });
    return dicts;
  }
  return new Array<ServerObject>();
}

export async function loadViews(): Promise<string[]> {
  const rawViews = await ext.connection?.executeQuery("views`");
  const rawViewArray = rawViews?.replace("\r\n", "").split("`");
  const views = rawViewArray?.filter((item) => {
    return item !== "s#" && item !== "" && item !== ",";
  });
  return views ?? new Array<string>();
}

function getNamespaces(input: ServerObject[], root = "."): ServerObject[] {
  const output: ServerObject[] = [];

  input.forEach((v, i) => {
    let index = -1;
    if (root === v.namespace) {
      index = i;
    }

    if (index != -1) {
      output.push(v);
    }
  });

  return output;
}
