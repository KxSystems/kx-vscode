/*
 * Copyright (c) 1998-2025 Kx Systems Inc.
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

import { LocalConnection } from "../classes/localConnection";
import { loadServerObjects } from "../commands/serverCommand";
import { ext } from "../extensionVariables";
import { ServerObject } from "../models/serverObject";

export class KdbTreeService {
  static async loadNamespaces(root?: string): Promise<ServerObject[]> {
    const serverObjects = await loadServerObjects();
    if (serverObjects !== undefined) {
      const ns = serverObjects.filter((value) => {
        return value.isNs ? value : undefined;
      });

      const sorted = KdbTreeService.sortObjects(ns);

      return KdbTreeService.getNamespaces(sorted, root);
    }
    return new Array<ServerObject>();
  }

  static async loadDictionaries(ns: string): Promise<ServerObject[]> {
    const serverObjects = await loadServerObjects();
    if (serverObjects !== undefined) {
      const dicts = serverObjects.filter((value) => {
        return value.typeNum === 99 && !value.isNs && value.namespace === ns
          ? value
          : undefined;
      });
      return KdbTreeService.sortObjects(dicts);
    }
    return new Array<ServerObject>();
  }

  static async loadFunctions(ns: string): Promise<ServerObject[]> {
    const serverObjects = await loadServerObjects();
    if (serverObjects !== undefined) {
      const funcs = serverObjects.filter((value) => {
        return value.typeNum === 100 && !value.isNs && value.namespace === ns
          ? value
          : undefined;
      });
      return KdbTreeService.sortObjects(funcs);
    }
    return new Array<ServerObject>();
  }

  static async loadTables(ns: string): Promise<ServerObject[]> {
    const serverObjects = await loadServerObjects();
    if (!serverObjects) return [];

    const tables = serverObjects.filter(
      (value) =>
        (value.typeNum === 98 || value.typeNum === 99) &&
        !value.isNs &&
        value.namespace === ns,
    );

    return KdbTreeService.sortObjects(tables);
  }

  static async loadVariables(ns: string): Promise<ServerObject[]> {
    const serverObjects = await loadServerObjects();
    const views = await KdbTreeService.loadViews();

    if (serverObjects !== undefined) {
      const vars = serverObjects.filter((value) => {
        return views.indexOf(value.name) === -1 &&
          value.typeNum < 98 &&
          !value.isNs &&
          value.namespace === ns
          ? value
          : undefined;
      });
      return KdbTreeService.sortObjects(vars);
    }
    return new Array<ServerObject>();
  }

  static async loadViews(): Promise<string[]> {
    if (ext.activeConnection instanceof LocalConnection) {
      const rawViewArray = await ext.activeConnection?.executeQuery("views`");
      const views = rawViewArray?.filter((item: any) => {
        return item !== "s#" && item !== "" && item !== ",";
      });
      const sorted = views?.sort((object1: any, object2: any) => {
        if (object1 < object2) {
          return -1;
        } else if (object1 > object2) {
          return 1;
        }
        return 0;
      });
      return sorted ?? new Array<string>();
    }
    return new Array<string>();
  }

  private static getNamespaces(
    input: ServerObject[],
    root = ".",
  ): ServerObject[] {
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

  private static sortObjects(input: ServerObject[]): ServerObject[] {
    const sorted = input.sort((object1, object2) => {
      if (object1.fname < object2.fname) {
        return -1;
      } else if (object1.fname > object2.fname) {
        return 1;
      }
      return 0;
    });
    return sorted;
  }
}
