// 1. Safe ArrayBuffer <-> Base64 Converters (Prevents UTF-8 Byte Corruption)
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = window.atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export function getSubtleCrypto(): SubtleCrypto {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    return window.crypto.subtle;
  }
  throw new Error('Web Cryptography requires a secure HTTPS connection. Please open the HTTPS link on your phone.');
}

// 2. RSA-OAEP Key Pair Generation & PEM Export/Import
export async function generateE2EEKeyPair(): Promise<{ publicKeyPem: string; privateKey: CryptoKey }> {
  const subtle = getSubtleCrypto();
  const keyPair = await subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );

  const exportedPublic = await subtle.exportKey("spki", keyPair.publicKey);
  const publicKeyPem = arrayBufferToBase64(exportedPublic);

  return { publicKeyPem, privateKey: keyPair.privateKey };
}

export async function importPublicKey(pemString: string): Promise<CryptoKey> {
  const subtle = getSubtleCrypto();
  const binaryDer = base64ToArrayBuffer(pemString);
  return subtle.importKey(
    "spki",
    binaryDer,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["encrypt"]
  );
}

// 3. Encrypt & Decrypt Core Wrappers
export async function encryptText(plainText: string, recipientPublicKeyPem: string): Promise<string> {
  const subtle = getSubtleCrypto();
  const publicKey = await importPublicKey(recipientPublicKeyPem);
  const encoder = new TextEncoder();
  const aesKey = await subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encryptedPayload = await subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    encoder.encode(plainText)
  );

  const rawKey = await subtle.exportKey('raw', aesKey);
  const encryptedKey = await subtle.encrypt(
    { name: 'RSA-OAEP' },
    publicKey,
    rawKey
  );

  const envelope = {
    v: 2,
    e2ee: true,
    iv: arrayBufferToBase64(iv.buffer),
    key: arrayBufferToBase64(encryptedKey),
    data: arrayBufferToBase64(encryptedPayload)
  };

  return JSON.stringify(envelope);
}

export async function encryptGroupMessagePayload(plainText: string, recipientKeys: Record<string, string>): Promise<string> {
    const subtle = getSubtleCrypto();
    const aesKey = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const data = await subtle.encrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      new TextEncoder().encode(plainText)
    );

    const rawKey = await subtle.exportKey('raw', aesKey);
    const wrappedKeys: Record<string, string> = {};
    for (const [userId, pubKeyPem] of Object.entries(recipientKeys)) {
      if (!pubKeyPem) continue;
      try {
        const publicKey = await importPublicKey(pubKeyPem);
        const wrapped = await subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, rawKey);
        wrappedKeys[userId] = arrayBufferToBase64(wrapped);
      } catch (err) {
        console.warn(`Could not wrap group key for recipient ${userId}:`, err);
      }
    }

    return JSON.stringify({
      v: 3,
      e2ee: true,
      iv: arrayBufferToBase64(iv.buffer),
      keys: wrappedKeys,
      data: arrayBufferToBase64(data)
    });
}

export async function rewrapGroupPayloadForTarget(
  envelopeStr: string,
  sourcePrivateKey: CryptoKey,
  userIdOrTargetPubKey: string,
  targetPublicKeyPem?: string
): Promise<string> {
  const subtle = getSubtleCrypto();
  const envelope = JSON.parse(envelopeStr);
  if (!envelope) throw new Error('Invalid envelope structure for rewrapping');

  let keyToDecrypt: string | undefined;
  let targetPub: string;

  if (targetPublicKeyPem) {
    const userId = userIdOrTargetPubKey;
    targetPub = targetPublicKeyPem;
    if (envelope.keys && envelope.keys[userId]) {
      keyToDecrypt = envelope.keys[userId];
    } else if (envelope.key) {
      keyToDecrypt = envelope.key;
    }
  } else {
    targetPub = userIdOrTargetPubKey;
    keyToDecrypt = envelope.key;
  }

  if (!keyToDecrypt) throw new Error('No envelope key found to rewrap');

  const rawKey = await subtle.decrypt(
    { name: 'RSA-OAEP' },
    sourcePrivateKey,
    base64ToArrayBuffer(keyToDecrypt)
  );

  const targetPublicKey = await importPublicKey(targetPub);
  const wrappedTargetKey = await subtle.encrypt({ name: 'RSA-OAEP' }, targetPublicKey, rawKey);

  return arrayBufferToBase64(wrappedTargetKey);
}

