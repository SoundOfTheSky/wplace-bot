export type IDBSchema = Record<string, unknown>

/**
 * Minimal promise-based IndexedDB wrapper with typed stores.
 *
 * type Schema = {
 *   items: { id: number; name: string }
 *   users: { id: string; email: string }
 * }
 *
 * const db = await IDB.open<Schema>("myDb", 1, (db) => {
 *   db.createObjectStore("items", { keyPath: "id" })
 *   db.createObjectStore("users", { keyPath: "id" })
 * })
 */
export class IDB<Schema extends IDBSchema = IDBSchema> {
  private constructor(private db: IDBDatabase) {}

  public static open<Schema extends IDBSchema = Record<string, unknown>>(
    name: string,
    version: number,
    onUpgrade: (
      db: IDBDatabase,
      oldVersion: number,
      newVersion: number | null,
    ) => void,
  ): Promise<IDB<Schema>> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(name, version)
      req.onupgradeneeded = (event) => {
        onUpgrade(req.result, event.oldVersion, event.newVersion)
      }
      req.onsuccess = () => {
        resolve(new IDB<Schema>(req.result))
      }
      req.onerror = () => {
        reject(req.error ?? new Error('Unknown IDB error'))
      }
      req.onblocked = () => {
        reject(new Error(`IDB open blocked: ${name}`))
      }
    })
  }

  public static delete(name: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.deleteDatabase(name)
      req.onsuccess = () => {
        resolve()
      }
      req.onerror = () => {
        reject(req.error ?? new Error('Unknown IDB error'))
      }
      req.onblocked = () => {
        reject(new Error(`IDB delete blocked: ${name}`))
      }
    })
  }

  public get<K extends keyof Schema & string>(
    store: K,
    key: IDBValidKey,
  ): Promise<Schema[K] | undefined> {
    return this.wrap(this.t(store, 'readonly').get(key))
  }

  public getAll<K extends keyof Schema & string>(
    store: K,
    query?: IDBValidKey | IDBKeyRange,
  ): Promise<Schema[K][]> {
    return this.wrap(this.t(store, 'readonly').getAll(query)) as Promise<
      Schema[K][]
    >
  }

  public getAllKeys(store: keyof Schema & string): Promise<IDBValidKey[]> {
    return this.wrap(this.t(store, 'readonly').getAllKeys())
  }

  public put<K extends keyof Schema & string>(
    store: K,
    value: Schema[K],
    key?: IDBValidKey,
  ): Promise<IDBValidKey> {
    return this.wrap(this.t(store, 'readwrite').put(value, key))
  }

  public add<K extends keyof Schema & string>(
    store: K,
    value: Schema[K],
    key?: IDBValidKey,
  ): Promise<IDBValidKey> {
    return this.wrap(this.t(store, 'readwrite').add(value, key))
  }

  public delete(store: keyof Schema & string, key: IDBValidKey): Promise<void> {
    return this.wrap(this.t(store, 'readwrite').delete(key))
  }

  public clear(store: keyof Schema & string): Promise<void> {
    return this.wrap(this.t(store, 'readwrite').clear())
  }

  public count(store: keyof Schema & string): Promise<number> {
    return this.wrap(this.t(store, 'readonly').count())
  }

  public close(): void {
    this.db.close()
  }

  private t(store: string, mode: IDBTransactionMode) {
    return this.db.transaction(store, mode).objectStore(store)
  }

  private wrap<T>(req: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => {
        resolve(req.result)
      }

      req.onerror = () => {
        reject(req.error ?? new Error('Unknown IDB error'))
      }
    })
  }
}
