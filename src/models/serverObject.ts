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
    return item !== "s#" && item !== "";
  });
  return views ?? new Array<string>();
}