export async function decryptText(base64Cipher: string, privateKey: CryptoKey, userId?: string): Promise<string> {
  const subtle = getSubtleCrypto();
  try {
    const envelope = JSON.parse(base64Cipher);
    if (envelope.v === 2 && envelope.key && envelope.data && envelope.iv) {
      try {
        const rawKey = await subtle.decrypt(
          { name: 'RSA-OAEP' },
          privateKey,
          base64ToArrayBuffer(envelope.key)
        );
        const aesKey = await subtle.importKey(
          'raw',
          rawKey,
          { name: 'AES-GCM' },
          false,
          ['decrypt']
        );
        const decrypted = await subtle.decrypt(
          { name: 'AES-GCM', iv: base64ToArrayBuffer(envelope.iv) },
          aesKey,
          base64ToArrayBuffer(envelope.data)
        );
        return new TextDecoder().decode(decrypted);
      } catch (err) {
        throw new Error('E2EE Decryption Failed: RSA/AES mismatch');
      }
    } else if ((envelope.v === 3 || envelope.keys) && envelope.data && envelope.iv) {
      const cleanUserId = userId ? String(userId).trim() : '';
      let wrappedKey = cleanUserId && envelope.keys ? envelope.keys[cleanUserId] : undefined;
      if (!wrappedKey && envelope.keys) {
        const matched = Object.entries(envelope.keys).find(([k]) => String(k).trim() === cleanUserId);
        if (matched) wrappedKey = matched[1] as string;
      }
      if (wrappedKey) {
        const rawKey = await subtle.decrypt({ name: 'RSA-OAEP' }, privateKey, base64ToArrayBuffer(wrappedKey));
        const aesKey = await subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['decrypt']);
        const decrypted = await subtle.decrypt(
          { name: 'AES-GCM', iv: base64ToArrayBuffer(envelope.iv) },
          aesKey,
          base64ToArrayBuffer(envelope.data)
        );
        return new TextDecoder().decode(decrypted);
      } else {
        throw new Error('This encrypted message does not include a key for your user account.');
      }
    }
  } catch (e: any) {
    if (e?.message?.includes('does not include a key') || e?.message?.includes('RSA/AES mismatch')) {
      throw e;
    }
    // Fall back to v1 direct asymmetric RSA-OAEP
  }

  const binaryDer = base64ToArrayBuffer(base64Cipher);
  const decryptedBuffer = await subtle.decrypt(
    { name: "RSA-OAEP" },
    privateKey,
    binaryDer
  );

  return new TextDecoder().decode(decryptedBuffer);
}

export async function encryptMessagePayload(
  plainText: string,
  senderOrRecipientKey: string,
  recipientPubKey?: string
): Promise<any> {
  if (recipientPubKey) {
    const recipientCipher = await encryptText(plainText, recipientPubKey);
    const senderCipher = await encryptText(plainText, senderOrRecipientKey);
    return {
      ciphertextForRecipient: recipientCipher,
      ciphertextForSender: senderCipher
    };
  }
  return encryptText(plainText, senderOrRecipientKey);
}

export const rewrapGroupMessageKeyForRecipient = rewrapGroupPayloadForTarget;

// 4. Client-Side Key Escrow (PBKDF2 + AES-GCM)
export async function deriveKeyFromPassword(password: string, saltString: string): Promise<CryptoKey> {
  const subtle = getSubtleCrypto();
  const encoder = new TextEncoder();
  const keyMaterial = await subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  
  return subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(saltString),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptPrivateKey(privateKey: CryptoKey, aesKey: CryptoKey): Promise<string> {
  const subtle = getSubtleCrypto();
  const exported = await subtle.exportKey('pkcs8', privateKey);
  
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    exported
  );
  
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  return arrayBufferToBase64(combined.buffer);
}

export async function decryptPrivateKey(encryptedBase64: string, aesKey: CryptoKey): Promise<CryptoKey> {
  const subtle = getSubtleCrypto();
  const combined = new Uint8Array(base64ToArrayBuffer(encryptedBase64));
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  
  const decrypted = await subtle.decrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    data
  );
  
  return subtle.importKey(
    'pkcs8',
    decrypted,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    true,
    ['decrypt']
  );
}
