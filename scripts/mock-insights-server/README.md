## Test instructions: self-signed mock Insights connection

Verifies the fix in `src/services/kdbInsights/codeFlowLogin.ts` (`getAuthPrefix`
now honors the connection's "insecure" flag) against
`scripts/mock-insights-server/`.

### 1. Start the mock server

```
npm run mock-insights-server
```

Leave it running in its own terminal. First run generates a self-signed cert
into `scripts/mock-insights-server/certs/` (gitignored). Confirm the log line:

```
Mock Insights API listening on https://localhost:8443
```

### 2. Launch the extension

- In VS Code: Run and Debug → **Run Extension** (F5).
- No `NODE_EXTRA_CA_CERTS` env var needed anymore — that was the workaround
  for the bug this fix removes.

### 3. Add the mock connection

In the Extension Development Host:

- Open the **KX** view → click **New Connection** (`kdb.connections.add`), or
  run it from the Command Palette.
- Choose "KDB Insights connection".
- Fill in:
  - **Server**: `https://localhost:8443/` (trailing slash matters — it's
    resolved as a relative base URL)
  - **Alias**: `MOCK`
  - Check **"Accept insecure SSL certifcates"**
- Save.

### 4. Connect and verify

- Click the `MOCK` connection to connect.
- Expected: connects successfully, no `self signed certificate` error in the
  **Output → KX** channel.
- Confirm the full handshake happened: `Output → KX` should show REST debug
  lines for `/kxicontroller/config`, `/api/config`, and
  `/servicegateway/api/v3/meta`, then `Connection established successfully to: MOCK`.

### 5. Regression check (pre-fix behavior)

To confirm the failure this fixes, temporarily revert
`src/services/kdbInsights/codeFlowLogin.ts` (or `git stash` the fix), repeat
steps 2-4 with "insecure" checked, and confirm the original error reproduces:

```
self signed certificate; if the root CA is installed locally, try running Node.js with --use-system-ca
```

Then restore the fix and re-run step 4 to confirm it's resolved.

### 6. Optional: exercise a query

Once connected, open a `.q` or scratchpad file, run a trivial query (e.g.
`1+1`). The mock server's `/scratchpadmanager/scratchpad/display` route
returns `mock result for: <expression>`, so the results panel should show
that string rather than an error.

### Cleanup

Stop the mock server (Ctrl+C). `scripts/mock-insights-server/certs/` can be
deleted to force cert regeneration on the next run.
