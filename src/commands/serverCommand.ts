import {
  commands,
  ConfigurationTarget,
  InputBoxOptions,
  ProgressLocation,
  QuickPickItem,
  QuickPickOptions,
  window,
  workspace,
} from "vscode";
import { ext } from "../extensionVariables";
import { Connection } from "../models/connection";
import { ResourceGroupItem } from "../models/resourceGroupItem";
import { Server } from "../models/server";
import { SubscriptionItem } from "../models/subscriptionItem";
import {
  createResourceGroup,
  showResourceGroups,
  showSubscriptions,
} from "../services/azureProvider";
import { KdbNode } from "../services/kdbTreeProvider";
import { getHash, getServerName } from "../utils/core";
import {
  validateServerAlias,
  validateServerName,
  validateServerPort,
  validateServerUsername,
} from "../validators/kdbValidator";
import { ExecutionConsole } from "../utils/executionConsole";

export async function addNewConnection(): Promise<void> {
  const picks: QuickPickItem[] = [
    {
      label: "Enter a KDB endpoint",
      detail:
        "Enter the url, ip address, and port to connect to a KDB instance",
    },
    {
      label: "Create or Connect to KX Insights on Azure",
      detail: "Either provide an existing Azure instance or create a new one",
    },
  ];

  const options: QuickPickOptions = { placeHolder: "Select the KDB type" };

  const resultType: QuickPickItem | undefined = await window.showQuickPick(
    picks,
    options
  );
  if (resultType === undefined) {
  } else if (resultType.label === "Enter a KDB endpoint") {
    addKdbConnection();
  } else {
    await addAzureConnection();
  }
}

export async function addAzureConnection() {
  if (!(await ext.azureAccount.waitForLogin())) {
    await commands.executeCommand("azure-account.askForLogin");
  }

  let subscriptions: SubscriptionItem[] = [];

  window
    .withProgress(
      {
        location: ProgressLocation.Notification,
        title: "Retrieving Azure subscriptions, please wait...",
        cancellable: true,
      },
      async (progress, token) => {
        token.onCancellationRequested(() => {
          ext.outputChannel.appendLine(
            "User cancelled the connection to Azure for subscriptions."
          );
        });

        progress.report({ increment: 50 });
        subscriptions = await showSubscriptions();
        progress.report({ increment: 100 });

        return new Promise<void>((resolve) => {
          resolve();
        });
      }
    )
    .then(async () => {
      const result = await window.showQuickPick(subscriptions);
      if (result != undefined) {
        const resourceGroups: ResourceGroupItem[] = [];
        window
          .withProgress(
            {
              location: ProgressLocation.Notification,
              title:
                "Retrieving resource groups for the subscription, please wait...",
              cancellable: true,
            },
            async (progress, token) => {
              token.onCancellationRequested(() => {
                ext.outputChannel.appendLine(
                  "User cancelled the connection to Azure for resource groups."
                );
              });

              progress.report({ increment: 50 });
              const resourceGroupsResult = await showResourceGroups(result);
              resourceGroups.push({ label: "$(plus) Create Resource Group" });
              resourceGroups.push(...resourceGroupsResult);
              progress.report({ increment: 100 });

              return new Promise<void>((resolve) => {
                resolve();
              });
            }
          )
          .then(async () => {
            const resourceGroup = await window.showQuickPick(resourceGroups);
            if (resourceGroup != undefined) {
              if (resourceGroup.label === "$(plus) Create Resource Group") {
                await createResourceGroup(result);
                return;
              }
              window.showInformationMessage(resourceGroup.label);
            }
          });
      }
    });
}

