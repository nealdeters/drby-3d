/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ABLY_API_KEY: string
  readonly VITE_API_BASE: string
  readonly VITE_API_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
