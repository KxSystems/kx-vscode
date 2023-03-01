export interface ServerDetails {
  serverName: string;
  serverPort: string;
  auth: boolean;
  serverAlias: string | undefined;
}

export interface Server {
  [name: string]: ServerDetails;
}
