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
  plugins: [
    copy({
      resolveFrom: "cwd",
      assets: {
        from: ["node_modules/web-tree-sitter/tree-sitter.wasm"],
        to: ["./out"],
      },
    }),
  ],
};

const webviewConfig = {
  ...baseConfig,
  target: "es2020",
  format: "esm",
  entryPoints: ["./src/webview/main.ts"],
  outfile: "./out/webview.js",
  plugins: [
    copy({
      resolveFrom: "cwd",
      assets: {
        from: ["src/webview/styles/*.css"],
        to: ["./out"],
      },
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
