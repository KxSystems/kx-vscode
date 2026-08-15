/*
 * Copyright (c) 1998-2026 KX Systems Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the
 * License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations under the License.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import * as path from "node:path";

// Kept beside the sources rather than under out-test, which pretest wipes, so
// openssl only runs on the very first end to end run.
const certs = path.resolve(__dirname, "..", "..", "..", "test", "e2e", "certs");
const keyPath = path.join(certs, "key.pem");
const certPath = path.join(certs, "cert.pem");

/**
 * The certificate the stand-in Insights instance presents. It is self-signed on
 * purpose: an instance with a certificate no CA vouches for is exactly what the
 * connection's "insecure" flag exists for, so this is what proves the flag is
 * honored on every leg of the connection.
 */
export function selfSignedCert(): { key: string; cert: string } {
  if (!existsSync(keyPath) || !existsSync(certPath)) {
    mkdirSync(certs, { recursive: true });
    execFileSync("openssl", [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      keyPath,
      "-out",
      certPath,
      "-days",
      "365",
      "-subj",
      "/CN=localhost",
      "-addext",
      "subjectAltName=DNS:localhost,IP:127.0.0.1",
    ]);
  }

  return {
    key: readFileSync(keyPath, "utf8"),
    cert: readFileSync(certPath, "utf8"),
  };
}
