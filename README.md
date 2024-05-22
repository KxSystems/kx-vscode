# kdb Visual Studio Code extension

This is a companion extension for kdb developers to edit q files, connect to kdb processes, and run queries. This VS Code extension can be used alongside [kdb Insights Enterprise](https://code.kx.com/insights/enterprise/index.html) when using a shared kdb process.

Please use vscode-questions@kx.com to raise any questions or feedback.

[![KX VS Code CI Testing](https://github.com/KxSystems/kx-vscode/actions/workflows/main.yml/badge.svg)](https://github.com/KxSystems/kx-vscode/actions/workflows/main.yml)

[![KX VS Code Release](https://github.com/KxSystems/kx-vscode/actions/workflows/release.yml/badge.svg)](https://github.com/KxSystems/kx-vscode/actions/workflows/release.yml)

## Contents

- [Why q for VS Code?](#why-q-for-vs-code)
- [Get Started](#get-started)
- [Connections](#connections)
- [kdb language server](#kdb-language-server)
- [Execute code](#execute-code)
- [View results](#view-results)
- [Settings](#settings)
- [Shortcuts](#shortcuts)

## Why q for VS Code?

With the kdb VS Code extension you can:

- Install q.
- Write q syntax with support for predict and autocomplete.
- Execute q from a single line of code, code block or q file.
- Write and execute q code against kdb Insights Enterprise.
- View results from your queries.

## Get started

After installing the extension, if you have an existing q installation, you will see the message `q runtime installed` and can go directly to adding [connections](#connections).

If you do not have an existing q installation, and wish to use [kdb Insights Personal Edition](https://kx.com/kdb-insights-personal-edition-license-download/) follow [Integrating VS Code with q](#integrate-vs-code-with-q), where the VS Code Extension guides you through the steps to register, install q and add your license file. 

### Registering for other kdb versions

If you wish to use a version other than [kdb Insights Personal Edition](https://kx.com/kdb-insights-personal-edition-license-download/) you must register for that version and install q before continuing with VS Code.

The table below describes the different versions and their support for different features:

| item                                                                                            | write q | run q queries | explore results | shared kdb process with kdb Insights |
| ----------------------------------------------------------------------------------------------- | ------- | ------------- | --------------- | ------------------------------------ |
| [kdb+ Personal Edition](https://kx.com/kdb-personal-edition-download/)                          | yes     | yes           | yes             | no                                   |
| [kdb Insights Personal Edition](https://kx.com/kdb-insights-personal-edition-license-download/) | yes     | yes           | yes             | no                                   |
| kdb Insights Enterprise                                                                         | yes     | yes           | yes             | yes                                  |

Contact licadmin@kx.com for commercial kdb licensing.

After registering for your chosen version, you will receive an email with a link to download an installation file and a `k4.lic` or `kc.lic` license file. Follow the instructions [here](https://code.kx.com/q/learn/install) for Linux, macOS and Windows to install q and a license file before proceeding.

Once you have installed q and downloaded a license file follow [Integrating VS Code with q](#integrate-vs-code-with-q).

### Integrate VS Code with q 

To integrate VS Code with q take the following steps:

1. Ensure the kdb VS Code extension is installed.

1. Click `Install new instance` from the prompt. If the prompt is not visible ensure the kdb extension is selected in the Activity bar on the left, if that does not display the prompt, close and re-open VS Code.

  ![installnewinstance](https://github.com/KxSystems/kx-vscode/blob/main/img/installnewinstance.jpg?raw=true)

1. If you have already registered, then choose `Select/Enter a license`. If you haven't registered, choose `Acquire license`, this will open a dialog with a redirect link to register for [kdb Insights Personal Edition](https://kx.com/kdb-insights-personal-edition-license-download/).

  ![findlicense](https://github.com/KxSystems/kx-vscode/blob/main/img/findlicense.jpg?raw=true)

  Once registered you will receive an email with you license details.

1. With the license secured, you can link this to VS Code by either choosing `pasting license string` or `selecting license file` from your PC; the latter method is recommended for new users.

  ![findlicense](https://github.com/KxSystems/kx-vscode/blob/main/img/pastelicense.jpg?raw=true)

  The base64 encoded license string can be found in the welcome email received after registration, under the download link for the license file.

  ![welcomeemaillicense](https://github.com/KxSystems/kx-vscode/blob/main/img/weclomeemail.jpg?raw=true)

  The `k4.lic` or `kc.lic` license file can be downloaded to your PC using the link also found in the welcome email.

1. If you wish to use q outside of VS Code, set a [`QHOME` environment variable](https://code.kx.com/q/learn/install/#step-5-edit-your-profile) to the location used by the kdb VS Code install. A notification dialog displays the location of q, as do the extension [settings](#settings). T

  ![qfound](https://github.com/KxSystems/kx-vscode/blob/main/img/installationofqfound.jpg?raw=true)

  If q is installed at `C:\q`, then `QHOME` is `C:\q`.

1. To finish, a prompt is offered with an opt-in to receive a newsletter.



## Connections

The kdb VS Code extension allows you to connect VS Code to one or more q processes; these can be:

- [Bundled q](#bundled-q): referred to as a **managed q session**, which uses the q installed as part of the kdb VS Code extension installation. It runs a child q process from within the extension and is fully managed by the extension. 
- [My q](#my-q): referred to as an **unmanaged q session** this is a remote q process.

- [Insights](#insights-connection): access to kdb Insights Enterprise API endpoints and a user-specific scratchpad process within a kdb Insights Enterprise deployment.

You can have multiple connections open at once, enabling development and testing across different q and kdb Insights Enterprise connections using both q and Python.


### Bundled q

This runs a q session using the existing kdb installed as part of the kdb VS Code extension.

1. Click _connect to kdb server_ or _Add new connection_ from the _CONNECTIONS_ context menu.

  ![connecttoakdbserver](https://github.com/KxSystems/kx-vscode/blob/main/img/connecttoakdbserver.png?raw=true)

1. A new window will open with the type of connection you desire to add, **Select Bundled q**.

  ![setendpoint](https://github.com/KxSystems/kx-vscode/blob/main/img/bundleqform.png?raw=true)

1. The _server name / alias_ will already be set as `local`.

1. The _connection address_ will already be set as `127.0.0.1` which corresponds to your _localhost_

1. Set the _port_ for the kdb server. Ensure the port used doesn't conflict with any other running q process; e.g. _5002_

  - I want to learn more about [setting a q port](https://code.kx.com/q/basics/ipc/)

1. Click **Create connection** to confirm the _connection creation_

1. Right-click the q bundled process listed under _KX:CONNECTIONS_, and click _Start q process_.

  ![setendpoint](https://github.com/KxSystems/kx-vscode/blob/main/img/managedqprocess.jpg?raw=true)

1. From the same right-click menu, click _Connect kdb server_. This connects to the child q process running inside the kdb VS Code extension.

If you close the extension, the connection to the child q process also closes.

### My q

1. Identify the remote location of a running process. The hostname and port will be required along with any authentication information.

1. Within the kdb VS Code extension, click _connect to kdb server_, or *Add new connection\*\* from the *CONNECTIONS\* context menu.

  ![connecttoakdbserver](https://github.com/KxSystems/kx-vscode/blob/main/img/connecttoakdbserver.png?raw=true)

1. A new window will open with the type of connection you desire to add, **Select My q**.

  ![setendpoint](https://github.com/KxSystems/kx-vscode/blob/main/img/myq.png?raw=true)

1. Assign a _server name / alias_. The server name selected **cannot be `local` or `insights`**, as these are reserved for use by [Bundled q connections](#bundled-q) and [Insights connections](#insights-connection), respectively; e.g. dev

1. Set the _connection address_ or ip address of the kdb server; e.g. _localhost_.

1. Set the _port_ used by the kdb server; e.g. _5001_.

  - I want to learn more about [setting a q port](https://code.kx.com/q/basics/ipc/)

1. If authentication is needed, fill in the username and password fields, otherwise, leave these fields **blank**

1. If TLS is enabled, check the checkbox.

  - I want to learn more [about TLS encryption](https://code.kx.com/q/kb/ssl/).

1. Click **Create connection** to confirm the _connection creation_

Upon completion, the localhost connection appears under _KX:CONNECTIONS_ in the left hand panel.

### Insights Connection

For kdb Insights Enterprise, the kdb VS Code extension uses a shared kdb process. Unlike for a **managed q session**, you must have [kdb Insights Enterprise Personal Edition](https://trykdb.kx.com/kx/signup) running before using these connections.

1. Click _Add Connection_.

  ![connecttoakdbserver](https://github.com/KxSystems/kx-vscode/blob/main/img/connecttoakdbserver.png?raw=true)

1. A new window will open with the type of connection you desire to add, **Select Insights connection**.

  ![connecttoinsights](https://github.com/KxSystems/kx-vscode/blob/main/img/insightsconnection.png?raw=true)

1. Create a _server name / alias_; this can be any name, aside from `local`, which is used by [Bundled q connection](#bundled-q).

1. Set the _hostname_. This is the remote address of your kdb Insights Enterprise deployment: e.g. `https://mykdbinsights.cloudapp.azure.com`

1. Click **Create connection** to confirm the _connection creation_

1. The kdb Insights Enterprise connection is listed under _KX:Connections_, with its own icon. Right-click the connection and _Connect to Insights_

  ![connecttoinsights](https://github.com/KxSystems/kx-vscode/blob/main/img/kdbinsightsconnection.jpg?raw=true)

1. The kdb VS Code extension runs an authentication step with the remote kdb Insights Enterprise process; sign-in to kdb Insights Enterprise.

  ![authenticateinsights](https://github.com/KxSystems/kx-vscode/blob/main/img/insightsauthenticate.jpg?raw=true)


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

Linting is supported for assignment to reserved words and literals, unused arguments and variables, line length, deprecated date time, too many globals, locals and constants. More linter rules will be supported for future releases.

### Code navigation

While developing q scripts, the kdb VS Code extension supports:

- Go to definition

  Navigate to the definition of a function

- Find/go to all references

  View references of a function both on the side view and inline with the editor

  ![Find all references](https://github.com/KxSystems/kx-vscode/blob/main/img/find-all-references.png?raw=true)

  ![Go to References](https://github.com/KxSystems/kx-vscode/blob/main/img/go-to-references.png?raw=true)

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

KX Data source files are workspace specific files that have the following properties

- Can be associated with a connection
- Have the `kdb.json` extension
- Are stored in a `.kx` folder at the root of your open folder

These files allow you to build a query within VS Code, associate it with a connection and run it against the [kdb Insights Enterprise API endpoints](https://code.kx.com/insights/api/index.html). The UI helps you to build a query based on the available API on your instance of kdb Insights Enterprise, parameterize it and return the data results to the output or kdb results window.


To create a data source and run it against a specific connection::

1. Ensure you have at least one folder open in VS Code.
1. In the DATASOURCES view, click the '+'' button.
1. Select a Connection from the Connections dropdown.
1. Choose getData from the Select API dropdown.
1. Choose the table you wish to query from the Tables dropdown.
1. Choose a Start and End Time.
1. You can choose from the additional parameters if you wish.
1. Click Save to store the settings you have chosen, for reuse later.

  ![data Source](https://github.com/KxSystems/kx-vscode/blob/main/img/data-source.png?raw=true)

1. Click 'Run'.

1. The results populate the kdb results window if it is active, otherwise it will populate the output window.

When you save a data source file query parameters and the connection details are stored. The data source icon will be green if it is associated with a connection and grey if there is no association.

In addition to [API queries](https://code.kx.com/insights/api/database/query/get-data.html), if the query environment is enabled on the deployed instance of kdb Insights Enterprise, qSQL and SQL queries can be used within a data source with the appropriate parameterization.


#### Populate scratchpad

You can use a data source to populate a scratchpad process running in a kdb Insights Enterprise instance with a dataset. This allows you to then execute q or python code against the data stored in that variable in the scratchpad. This facilitates the generation of complex APIs and pipelines within VS Code and kdb Insights Enterprise.

To do this:

1. Create a data source and execute it using the 'Populate Scratchpad' button.
1. At the prompt, provide a variable to populate your own scratchpad instance running in the connected kdb Insights Enterprise with the data.
   The scratchpad process is populated.
1. Return to VS Code and use a [workbook](#workbooks) to execute q or python code against the data in your scratchpad using the variable you provided.

![Populate Scratchpad](https://github.com/KxSystems/kx-vscode/blob/main/img/populate-scratchpad.png?raw=true)

#### Workbooks

Workbooks are the most convenient way to prototype and execute q and python code against a deployment of kdb Insights Enterprise using the [variables](#populate-scratchpad) populated into the scratchpad by data sources. 

Standard `.q` and `.py` files only run on the active connection. Workbook files can be associated with a connection, have a `kdb.q` or `kdb.py` extension and are stored in a `.kx` folder at the root of your workspace. This allows you to have multiple workbooks running against different connections at the same time.

To create a Workbook and run code against a specific connection:

1. Ensure you have at least one folder open in VS Code.
1. In the WORKBOOKS view, click one of the '+' buttons to create a q or Python workbook.
  ![new workbook](https://github.com/KxSystems/kx-vscode/blob/main/img/addnewworkbook.png?raw=true)

1. Write code you wish to execute.

1. Run the code:

  1. To run all the code in the file you can use one of the following methods:

    1. Click 'Run' from above the first line of code in the workbook file.
      ![workbook links](https://github.com/KxSystems/kx-vscode/blob/main/img/workbookrunlink.png)

    1. Select 'Run' from the upper right of the editor. Using the dropdown next to the button you can choose to 'KX: Execute Entire File' or 'KX Execute Current Selection'.
        ![play dropdown](https://github.com/KxSystems/kx-vscode/blob/main/img/wortkbookplaydropdown.png)

    1. Click the 'Run' button on the right hand side of the status bar.
        ![status bar run ](https://github.com/KxSystems/kx-vscode/blob/main/img/workbookstatusbarrun.png)

    1. Right click and choose 'KX: Execute Entire File' from the menu.

  1. If you wish to only run the current selection (or current line if nothing is selected), right click and choose 'KX: Execute Current Selection' from the menu.

1. If you have not yet chosen a connection to associate with the workbook you will be asked to choose a connection before the code is executed.
        ![choose connection](https://github.com/KxSystems/kx-vscode/blob/main/img/workbookconnectionlink.png)

1. The results populate the kdb results window if it is active, otherwise it will populate the output window.

When you save a workbook file the code and the connection details are stored. The workbook icon will be green if it is associated with a connection and grey if there is no association.

You can also change the connection associated with a workbook at any time by clicking on 'Choose Connection' from above the first line of code in the workbook file.
  ![choose connection](https://github.com/KxSystems/kx-vscode/blob/main/img/wortkbookplaydropdown.png)



## View results

All query executions happen remotely from the kdb VS Code extension either against a running q process or against your user-specific scratchpad process in kdb Insights Enterprise. The results, successful or otherwise, are returned to VS Code as:

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

To update kdb VS Code settings, search for `kdb` from _Preferences_ > _Settings_, or right-click the settings icon in kdb VS Code marketplace panel and choose _Extension Settings_.

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
