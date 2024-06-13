# Change log

All notable changes to the **kdb VS Code extension** are documented in this file.

# v1.6.0

### Enhancements

- Display meta data for Insights connections
- Added option to click at meta data and open in json format the meta data
- Ability to change the name of the Keycloak realm, used for authentication, from the default value of `insights`. This enables the connection to a kdb Insights Enterprise Free trial instance.
- Improve the console log quality to "kdb"output pane
- Insights free trial instances are supported
- Added execute block command for q code
- Added hotkey to cache function parameters for q code

### Fixes

- Disconnect when q process is stopped
- Fix query execution on KDB+ connections not refreshing completion items

### Internal Improvements

- Added logging framework

# v1.5.2

### Fixes

- Local connection listener behaviour fixed (if the connection is closed, the connection will disconnect)
- Return to show console output if results tab isn't visible in case of query execution
- Linter fixes

# v1.5.1

### Fixes

- Documentation fixes.

# v1.5.0

This release requires VS Code version 1.86.0 or higher.

### Enhancements

- **Multiple Connections** - It is now possible to have more than one connection open simultaneously. q and Python files run against the active connection, which can be chosen from the list of open connections.
- **Workbooks** - We have introduced Workbook files, which can be associated with a specific connection rather than just running against the active connection. These files are identified with the extension `*.kdb.q` (for q) or `*.kdb.py` (for Python) and are created in `.kx` directory of the current workspace folder.
  - A new **WORKBOOK** view displays the list of Workbooks per workspace.
- **Data sources** - Data sources can be associated with a specific connection rather than just running against the active connection. They are created in the `.kx` directory of the current workspace folder as `*.kdb.json` files.
  - A new **DATASOURCES** view displays the list of data sources per workspace.
- **Data Source Editor** - The data source editor visual design has been improved.
- **OUTLINE** - A new OUTLINE view provides support for q and quke files.
- **Command Grouping** - All extension commands are now grouped under the KX prefix.
- **Syntax Highlighting** - The syntax highlighting for q and quke files has been improved.
- **Connections Icons** - New status sensitive icons have been implemented for connections/
- **q file icon** - New icon for q files.

### Fixes

- Inconsistent command descriptions have been fixed.
- The Execute entire file button was only working when the code editor was selected. This is resolved.
- Language server, parser and linter improvements.
- Updated dependencies.

### Internal Improvements

- Corrected parser inconsistencies
- Language server support for quke files
- Improved query execution for Insights connections

# v1.4.0

### Enhancements

- Changed the workflow of adding new connections to improve the experience of new users

### Fixes

- Previously when running code without an active q connection nothing took place, now an error message is displayed
- KDB Results tab now supports display the result of a scan operation
- Using the query panel to re-run the query will now show the new results
- Corrected issues with linter warnings about undeclared variables, and declared variables not being used as parameters
- Connections must now have unique names
- Unprojected function assignments are now displayed in output
- The limitation of 64 characters for the server name has been increased to 2048
- "temporality" parameter of getData API in kdb Insights has been updated
- MacOS keyboard shortcut documentation has been updated
- Issues with the colorization of comments have been fixed

# v1.3.0

### Enhancements

- Ability to connect to Insights Enterprise in case of remote development environments such as WSL and SSH.
- Execute files from the right-click menu.
- On the Results tab, on a kdb Insights Enterprise connection, hover the mouse over a column header to see the column Q type if it exists.
- Linting enhancements:
  - Implement the following rules:
    - Declare after use
    - Invalid Escape
    - Fixed Seed
    - Too many arguments - when more than 8 arguments are being passed
  - Line length limits have been removed to ensure there are no warnings after a long block comment.
  - Handle .z.exit correctly.
  - Optionally disable linting.

### Fixes

- Ability to switch users connected to a kdb Insights Enterprise URL. The new flow to switch users when you are already logged in is as follows:

  - Disconnect from the URL.
  - Log into the URL using browser and log out of environment.
  - On reconnecting you are asked to enter your login details and you can chose a different user.

- Fix to ensure you can login again if a login attempt fails.

- Fix for an invalid "settings.json" file causing "Add Connection" to fail without error.

- Ensure the "Execute Entire File" button works even if the cursor is not in the code editor window.

- Fixes for the Data Sources:

  - Custom APIs are no longer listed, these will be added in a future release when the execution of a Custom API is supported.
  - The "Run" button will be greyed out while a Data Source is executing, to ensure there are no concurrent executions.
  - To see Data Source results within the "Output" tab, ensure that the output is from "q Console Output".

- Fixes for the tree:

  - The only variables being displayed were longs.
  - Connections were string queries were forbidden broke the tree

- Fixes for KDB Results:

  - incorrect display of empty tables
  - not displaying results for non-tables or non-atoms.

- Fix for incorrectly displayed types for local q and kdb Insights Enterprise connections.

- Fix for the console occasionally displaying the results from the previous query.

- Fix for syntax highlighting when using the @see qdoc tag

### Internal Improvements

- Fixed various CVEs

# v1.2.1

### Fixes

- Documentation fixes

# v1.2.0

### Enhancements

- Execution of Python code on kdb Insights Enterprise
- Rename symbol support
- Basic linting support
- kdb+/q REPL flow

### Fixes

- Fix auto closing quote in wrong place
- Fix confusing scratchpad wording
- Fix for datasource rename
- Fix for datasource qsql execution
- Fix flickering output tab
- Fix for activate results view on query execution
- Fix for displaying error messages from datasource execution
- Fix non-ascii character rendering for console and results view

### Internal Improvements

- Removed request-promise dependency
- Implemented webview tests

# v1.1.1

### Fixes

- Documentation fixes

# v1.1.0

### Enhancements

