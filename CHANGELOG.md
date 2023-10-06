# Change log

All notable changes to the kdb extension will be documented in this file.

# 1.0.1

### Internal Improvements

- Documentation improvements

# 1.0.0

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

# 0.1.17

### Internal Improvements

- KX Language Server improvements

# 0.1.16

### Internal Improvements

- Renamed to 'kdb'

- Preview KX Language Server implementation

# 0.1.15

### Enhancements

- New context sensitive icons for tree view

- Refresh functionality moved from context menu to icon in view title bar

# 0.1.14

### Fixes

- Fix where namespaces without a prefix would have duplicate items and incorrect contexts

- Fix to display objects in the default namespace with no prepended "."

- Fix to only allow expanding the instance/node if a connection is active

- Fix to filter "," namespace from views retrieval

# 0.1.13

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

# 0.1.12

### Enhancements

- Added explorer tree for viewing q server objects

- Added autocomplete and code navigation

### Fixes

- Fixed colors for syntax highlighting

### Internal Improvements

- Added language server to support code completion and navigation

# 0.1.11

### Enhancements

- If no text is selected, Ctrl+Q will execute the current line

- Results now scroll into view on execution

- Clearer error message if empty query is executed

### Fixes

- QHOME path now respected for existing q installations, and local connections can be created for them

### Internal Improvements

- Queries are now wrapped with .Q.s to support displaying all possible types in results

- Branding updates

# 0.1.10

### Enhancements

- Updated onboarding flow design, also improved q process management after onboarding

- Added ability to execute a file or the current selection and display results in the Output pane

- Added activity bar

### Fixes

- Fix for Mac that showed a message when single clicking the connection in connection manager

### Internal Improvements

# 0.1.9

### Enhancements

- Updated onboarding flow to direct the user to the external KX website for new licenses.

- Updated onboarding flow to allow users to use both the base64 encoded string or downloaded file for license.

### Fixes

### Internal Improvements

- Removed q terminal from the extension with the decision to use the editor and output window in favor of the confusion with the terminal.

# 0.1.8

### Enhancements

- Updated the connection manager to validate input for new connections, including alias, hostname, port, username and password.

### Fixes

### Internal Improvements

# 0.1.7

### Enhancements

- Updated the connection manager to allow aliases to be optional.

### Fixes

### Internal Improvements

# 0.1.6

### Enhancements

### Fixes

- Fixed issue when after establishing a connection via connection manager, and the kdb instance going down, the UI still showed connected. This update will provide the user a toast style notification about the connection failure as well as updating the connection status in the connection manager UI (tree).

### Internal Improvements

# 0.1.5

### Enhancements

- Added the core Azure infrastructure code that will be used by subsequent releases to deploy KX Insights directly from VS Code.

- Added internal validation code for Azure resources.

### Fixes

- Fixed issue with bundling with esbuild to address issues with node-fetch used by Azure resources.

### Internal Improvements

# 0.1.4

### Enhancements

### Fixes

- Fixed extension activation not registered for terminal (and other new commands).

### Internal Improvements

# 0.1.3

### Enhancements

- Updated the connection manager to use aliases for connections

- Updated the connection manager to allow auth for kdb endpoints, using the secret storage in VS Code for protection of secrets

### Fixes

- Fixes to global storage for server info in better to manage form.

### Internal Improvements

- Initial infrastructure code for SQL queries from editor, more to come in next release.

# 0.1.2

### Enhancements

- Updated the q terminal to not be started by the Command Pallette and instead be started / stopped from the normal terminal controls.

- Updated the q terminal to use the shared connection manager for kdb connections.

- Added the walkthrough for new users.

### Fixes

- Updated installation logic. The extension will now check to see if QHOME is defined and if so, it will assume that the user has already installed the runtime. If there is no QHOME defined, the extension will prompt the user to install. These will use generic uris which we are still figuring out. There are really 3 profiles for users. The first would be a "managed" install, which would install the bits inside VS Code for the user. The second would be where the user wants to install q runtime outside of VS Code and use it in there, and be guided by the extension and the last is the advanced user who already has the q runtime installed.

### Internal Improvements

- Updated the internal connection manager caching for better response and less connections required when using multiple inputs such as q terminal and the editor pane.

# 0.1.1

### Enhancements

- Add visual indicator to registered connections in the kdb servers panel. This is used to inform the user of the currently connected (active connections) kdb server.

- Add logic to ensure only one connection can be activated at a specific time.

- Add welcome panel when no connections are registered.

### Fixes

- Removed the check for q install, this is being reworked to no annoy users with local installs.

### Internal Improvements
