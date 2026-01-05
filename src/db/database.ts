/**
 * IndexedDB Database initialization and management
 */

import { DB_NAME, DB_VERSION, STORE_NAMES } from './schema.js';

let dbInstance: IDBDatabase | null = null;
let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Create the database schema
 */
function createSchema(db: IDBDatabase): void {
  // Profiles store
  const profileStore = db.createObjectStore(STORE_NAMES.PROFILES, { keyPath: 'did' });
  profileStore.createIndex('by-handle', 'handle', { unique: false });
  profileStore.createIndex('by-follows-you', 'followsYou', { unique: false });
  profileStore.createIndex('by-you-follow', 'youFollow', { unique: false });
  profileStore.createIndex('by-mutual', 'isMutual', { unique: false });

  // Posts store
  const postStore = db.createObjectStore(STORE_NAMES.POSTS, { keyPath: 'uri' });
  postStore.createIndex('by-author', 'authorDid', { unique: false });
  postStore.createIndex('by-created', 'createdAt', { unique: false });
  postStore.createIndex('by-type', 'postType', { unique: false });
  postStore.createIndex('by-author-created', ['authorDid', 'createdAt'], { unique: false });
  postStore.createIndex('by-fetched', 'fetchedAt', { unique: false });

  // Interactions store (your interactions with others' posts)
  const interactionStore = db.createObjectStore(STORE_NAMES.INTERACTIONS, { keyPath: 'id' });
  interactionStore.createIndex('by-type', 'type', { unique: false });
  interactionStore.createIndex('by-target-author', 'targetAuthorDid', { unique: false });
  interactionStore.createIndex('by-created', 'createdAt', { unique: false });

  // Engagements store (others' engagement with your posts)
  const engagementStore = db.createObjectStore(STORE_NAMES.ENGAGEMENTS, { keyPath: 'id' });
  engagementStore.createIndex('by-type', 'type', { unique: false });
  engagementStore.createIndex('by-from', 'fromDid', { unique: false });
  engagementStore.createIndex('by-created', 'createdAt', { unique: false });

  // Sync state store
  db.createObjectStore(STORE_NAMES.SYNC_STATE, { keyPath: 'key' });

  // Cached analytics store
  db.createObjectStore(STORE_NAMES.CACHED_ANALYTICS, { keyPath: 'id' });
}

/**
 * Open or get the database connection
 */
export function openDatabase(): Promise<IDBDatabase> {
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      dbPromise = null;
      reject(new Error(`Failed to open database: ${request.error?.message}`));
    };

    request.onsuccess = () => {
      dbInstance = request.result;

      // Handle database connection closing unexpectedly
      dbInstance.onclose = () => {
        dbInstance = null;
        dbPromise = null;
      };

      dbInstance.onerror = (event) => {
        console.error('[Universe] Database error:', event);
      };

      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      createSchema(db);
    };
  });

  return dbPromise;
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    dbPromise = null;
  }
}

/**
 * Delete the entire database
 */
export function deleteDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    closeDatabase();

    const request = indexedDB.deleteDatabase(DB_NAME);

    request.onerror = () => {
      reject(new Error(`Failed to delete database: ${request.error?.message}`));
    };

    request.onsuccess = () => {
      resolve();
    };
  });
}

/**
 * Generic get by key
 */
export async function getByKey<T>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(key);

    request.onerror = () => reject(new Error(`Failed to get: ${request.error?.message}`));
    request.onsuccess = () => resolve(request.result as T | undefined);
  });
}

/**
 * Generic put (insert or update)
 */
export async function put<T>(storeName: string, item: T): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(item);

    request.onerror = () => reject(new Error(`Failed to put: ${request.error?.message}`));
    request.onsuccess = () => resolve();
  });
}

/**
 * Generic batch put
 */
export async function putBatch<T>(storeName: string, items: T[]): Promise<void> {
  if (items.length === 0) return;

  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);

    let completed = 0;
    let hasError = false;

    for (const item of items) {
      const request = store.put(item);

      request.onerror = () => {
        if (!hasError) {
          hasError = true;
          reject(new Error(`Failed to put batch: ${request.error?.message}`));
        }
      };

      request.onsuccess = () => {
        completed++;
        if (completed === items.length && !hasError) {
          resolve();
        }
      };
    }
  });
}

/**
 * Generic delete by key
 */
export async function deleteByKey(storeName: string, key: IDBValidKey): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(key);

    request.onerror = () => reject(new Error(`Failed to delete: ${request.error?.message}`));
    request.onsuccess = () => resolve();
  });
}

/**
 * Get all items from a store
 */
export async function getAll<T>(storeName: string): Promise<T[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onerror = () => reject(new Error(`Failed to getAll: ${request.error?.message}`));
    request.onsuccess = () => resolve(request.result as T[]);
  });
}

/**
 * Get items by index value
 */
export async function getByIndex<T>(
  storeName: string,
  indexName: string,
  value: IDBValidKey
): Promise<T[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const index = store.index(indexName);
    const request = index.getAll(value);

    request.onerror = () => reject(new Error(`Failed to getByIndex: ${request.error?.message}`));
    request.onsuccess = () => resolve(request.result as T[]);
  });
}

/**
 * Get items by index range
 */
export async function getByIndexRange<T>(
  storeName: string,
  indexName: string,
  range: IDBKeyRange
): Promise<T[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const index = store.index(indexName);
    const request = index.getAll(range);

    request.onerror = () =>
      reject(new Error(`Failed to getByIndexRange: ${request.error?.message}`));
    request.onsuccess = () => resolve(request.result as T[]);
  });
}

/**
 * Count items in a store
 */
export async function count(storeName: string): Promise<number> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.count();

    request.onerror = () => reject(new Error(`Failed to count: ${request.error?.message}`));
    request.onsuccess = () => resolve(request.result);
  });
}

/**
 * Clear all items from a store
 */
export async function clearStore(storeName: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.clear();

    request.onerror = () => reject(new Error(`Failed to clear: ${request.error?.message}`));
    request.onsuccess = () => resolve();
  });
}

/**
 * Delete items older than a given timestamp by index
 */
export async function deleteOlderThan(
  storeName: string,
  indexName: string,
  timestamp: number
): Promise<number> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const index = store.index(indexName);
    const range = IDBKeyRange.upperBound(timestamp, true);
    const request = index.openCursor(range);

    let deletedCount = 0;

    request.onerror = () =>
      reject(new Error(`Failed to deleteOlderThan: ${request.error?.message}`));

    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        cursor.delete();
        deletedCount++;
        cursor.continue();
      } else {
        resolve(deletedCount);
      }
    };
  });
}
