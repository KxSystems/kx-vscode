export interface ServerDetails {
  serverName: string;
  serverPort: string;
  auth: boolean;
  serverAlias: string | undefined;
  managed: boolean;
}

export interface Server {
  [name: string]: ServerDetails;
}
