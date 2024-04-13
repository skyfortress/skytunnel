export {};
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      [key: string]: string | undefined;
      SSH_SERVER_PORT: string;
      SSH_HOST_KEY: string;
      // add more environment variables and their types here
    }
  }
}
