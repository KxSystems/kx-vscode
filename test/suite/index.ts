import { glob } from "glob";
import * as Mocha from "mocha";
import * as NYC from "nyc";
import * as path from "path";

import * as baseConfig from "@istanbuljs/nyc-config-typescript";

async function setupCoverage() {
  const nyc = new NYC({
    ...baseConfig,
    cwd: path.join(__dirname, "..", "..", ".."),
    include: ["out/**/*.js"],
    exclude: ["**/test/**", ".vscode-test/**"],
    reporter: ["text", "html"],
    all: true,
    instrument: true,
    hookRequire: true,
    hookRunInContext: true,
    hookRunInThisContext: true,
  });

  await nyc.reset();
  await nyc.wrap();

  return nyc;
}

export async function run(): Promise<void> {
  // const nyc = process.env.COVERAGE ? setupCoverage() : null;
  const nyc = await setupCoverage();
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

  const mocha = new Mocha(options);
  const testsRoot = path.resolve(__dirname, "..");

  const files = await glob("**/**.test.js", { cwd: testsRoot });

  files.forEach((f) => mocha.addFile(path.resolve(testsRoot, f)));

  const failures: number = await new Promise((resolve) => mocha.run(resolve));

  if (nyc) {
    await nyc.writeCoverageFile();
    await nyc.report();
  }

  if (failures > 0) {
    throw new Error(`${failures} tests failed.`);
  }
}