export function addKdbConnection(): void {
  const connectionAlias: InputBoxOptions = {
    prompt: "Enter a name/alias for the connection",
    placeHolder: "server name / alias",
    validateInput: (value: string | undefined) => validateServerAlias(value),
  };
  const connectionHostname: InputBoxOptions = {
    prompt: "Enter the hostname or ip address of the KDB server",
    placeHolder: "0.0.0.0",
    validateInput: (value: string | undefined) => validateServerName(value),
  };
  const connectionPort: InputBoxOptions = {
    prompt: "Enter the port number of the KDB server",
    placeHolder: "5001",
    validateInput: (value: string | undefined) => validateServerPort(value),
  };
  const connectionUsername: InputBoxOptions = {
    prompt: "Enter username to authenticate with (optional)",
    placeHolder: "username",
    validateInput: (value: string | undefined) => validateServerUsername(value),
  };
  const connectionPassword: InputBoxOptions = {
    prompt: "Enter password to authenticate with (optional)",
    placeHolder: "password",
    password: true,
  };

  window.showInputBox(connectionAlias).then(async (alias) => {
    window.showInputBox(connectionHostname).then(async (hostname) => {
      if (hostname) {
        window.showInputBox(connectionPort).then(async (port) => {
          if (port) {
            window.showInputBox(connectionUsername).then(async (username) => {
              window.showInputBox(connectionPassword).then(async (password) => {
                // store secrets
                let authUsed = false;
                if (
                  (username != undefined || username != "") &&
                  (password != undefined || password != "")
                ) {
                  authUsed = true;
                  ext.secretSettings.storeAuthData(
                    `${hostname}:${port}`,
                    `${username}:${password}`
                  );
                }

                let servers: Server | undefined = workspace
                  .getConfiguration()
                  .get("kdb.servers");

                if (
                  servers != undefined &&
                  servers[getHash(`${hostname}:${port}`)]
                ) {
                  await window.showErrorMessage(
                    `Server ${hostname}:${port} already exists.`
                  );
                } else {
                  const key =
                    alias != undefined
                      ? getHash(`${hostname}${port}${alias}`)
                      : getHash(`${hostname}${port}`);
                  if (servers === undefined) {
                    servers = {
                      key: {
                        auth: authUsed,
                        serverName: hostname,
                        serverPort: port,
                        serverAlias: alias,
                      },
                    };
                  } else {
                    servers[key] = {
                      auth: authUsed,
                      serverName: hostname,
                      serverPort: port,
                      serverAlias: alias,
                    };
                  }

                  await workspace
                    .getConfiguration()
                    .update("kdb.servers", servers, ConfigurationTarget.Global);
                  const newServers: Server | undefined = workspace
                    .getConfiguration()
                    .get("kdb.servers");
                  if (newServers != undefined) {
                    ext.serverProvider.refresh(newServers);
                  }
                }
              });
            });
          }
        });
      }
    });
  });
}

export async function removeConnection(viewItem: KdbNode): Promise<void> {
  const servers: Server | undefined = workspace
    .getConfiguration()
    .get("kdb.servers");

  const key =
    viewItem.details.serverAlias != ""
      ? getHash(
          `${viewItem.details.serverName}${viewItem.details.serverPort}${viewItem.details.serverAlias}`
        )
      : getHash(`${viewItem.details.serverName}${viewItem.details.serverPort}`);
  if (servers != undefined && servers[key]) {
    const uServers = Object.keys(servers).filter((server) => {
      return server !== key;
    });

    const updatedServers: Server = {};
    uServers.forEach((server) => {
      updatedServers[server] = servers[server];
    });

    await workspace
      .getConfiguration()
      .update("kdb.servers", updatedServers, ConfigurationTarget.Global);
    ext.serverProvider.refresh(updatedServers);
  }
}

export async function connect(viewItem: KdbNode): Promise<void> {
  // handle cleaning up existing connection
  if (
    ext.connectionNode !== undefined &&
    ext.connectionNode.label === viewItem.label
  ) {
    ext.connectionNode = undefined;
    if (ext.connection !== undefined) {
      ext.connection.disconnect();
      ext.connection = undefined;
    }
  }

  // check for auth
  const authCredentials = await ext.secretSettings.getAuthData(viewItem.label);
  const servers: Server | undefined = workspace
    .getConfiguration()
    .get("kdb.servers");
  if (servers === undefined) {
    window.showErrorMessage("Server not found.");
    return;
  }

  const key =
    viewItem.details.serverAlias != ""
      ? getHash(
          `${viewItem.details.serverName}${viewItem.details.serverPort}${viewItem.details.serverAlias}`
        )
      : getHash(`${viewItem.details.serverName}${viewItem.details.serverPort}`);
  const connection = `${servers[key].serverName}:${servers[key].serverPort}`;

  if (authCredentials != undefined) {
    const creds = authCredentials.split(":");
    ext.connection = new Connection(connection, creds);
  } else {
    ext.connection = new Connection(connection);
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  ext.connection.connect((err, conn) => {
    if (err) {
      window.showErrorMessage(err.message);
      return;
    }

    if (conn) {
      ext.outputChannel.appendLine(
        `Connection established successfully to: ${viewItem.details.serverName}`
      );

      commands.executeCommand("setContext", "kdb.connected", [
        `${getServerName(viewItem.details)}` + " (connected)",
      ]);
      ext.connectionNode = viewItem;
      ext.serverProvider.reload();
    }
  });
}

export async function executeQuery(
  query: string,
  serverName: string
): Promise<void> {
  const queryConsole = ExecutionConsole.start();
  if (ext.connection !== undefined && query.length > 0) {
    if (query.slice(-1) === ";") {
      query = query.slice(0, -1);
    } else if (query[0] === "`") {
      query = query + " ";
    }
    const queryRes = await ext.connection.execute(query);
    writeQueryResult(queryRes, query, serverName);
  } else {
    queryConsole.appendQueryError(
      "There is no kbd connection or the query is empty",
      serverName
    );
    return undefined;
  }
}

function writeQueryResult(
  result: string | Error,
  query: string,
  serverName: string
): void {
  const queryConsole = ExecutionConsole.start();
  if (ext.connection && !(result instanceof Error)) {
    queryConsole.append(result, serverName, query);
  } else {
    queryConsole.appendQueryError(
      `The query: /n${query} /nReturned without any results`,
      serverName
    );
  }
}
