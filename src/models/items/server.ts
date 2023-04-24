import { QuickPickItem } from 'vscode';

export const serverEndpointPlaceHolder = 'Select the KDB type';
export const kdbEndpoint = 'Enter a KDB endpoint';
export const kxInsightsEndpoint = 'Create or Connect to KX Insights on Azure';

export const serverEndpoints: QuickPickItem[] = [
  {
    label: kdbEndpoint,
    detail: 'Enter the url, ip address, and port to connect to a KDB instance',
  },
  {
    label: kxInsightsEndpoint,
    detail: 'Either provide an existing Azure instance or create a new one',
  },
];

export const connectionAliasInput = {
  prompt: 'Enter a name/alias for the connection',
  placeholder: 'server name / alias',
};

export const connectionHostnameInput = {
  prompt: 'Enter the hostname or ip address of the KDB server',
  placeholder: '0.0.0.0',
};

export const connectionPortInput = {
  prompt: 'Enter the port number of the KDB server',
  placeholder: '5001',
};

export const connectionUsernameInput = {
  prompt: 'Enter username to authenticate with (optional)',
  placeholder: 'username',
};

export const connectionPasswordInput = {
  prompt: 'Enter password to authenticate with (optional)',
  placeholder: 'password',
};
