import { QuickPickItem } from 'vscode';

export const licensePlaceholder = 'Provide a license key.';
export const licenseAquire = 'Acquire license';
export const licenseSelect = 'Select / Enter a license';

export const licenseWorkflow = {
  prompt: 'After receiving the email with license, click continue to proceed.',
  option1: 'Continue',
  option2: 'Cancel',
};

export const licenseItems: QuickPickItem[] = [
  {
    label: licenseSelect,
    detail: 'Select if you have already registered and have a license key.',
  },
  {
    label: licenseAquire,
    detail: 'Select if you are new or need to register for a new license key.',
  },
];

export const licenseTypePlaceholder = 'Select an option for license';
export const licenseString = 'Paste license string (base64 string from email)';
export const licenseFile = 'Select license file';

export const licenseTypes: QuickPickItem[] = [
  {
    label: licenseString,
    detail: 'Paste in the base64 encoded license string from the email ',
  },
  {
    label: licenseFile,
    detail: 'Select a file saved with the license',
  },
];

export const licenseStringInput = {
  prompt: 'Paste the base64 encoded license string',
  placeholder: 'encoded license',
};

export const licenseFileInput = {
  canSelectFiles: true,
  canSelectFolders: false,
  canSelectMany: false,
  openLabel: 'Select a license file',
};
