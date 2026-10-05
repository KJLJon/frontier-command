import { THEME_DATABASE } from "./app-identity";

// Theme downloads have their own database; strategy saves are never touched.
export class ThemeAssetStore {
  private database?: Promise<IDBDatabase>;
  private legacyDatabase?: Promise<IDBDatabase | undefined>;
  private open() {
    if (!this.database) {
      this.database = new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(THEME_DATABASE, 1);
        request.onupgradeneeded = () =>
          request.result.createObjectStore("assets");
        request.onerror = () =>
          reject(request.error ?? Error("Theme storage unavailable"));
        request.onsuccess = () => {
          const db = request.result;
          db.onversionchange = () => {
            db.close();
            this.database = undefined;
          };
          resolve(db);
        };
        request.onblocked = () => reject(Error("Theme storage busy"));
      });
      this.database.catch(() => {
        this.database = undefined;
      });
    }
    return this.database;
  }
  private legacy() {
    // Read only an existing old Frontier cache. Never create or write legacy storage.
    return (this.legacyDatabase ??= (async () => {
      if (!indexedDB.databases) return undefined;
      const databases = await indexedDB.databases();
      if (!databases.some((db) => db.name === "frontier-theme-art"))
        return undefined;
      return new Promise<IDBDatabase | undefined>((resolve) => {
        const request = indexedDB.open("frontier-theme-art");
        request.onupgradeneeded = () => request.transaction?.abort();
        request.onerror = request.onblocked = () => resolve(undefined);
        request.onsuccess = () => {
          if (!request.result.objectStoreNames.contains("assets")) {
            request.result.close();
            resolve(undefined);
          } else resolve(request.result);
        };
      });
    })().catch(() => undefined));
  }
  private read(db: IDBDatabase, url: string): Promise<ArrayBuffer | undefined> {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("assets", "readonly");
      const request = transaction.objectStore("assets").get(url);
      let bytes: ArrayBuffer | undefined;
      request.onsuccess = () => {
        bytes = request.result;
      };
      transaction.oncomplete = () => resolve(bytes);
      transaction.onabort = transaction.onerror = () =>
        reject(transaction.error ?? Error("Theme read failed"));
    });
  }
  async get(url: string): Promise<ArrayBuffer | undefined> {
    const parsed = new URL(url, location.href);
    if (
      parsed.origin !== location.origin ||
      !parsed.pathname.startsWith("/frontier-command/themes/")
    )
      return undefined;
    const bytes = await this.read(await this.open(), url);
    if (bytes !== undefined) return bytes;
    const old = await this.legacy();
    if (!old) return undefined;
    const legacy = await this.read(old, url);
    if (legacy !== undefined) await this.put(url, legacy);
    return legacy;
  }
  async put(url: string, bytes: ArrayBuffer): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("assets", "readwrite");
      transaction.objectStore("assets").put(bytes, url);
      transaction.oncomplete = () => resolve();
      transaction.onabort = () =>
        reject(transaction.error ?? Error("Theme write failed"));
      transaction.onerror = () =>
        reject(transaction.error ?? Error("Theme write failed"));
    });
  }
}
