import { context, build } from "esbuild";
import { copyFileSync, mkdirSync } from "fs";
import { sync } from "glob";
import { join, basename } from "path";

function copyFiles(srcPattern, destDir) {
  sync(srcPattern).forEach((file) => {
    const destFile = join(destDir, basename(file));
    copyFileSync(file, destFile);
  });
}

const minify = process.argv.includes("--minify");
const sourcemap = process.argv.includes("--sourcemap");
const keepNames = process.argv.includes("--keep-names");
const watch = process.argv.includes("--watch");

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
    mkdirSync("./out", { recursive: true });
    copyFiles("src/webview/styles/*.css", "./out");

    if (watch) {
      console.log("esbuild:started");
      const contexts = await Promise.all([
        context(serverConfig),
        context(webviewConfig),
        context(extensionConfig),
      ]);
      await Promise.all(contexts.map((ctx) => ctx.rebuild())).finally(() =>
        Promise.all(contexts.map((ctx) => ctx.watch({ delay: 500 })))
          .then(() => console.log("esbuild:watching"))
          .catch((err) => {
            console.error(err);
            process.exit(1);
          }),
      );
    } else {
      await build(serverConfig);
      await build(webviewConfig);
      await build(extensionConfig);
    }
  } catch (err) {
    console.error(err);
  }
})();
