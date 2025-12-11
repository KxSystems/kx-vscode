import { context, build } from "esbuild";
import { copyFileSync, mkdirSync } from "fs";
import { join, basename } from "path";
import { sync } from "glob";

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
      const ctxs = await Promise.all([
        context({
          ...serverConfig,
          plugins: [getProblemMatcherPlugin()],
        }),
        context({
          ...webviewConfig,
          plugins: [getProblemMatcherPlugin()],
        }),
        context({
          ...extensionConfig,
          plugins: [getProblemMatcherPlugin()],
        }),
      ]);
      ctxs.forEach((ctx) => ctx.watch({ delay: 500 }));
    } else {
      await build(serverConfig);
      await build(webviewConfig);
      await build(extensionConfig);
    }
  } catch (err) {
    console.log(err);
    process.exit(1);
  }
})();

function getProblemMatcherPlugin() {
  return {
    name: "custom-problem-matcher",
    setup(build) {
      build.onStart(() => {
        console.log("esbuild:started");
      });
      build.onEnd((result) => {
        result.errors.forEach(({ text, location }) => {
          console.error(
            `esbuild:${text}:${location.file}:${location.line}:${location.column}:`,
          );
        });
        console.log("esbuild:watching");
      });
    },
  };
}
