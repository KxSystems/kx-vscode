import { glob } from "glob";
import * as Mocha from "mocha";
import * as NYC from "nyc";
import * as path from "path";

async function setupCoverage() {
  console.log("===NF dir", path.join(__dirname, "..", "..", ".."));

  const nyc = new NYC({
    cwd: path.join(__dirname, "..", "..", ".."),
    exclude: ["**/test/**", ".vscode-test/**"],
    reporter: ["text", "html"],
    all: true,
    instrument: true,
    hookRequire: true,
    hookRunInContext: true,
    hookRunInThisContext: true,
  });

  console.log("===NF nyc 1", nyc);

  nyc.reset();
  nyc.wrap();

  console.log("===NF nyc 2", nyc);

  return nyc;
}

export async function run(): Promise<void> {
  const nyc = process.env.COVERAGE ? setupCoverage() : null;
  // const nyc = await setupCoverage();
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

  console.log(
    "===NF mochaDir",
    path.resolve(__dirname, "..", "..", "test-results.xml")
  );

  const mocha = new Mocha(options);
  const testsRoot = path.resolve(__dirname, "..");

  const files = await glob("**/**.test.js", { cwd: testsRoot });

  files.forEach((f) => mocha.addFile(path.resolve(testsRoot, f)));

  try {
    await new Promise((resolve, reject) =>
      mocha.run((failures) =>
        failures
          ? reject(new Error(`${failures} tests failed`))
          : resolve(undefined)
      )
    );
  } catch (err) {
    console.error(err);
  } finally {
    // if (nyc) {
    //   nyc.writeCoverageFile();
    //   await nyc.report();
    // }
  }
}
