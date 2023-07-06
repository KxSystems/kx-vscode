import { glob } from "glob";
import * as Mocha from "mocha";
import * as NYC from "nyc";
import * as path from "path";

import * as baseConfig from "@istanbuljs/nyc-config-typescript";
import "source-map-support/register";
import "ts-node/register";

export async function run(): Promise<void> {
  const options: Mocha.MochaOptions = {
    ui: "bdd",
    color: true,
    reporter: "mocha-multi-reporters",
    reporterOptions: {
      reporterEnabled: "spec, mocha-junit-reporter",
      mochaJunitReporterReporterOptions: {
        mochaFile: path.resolve(__dirname, "..", "..", "test-results.xml"),
      },
    },
  };

  const nyc = new NYC({
    ...baseConfig,
    cwd: path.join(__dirname, "..", "..", ".."),
    include: ["out/**/*.js"],
    exclude: ["out/test/**"],
    reporter: ["text-summary", "html"],
    all: true,
    silent: false,
    instrument: true,
    hookRequire: true,
    hookRunInContext: true,
    hookRunInThisContext: true,
  });

  await nyc.reset();
  await nyc.wrap();

  Object.keys(require.cache)
    .filter((f) => nyc.exclude.shouldInstrument(f))
    .forEach((m) => {
      console.warn("Module loaded before NYC, invalidating", m);
      delete require.cache[m];
      require(m);
    });

  const mocha = new Mocha(options);
  const testsRoot = path.resolve(__dirname, "..");

  const files = glob.sync("**/**.test.js", { cwd: testsRoot });

  files.forEach((f) => mocha.addFile(path.resolve(testsRoot, f)));

  const failures: number = await new Promise((resolve) => mocha.run(resolve));

  await nyc.writeCoverageFile();

  console.log(await captureStdout(nyc.report.bind(nyc)));

  if (failures > 0) {
    throw new Error(`${failures} tests failed.`);
  }
}

async function captureStdout(fn) {
  const w = process.stdout.write;
  let buffer = "";

  process.stdout.write = (s) => {
    buffer = buffer + s;
    return true;
  };

  await fn();
  process.stdout.write = w;
  return buffer;
}
