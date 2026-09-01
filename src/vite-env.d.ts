/// <reference types="vite/client" />

/**
 * Pezzi della File System Access API che `lib.dom` non dichiara ancora: il selettore di cartella
 * e le due chiamate sui permessi. Servono alla playlist di asset (`lib/assetFolder.ts`), che
 * tiene i file su disco invece di caricarli nel browser. Solo tipi, nessun polyfill: dove l'API
 * manca, `supportsAssetFolder()` restituisce false e la barra lo dice.
 */
interface FileSystemHandlePermissionDescriptor {
  mode?: 'read' | 'readwrite'
}

interface FileSystemHandle {
  queryPermission?(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>
  requestPermission?(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>
}

interface Window {
  showDirectoryPicker?(options?: {
    id?: string
    mode?: 'read' | 'readwrite'
    startIn?: string | FileSystemHandle
  }): Promise<FileSystemDirectoryHandle>
}
