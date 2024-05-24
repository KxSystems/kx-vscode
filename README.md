# kdb Visual Studio Code extension

[![KX VS Code CI Testing](https://github.com/KxSystems/kx-vscode/actions/workflows/main.yml/badge.svg)](https://github.com/KxSystems/kx-vscode/actions/workflows/main.yml) [![KX VS Code Release](https://github.com/KxSystems/kx-vscode/actions/workflows/release.yml/badge.svg)](https://github.com/KxSystems/kx-vscode/actions/workflows/release.yml)

The **kdb Visual Studio Code extension** provides developers with an extensive set of features that enable them to create and edit q files, connect to multiple kdb processes, and execute queries. 

This extension can be used with [kdb Insights Enterprise](https://code.kx.com/insights/enterprise/index.html) when using a shared kdb process.

> Please use vscode-questions@kx.com to raise any questions or feedback.

## Contents
This guide provides information on the following:

- [Benefits of using kdb VS Code Extension](#benefits-of-kdb-vs-code-extension)
- [Get Started](#get-started)
- [Connections](#connections)
- [kdb language server](#kdb-language-server)
- [Execute code](#execute-code)
- [View results](#view-results)
- [Settings](#settings)
- [Shortcuts](#shortcuts)

## Benefits of kdb VS Code Extension

With the kdb VS Code extension you can:

- Install q.
- Write q syntax with support for syntax highlighting, predict and autocomplete.
- Write and execute q from a single line of code, code block or q file.
- Write and execute q and Python code against kdb Insights Enterprise.
- Connect to one or more q process or kdb Insights Enterprise deployment.
- Use a KX data source to choose a connection, specify the parameters and run API requests, SQL or qSQL.
- Use a KX workbook to choose a connection and run q or Python code against any connection.
- View results from your queries.


## Getting Started

This is divided into three sections:

- [Installing kdb VS Code Extension](#installing-kdb-vs-code-extension)
- [Installing q](#installing-q)
- [Integrating VS Code with q](#integrate-vs-code-with-q)

### Installing kdb VS Code Extension

This section assumes you have [VS Code installed](https://code.visualstudio.com/download)

- [Install the kdb VS Code extension by clicking the Install button here](https://marketplace.visualstudio.com/items?itemName=KX.kdb)
- The [next step](#installing-kdb/q) depends on whether or not you have kdb/q installed.

Once installed KX appears in the Activity Bar on the left-hand side and once selected shows the following Views in the Primary Sidebar:

- [Connections](#connections)
- [Datasources](#data-sources)
- [Workbooks](#workbooks)
- [Query History](#query-history)

### Installing q

The next action depends on whether or not you already have q installed as it is required to use the extension.

- q is already installed: the message `q runtime installed` is displayed, after you [install the extension](#installing-kdb-vs-code-extension) and you can go directly to adding [connections](#connections).

- q is not installed: a notification gives you option to download and register, install [kdb Insights Personal Edition](https://kx.com/kdb-insights-personal-edition-license-download/) and add your license file.

 After install the extension provides a seamless integration with q, by displaying a notification with an option to download, register and install [kdb Insights Personal Edition](https://kx.com/kdb-insights-personal-edition-license-download/). For details on the other versions available see [here](#versions-available).


#### Integrating q with VS Code

To integrate VS Code with q take the following steps:

1. Ensure the kdb VS Code extension is installed.

1. Click `Install new instance` from the prompt. If the prompt is not visible ensure the kdb extension is selected in the Activity bar on the left, if that does not display the prompt, close and re-open VS Code.

    ![installnewinstance](https://github.com/KxSystems/kx-vscode/blob/main/img/installnewinstance.jpg?raw=true)

1. An dropdown will be displayed with the two options:

    ![findlicense](https://github.com/KxSystems/kx-vscode/blob/main/img/findlicense.jpg?raw=true)

    - If you haven't yet registered for q, choose `Acquire license`, this will open a dialog with a redirect link to register for [kdb Insights Personal Edition](https://kx.com/kdb-insights-personal-edition-license-download/). 
    
    - If you have already registered for any of the [versions of q available](#versions-available) choose `Select/Enter a license`. 

1. Once registered you will receive an email with you license details.

1. With the license secured, you can link this to VS Code by either choosing `pasting license string` or `selecting license file` from your PC; the latter method is recommended for new users.

    ![findlicense](https://github.com/KxSystems/kx-vscode/blob/main/img/pastelicense.jpg?raw=true)

    The base64 encoded license string can be found in the welcome email received after registration, under the download link for the license file.

    ![welcomeemaillicense](https://github.com/KxSystems/kx-vscode/blob/main/img/weclomeemail.jpg?raw=true)

    The `k4.lic` or `kc.lic` license file can be downloaded to your PC using the link also found in the welcome email.

1. To finish, a prompt is offered with an opt-in to receive a newsletter.

> **Using q outside of VS Code**

> If you want to use q outside of VS Code, set a [`QHOME` environment variable](https://code.kx.com/q/learn/install/#step-5-edit-your-profile) to the location used by the kdb VS Code install. A notification dialog displays the location of q, as do the extension [settings](#settings). T

    ![qfound](https://github.com/KxSystems/kx-vscode/blob/main/img/installationofqfound.jpg?raw=true)

    If q is installed at `C:\q`, then `QHOME` is `C:\q`.


#### Versions available

There are commercial and non-commercial editions available. We recommend you start with the kdb+ Personal Edition or kdb Insights Personal Edition. The following table lists the editions with links to downloads and the functionality they support.
      
| Edition                                                                                            | write q | run q queries | explore results | shared kdb process with kdb Insights |
| ----------------------------------------------------------------------------------------------- | ------- | ------------- | --------------- | ------------------------------------ |
| [kdb+ Personal Edition](https://kx.com/kdb-personal-edition-download/)                          | yes     | yes           | yes             | no                                   |
| [kdb Insights Personal Edition](https://kx.com/kdb-insights-personal-edition-license-download/) | yes     | yes           | yes             | no                                   |
| **kdb Insights Enterprise**                                                                          | yes     | yes           | yes             | yes                                  |

> **kdb Insights Enterprise** requires a commercial license. Please contact licadmin@kx.com for further information.

After registering for your chosen version, you will receive an email with a link to download an installation file and a `k4.lic` or `kc.lic` license file. Follow the instructions [here](https://code.kx.com/q/learn/install) for Linux, macOS and Windows to install q and a license file before proceeding.

Once you have installed q and downloaded a license file the next step is to [Integrating q with VS Code](#integrating-q-with-vs-code).


## Connections

The kdb VS Code extension allows you to have multiple connections open at once, enabling development and testing across different q and kdb Insights Enterprise connections using both q and Python.

To add connections:

1. Select the extension from the Activity Bar and the **CONNECTIONS** View will be visible at the top of the Primary Sidebar.

1. When you first install the extension there are no connections so click **Add Connection** OR if there are existing connections click **+** for New Connection in the **Connections** menu.

    ![connecttoakdbserver](https://github.com/KxSystems/kx-vscode/blob/main/img/connecttoakdbserver.png?raw=true)

    This opens the **Add a new connection** screen which has three tabs; one for each of the three connection types.
    - [Bundled q](#bundled-q): This is a managed q session, which uses the q installed as part of the kdb VS Code extension installation. It runs a child q process from within the extension and is fully managed by the extension. 
    - [My q](#my-q): This is an unmanaged q session and is a connection to a remote q process.
    - [Insights](#insights-connection): This accesses **kdb Insights Enterprise** API endpoints and a user-specific scratchpad process within a **kdb Insights Enterprise** deployment.

    ![setendpoint](https://github.com/KxSystems/kx-vscode/blob/main/img/bundleqform.png?raw=true)

1. Set the properties appropriate to the connection type.


### Bundled q

When you select **Bundled q** as the connection type and set the following properties:

|Property              | Description                          |
|----------------------|--------------------------------------|
|Server Name           | The name is already set as **local**.|
|The connection address| This is already be set as `127.0.0.1` which corresponds to your _localhost_ |
|Port                  | Port for the kdb server. Ensure the port used doesn't conflict with any other running q process; e.g. _5002_. [Read here for more about setting a q port](https://code.kx.com/q/basics/ipc/)|

1. Click **Create Connection** and the connection appears under **CONNECTIONS** in the Primary Sidebar.

1. Right-click the q bundled process listed under **CONNECTIONS**, and click _Start q process_.

    ![setendpoint](https://github.com/KxSystems/kx-vscode/blob/main/img/managedqprocess.jpg?raw=true)

1. From the same right-click menu, click _Connect server_. This connects to the child q process running inside the kdb VS Code extension.

If you close the extension, the connection to the child q process also closes.

### My q

When you select **My q** as the connection type, identify the remote location of a running process. The hostname and port will be required along with any authentication information.

Set the following properties:

|Property               | Description                          |
|-----------------------|--------------------------------------|
|Server Name            | The server name / alias. The server name selected **cannot be `local` or `insights`**, as these are reserved for use by [Bundled q connections](#bundled-q) and [Insights connections](#insights-connection), respectively; e.g. dev|
|The connection address | Set to the IP address of the kdb server; e.g. _localhost_. |
|Port                   | Set the _port_ used by the kdb server; e.g. _5001_.  Learn more about [setting a q port](https://code.kx.com/q/basics/ipc/).       |
Username                | If authentication is needed, fill in the username otherwise, leave **blank** |
Password                | If authentication is needed, fill in the password otherwise, leave **blank** |
Enable TLS Encryption   | Check the box is TLS is enabled. Learn more [about TLS encryption](https://code.kx.com/q/kb/ssl/).  |

![setendpoint](https://github.com/KxSystems/kx-vscode/blob/main/img/myq.png?raw=true)

1. Click **Create Connection** and the connection appears under **CONNECTIONS** in the Primary Sidebar.

1. Right-click the my q process listed under **CONNECTIONS**, and click _Connect server_. This connects to the child q process running inside the kdb VS Code extension.

If you close the extension, the connection also closes.


### Insights Connection

For kdb Insights Enterprise, the kdb VS Code extension uses a shared kdb process. Unlike for a **managed q session**, you must have [kdb Insights Enterprise Personal Edition](https://trykdb.kx.com/kx/signup) running before using these connections.

When you select **Insights connection** as the connection type, the kdb VS Code extension uses a shared kdb process. Unlike for a **managed q session**, you must have [kdb Insights Enterprise Personal Edition](https://trykdb.kx.com/kx/signup) running before using connections of this type.

Set the following properties:

|Property              | Description                          |
|----------------------|--------------------------------------|
|Server Name           | The server name / alias. This can be any name, aside from `local`, which is used by [Bundled q connection](#bundled-q)|
|The connection address|This is the remote address of your kdb Insights Enterprise deployment: e.g. `https://mykdbinsights.cloudapp.azure.com` |


![connecttoinsights](https://github.com/KxSystems/kx-vscode/blob/main/img/insightsconnection.png?raw=true)

1. Click **Create Connection** and the kdb Insights Enterprise connection appears under **CONNECTIONS** in the Primary Sidebar.

1. Right-click the connection, and click _Connect server_.

    ![connecttoinsights](https://github.com/KxSystems/kx-vscode/blob/main/img/kdbinsightsconnection.jpg?raw=true)

1. The kdb VS Code extension runs an authentication step with the remote kdb Insights Enterprise process; sign-in to kdb Insights Enterprise.

    ![authenticateinsights](https://github.com/KxSystems/kx-vscode/blob/main/img/insightsauthenticate.jpg?raw=true)

If you close the extension, the connection also closes.

Once connected, go to [execute code](#execute-code).


[//]: # "In what context is the reserved alias name `insights` used? - BMA - the context is used on build the connection tree; different icon; different connection process. - DF - Is this connection process currently supported in kdb VS Code extension; if so, do we need to document it here?"

## kdb language server

A kdb language server is bundled with the kdb VS Code extension. It offers various common features to aid in the development of kdb code within VS Code, including:

- [Syntax highlighting and linting](#syntax-highlighting)
- [Code navigation](#code-navigation)
- [Code completion](#code-completion)
- [Rename symbol](#rename-symbol)

### Syntax highlighting

The extension provides keyword syntax highlighting, comments and linting help.

![Syntax Highlighting and Linting](https://github.com/KxSystems/kx-vscode/blob/main/img/syntax-highlighting.png?raw=true)

![Linting](https://github.com/KxSystems/kx-vscode/blob/main/img/linting.png?raw=true)

Linting can be enabled by checking `Enable linting for q and quke files` in extension settings.

### Code navigation

While developing q scripts, the kdb VS Code extension supports:

- Go to definition

    Navigate to the definition of a function

- Find/go to all references

    View references of a function both on the side view and inline with the editor

    ![Find all references](https://github.com/KxSystems/kx-vscode/blob/main/img/find-all-references.png?raw=true)

    ![Go to References](https://github.com/KxSystems/kx-vscode/blob/main/img/go-to-references.png?raw=true)

- Outline View 

    Use the Overview at the bottom of the Explorer view which shows the symbol tree of the currently active q file.

    ![Outline View](https://github.com/KxSystems/kx-vscode/blob/main/img/outline.png?raw=true)


### Code Completion

- Keyword auto complete for the q language

  ![Autocomplete](https://github.com/KxSystems/kx-vscode/blob/main/img/autocomplete.png?raw=true)

- Autocomplete for local and remotely connected q processes

### Rename Symbol

Supports renaming symbols in text editor. Right-click and select "Rename Symbol" on any identifier and extension will rename it.

![Rename](https://github.com/KxSystems/kx-vscode/blob/main/img/rename.png?raw=true)

## Execute code

Leaning on VS Code's extensive integrations with SCMs, all code is typically stored and loaded into a VS Code workspace. From there, the kdb VS Code extension allows you execute code against both kdb processes, and kdb Insights Enterprise endpoints.

### kdb process executing q and Python code

For any file with a `.q` or `.py` extension there are additional options available from the right-click menu for executing code:

- Execute entire file

  Takes the current file and executes it against the active connection Results are displayed in the [output window](#view-results). Returned data is displayed in the [kdb results window](#view-results).

- Execute current selection

  Takes the current selection (or current line if nothing is selected) and executes it against the active connection. Results are displayed in the [output window and/or the kdb results window](#view-results).

- Run q file in new q instance - for `.q` files only if q is installed and executable from the terminal

  You can execute an entire q script on a newly launched q instance. Executing a file on a new instance is done in the terminal, and allows interrogation of the active q process from the terminal window.

### Insights query execution

kdb Insights Enterprise offers enhanced connectivity and enterprise level API endpoints, providing additional means to query data and interact with kdb Insights Enterprise that are not available with standard kdb processes. You must have an instance of kdb Insights Enterprise running, and have created a [connection](#connections) within the kdb VS Code extension.

Similarly, you can execute arbitrary code against kdb Insights Enterprise. The code is executed on a user-specific scratchpad process within the kdb Insights Enterprise deploy. The scratchpad is instantiated upon the first request to execute code when connected to a kdb Insights Enterprise connection. It remains active until timed out or until you log out.

#### Data sources

KX Data source files allow you to build a query within VS Code, associate it with a connection and run it against the [kdb Insights Enterprise API endpoints](https://code.kx.com/insights/api/index.html). These are workspace specific files that have the following features:

- Listed in the **DATASOURCES** View in the Primary Sidebar.
- Can be associated with a connection
- Have the **kdb.json** extension
- Are stored in a **.kx** folder at the root of your open folder

 The data source UI helps you to build a query, based on the available API on your instance of **kdb Insights Enterprise**, parameterize it and return the data results to the output or kdb results window.

To create a data source and run it against a specific connection:

1. Ensure you have at least one folder open in VS Code.
1. In the **DATASOURCES** View, click **+**. Specify the parameters defined in the following table:

    | Property              | Description                                                                                                                     |
    |-----------------------|---------------------------------------------------------------------------------------------------------------------------------|
    | Connection            | Select a Connection from list of existing Connections in the dropdown. If none are listed [create a connection](#connections).  |
    | Select API            | Choose **getData** from the **Select API** dropdown. If none are listed click the **Refresh** button.*                          |
    | Table                 | Choose the table you wish to query from the **Tables** dropdown.  If none are listed click the **Refresh** button.*             |
    | Start Time/End Time   | Select the Start and End Time for the query.                                                                                    |
    | Additional Parameters | You can choose from the additional parameters as required.                                                                      |

    *If you are not already connected when you click the **Refresh** button a notification gives you the option to connect.
    
    ![Connection Request](https://github.com/KxSystems/kx-vscode/blob/main/img/connect-request.png?raw=true)

    Once connected you need to click **Refresh** again.

1. Click **Save** to store the settings you have chosen, for reuse later. When you save a data source; query parameters and the connection details are stored. The data source icon is green if it is associated with a connection and grey if there is no association. 

    ![data Source](https://github.com/KxSystems/kx-vscode/blob/main/img/data-source.png?raw=true)

1. Click **Run**.

    If you are not already connected a notification gives you the option to connect.
    
    ![Connection Request](https://github.com/KxSystems/kx-vscode/blob/main/img/connect-request.png?raw=true)

    Once connected you need to click **Run** again.

1. The results populate:

    - The kdb results window, if it is active
    
        ![KDB Results](https://github.com/KxSystems/kx-vscode/blob/main/img/datasource-kdbresults.png)
    
    - Otherwise it will populate the output window

        ![Output](https://github.com/KxSystems/kx-vscode/blob/main/img/datasource-output.png)
    

In addition to [API queries](https://code.kx.com/insights/api/database/query/get-data.html), if the query environment is enabled on the deployed instance of kdb Insights Enterprise, qSQL and SQL queries can be used within a data source with the appropriate parameterization. If qSQL or SQL is required and issues occur trying to run these queries contact a kdb Insights Enterprise administrator for assistance.


#### Populate scratchpad

You can use a data source to populate a scratchpad process running in a **kdb Insights Enterprise** instance with a dataset. This allows you to then execute q or python code against the data stored in that variable in the scratchpad. This facilitates the generation of complex APIs and pipelines within VS Code and kdb Insights Enterprise.

To do this:

1. Create a data source and execute it by clicking **Populate Scratchpad**.

    ![Populate Scratchpad](https://github.com/KxSystems/kx-vscode/blob/main/img/populate-scratchpad-button.png?raw=true)

    If you are not already connected a notification gives you the option to connect.
    
    ![Connection Request](https://github.com/KxSystems/kx-vscode/blob/main/img/connect-request.png?raw=true)

    Once connected you need to click **Populate Scratchpad** again.

1. At the prompt, provide a variable to populate your own scratchpad instance running in the connected kdb Insights Enterprise with the data.

    ![Populate Scratchpad Variable](https://github.com/KxSystems/kx-vscode/blob/main/img/populate-scratchpad.png?raw=true)

1. The scratchpad process is populated.

1. Use a [Workbook](#workbooks) to execute q or Python code against the data in your scratchpad using the variable you provided.



#### Workbooks

Workbooks provide a convenient way to prototype and execute q and python code against a q process and using the variables [populated into the scratchpad](#populate-scratchpad) of a **kdb Insights Enterprise**  deployment by data sources. 

Standard **.q** and **.py** files only run on the active connection. Workbook files have the following features:

- Listed in the **WORKBOOKS** View in the Primary Sidebar.
- Can be associated with a connection
- Have the **.kdb.q.** or **kdb.py** extension
- Are stored in a **.kx** folder at the root of your open folder

This allows you to have multiple Workbooks running against different connections at the same time.

To create a Workbook and run code against a specific connection:

1. Ensure you have at least one folder open in VS Code.
1. In the **WORKBOOKS** View in the Primary Sidebar, click one of the '+' buttons to create a q or Python workbook.

    ![new workbook](https://github.com/KxSystems/kx-vscode/blob/main/img/addnewworkbook.png?raw=true)

1. Write code you wish to execute.

1. Run the code:

    1. To run all the code in the file you can use one of the following methods:

        1. Click 'Run' from above the first line of code in the workbook file.
            ![workbook links](https://github.com/KxSystems/kx-vscode/blob/main/img/workbookrunlink.png)

        1. Select 'Run' from the upper right of the editor. Using the dropdown next to the button you can choose to 'KX: Execute Entire File' or 'KX Execute Current Selection'.
            ![play dropdown](https://github.com/KxSystems/kx-vscode/blob/main/img/wortkbookplaydropdown.png)

        1. Click the 'Run' button on the right-hand side of the status bar.
            ![status bar run ](https://github.com/KxSystems/kx-vscode/blob/main/img/workbookstatusbarrun.png)

        1. Right click and choose 'KX: Execute Entire File' from the menu.

    1. If you wish to only run the current selection (or current line if nothing is selected), right click and choose 'KX: Execute Current Selection' from the menu.

    If you are not already connected a notification gives you the option to connect.
    
    ![Connection Request](https://github.com/KxSystems/kx-vscode/blob/main/img/connect-request.png?raw=true)

    Once connected you need to run the code again.


1. If you have not yet chosen a connection to associate with the workbook you will be asked to choose a connection before the code is executed.
    ![choose connection](https://github.com/KxSystems/kx-vscode/blob/main/img/workbookconnectionlink.png)

1. The results populate the kdb results window if it is active, otherwise it will populate the output window.

When you save a workbook file the code and the connection details are stored. The workbook icon will be green if it is associated with a connection and grey if there is no association.

You can also change the connection associated with a workbook at any time by clicking on 'Choose Connection' from above the first line of code in the workbook file.
  ![choose connection](https://github.com/KxSystems/kx-vscode/blob/main/img/wortkbookplaydropdown.png)



#### Query History

The Query History View in the Primary Sidebar captures each query execution and enables you to re-run any of the queries listed. Initially the query history view will be empty but once you run a query it will be captured and displayed in the window - with a separate row displayed for every execution. All information is stored in memory and not persisted upon application exit.

![Query History](https://github.com/KxSystems/kx-vscode/blob/main/img/query-history.png)

Rows consists of the following parts:

- Status icon: Shows if the code or query executed successfully or an error occurred.
- Connection Name: The Server name associated with the connection on which the query was executed
- Connection Type: 'local', 'myq' or 'insights'
- Time: Time the query was execute
- Data Source/File/Workbook: Name of the file being executed
- Query: When Code is being execute the code is shown
- Data Source Type: When a datasource is being run 'API' is displayed

![Query History Details](https://github.com/KxSystems/kx-vscode/blob/main/img/query-history-details.png)


Right-clicking on a history row will bring up a menu with the option to 'Rerun query'.

![Query History Clear](https://github.com/KxSystems/kx-vscode/blob/main/img/query-history-clear.png)


## View results

All query executions happen remotely from the **kdb VS Code extension** either against a running q process or against your user-specific scratchpad process in kdb Insights Enterprise. The results, successful or otherwise, are returned to VS Code as:

- An output view

  The output view displays results as they are received by the kdb VS Code extension. It includes the query executed, a timestamp and the results.

  ![Output view](https://github.com/KxSystems/kx-vscode/blob/main/img/output-results.png?raw=true)

  **Note:** You can enable/disable auto-scrolling in the VS Code settings. This setting determines whether the output view scrolls to the latest results.

  ![Output autoscrolling](https://github.com/KxSystems/kx-vscode/blob/main/img/auto-scrolling.png?raw=true)

  **Note** You can hide or show the full details in the console output. Go to settings of the VS Code, search for kdb, check the option "Hide Detailed Console Query Output" (this option is checked by default)

  ![Hide Detailed Console Query Output](https://github.com/KxSystems/kx-vscode/blob/main/img/hide-detailed-console-query.png?raw=true)

- A kdb results view

  Results are displayed under the kdb results view, which shows the returned data in a table.

  ![kdb results view](https://github.com/KxSystems/kx-vscode/blob/main/img/kdbview-results.png?raw=true)

## q REPL

q REPL can be started from the command prompt by searching "q REPL".

![REPL](https://github.com/KxSystems/kx-vscode/blob/main/img/repl.png?raw=true)

## Settings

To update kdb VS Code settings, search for `kdb` from _Preferences_ > _Settings_, or right-click the settings icon in kdb VS Code marketplace panel and choose **Extension Settings**.

| Item                                                       | Action                                                              |
| ---------------------------------------------------------- | ------------------------------------------------------------------- |
| Hide notification of installation path after first install | yes/no; default `no`                                                |
| Hide subscription to newsletter after first install        | yes/no; default `no`                                                |
| Insights Enterprise Connections for Explorer               | [edit JSON settings](#insights-enterprise-connections-for-explorer) |
| Linting                                                    | Enable linting for q and quke files                                 |
| QHOME directory for q runtime                              | Display location path of q installation                             |
| Servers                                                    | [edit JSON settings](#servers)                                      |

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

## Shortcuts

### For Windows

| Key                | Action                       |
| ------------------ | ---------------------------- |
| F12                | Go to definition             |
| Shift + F12        | Go to references             |
| Ctrl + Shift + F12 | Find all references          |
| Ctrl + D           | Execute current selection    |
| Ctrl + Shift + D   | Execute entire file          |
| Ctrl + Shift + R   | Run q file in new q instance |

### For MacOS

| Key             | Action                       |
| --------------- | ---------------------------- |
| F12             | Go to definition             |
| Shift + F12     | Go to references             |
| ⌘ + Shift + F12 | Find all references          |
| ⌘ + D           | Execute current selection    |
| ⌘ + Shift + D   | Execute entire file          |
| ⌘ + Shift + R   | Run q file in new q instance |
