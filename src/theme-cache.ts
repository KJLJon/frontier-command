// Theme downloads have their own database; strategy saves are never touched.
export class ThemeAssetStore {
  private database?: Promise<IDBDatabase>;
  private open() {
    if (!this.database) {
      this.database = new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("frontier-theme-art", 1);
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
  async get(url: string): Promise<ArrayBuffer | undefined> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("assets", "readonly");
      const request = transaction.objectStore("assets").get(url);
      let bytes: ArrayBuffer | undefined;
      request.onsuccess = () => {
        bytes = request.result;
      };
      transaction.oncomplete = () => resolve(bytes);
      transaction.onabort = () =>
        reject(transaction.error ?? Error("Theme read failed"));
      transaction.onerror = () =>
        reject(transaction.error ?? Error("Theme read failed"));
    });
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
