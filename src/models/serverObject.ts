import { loadServerObjects } from "../commands/serverCommand";

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

export async function loadNamespaces(): Promise<ServerObject[]> {
  const serverObjects = await loadServerObjects();
  if (serverObjects !== undefined) {
    const ns = serverObjects.filter((value) => {
      return value.isNs ? value : undefined;
    });
    return ns;
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
  if (serverObjects !== undefined) {
    const dicts = serverObjects.filter((value) => {
      return value.typeNum === -7 && !value.isNs && value.namespace === ns
        ? value
        : undefined;
    });
    return dicts;
  }
  return new Array<ServerObject>();
}

export async function loadViews(ns: string): Promise<ServerObject[]> {
  const serverObjects = await loadServerObjects();
  if (serverObjects !== undefined) {
    const dicts = serverObjects.filter((value) => {
      return value.typeNum === -7 && value.namespace === ns ? value : undefined;
    });
    return dicts;
  }
  return new Array<ServerObject>();
}
