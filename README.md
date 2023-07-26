# kdb VS Code extension

This is a companion extension for kdb developers including editor features for working with q files along with the ability to connect to kdb processes and run queries

[![Tests](https://github.com/KxSystems/kx-vscode/actions/workflows/test.yml/badge.svg)](https://github.com/KxSystems/kx-vscode/actions/workflows/test.yml)

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
