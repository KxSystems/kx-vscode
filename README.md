# kdb VS Code extension

This is a companion extension for kdb developers. Some words about brilliant features provided.

Its main features are editing capabilities for working with q files, and the ability to connect to kdb processes and run queries.

[![KX VS Code CI](https://github.com/KxSystems/kx-vscode/actions/workflows/ci.yml/badge.svg)](https://github.com/KxSystems/kx-vscode/actions/workflows/ci.yml)

## Contents

[Get started](#get-started)

[Editing features](#editing-features)

[Connections](#connections)

[Execute code](#execute-code)

[View results](#view-results)

## Get started

a few words about the process, so install q, start q and connect q to vscode

### Install q

**If you already have q installed locally**

When you install the extension, the message **q runtime installed** is displayed. You can now [start q](#start-q).

**If you do not have q installed**

When you install the extension, you are instructed to do one of the following:

- [Install q locally](https://code.kx.com/q/learn/install)
- [Install q using the extension](#install-q-using-the-extension)

**Install q using the extension**

Click **Install runtime**.

    You are prompted to provide a license key.
    
    - If you have a license key, click **Select/Enter a license**
    
        Choose one of the following options:
	
	- Paste license string
 
		Paste your base64 encoded license string. This is provided by KX in an email.
  
	- Select license file
 
		If KX provided a license file, which you downloaded, choose this option and specify the file.
  
	A success message is displayed and you can [start q](#start-q).
 
    - If you do not have a license key, click **Acquire license**.
    
        At the prompt, click **Open** to go to https://kx.com/kdb-personal-edition-download, where you can sign up for our 12-month free trial of kdb+ Personal Edition. You can alternatively contact our licensing department at licadmin@kx.com if you want to buy a full commercial license.

When you receive a license email from KX, return to Visual Studio Code and click **Continue** at the prompt in the bottom right-hand corner. From here, you are prompted to specify a license key string or file as above.

    A success notice is displayed and you can [start q](#start-q).

Note

Ensure that the system variable [QHOME](FIXME) is defined and that the location of your q folder is specified in the *Path* system variable.

### Start q



### Connect q and Visual Studio Code

You must enable the kdb+ process to communicate with Visual Studio Code. To do this, [set the kdb+process to listen on a port](https://code.kx.com/q/basics/ipc). Make a note of the port number that you use; you need this later on to connect Visual Studio Code to the port.




## Editing features


- Syntax highlighting

    The extension highlights native [q syntax](https://code.kx.com/q/basics/syntax/).


- Code navigation

    The extension uses [Visual Studio Code's navigation framework](https://code.visualstudio.com/docs/editor/editingevolved).


- Code completion


## Connections

We provide these connection types:

- Managed

    You can use Visual Studio Code's controls to start and stop a managed connection. When you exit Visual Studio Code, the q process stops.
    
- Unmanaged

    You manage the q process outside of Visual Studio Code. The q process runs irrespective of whether you have Visual Studio Code open or not.

- Insights

    You can connect to an instance of kdb Insights Enterprise.


## Execute code


## View results













**OLD STUFF**

## Install

Follow the extension walkthrough to install q, if required

## Get Started

<details>
  <summary>Add a connection</summary>
  Add a new server connection by opening the extension side panel and choosing 'Add new connection' from the context menu

![Extension panel](https://code.kx.com/img/walkthrough/add-new-connection.png "Add a connection")

  </details>

<details>
  <summary>Connect to a server</summary>

Connect to an existing server by right-clicking and choosing 'Connect kdb server'

![Extension panel](https://code.kx.com/img/walkthrough/connect.png "Connect kdb server")

</details>

<details>
  <summary>Execute code</summary>

q files can be executed by right-clicking the editor and choosing 'Execute Entire File', results will be shown in the Output pane

![Extension panel](https://code.kx.com/img/walkthrough/output.png "q Console Output")

</details>

## More

<details>
  <summary>Syntax highlighting</summary>

![Syntax highlighting](https://code.kx.com/img/walkthrough/highlighting.png "Syntax highlighting")

</details>

<details>
  <summary>Code navigation</summary>

![Code navigation](https://code.kx.com/img/walkthrough/navigation.png "Code navigation")

</details>

<details>
  <summary>Code completion</summary>

![Code completion](https://code.kx.com/img/walkthrough/autocomplete.png "Code completion")

</details>

## Known Issues

- Code hierarchy functionality may experience performance issues

- Smart scroll may cause issues with query output, if experiencing issues please disable the Output > Smart Scroll setting and enable Auto Scrolling in the Output pane by clicking the lock icon at the top right
