import * as path from 'path';
import { Event, EventEmitter, TreeDataProvider, TreeItem, TreeItemCollapsibleState } from 'vscode';
import { ext } from '../extensionVariables';
import { Server, ServerDetails } from '../models/server';

export class KdbTreeProvider implements TreeDataProvider<KdbNode> {
  private _onDidChangeTreeData: EventEmitter<KdbNode | undefined | void> = new EventEmitter<
    KdbNode | undefined | void
  >();
  readonly onDidChangeTreeData: Event<KdbNode | undefined | void> = this._onDidChangeTreeData.event;

  constructor(private serverList: Server) {}

  reload(): void {
    this._onDidChangeTreeData.fire();
  }

  refresh(serverList: Server): void {
    this.serverList = serverList;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: KdbNode): TreeItem {
    return element;
  }

  getChildren(element?: KdbNode): Thenable<KdbNode[]> {
    if (!this.serverList) {
      return Promise.resolve([]);
    }
    return Promise.resolve(this.getChildElements(element));
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private getChildElements(_element?: KdbNode): KdbNode[] {
    return this.createLeafItems(this.serverList);
  }

  private createLeafItems(servers: Server): KdbNode[] {
    const keys: string[] = Object.keys(servers);
    return keys.map(
      x =>
        new KdbNode(
          x.split(':'),
          `${servers[x].serverName}:${servers[x].serverPort}`,
          servers[x],
          TreeItemCollapsibleState.None
        )
    );
  }

  private groupBy<T>(list: Array<T>, callback: (x: T) => string) {
    const map = new Map<string, T[]>();

    list.forEach(item => {
      const key = callback(item);
      const collection = map.get(key);

      if (!collection) {
        map.set(key, [item]);
      } else {
        collection.push(item);
      }
    });

    return map;
  }
}

export class KdbNode extends TreeItem {
  constructor(
    public readonly children: string[],
    public readonly label: string,
    public readonly details: ServerDetails,
    public readonly collapsibleState: TreeItemCollapsibleState
  ) {
    if (details.serverAlias != '') {
      label = label + ` [${details.serverAlias}]`;
    }

    if (ext.connectionNode != undefined && label === ext.connectionNode.label) {
      label = label + ' (connected)';
    }

    super(label, collapsibleState);
    this.description = this.getDescription();
  }

  getDescription(): string {
    return this.collapsibleState === TreeItemCollapsibleState.None && this.children.length > 2
      ? `${this.children[2]}:${'*'.repeat(this.children[3].length)}`
      : '';
  }

  iconPath = {
    light: path.join(
      __filename,
      '..',
      '..',
      'resources',
      'light',
      ext.connectionNode != undefined && this.label === ext.connectionNode.label + ' (connected)'
        ? 'db-connected.svg'
        : 'db-disconnected.svg'
    ),
    dark: path.join(
      __filename,
      '..',
      '..',
      'resources',
      'dark',
      ext.connectionNode != undefined && this.label === ext.connectionNode.label + ' (connected)'
        ? 'db-connected.svg'
        : 'db-disconnected.svg'
    ),
  };

  contextValue = this.label;
}
