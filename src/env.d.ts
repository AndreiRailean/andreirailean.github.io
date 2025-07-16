import "../.astro/types.d.ts"
import "astro/client"

interface ImportMetaEnv {
  readonly PUBLIC_GA_TRACKING_ID: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare global {
  interface Window {
    gtag: (...args: any[]) => void // eslint-disable-line @typescript-eslint/no-explicit-any
  }
}
