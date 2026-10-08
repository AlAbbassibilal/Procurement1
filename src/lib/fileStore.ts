// ---------------------------------------------------------------------------
// Binary file storage (IndexedDB) — PDFs are too large for localStorage.
// ---------------------------------------------------------------------------
const DB = 'rhs-platform-files', STORE = 'files'
function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1)
    r.onupgradeneeded = () => r.result.createObjectStore(STORE)
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error)
  })
}
export async function putFile(key: string, data: Uint8Array | ArrayBuffer | Blob): Promise<void> {
  const db = await open()
  await new Promise<void>((res, rej) => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(data instanceof Blob ? data : new Blob([data as BlobPart]), key); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error) })
  db.close()
}
export async function getFile(key: string): Promise<Uint8Array | null> {
  const db = await open()
  const blob = await new Promise<Blob | undefined>((res, rej) => { const tx = db.transaction(STORE, 'readonly'); const q = tx.objectStore(STORE).get(key); q.onsuccess = () => res(q.result as Blob | undefined); q.onerror = () => rej(q.error) })
  db.close()
  return blob ? new Uint8Array(await blob.arrayBuffer()) : null
}
export async function deleteFile(key: string): Promise<void> {
  const db = await open()
  await new Promise<void>((res, rej) => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).delete(key); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error) })
  db.close()
}
