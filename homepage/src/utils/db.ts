import { arrayBufferToBase64, base64ToArrayBuffer, getSubtleCrypto } from './crypto';

const memorySentCache = new Map<string, string>();
const DB_NAME = 'AetherDB';
const DB_VERSION = 4; // Increment version so onupgradeneeded guarantees creation of all object stores

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not supported'));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('keys')) {
        db.createObjectStore('keys');
      }
      if (!db.objectStoreNames.contains('sent_messages')) {
        db.createObjectStore('sent_messages');
      }
    };
    request.onsuccess = (event: any) => {
      resolve(event.target.result);
    };
    request.onerror = (event: any) => {
      reject(event.target.error || new Error('Failed to open IndexedDB'));
    };
    request.onblocked = () => {
      console.warn('IndexedDB upgrade blocked by open connections');
    };
  });
}

export async function savePrivateKeyToDB(userId: string, privateKey: CryptoKey): Promise<void> {
  if (!userId || !privateKey) return;

  // 1. Save to LocalStorage and SessionStorage (Synchronous & resilient across browser refresh)
  try {
    const subtle = getSubtleCrypto();
    const exported = await subtle.exportKey('pkcs8', privateKey);
    const pkcs8Base64 = arrayBufferToBase64(exported);
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(`aether_e2ee_pkcs8_${userId}`, pkcs8Base64);
    }
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem(`aether_e2ee_pkcs8_${userId}`, pkcs8Base64);
    }
  } catch (err) {
    console.warn('Could not export private key to localStorage:', err);
  }

  // 2. Save to IndexedDB with automatic connection closing
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('keys', 'readwrite');
      const store = tx.objectStore('keys');
      store.put(privateKey, `aether_priv_key_${userId}`);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = (e) => {
        db.close();
        reject(e);
      };
      tx.onabort = () => {
        db.close();
        resolve();
      };
    });
  } catch (err) {
    console.warn('IndexedDB savePrivateKey error:', err);
  }
}

export async function getPrivateKeyFromDB(userId: string): Promise<CryptoKey | null> {
  if (!userId) return null;

  // 1. Fast path: Check localStorage or sessionStorage (Immediate, 0ms, unaffected by DB locks)
  try {
    const storedPkcs8 = (typeof window !== 'undefined' && window.localStorage?.getItem(`aether_e2ee_pkcs8_${userId}`)) ||
                        (typeof window !== 'undefined' && window.sessionStorage?.getItem(`aether_e2ee_pkcs8_${userId}`));
    if (storedPkcs8) {
      const subtle = getSubtleCrypto();
      const key = await subtle.importKey(
        'pkcs8',
        base64ToArrayBuffer(storedPkcs8),
        { name: 'RSA-OAEP', hash: 'SHA-256' },
        true,
        ['decrypt']
      );
      if (key) return key;
    }
  } catch (err) {
    console.warn('Failed to restore private key from localStorage:', err);
  }

  // 2. Secondary path: Check IndexedDB
  try {
    const db = await openDB();
    const key = await new Promise<CryptoKey | null>((resolve) => {
      try {
        const tx = db.transaction('keys', 'readonly');
        const store = tx.objectStore('keys');
        const getReq = store.get(`aether_priv_key_${userId}`);
        getReq.onsuccess = () => {
          const res = getReq.result || null;
          db.close();
          resolve(res);
        };
        getReq.onerror = () => {
          db.close();
          resolve(null);
        };
      } catch {
        db.close();
        resolve(null);
      }
    });

    if (key) {
      // Sync back to localStorage for next instant load
      try {
        const subtle = getSubtleCrypto();
        const exported = await subtle.exportKey('pkcs8', key);
        const pkcs8Base64 = arrayBufferToBase64(exported);
        window.localStorage?.setItem(`aether_e2ee_pkcs8_${userId}`, pkcs8Base64);
      } catch {}
      return key;
    }
  } catch (err) {
    console.warn('IndexedDB getPrivateKey error:', err);
  }

  return null;
}

export function cacheSentMessageMemory(id: string, plainText: string): void {
  if (id && plainText) {
    memorySentCache.set(id, plainText);
  }
}

export function getSentMessageMemory(id: string): string | null {
  if (!id) return null;
  return memorySentCache.get(id) || null;
}

export async function saveSentMessageToDB(userId: string, messageId: string, plainText: string): Promise<void> {
  if (!messageId || !plainText) return;
  memorySentCache.set(messageId, plainText);

  // Synchronous localStorage cache for zero-delay instant restores across reloads
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(`aether_msg_${userId}_${messageId}`, plainText);
    }
  } catch (e) {
    // LocalStorage quota may be reached in extreme cases
  }

  try {
    const db = await openDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction('sent_messages', 'readwrite');
      const store = tx.objectStore('sent_messages');
      store.put(plainText, `aether_sent_${userId}_${messageId}`);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); resolve(); };
      tx.onabort = () => { db.close(); resolve(); };
    });
  } catch {}
}

export async function getSentMessageFromDB(userId: string, messageId: string): Promise<string | null> {
  if (!messageId) return null;
  const mem = memorySentCache.get(messageId);
  if (mem) return mem;

  // Check localStorage first
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem(`aether_msg_${userId}_${messageId}`);
      if (stored) {
        memorySentCache.set(messageId, stored);
        return stored;
      }
    }
  } catch {}

  // Fallback to IndexedDB
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction('sent_messages', 'readonly');
      const store = tx.objectStore('sent_messages');
      const getReq = store.get(`aether_sent_${userId}_${messageId}`);
      getReq.onsuccess = () => {
        const val = getReq.result || null;
        db.close();
        if (val) memorySentCache.set(messageId, val);
        resolve(val);
      };
      getReq.onerror = () => {
        db.close();
        resolve(null);
      };
    });
  } catch {
    return null;
  }
}
