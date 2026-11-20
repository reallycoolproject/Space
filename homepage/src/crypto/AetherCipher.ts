export class AetherCipher {
  private privateKey: CryptoKey | null = null;
  private publicKey: CryptoKey | null = null;
  
  constructor() {}
  
  // Initialize from IndexedDB or generate new
  public async initialize(userId: string): Promise<string> {
    const keyName = `aether_private_key_${userId}`;
    const storedKeys = await this.loadKeysFromDB(keyName);
    
    if (storedKeys) {
      this.privateKey = storedKeys.privateKey;
      this.publicKey = storedKeys.publicKey;
    } else {
      const keys = await crypto.subtle.generateKey(
        {
          name: "RSA-OAEP",
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: "SHA-256",
        },
        true,
        ["encrypt", "decrypt"]
      );
      this.privateKey = keys.privateKey;
      this.publicKey = keys.publicKey;
      await this.saveKeysToDB(keyName, keys);
    }
    
    // Export public key to base64 SPKI
    const exported = await crypto.subtle.exportKey("spki", this.publicKey!);
    return this.arrayBufferToBase64(exported);
  }
  
  private async loadKeysFromDB(keyName: string): Promise<CryptoKeyPair | null> {
    return new Promise((resolve) => {
      const req = indexedDB.open('AetherDB', 1);
      req.onupgradeneeded = (e: any) => {
        e.target.result.createObjectStore('keys');
      };
      req.onsuccess = (e: any) => {
        const db = e.target.result;
        try {
          const tx = db.transaction('keys', 'readonly');
          const store = tx.objectStore('keys');
          const getReq = store.get(keyName);
          getReq.onsuccess = () => resolve(getReq.result || null);
          getReq.onerror = () => resolve(null);
        } catch (err) {
          resolve(null); // store might not exist if upgraded without creating
        }
      };
      req.onerror = () => resolve(null);
    });
  }
  
  private async saveKeysToDB(keyName: string, keys: CryptoKeyPair): Promise<void> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('AetherDB', 1);
      req.onupgradeneeded = (e: any) => {
        e.target.result.createObjectStore('keys');
      };
      req.onsuccess = (e: any) => {
        const db = e.target.result;
        const tx = db.transaction('keys', 'readwrite');
        const store = tx.objectStore('keys');
        const putReq = store.put(keys, keyName);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      };
    });
  }
  
  public async encrypt(plaintext: string, recipientPublicKeyBase64: string): Promise<string> {
    const pubKeyBuffer = this.base64ToArrayBuffer(recipientPublicKeyBase64);
    const recipientKey = await crypto.subtle.importKey(
      "spki",
      pubKeyBuffer,
      { name: "RSA-OAEP", hash: "SHA-256" },
      false,
      ["encrypt"]
    );
    
    const encoded = new TextEncoder().encode(plaintext);
    const ciphertext = await crypto.subtle.encrypt(
      { name: "RSA-OAEP" },
      recipientKey,
      encoded
    );
    
    return this.arrayBufferToBase64(ciphertext);
  }
  
  public async decrypt(ciphertextBase64: string): Promise<string> {
    if (!this.privateKey) throw new Error("Cipher not initialized");
    const ciphertextBuffer = this.base64ToArrayBuffer(ciphertextBase64);
    const decrypted = await crypto.subtle.decrypt(
      { name: "RSA-OAEP" },
      this.privateKey,
      ciphertextBuffer
    );
    return new TextDecoder().decode(decrypted);
  }
  
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
  
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}
