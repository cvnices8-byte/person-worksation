const DB_NAME = "personal-workstation";
const DB_VERSION = 1;
const STORES = ["tasks", "sessions", "papers", "health", "settings"];

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      for (const store of STORES) {
        if (!database.objectStoreNames.contains(store)) {
          database.createObjectStore(store, { keyPath: "id" });
        }
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(storeName, mode, action) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const request = action(store);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
}

export const db = {
  getAll(storeName) {
    return withStore(storeName, "readonly", (store) => store.getAll());
  },

  get(storeName, id) {
    return withStore(storeName, "readonly", (store) => store.get(id));
  },

  put(storeName, value) {
    return withStore(storeName, "readwrite", (store) => store.put(value));
  },

  delete(storeName, id) {
    return withStore(storeName, "readwrite", (store) => store.delete(id));
  },

  clear(storeName) {
    return withStore(storeName, "readwrite", (store) => store.clear());
  },

  async exportAll() {
    const snapshot = {};
    for (const store of STORES) snapshot[store] = await this.getAll(store);
    return snapshot;
  },

  async importAll(snapshot) {
    for (const store of STORES) {
      await this.clear(store);
      for (const item of snapshot[store] || []) await this.put(store, item);
    }
  },
};
