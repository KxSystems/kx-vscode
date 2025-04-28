# kdb Visual Studio Code extension

[![KX VS Code CI Testing](https://github.com/KxSystems/kx-vscode/actions/workflows/main.yml/badge.svg)](https://github.com/KxSystems/kx-vscode/actions/workflows/main.yml) [![KX VS Code Release](https://github.com/KxSystems/kx-vscode/actions/workflows/release.yml/badge.svg)](https://github.com/KxSystems/kx-vscode/actions/workflows/release.yml)

The **kdb Visual Studio Code extension** provides developers with an extensive set of features that enables them to create and edit q files, connect to multiple kdb processes, and execute queries.

This extension can be used with [kdb Insights Enterprise](https://code.kx.com/insights/enterprise/index.html) when using a shared kdb process.

> Please email vscode-questions@kx.com to raise any questions or provide feedback.

## Contents

This guide provides information on the following:

- [Benefits of using kdb VS Code Extension](#benefits-of-kdb-vs-code-extension)
- [Getting Started](#getting-started)
- [Creating and managing connections](#connections)
- [kdb language server](#kdb-language-server)
- [Executing code](#execute-code)
- [Data sources](#data-sources)
- [Workbooks](#workbooks)
- [Query History](#query-history)
- [Viewing results](#view-results)
- [AxLibraries](#axlibraries)
- [q REPL](#q-repl)
- [Settings](#settings)
- [Shortcuts](#shortcuts)

## Benefits of kdb VS Code Extension

With the **kdb VS Code extension** you can:

- Install q.
- Write q syntax with support for syntax highlighting, predict and autocomplete.
- Write and execute q from a single line of code, code block or q file.
- Write and execute q and Python code against kdb Insights Enterprise.
- Connect to one or more q process or **kdb Insights Enterprise** deployment.
- Use a KX data source to choose a connection, specify the parameters and run API requests, SQL or qSQL.
- Use a KX workbook to choose a connection and run q or Python code against any connection.
- View results from your queries.

## Getting Started

To get started you must do the following:

1. [Install kdb VS Code Extension](#installing-kdb-vs-code-extension)
2. [Install q and integrate with VS Code extension](#installing-q)

### Installing kdb VS Code Extension

This section assumes you have already installed [VS Code](https://code.visualstudio.com/download).

Install the kdb VS Code extension by clicking **Install** [on this page.](https://marketplace.visualstudio.com/items?itemName=KX.kdb)

- If q is already installed the message **q runtime installed** is displayed and you can go directly to adding [connections](#connections).
- If q is not installed the message **Local q installation not found** is displayed. If this is the case go to the [instructions for installing q.](#installing-q)

Once the **kdb VS Code extension** is installed **KX** appears in the Activity Bar on the left-hand side and when it is selected the following views are displayed in the primary sidebar:

- [Connections](#connections)
- [Datasources](#data-sources)
- [Workbooks](#workbooks)
- [Query History](#query-history)

**Note** Customized authentication has been implemented for the kdb VS Code extension, allowing you to add custom logic when authenticating with kdb. Refer to [customized authentication](https://github.com/KxSystems/kx-vscode-auth) for details on how to set this up.

### Installing q

After you install **kdb VS Code extension**, if q is not already installed the extension provides a seamless integration with q, by displaying a notification with an option to download, register and install [kdb Insights Personal Edition](https://kx.com/kdb-insights-personal-edition-license-download/). For details on the other versions available see [here](#versions-available).

1. Click **Install new instance**. If the prompt is not visible ensure the kdb extension is selected in the Activity bar on the left, if that does not display the prompt, close and re-open VS Code.

   ![installnewinstance](https://github.com/KxSystems/kx-vscode/blob/main/img/installnewinstance.jpg?raw=true)

1. A dropdown is displayed with the two options:

   - **Select/Enter a license** - If you have already registered for any of the [versions of q available](#versions-available) choose this to enter the license details.
   - **Acquire license** - If you haven't yet registered for q, click this to open a dialog with a redirect link to register for [kdb Insights Personal Edition](https://kx.com/kdb-insights-personal-edition-license-download/).

   ![findlicense](https://github.com/KxSystems/kx-vscode/blob/main/img/findlicense.jpg?raw=true)

Once registered you will receive an email with you license details. The base64 encoded license string can be found in the welcome email received after registration, under the download link for the license file.

With your license details to hand, you can link this to VS Code by either choosing **Paste license string** or **Select license file** from your PC. The latter method is recommended for new users.

![findlicense](https://github.com/KxSystems/kx-vscode/blob/main/img/pastelicense.jpg?raw=true)

The `k4.lic` or `kc.lic` license file can be downloaded to your PC using the link also found in the welcome email.

To finish, a prompt is offered with an opt-in to receive a newsletter.

### Using q outside of VS Code

If you want to use q outside of VS Code, set a [`QHOME` environment variable](https://code.kx.com/q/learn/install/#step-5-edit-your-profile) to the location used by the kdb VS Code install. A notification dialog displays the location of q, as do the extension [settings](#settings).

![qfound](https://github.com/KxSystems/kx-vscode/blob/main/img/installationofqfound.jpg?raw=true)

If q is installed at `C:\q`, then `QHOME` is `C:\q`.

### Versions available

There are commercial and non-commercial editions available. We recommend you start with the kdb+ Personal Edition or kdb Insights Personal Edition. The following table lists the editions with links to downloads and the functionality they support.

| Edition                                                                                         | write q | run q queries | explore results | shared kdb process with kdb Insights |
| ----------------------------------------------------------------------------------------------- | ------- | ------------- | --------------- | ------------------------------------ |
| [kdb+ Personal Edition](https://kx.com/kdb-personal-edition-download/)                          | yes     | yes           | yes             | no                                   |
| [kdb Insights SDK Personal Edition](https://kx.com/kdb-insights-sdk-personal-edition-download/) | yes     | yes           | yes             | no                                   |
| **kdb Insights Enterprise**                                                                     | yes     | yes           | yes             | yes                                  |

> **kdb Insights Enterprise** requires a commercial license. Please contact licadmin@kx.com for further information.

After registering for your chosen version, you will receive an email with a link to download an installation file and a `k4.lic` or `kc.lic` license file. Follow the instructions [here](https://code.kx.com/q/learn/install) for Linux, macOS and Windows to install q and a license file before proceeding.

## Connections

The **kdb VS Code extension** allows you to have multiple connections open at once, enabling development and testing across different q and kdb Insights Enterprise connections using both q and Python.

To add connections:

1. Select the **KX** extension from the Activity Bar to display the **CONNECTIONS** view.

1. When you first install the extension there are no connections so click **Add Connection**. If you have already created connections click **+** for New Connection in the **CONNECTIONS** menu.

   ![connecttoakdbserver](https://github.com/KxSystems/kx-vscode/blob/main/img/connecttoakdbserver.png?raw=true)

   This opens the **Add a new connection** screen which has three tabs; one for each of the three connection types.

   - [Bundled q](#bundled-q): This is a managed q session, which uses the q installed as part of the **kdb VS Code extension** installation. It runs a child q process from within the extension and is fully managed by the extension.
   - [My q](#my-q): This is an unmanaged q session and is a connection to a remote q process.
   - [Insights](#insights-connection): This accesses **kdb Insights Enterprise** API endpoints and a user-specific scratchpad process within a **kdb Insights Enterprise** deployment.

1. Set the properties appropriate to the connection type as described in the following sections.

### Bundled q

When you select **Bundled q** as the connection type and set the following properties:

| Property               | Description                                                                                                                                                                                        |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Server Name            | The name is already set as **local**.                                                                                                                                                              |
| The connection address | This is already be set as `127.0.0.1` which corresponds to your **localhost**.                                                                                                                     |
| Port                   | Set the port for the kdb server. Ensure the port used doesn't conflict with any other running q process; e.g. 5002. [Read here for more about setting a q port](https://code.kx.com/q/basics/ipc/) |
| Label Name             | Select the label you want to assign the connection to                                                                                                                                              |

![setendpoint](https://github.com/KxSystems/kx-vscode/blob/main/img/bundleq.png?raw=true)

1. Click **Create Connection** and the connection appears under **CONNECTIONS** in the primary sidebar..

1. Right-click the q bundled process listed under **CONNECTIONS**, and click **Start q process**.

   ![setendpoint](https://github.com/KxSystems/kx-vscode/blob/main/img/managedqprocess.jpg?raw=true)

1. From the same right-click menu, click **Connect server**. This connects to the child q process running inside the kdb VS Code extension.

If you close the extension, the connection to the child q process also closes.

### My q

When you select **My q** as the connection type, identify the remote location of a running process. The hostname and port are required along with any authentication information.

Set the following properties:

| Property               | Description                                                                                                                                                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Server Name            | The server name / alias. The server name selected cannot be **local** or **insights**, as these are reserved for use by [Bundled q connections](#bundled-q) and [Insights connections](#insights-connection), respectively; e.g. dev |
| The connection address | Set to the IP address of the kdb server; e.g. **localhost**.                                                                                                                                                                         |
| Port                   | Enter the port used by the kdb server; e.g. 5001. Learn more about [setting a q port](https://code.kx.com/q/basics/ipc/) .                                                                                                           |
| Username               | If authentication is needed, fill in the username otherwise, leave **blank**                                                                                                                                                         |
| Password               | If authentication is needed, fill in the password otherwise, leave **blank**                                                                                                                                                         |
| Enable TLS Encryption  | Check the box is TLS is enabled. Learn more [about TLS encryption](https://code.kx.com/q/kb/ssl/).                                                                                                                                   |
| Label Name             | Select the label you want to assign the connection to                                                                                                                                                                                |

![setendpoint](https://github.com/KxSystems/kx-vscode/blob/main/img/myq.png?raw=true)

1. Click **Create Connection** and the connection appears under **CONNECTIONS** in the primary sidebar.

1. Right-click the my q process listed under **CONNECTIONS**, and click **Connect server**. This connects to the child q process running inside the kdb VS Code extension.

If you close the extension, the connection also closes.

### Insights Connection

When you select **Insights connection** as the connection type, the **kdb VS Code extension** uses a shared kdb process. You must have [kdb Insights Enterprise Personal Edition](https://trykdb.kx.com/kx/signup) running before using connections of this type.

Set the following properties:

| Property               | Description                                                                                                                |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Server Name            | The server name / alias. This can be any name, aside from `local`, which is used by [Bundled q connection](#bundled-q)     |
| The connection address | This is the remote address of your **kdb Insights Enterprise** deployment: e.g. `https://mykdbinsights.cloudapp.azure.com` |
| Label Name             | Select the label you want to assign the connection to                                                                      |

![connecttoinsights](https://github.com/KxSystems/kx-vscode/blob/main/img/insightsconnection.png?raw=true)

Set the following from the Advanced properties if necessary:

| Property     | Description                                                                                                                                                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Define Realm | Specify the Keycloak realm for authentication. Usually the realm is set to `insights`, which is the default value used by the extension. You only need to change this field if a different realm has been configured on your server. |

![connecttoinsights](https://github.com/KxSystems/kx-vscode/blob/main/img/insightsconnectionadvanced.png?raw=true)

**Note** For kdb Insights Enterprise Free Trial instances the realm is configured as `insights-{URL}` where {URL} is the 10 digit code in the trial URL. For example: if your trial url is https://fstc83yi5b.ft1.cld.kx.com/ the realm should be `insights-fstc83yi5b`.

1. Click **Create Connection** and the **kdb Insights Enterprise** connection appears under **CONNECTIONS** in the primary sidebar.

1. Right-click the connection, and click **Connect server**.

   ![connecttoinsights](https://github.com/KxSystems/kx-vscode/blob/main/img/kdbinsightsconnection.jpg?raw=true)

1. The kdb VS Code extension runs an authentication step with the remote **kdb Insights Enterprise** process to sign-in.

   ![authenticateinsights](https://github.com/KxSystems/kx-vscode/blob/main/img/insightsauthenticate.jpg?raw=true)

If you close the extension, the connection also closes.

[//]: # "In what context is the reserved alias name `insights` used? - BMA - the context is used on build the connection tree; different icon; different connection process. - DF - Is this connection process currently supported in kdb VS Code extension; if so, do we need to document it here?"

#### Meta

When connected **Insights** connections can be expanded to show the details returned by the [getMeta API](https://code.kx.com/insights/api/database/query/get-meta.html) call, which provides information on the database schemas and all the analytics available.

![Insights Meta Tree](https://github.com/KxSystems/kx-vscode/blob/main/img/insights-meta-tree.png?raw=true)

To see the results of the getMeta call click on the 'meta' node under the connection. A json representation of the details returned by the call are displayed with **"[Connection Name] - meta"** as title of the tab.

![Insights Meta JSON](https://github.com/KxSystems/kx-vscode/blob/main/img/insights-meta-json.png?raw=true)

The 'meta' node contains a child node for each of the child sections in the json. To see a json representation of a specific section click on the child node. The json representation of this section returned by the call is displayed with **"[Connection Name] - [CHILD SECTION]"** as title of the tab.

You can refresh the meta data view at any time by choosing **Refresh meta data** from the right-click menu of an Insights connection.

## Edit Connections

To edit an existing connection, right-click the connection you wish to edit and select the **Edit connection** option.

![Edit connection option](https://github.com/KxSystems/kx-vscode/blob/main/img/select-edit-connection.png?raw=true)

> NOTE: Editing an **active connection** may require you to **restart** the connection. If so, you will be prompted to reconnect after saving your changes.

![Edit connected connection dialog](https://github.com/KxSystems/kx-vscode/blob/main/img/edit-connected-connection-dialog.png?raw=true)

### Edit Bundle q connection

When editing a **Bundled q** connection, you can edit the following properties:

| Property               | Description                                                                                                                                                                                         |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Server Name            | The name is already set as **local** and **cannot be edited**.                                                                                                                                      |
| The connection address | This is already be set as `127.0.0.1` which corresponds to your **localhost** and **cannot be edited**.                                                                                             |
| Port                   | Set the port for the kdb server. Ensure the port used doesn't conflict with any other running q process; e.g. 5002. [Read here for more about setting a q port](https://code.kx.com/q/basics/ipc/). |
| Label Name             | Select the label you want to assign the connection to.                                                                                                                                              |

![Edit Bundle q connection](https://github.com/KxSystems/kx-vscode/blob/main/img/edit-bundle-q-conn-form.png?raw=true)

### Edit My q connection

When editing a **My q** connection, you can edit the following properties:

| Property               | Description                                                                                                                                                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Server Name            | The server name / alias. The server name selected cannot be **local** or **insights**, as these are reserved for use by [Bundled q connections](#bundled-q) and [Insights connections](#insights-connection), respectively; e.g. dev |
| The connection address | Set to the IP address of the kdb server; e.g. **localhost**.                                                                                                                                                                         |
| Port                   | Enter the port used by the kdb server; e.g. 5001. Learn more about [setting a q port](https://code.kx.com/q/basics/ipc/) .                                                                                                           |
| Edit Auth options      | Check the box if you wish to change **Auth options**. If you want to **remove the Auth** for this connection, select this checkbox and leave the **Username** and **Password** fields in **blank**.                                  |
| Username               | If authentication is needed, fill in the username otherwise, leave **blank**.                                                                                                                                                        |
| Password               | If authentication is needed, fill in the password otherwise, leave **blank**.                                                                                                                                                        |
| Enable TLS Encryption  | Check the box is TLS is enabled. Learn more [about TLS encryption](https://code.kx.com/q/kb/ssl/).                                                                                                                                   |
| Label Name             | Select the label to assign the connection to.                                                                                                                                                                                        |

![Edit My q connection](https://github.com/KxSystems/kx-vscode/blob/main/img/edit-my-q-conn-form.png?raw=true)

### Edit Insights connection

When editing a **Insights** connection, you can edit the following properties:

| Property               | Description                                                                                                                                                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Server Name            | The server name / alias. This can be any name, aside from `local`, which is used by [Bundled q connection](#bundled-q)                                                                                                               |
| The connection address | This is the remote address of your **kdb Insights Enterprise** deployment: e.g. `https://mykdbinsights.cloudapp.azure.com`                                                                                                           |
| Define Realm           | Specify the Keycloak realm for authentication. Usually the realm is set to `insights`, which is the default value used by the extension. You only need to change this field if a different realm has been configured on your server. |
| Label Name             | Select the label you want to assign the connection to                                                                                                                                                                                |

![Edit Insights connection](https://github.com/KxSystems/kx-vscode/blob/main/img/edit-insights-conn-form.png?raw=true)

### Import/Export Connection Configuration

The **Import/Export Connection** config allows you to import and export connections in JSON format from the VSCode IDE without having to create them manually.

![Import Export](https://github.com/KxSystems/kx-vscode/blob/main/img/impex.png?raw=true)

To import a connection:

1. Open the Command Palette (Ctrl+Shift+P) and type the command to open the connection configuration for the installed database extension **OR** click the three dots (…) next to the Refresh button in the Connections window.
2. Select **Import Connections**.
3. Navigate to the location of the configuration file, such as a JSON file that contains the connection details, and select it.
4. Review the imported connection for accuracy.
5. Confirm the import.

To connect to the database, select the newly imported connection from the list of available connections and initiate the connection to the database. You can run a simple query or command to verify the connection is successful.

Note: If the imported connection has the same name as an existing connection, you will see a notification in the bottom right corner prompting you to either duplicate, overwrite, or cancel the import.

To export a connection:

1. Open the Command Palette (Ctrl+Shift+P) and type the command to manage connection configurations for the installed database extension **OR** click the three dots (…) next to the Refresh button in the Connections window.
2. Select **Export Connections**.
3. Choose the connection(s) you want to export.
4. Specify the format and location for the exported configuration file. For example, JSON, YAML.
5. Confirm the export action.

To verify the export is successful navigate to the saved location and open the configuration file to check its contents.

## Connection Labels

Connection Labels allow you to categorize and organize your connections by assigning them distinct names and colors, making it easier to manage and locate specific connections within the application.

![Connection Tree With Labels](https://github.com/KxSystems/kx-vscode/blob/main/img/conn-labels-tree.png?raw=true)

### Create New Label

To create a Label, start by **editing** or **creating** a connection. At the **bottom of the form**, you'll see a **Create New Label** button.

![Create New Label Button](https://github.com/KxSystems/kx-vscode/blob/main/img/create-new-label-btn.png?raw=true)

A dialog opens where you can enter a **Label name** and choose a **Label color**. Create the Label by clicking **Create** or cancel the process by clicking **Cancel**.

| Property    | Description                                               |
| ----------- | --------------------------------------------------------- |
| Label Name  | Enter a name for the label.                               |
| Label color | Select the color in the list of colors for the new label. |

![Create New Label](https://github.com/KxSystems/kx-vscode/blob/main/img/create-new-label-dialog.png?raw=true)

### Add Label to a connection

To add a Label to a connection, start by **editing** or **creating** a connection. At the **bottom of the form**, you'll see a **Label Name** dropdown to select a Label, select the Label and click in **Edit or Create Connection**.

| Property   | Description                          |
| ---------- | ------------------------------------ |
| Label Name | Select Label from the list of Labels |

![Select Label](https://github.com/KxSystems/kx-vscode/blob/main/img/conn-labels.png?raw=true)

### Rename Label

Right-click the label at Connection Tree and select **Rename label**.

![Rename Label Opt](https://github.com/KxSystems/kx-vscode/blob/main/img/labels-rename-opt.png?raw=true)

A prompt is displayed at the top of the screen where you can edit the name of the Label.

![Rename Label](https://github.com/KxSystems/kx-vscode/blob/main/img/labels-rename.png?raw=true)

### Edit Label Color

Right-click the label at Connection Tree and select **Edit label color**.

![Edit Label Color Opt](https://github.com/KxSystems/kx-vscode/blob/main/img/labels-edit-color-opt.png?raw=true)

A prompt is displayed at the top of the screen where you can edit the color of the Label.

![Edit Label Color](https://github.com/KxSystems/kx-vscode/blob/main/img/labels-edit-color.png?raw=true)

### Delete Label

Right-click the label at Connection Tree and select **Delete label**.

![Delete Label Opt](https://github.com/KxSystems/kx-vscode/blob/main/img/labels-delete-opt.png?raw=true)

> Connections assigned to the Label are **not deleted**.

## kdb language server

A kdb language server is bundled with the kdb VS Code extension. It offers various common features to aid in the development of kdb code, including:

- [Syntax highlighting and linting](#syntax-highlighting)
- [Code navigation](#code-navigation)
- [Code completion](#code-completion)
- [Rename symbol](#rename-symbol)

### Syntax highlighting

The extension provides keyword syntax highlighting, comments and linting help.

![Syntax Highlighting and Linting](https://github.com/KxSystems/kx-vscode/blob/main/img/syntax-highlighting.png?raw=true)

![Linting](https://github.com/KxSystems/kx-vscode/blob/main/img/linting.png?raw=true)

Linting can be enabled by checking **Enable linting for q and quke files** in [extension settings](#settings).

Semantic highlighting is provided for local variables:

![Semantic](https://github.com/KxSystems/kx-vscode/blob/main/img/semantic.png?raw=true)

### Code navigation

While developing q scripts you can:

- **Go to definition** - Navigate to the definition of a function.
- **Find/go to all** references - View references of a function both on the side view and inline with the editor.

  ![Find all references](https://github.com/KxSystems/kx-vscode/blob/main/img/find-all-references.png?raw=true)

  ![Go to References](https://github.com/KxSystems/kx-vscode/blob/main/img/go-to-references.png?raw=true)

- **Outline View** - Use the Overview at the bottom of the explorer view which shows the symbol tree of the currently active q file.

  ![Outline View](https://github.com/KxSystems/kx-vscode/blob/main/img/outline.png?raw=true)

### Code Completion

- **Keyword auto complete for the q language**

  ![Autocomplete](https://github.com/KxSystems/kx-vscode/blob/main/img/autocomplete.png?raw=true)

- **Autocomplete for local and remotely connected q processes**

### Rename Symbol

- **Rename Symbol** - Supports renaming symbols in the text editor. Right-click and select **Rename Symbol** on any identifier to rename it.

![Rename](https://github.com/KxSystems/kx-vscode/blob/main/img/rename.png?raw=true)

## Execute code

Leaning on VS Code's extensive integrations with SCMs, all code is typically stored and loaded into a VS Code workspace. From there, the **kdb VS Code extension** allows you execute code against both kdb processes, and **kdb Insights Enterprise** endpoints.

### kdb process executing q and Python code

For any file with a **.q** or **.py** extension there are additional options available from the right-click menu for executing code:

- **Execute entire file** - Takes the current file and executes it against the active connection. Results are displayed in the [Output window](#view-results). Returned data is displayed in the [KDB Results window](#view-results).

- **Execute current selection** - Takes the current selection (or current line if nothing is selected) and executes it against the active connection. Results are displayed in the [Output window and/or the KDB Results window](#view-results).

- **Execute current block** - Selects the q expression under the cursor and executes it against the active connection. Results are displayed in the [Output window and/or the KDB Results window](#view-results).

- **Run q file in new q instance** - If q is installed and executable from the terminal you can execute an entire q script on a newly launched q instance. Executing a file on a new instance is done in the terminal, and allows interrogation of the active q process from the terminal window.

When executing Python code against kdb+ connections, **note** the following:

- A Python variable is defined in the remote process `_kx_execution_context`, which means you need to explicitly accept it to avoid implicit changes to the remote process. It doesn’t make any other change to the remote process.
- To write and execute Python code against kdb+ connections, make sure that `pykx` is loaded into the q process. If `.pykx` is undefined, it returns the following error: `.pykx is not defined: please load pykx`. PyKX is a Python-first interface to kdb+ and q. It helps users query and analyze huge amounts of in-memory and on-disk time-series data, significantly faster than other libraries. For more information on getting started with pykx, refer to the [pykx quickstart](https://code.kx.com/pykx/3.0/getting-started/quickstart.html).

### Insights query execution

**kdb Insights Enterprise** offers enhanced connectivity and enterprise level API endpoints, providing additional means to query data and interact with **kdb Insights Enterprise** that are not available with standard kdb processes. You must have an instance of **kdb Insights Enterprise** running, and have created a [connection](#connections) within the **kdb VS Code extension**.

Similarly, you can execute arbitrary code against **kdb Insights Enterprise**. The code is executed on a user-specific scratchpad process within the **kdb Insights Enterprise deploy**. The scratchpad is instantiated upon the first request to execute code when connected to a **kdb Insights Enterprise** connection. It remains active until timed out or until you log out.

## Data sources

KX data source files allow you to build queries within VS Code, associate them with a connection and run them against the [kdb Insights Enterprise API endpoints](https://code.kx.com/insights/api/index.html). These are workspace specific files that have the following features:

- Listed in the **DATASOURCES** view in the primary sidebar
- Can be associated with a connection
- Have the **kdb.json** extension
- Are stored in a **.kx** folder at the root of your open folder

The data source screen helps you to build a query, based on the available API on your instance of **kdb Insights Enterprise**, parameterize it and return the data results to the output or kdb results window.

To create a data source and run it against a specific connection:

1. Ensure you have at least one folder open in VS Code.
1. In the **DATASOURCES** view, click **+** and specify the parameters defined in the following table:

   | Property                | Description                                                                                                         |
   | ----------------------- | ------------------------------------------------------------------------------------------------------------------- |
   | **Connection**          | Select a Connection from the **Connection** dropdown.                                                               |
   | **Select API**          | Choose **getData** from the **Select API** dropdown.                                                                |
   | **Table**               | Choose the table you wish to query from the **Tables** dropdown.                                                    |
   | **Start Time/End Time** | Select the **Start Time** and **End Time** for the query.                                                           |
   | **Row Limit**           | Add a limit to the number of queries executed to reduce the number of Out of Memory (OOM) issues or failed queries. |
   | Additional Parameters   | You can choose from the additional parameters as required.                                                          |

1. Click **Save** to store the settings you have chosen, for reuse later. When you save a data source; query parameters and the connection details are stored. The data source icon is green if it is associated with a connection and grey if there is no association.

   ![data Source](https://github.com/KxSystems/kx-vscode/blob/main/img/data-source.png?raw=true)

1. Click **Run**.

1. The results are populated in the **KDB Results** window, if it is active.

   ![KDB Results](https://github.com/KxSystems/kx-vscode/blob/main/img/datasource-kdbresults.png?raw=true)

   - Otherwise the **Output** window is populated.

     ![Output](https://github.com/KxSystems/kx-vscode/blob/main/img/datasource-output.png?raw=true)

In addition to [API queries](https://code.kx.com/insights/api/database/query/get-data.html), if the query environment is enabled on the deployed instance of **kdb Insights Enterprise**, qSQL and SQL queries can be used within a data source with the appropriate parameterization. If qSQL or SQL is required and issues occur trying to run these queries contact a kdb Insights Enterprise administrator for assistance.

### API queries

The getData API provides a method of querying a table using a defined set of parameters. These parameters can be configured through the getData form available in the VSCode extension.

Refer to the [`getData` API](https://code.kx.com/insights/api/database/query/get-data.html) documentation for more information and a full list of available parameters.

### QSQL queries

The `.com_kx_edi.qsql` API is a QSQL query builder that assembles QSQL queries based on a q expression. It is a developer tool that allows running freeform q code against a specific database tier. 

This function runs an QSQL query.

```
.com_kx_edi.qsql[args]
```

**Note**: Along with the query itself, you must also specify the target database and tier.

Refer to the [QSQL documentation](https://code.kx.com/insights/api/database/query/qsql.html) for more details.

**Warning!** Starting with kdb Insights Enterprise version 1.13, QSQL queries and populating QSQL only work if the Query Environment (QE) is enabled. Ensure you have enabled QEs to use QSQL; they are disabled by default in kdb VS Code. Refer to [Query Environments](https://code.kx.com/insights/enterprise/configuration/base.html#query-environments) for more details.

### SQL queries

The `.com_kx_edi.sql` SQL API allows running freeform SQL queries. Each query is distributed across all available databases. The results are then aggregated and returned as a single dataset.

This function runs an SQL query.

```
.com_kx_edi.sql[query]
```

Refer to the [SQL documentation](https://code.kx.com/insights/api/database/query/sql.html) for more details.

### UDA queries

User-Defined Analytics (UDAs), also known as custom APIs, are essential for developers to leverage the capabilities of kdb when using Insights Enterprise. These UDAs are deployed to Insights through the Data Access Processes (DAPs) and Aggregators (Aggs).

UDAs can be called directly within the VSCode extension through the UDA tab in a data source. This provides a form-based approach to populating the UDA parameters. UDAs can also be called within the Insights Enterprise web interface using Pipelines, Queries, and Views.

![Query UDAs in VSCode extension](https://github.com/KxSystems/kx-vscode/blob/main/img/udas-query.png?raw=true)

When interacting with UDAs, parameter fields are shown for configuration. Note the following:

- Required fields are marked with an asterisk (*).

- Optional fields are not required but may be displayed in your results, even if they are empty.

You can add new parameters by clicking **Add Parameter**. Both optional and distinguished parameters can be added as needed.

![Add parameters to call UDAs](https://github.com/KxSystems/kx-vscode/blob/main/img/udas-add-parameters.png?raw=true)

**Important!** A UDA cannot be queried if one or more parameters are invalid.

If you attempt to run a UDA with invalid parameters, an error occurs and a pop-up message appears to alert you to the issue.

![Error showing invalid parameters for UDA](https://github.com/KxSystems/kx-vscode/blob/main/img/udas-invalid-parameter.png?raw=true)

![Pop-up message UDAs include invalid parameter](https://github.com/KxSystems/kx-vscode/blob/main/img/udas-error-pop-up.png?raw=true)

In some cases, you can successfully query UDAs without any parameters, as seen in the screenshot below.

![UDAs with no parameters](https://github.com/KxSystems/kx-vscode/blob/main/img/udas-no-parameters.png?raw=true)

However, you can still modify the parameter list to add parameters by clicking **Add parameter** or deleting parameters using the recycle bin icon.

![Delete UDA parameters](https://github.com/KxSystems/kx-vscode/blob/main/img/udas-delete-parameters.png?raw=true)

For more information on User-Defined Analytics, refer to the [UDAs documentation](https://code.kx.com/insights/api/database/uda/uda-overview-introduction.html).

### Run and populate scratchpad

Running and populating scratchpad are two actions used to execute q code, allowing you to run queries and perform operations on your kdb Insights Enterprise database but they differ in how and where the output is stored and accessed.

The [QSQL API](#qsql-queries) is designed to run queries against a specific Insights database and tier. However, sometimes you might need to run more flexible or freeform queries against a wider set of data. For this purpose each Insights Enterprise user is assigned a 'scratchpad' q process. This scratchpad is separate from the dedicated query processes, allowing you to run freeform code without impacting the overall system.

You can populate variables in your scratchpad with the results from your queries, and then perform freeform manipulations on those variables.

After you configure a data source in the VSCode extension you have two options for executing it:

- **Run** executes your query directly against the relevant API (getData, QSQL, SQL, or UDA) and displays the results in the extension
- **Populate Scratchpad** executes your query through the scratchpad, which passes it to the relevant API, assigns the results to a variable of your choosing in your scratchpad process and then displays them in the VSCode extension

For more details on populating scratchpad, refer to the [populate scratchpad](#populate-scratchpad) section below.

#### Populate scratchpad

You can use a data source to populate a scratchpad process running in a **kdb Insights Enterprise** instance with a dataset. This allows you to then execute q or python code against the data stored in that variable in the scratchpad. This facilitates the generation of complex APIs and pipelines within VS Code and kdb Insights Enterprise.

To do this:

1. Create a data source and execute it by clicking **Populate Scratchpad**.

   ![Populate Scratchpad](https://github.com/KxSystems/kx-vscode/blob/main/img/populate-scratchpad-button.png?raw=true)

1. At the prompt, provide a variable to populate your own scratchpad instance running in the connected **kdb Insights Enterprise** with the data.

   ![Populate Scratchpad Variable](https://github.com/KxSystems/kx-vscode/blob/main/img/populate-scratchpad.png?raw=true)

1. The scratchpad process is populated.

1. Use a [Workbook](#workbooks) to execute q or Python code against the data in your scratchpad using the variable you provided.

### Reset scratchpad

The **Reset Scratchpad** option in kdb VS Code allows you to delete all the data from a connected instance and restart your development from scratch.

There are several ways to reset the scratchpad:

1. Right click on the appropriate connection on the left-hand side and select **Reset Scratchpad**. The connection can be either active or idle but it must be connected.

   ![Reset Scratchpad with right click on connected instance](https://github.com/KxSystems/kx-vscode/blob/main/img/reset-scratchpad-right-click.png?raw=true)

   This displays a dialog box at the bottom right corner asking you to confirm your action.

   ![Dialog to confirm reset scratchpad](https://github.com/KxSystems/kx-vscode/blob/main/img/reset-scratchpad-dialog.png?raw=true)

2. Using the **Command Palette** in VSCode, start typing **Reset Scratchpad** and click on the option as it shows. This action resets the scratchpad for the active connection.

   ![Reset scratchpad using the Command Palette](https://github.com/KxSystems/kx-vscode/blob/main/img/reset-scratchpad-command-palette.png?raw=true)

3. Use the [MacOS or Windows shortcuts](#shortcuts) in the q file or in the workbook. Note that running the shortcuts in the q file resets the scratchpad for the active connection, while running them in the workbook resets the scratchpad for the connection chosen in the workbook.

## Workbooks

Workbooks provide a convenient way to prototype and execute q and python code against a q process and using the variables [populated into the scratchpad](#populate-scratchpad) of a **kdb Insights Enterprise** deployment by data sources.

Standard **.q** and **.py** files only run on the active connection. Workbook files have the following features:

- Are listed in the **WORKBOOKS** view in the primary sidebar
- Can be associated with a connection
- Have the **.kdb.q.** or **kdb.py** extension
- Are stored in a **.kx** folder at the root of your open folder

This allows you to have multiple Workbooks running against different connections at the same time.

To create a Workbook and run code against a specific connection:

1. Ensure you have at least one folder open in VS Code.
1. In the **WORKBOOKS** view in the primary sidebar, click the **+** for either a **New q workbook** or **New Python workbook**.

   ![new workbook](https://github.com/KxSystems/kx-vscode/blob/main/img/addnewworkbook.png?raw=true)

1. Write the code you wish to execute.

1. Run the code:

   1. To run all the code in the file you can use one of the following methods:

      1. Click **Run** from above the first line of code in the workbook file.
         ![workbook links](https://github.com/KxSystems/kx-vscode/blob/main/img/workbookrunlink.png?raw=true)

      1. Select **Run** from the upper right of the editor. Using the dropdown next to the button you can choose any of the [**KX:** menu items](#kdb-process-executing-q-and-python-code) to run some, or all of the code in the workbook.
         ![play dropdown](https://github.com/KxSystems/kx-vscode/blob/main/img/wortkbookplaydropdown.png?raw=true)

      1. Click **Run** on the right-hand side of the status bar.
         ![status bar run ](https://github.com/KxSystems/kx-vscode/blob/main/img/workbookstatusbarrun.png?raw=true)

      1. Right-click and choose **KX: Execute Entire File** from the menu.

1. If you have not yet chosen a connection to associate with the workbook you are asked to choose a connection before the code is executed.

   ![choose connection](https://github.com/KxSystems/kx-vscode/blob/main/img/workbookconnectionlink.png?raw=true)

1. The results populate the kdb results window if it is active, otherwise the output window is populated.

When you save a workbook file the code and the connection details are stored. The workbook icon is green if it is associated with a connection and grey if there is no association.

You can also change the connection associated with a workbook at any time by clicking on **Choose Connection** from above the first line of code in the workbook file.

![choose connection](https://github.com/KxSystems/kx-vscode/blob/main/img/workbookplaydropdown.png?raw=true)

## Query History

The **Query History** view in the primary sidebar captures each query execution and enables you to re-run any of the queries listed. Initially the query history view is empty but once you run a query it is captured and displayed in the window - with a separate row displayed for every execution. All information is stored in memory and not persisted upon application exit.

![Query History](https://github.com/KxSystems/kx-vscode/blob/main/img/query-history.png?raw=true)

Rows consists of the following:

| Field                         | Description                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------ |
| **Status icon**               | Shows if the code or query executed successfully or an error occurred.         |
| **Connection Name**           | The Server name associated with the connection on which the query was executed |
| **Connection Type**           | The connection type showing either **local**, **myq** or **insights**.         |
| **Time**                      | the time the query was executed.                                               |
| **Data Source/File/Workbook** | The name of the file being executed.                                           |
| **Query**                     | When Code is being execute the code is shown.                                  |
| **Data Source Type**          | When a datasource is being run 'API' is displayed.                             |

![Query History Details](https://github.com/KxSystems/kx-vscode/blob/main/img/query-history-details.png?raw=true)

Right-clicking on a history row brings up a menu with the option to **Rerun query**.

![Query History Clear](https://github.com/KxSystems/kx-vscode/blob/main/img/query-history-clear.png?raw=true)

## View results

All query executions happen remotely from the **kdb VS Code extension** either against a running q process or against your user-specific scratchpad process in **kdb Insights Enterprise**. The results, successful or otherwise, are returned to VS Code in one of the following windows:

- **Output** - The **Output** window displays results as they are received by the **kdb VS Code extension**. It includes the query executed, a timestamp and the results.

  ![Output view](https://github.com/KxSystems/kx-vscode/blob/main/img/output-results.png?raw=true)

  **Note:** You can enable/disable auto-scrolling in the VS Code settings. This setting determines whether the output view scrolls to the latest results.

  ![Output autoscrolling](https://github.com/KxSystems/kx-vscode/blob/main/img/auto-scrolling.png?raw=true)

  **Note** You can hide or show the full details in the console output. Go to settings of the VS Code, search for kdb, check the option **Hide Detailed Console Query Output** (this option is checked by default)

  ![Hide Detailed Console Query Output](https://github.com/KxSystems/kx-vscode/blob/main/img/hide-detailed-console-query.png?raw=true)

- **KDB Results** - This window displays the kdb returned data in a table.

  ![kdb results view](https://github.com/KxSystems/kx-vscode/blob/main/img/kdbview-results.png?raw=true)

## AxLibraries

The following features of [AxLibraries](https://code.kx.com/developer/libraries/) are integrated and can be used within the extension:

- [Grammar of Graphics](#grammar-of-graphics)
- q static linter

**Note:** To use those features, you should install AxLibraries following the [installation instructions.](https://code.kx.com/developer/libraries/#installation)

### Grammar of Graphics

Grammar of Graphics (GG) is a scripted visualization library for kdb+.

GGPlot2 in VSCode allows you to create detailed and informative visualizations, helping you understand the underlying patterns and trends in your data more clearly without having to switch to RStudio. For more information refer to the [GGPlot documentation](https://code.kx.com/developer/ggplot/).

To use GGPlot2 in VSCode:

- Create a `my q` connection to the port to load the library.

- Write a script to query and load data. Make sure to clean and prepare the data for visualization, ensuring it is in a format suitable for analysis.

- Use GGPlot2 to create visualizations, such as a bar plot showing the total transaction amount by month.

- Run the script within VSCode. The chart is generated and displayed in the VSCode plot viewer, and you can save the plot.
  **Note**: When executing GG scripts, calling `.qp.display2` displays the plot locally.

![gg-plot](https://github.com/KxSystems/kx-vscode/blob/main/img/gg-plot.png?raw=true)

You can make changes to the script before exporting the plot. Re-running the script updates to reflect the changes.

**Note**: When executing GG script commands, select the `KDB RESULTS` tab to display the plot.

## q REPL

q REPL can be started from the command prompt by searching **q REPL**.

![REPL](https://github.com/KxSystems/kx-vscode/blob/main/img/repl.png?raw=true)

## Logs

Any error or info will be posted at **OUTPUT** in **kdb** tab

![LOG](https://github.com/KxSystems/kx-vscode/blob/main/img/log-sample.png?raw=true)

The format will be:

`[DATE TIME] [INFO or ERROR] Message`

## Settings

To update kdb VS Code settings, search for **kdb** from _Preferences_ > _Settings_, or right-click the settings icon in kdb VS Code marketplace panel and choose **Extension Settings**.

| Setting                                                        | Action                                                              |
| -------------------------------------------------------------- | ------------------------------------------------------------------- |
| **Hide notification of installation path after first install** | yes/no; default no                                                  |
| **Hide subscription to newsletter after first install**        | yes/no; default no                                                  |
| **Insights Enterprise Connections for Explorer**               | [edit JSON settings](#insights-enterprise-connections-for-explorer) |
| **Linting**                                                    | Enable linting for q and quke files                                 |
| **Refactoring**                                                | Choose refactoring scope                                            |
| **QHOME directory for q runtime**                              | Display location path of q installation                             |
| **Servers**                                                    | [edit JSON settings](#servers)                                      |

### Refactoring

By default, refactorings like renaming are applied to all files in the workspace. You can preview the changes before applying them and select specific files to apply the refactoring by pressing the **ctrl** or **command** key before executing the action.

![Preview](https://github.com/KxSystems/kx-vscode/blob/main/img/preview.png?raw=true)

If you only need to apply the refactorings to the currently opened files, you can select **Window** instead of **Workspace** for the refactoring option:

![Refactoring](https://github.com/KxSystems/kx-vscode/blob/main/img/refactoring.png?raw=true)

### kdb Insights Enterprise Connections for Explorer

```JSON
{
    "security.workspace.trust.untrustedFiles": "open",
    "editor.accessibilitySupport": "off",
    "workbench.colorTheme": "Default Dark+",
    "kdb.qHomeDirectory": "C:\\qhomedirectory",
    "kdb.hideInstallationNotification": true,
    "kdb.servers": {
        "23XdJyFk7hXb35Z3yw2vP87HOHFIfy0PDoo5+/G1o7A=": {
            "auth": true,
            "serverName": "127.0.0.1",
            "serverPort": "5001",
            "serverAlias": "5001",
            "managed": false
        }
    },
    "kdb.hideSubscribeRegistrationNotification": true,
    "kdb.insightsEnterpriseConnections": {

        "b61Z6R1TGF3vsudDAmo5WWDcGEmRQpmQKoWrluXJD9g=": {
            "auth": true,
            "alias": "servername.com",
            "server": "https://servername.com/"
        }
    }
}
```

### Servers

```JSON
{
    "security.workspace.trust.untrustedFiles": "open",
    "editor.accessibilitySupport": "off",
    "workbench.colorTheme": "Default Dark+",
    "kdb.qHomeDirectory": "C:\\qhomedirectory",
    "kdb.hideInstallationNotification": true,
    "kdb.servers": {

        "23XdJyFk7hXb35Z3yw2vP87HOHFIfy0PDoo5+/G1o7A=": {
            "auth": true,
            "serverName": "127.0.0.1",
            "serverPort": "5001",
            "serverAlias": "5001",
            "managed": false
        }
    },
    "kdb.hideSubscribeRegistrationNotification": true,
    "kdb.insightsEnterpriseConnections": {
        "b61Z6R1TGF3vsudDAmo5WWDcGEmRQpmQKoWrluXJD9g=": {
            "auth": true,
            "alias": "servername.com",
            "server": "https://servername.com/"
        }
    }
}
```

### Double Click Selection

The following setting will change double click behaviour to select the whole identifier including dots:

```JSON
 "[q]": {
    "editor.wordSeparators": "`~!@#$%^&*()-=+[{]}\\|;:'\",<>/?"
  }
```

## Shortcuts

### For Windows

| Key                | Action                            |
| ------------------ | --------------------------------- |
| F12                | Go to definition                  |
| Shift + F12        | Go to references                  |
| Ctrl + Shift + F12 | Find all references               |
| Ctrl + D           | Execute current selection         |
| Ctrl + Shift + E   | Execute current block             |
| Ctrl + Shift + D   | Execute entire file               |
| Ctrl + Shift + R   | Run q file in new q instance      |
| Ctrl + Shift + Y   | Toggle paramater cache for lambda |
| Ctrl + Shift + Delete   | Reset scratchpad |

### For MacOS

| Key             | Action                            |
| --------------- | --------------------------------- |
| F12             | Go to definition                  |
| Shift + F12     | Go to references                  |
| ⌘ + Shift + F12 | Find all references               |
| ⌘ + D           | Execute current selection         |
| ⌘ + Shift + E   | Execute current block             |
| ⌘ + Shift + D   | Execute entire file               |
| ⌘ + Shift + R   | Run q file in new q instance      |
| ⌘ + Shift + Y   | Toggle paramater cache for lambda |
| ⌘ + Shift + Delete   | Reset scratchpad |
