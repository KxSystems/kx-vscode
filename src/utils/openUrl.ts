import { env, Uri } from "vscode";

export async function openUrl(url: string): Promise<void> {
  const uri: Uri | undefined = Uri.parse(url);
  if (uri === undefined) {
    throw Error("Invalid url");
  } else {
    env.openExternal(uri);
  }
}
