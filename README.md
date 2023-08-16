# kdb Visual Studio Code extension

This is a companion extension for kdb developers. It provides editing capabilities for working with q files, and the ability to connect to kdb processes and run queries.

[![KX VS Code CI](https://github.com/KxSystems/kx-vscode/actions/workflows/ci.yml/badge.svg)](https://github.com/KxSystems/kx-vscode/actions/workflows/ci.yml)

## Contents

FIXME put in table of contents with links

## Overview

Use this extension to:

- Predict and complete q syntax in a q session or within an instance of kdb Insights Enterprise
- Execute a line of q code, a section of q code or a file of q code in a q session
- Execute q code from within kdb Insights Enterprise FIXME more needed here
- View results FIXME more needed here

Before you can use these features, you must:

1. Install q
1. Start q
1. Configure connections between VS Code and q or kdb Insights Enterprise
1. Connect VS Code to q or kdb Insights Enterprise

## Install q

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
    At the prompt, click **Open** to go to https://kx.com/kdb-personal-edition-download, where you can sign up for our 12-month free trial of kdb+ Personal Edition. You can, alternatively, contact our licensing department at licadmin@kx.com if you want to buy a full commercial license.

    When you receive a license email from KX, return to Visual Studio Code and click **Continue** at the prompt in the bottom right-hand corner. From here, you are prompted to specify a license key string or file as above.

    A success notice is displayed and you can [start q](#start-q).

Note: ensure that the system variable [*QHOME*](FIXME) is defined and that the location of your q folder is specified in the *Path* system variable.

## Start q

If you just installed q using the extension, the last prompt is to **Start q**.

At any other time, type **q* at a command prompt.

From the extension, you can now [connect directly to a q session](#connect-to-a-q-session), or to an [instance of kdb Insights Enterprise](connect-to-an-instance-of-kdb-insights-enterprise).

## Connection types

We provide these connection types:

- Managed q session

    You can use Visual Studio Code's controls to start and stop a managed connection. When you exit Visual Studio Code, the q process stops.
    
- Unmanaged q session

    You manage the q process outside of Visual Studio Code. The q process runs irrespective of whether you have Visual Studio Code open or not.

- Insights

    You can connect to an instance of kdb Insights Enterprise.

## Connect to a q session (managed or unmanaged)

Use these steps:

1. Enable the q process to communicate with Visual Studio Code.
 
    To do this, [set the q process to listen on a port](https://code.kx.com/q/basics/ipc). Make a note of the port number that you use; you need this in the next step to connect Visual Studio Code to the port.

1. Configure the connection in Visual Studio Code.

    To do this, click **Connect to kdb server** in the KX side bar.
   
    FIXME image connecttokdbserver.jpg
   
    If this button is not displayed, select **Add new connection** from the context menu.
   
    FIXME image addnewconnection.jpg
   
    Select *Enter a kdb endpoint* and respond to the prompts:
    
    *Enter a name or alias for the connection*

    A note about the managed and unmanaged here.
    
    *Enter the host name or ip address of the kdb server*
    
    *Enter the port number of the kdb server*
    the one you set up earlier
    
    *Enter a username to authenticate with (optional)*
    
    *Enter a password to authenticate with (optional)*
    
    *Enable TLS encryption on kdb connection (optional)*
    
1. Tell the Visual Studio Code extension which configuration to connect to.

    To do this, right-click the relevant connection configuration in the KX side bar and select **Connect kdb server**.
    
    A success message is displayed in the bottom, right-hand corner of the screen.

    FIXME You can now ???

## Connect to an instance of kdb Insights Enterprise

Use these steps:

1. Specify details of the kdb Insights Enterprise endpoint in Visual Studio Code.
    To do this, click **Connect to kdb server** in the KX side bar.
    FIXME image connecttokdbserver.jpg
    Select *Connect to kdb Insights Enterprise* and respond to the prompts:

    *Enter a name or alias for the connection*

    *Enter the Insights endpoint URL*

1. Tell the Visual Studio Code extension which instance of kdb Insights Enterprise to connect to.

    To do this, right-click the relevant connection configuration in the KX side bar and select **Connect to Insights**.

    FIXME image connecttoinsightscontext.jpg

    The instance of kdb Insights Enterprise is displayed.


## Editing features


- Syntax highlighting

    The extension highlights native [q syntax](https://code.kx.com/q/basics/syntax/).


- Code navigation

    The extension uses [Visual Studio Code's navigation framework](https://code.visualstudio.com/docs/editor/editingevolved).


- Code completion





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
