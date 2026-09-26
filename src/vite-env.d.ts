/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_REALTIME_TRANSPORT: string
  readonly VITE_HOUSE_BUS_WS_URL: string
  readonly VITE_HOUSE_BUS_URL: string
  readonly VITE_HOUSE_BUS_TOKEN_URL: string
  readonly VITE_ABLY_API_KEY: string
  readonly VITE_API_BASE: string
  readonly VITE_API_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
