const { build } = require("esbuild");
const { copy } = require("esbuild-plugin-copy");

const baseConfig = {
  bundle: true,
  minify: process.env.NODE_ENV === "production",
  sourcemap: process.env.NODE_ENV !== "production",
};

const extensionConfig = {
  ...baseConfig,
  outfile: "./out/extension.js",
  entryPoints: ["./src/extension.ts"],
  external: ["vscode"],
  format: "cjs",
  platform: "node",
};

const serverConfig = {
  ...baseConfig,
  outfile: "./out/server.js",
  entryPoints: ["./server/src/server.ts"],
  format: "cjs",
  external: ["vscode"],
  platform: "node",
};

const webviewConfig = {
  ...baseConfig,
  target: "es2020",
  format: "esm",
  entryPoints: ["./src/webview/main.ts"],
  external: ["vscode"],
  outfile: "./out/webview.js",
  plugins: [
    copy({
      resolveFrom: "cwd",
      assets: [
        {
          from: ["src/webview/styles/*.css"],
          to: ["./out"],
        },
        {
          from: ["node_modules/ag-grid-community/styles/ag-grid.min.css"],
          to: ["./out"],
        },
        {
          from: [
            "node_modules/ag-grid-community/styles/ag-theme-alpine.min.css",
          ],
          to: ["./out"],
        },
        {
          from: [
            "node_modules/ag-grid-community/dist/ag-grid-community.min.js",
          ],
          to: ["./out"],
        },
      ],
    }),
  ],
};

(async () => {
  try {
    await build(extensionConfig);
    console.log("extension build complete");
    await build(serverConfig);
    console.log("server build complete");
    await build(webviewConfig);
    console.log("build complete");
  } catch (err) {
    process.stderr.write(err.stderr);
    process.exit(1);
  }
})();
