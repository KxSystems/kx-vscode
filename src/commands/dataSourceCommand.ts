import * as fs from "fs";
import path from "path";
import { window } from "vscode";
import { ext } from "../extensionVariables";
import { KdbDataSourceTreeItem } from "../services/dataSourceTreeProvider";
import { createKdbDataSourcesFolder } from "../utils/dataSource";

export async function addDataSource(): Promise<void> {
  const kdbDataSourcesFolderPath = createKdbDataSourcesFolder();
  if (!kdbDataSourcesFolderPath) {
    return;
  }

  let length = 0;
  let fileName = `datasource-${length}.ds`;
  let filePath = path.join(kdbDataSourcesFolderPath, fileName);

  while (fs.existsSync(filePath)) {
    length++;
    fileName = `datasource-${length}.ds`;
    filePath = path.join(kdbDataSourcesFolderPath, fileName);
  }

  fs.writeFileSync(filePath, "");
  window.showInformationMessage(
    `Created ${fileName} in ${kdbDataSourcesFolderPath}.`
  );
}

export async function renameDataSource(
  oldName: string,
  newName: string
): Promise<void> {
  const kdbDataSourcesFolderPath = createKdbDataSourcesFolder();
  if (!kdbDataSourcesFolderPath) {
    return;
  }

  const oldFilePath = path.join(kdbDataSourcesFolderPath, `${oldName}`);
  const newFilePath = path.join(
    kdbDataSourcesFolderPath,
    `${newName}${ext.kdbDataSourceFileExtension}`
  );

  fs.renameSync(oldFilePath, newFilePath);
  window.showInformationMessage(`Renamed ${oldFilePath} to ${newFilePath}.`);
}

export async function deleteDataSource(
  dataSource: KdbDataSourceTreeItem
): Promise<void> {
  const kdbDataSourcesFolderPath = createKdbDataSourcesFolder();
  if (!kdbDataSourcesFolderPath) {
    return;
  }

  const dataSourceFilePath = path.join(
    kdbDataSourcesFolderPath,
    `${dataSource.label}`
  );
  if (fs.existsSync(dataSourceFilePath)) {
    fs.unlinkSync(dataSourceFilePath);
    window.showInformationMessage(
      `Deleted ${dataSource.label} from ${kdbDataSourcesFolderPath}.`
    );
  }
}