- Updated connection creation workflow
- Reduced visual noise in output pane

### Fixes

- Several fixes for results tab
- Fix where uppercase variables are flagged as issues
- Fix where removing connection did not disconnect first
- Fixes for highlighting and indenting
- Fix to remove option to run q in a new instance if not available

### Internal Improvements

- Updated authentication service
- Improved datasource rendering

# v1.0.1

### Internal Improvements

- Documentation improvements

# v1.0.0

### Enhancements

- Added kdb Insights Enterprise connections
- kdb Insights Enterprise Scratchpad integration; execute q commands and scripts in VS Code
- Create persisted Data Sources to execute API, SQL and qSQL against kdb Insights Enterprise connections
- Populate Scratchpads from Data Sources and interrogate on the scratchpad
- Support for TLS secured remote kdb connections
- KDB Results View - graphical tabular view of executed queries

### Internal Improvements

- Improved kdb connections tree to support embedded namespaces
- kdb connections tree is now sorted
- Autocomplete fixes for embedded namespaces

# v0.1.17

### Internal Improvements

- KX Language Server improvements

# v0.1.16

### Internal Improvements

- Renamed to 'kdb'

- Preview KX Language Server implementation

# v0.1.15

### Enhancements

- New context sensitive icons for tree view

- Refresh functionality moved from context menu to icon in view title bar

# v0.1.14

### Fixes

- Fix where namespaces without a prefix would have duplicate items and incorrect contexts

- Fix to display objects in the default namespace with no prepended "."

- Fix to only allow expanding the instance/node if a connection is active

- Fix to filter "," namespace from views retrieval

# v0.1.13

### Enhancements

- Added command to refresh server objects

### Fixes

- Server objects can now be enumerated without a pre-script

- Tree for non-default namespaces and variables are now filtered to ensure views are not present

- Views tree now shows views correctly

- Language server no longer makes duplicate suggestions

- Fix for context menu after new server object items are added, all options now shown

### Internal Improvements

- Logo improved to work with both light and dark themes

# v0.1.12

### Enhancements

- Added explorer tree for viewing q server objects

- Added autocomplete and code navigation

### Fixes

- Fixed colors for syntax highlighting

### Internal Improvements

- Added language server to support code completion and navigation

# v0.1.11

### Enhancements

- If no text is selected, Ctrl+Q will execute the current line

- Results now scroll into view on execution

- Clearer error message if empty query is executed

### Fixes

- QHOME path now respected for existing q installations, and local connections can be created for them

### Internal Improvements

- Queries are now wrapped with .Q.s to support displaying all possible types in results

- Branding updates

# v0.1.10

### Enhancements

- Updated onboarding flow design, also improved q process management after onboarding

- Added ability to execute a file or the current selection and display results in the Output pane

- Added activity bar

### Fixes

- Fix for Mac that showed a message when single clicking the connection in connection manager

### Internal Improvements

# v0.1.9

### Enhancements

- Updated onboarding flow to direct the user to the external KX website for new licenses.

- Updated onboarding flow to allow users to use both the base64 encoded string or downloaded file for license.

### Fixes

### Internal Improvements

- Removed q terminal from the extension with the decision to use the editor and output window in favor of the confusion with the terminal.

# v0.1.8

### Enhancements

- Updated the connection manager to validate input for new connections, including alias, hostname, port, username and password.

### Fixes

### Internal Improvements

# v0.1.7

### Enhancements

- Updated the connection manager to allow aliases to be optional.

### Fixes

### Internal Improvements

# v0.1.6

### Enhancements

### Fixes

- Fixed issue when after establishing a connection via connection manager, and the kdb instance going down, the UI still showed connected. This update will provide the user a toast style notification about the connection failure as well as updating the connection status in the connection manager UI (tree).

### Internal Improvements

# v0.1.5

### Enhancements

- Added the core Azure infrastructure code that will be used by subsequent releases to deploy KX Insights directly from VS Code.

- Added internal validation code for Azure resources.

### Fixes

- Fixed issue with bundling with esbuild to address issues with node-fetch used by Azure resources.

### Internal Improvements

# v0.1.4

### Enhancements

### Fixes

- Fixed extension activation not registered for terminal (and other new commands).

### Internal Improvements

# v0.1.3

### Enhancements

- Updated the connection manager to use aliases for connections

- Updated the connection manager to allow auth for kdb endpoints, using the secret storage in VS Code for protection of secrets

### Fixes

- Fixes to global storage for server info in better to manage form.

### Internal Improvements

- Initial infrastructure code for SQL queries from editor, more to come in next release.

# v0.1.2

### Enhancements

- Updated the q terminal to not be started by the Command Pallette and instead be started / stopped from the normal terminal controls.

- Updated the q terminal to use the shared connection manager for kdb connections.

- Added the walkthrough for new users.

### Fixes

- Updated installation logic. The extension will now check to see if QHOME is defined and if so, it will assume that the user has already installed the runtime. If there is no QHOME defined, the extension will prompt the user to install. These will use generic uris which we are still figuring out. There are really 3 profiles for users. The first would be a "managed" install, which would install the bits inside VS Code for the user. The second would be where the user wants to install q runtime outside of VS Code and use it in there, and be guided by the extension and the last is the advanced user who already has the q runtime installed.

### Internal Improvements

- Updated the internal connection manager caching for better response and less connections required when using multiple inputs such as q terminal and the editor pane.

# v0.1.1

### Enhancements

- Add visual indicator to registered connections in the kdb servers panel. This is used to inform the user of the currently connected (active connections) kdb server.

- Add logic to ensure only one connection can be activated at a specific time.

- Add welcome panel when no connections are registered.

### Fixes

- Removed the check for q install, this is being reworked to no annoy users with local installs.

### Internal Improvements
