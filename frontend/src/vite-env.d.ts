/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_TEAM_ID?: string;
  readonly VITE_CURRENT_USER_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
