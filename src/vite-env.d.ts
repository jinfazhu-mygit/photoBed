/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEFAULT_OWNER?: string;
  readonly VITE_DEFAULT_REPO?: string;
  readonly VITE_DEFAULT_BRANCH?: string;
  readonly VITE_IMAGES_DIR?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
