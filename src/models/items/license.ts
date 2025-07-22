/*
 * Copyright (c) 1998-2025 KX Systems Inc.
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

import { QuickPickItem } from "vscode";

export const licensePlaceholder = "Provide a license key.";
export const licenseAquire = "Acquire license";
export const licenseSelect = "Select / Enter a license";

export const licenseWorkflow = {
  prompt: "After receiving the email with license, click continue to proceed.",
  option1: "Continue",
  option2: "Cancel",
};

export const licenseItems: QuickPickItem[] = [
  {
    label: licenseSelect,
    detail: "Select if you have already registered and have a license key.",
  },
  {
    label: licenseAquire,
    detail: "Select if you are new or need to register for a new license key.",
  },
];

export const licenseTypePlaceholder = "Select an option for license";
export const licenseString = "Paste license string (base64 string from email)";
export const licenseFile = "Select license file";

export const licenseTypes: QuickPickItem[] = [
  {
    label: licenseString,
    detail: "Paste in the base64 encoded license string from the email ",
  },
  {
    label: licenseFile,
    detail: "Select a file saved with the license",
  },
];

export const licenseStringInput = {
  prompt: "Paste the base64 encoded license string",
  placeholder: "encoded license",
};

export const licenseFileInput = {
  canSelectFiles: true,
  canSelectFolders: false,
  canSelectMany: false,
  openLabel: "Select a license file",
};
