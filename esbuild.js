const { build } = require("esbuild");
const fs = require("fs");
const path = require("path");
const glob = require("glob");

function copyFiles(srcPattern, destDir) {
  glob.sync(srcPattern).forEach((file) => {
    const destFile = path.join(destDir, path.basename(file));
    fs.copyFileSync(file, destFile);
  });
}

const minify = process.argv.includes("--minify");
const sourcemap = process.argv.includes("--sourcemap");
const keepNames = process.argv.includes("--keep-names");

const baseConfig = {
  minify,
  sourcemap,
  keepNames,
  bundle: true,
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
};

(async () => {
  try {
    await build(extensionConfig);
    console.log("extension build complete");
    await build(serverConfig);
    console.log("server build complete");
    await build(webviewConfig);
    copyFiles("src/webview/styles/*.css", "./out");
    console.log("build complete");
  } catch (err) {
    process.stderr.write(err.stderr);
    process.exit(1);
  }
})();
