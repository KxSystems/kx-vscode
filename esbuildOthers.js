const { build } = require("esbuild");
const { copy } = require("esbuild-plugin-copy");

const baseConfig = {
  bundle: true,
  minify: process.env.NODE_ENV === "production",
  sourcemap: process.env.NODE_ENV !== "production",
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
  const args = process.argv.slice(2);
  try {
    // if (args.includes("--watch")) {
    //   // Build and watch extension and webview code
    //   console.log("[watch] build started");
    //   await build({
    //     ...serverConfig,
    //     ...watchConfig,
    //   });
    //   console.log("[server watch] build started");
    //   await build({
    //     ...webviewConfig,
    //     ...watchConfig,
    //   });
    //   console.log("[webview watch] build finished");
    // } else {
    // Build extension and webview code
    await build(serverConfig);
    console.log("server build complete");
    await build(webviewConfig);
    console.log("build complete");
    // }
  } catch (err) {
    process.stderr.write(err.stderr);
    process.exit(1);
  }
})();
