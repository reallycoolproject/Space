Space - MVP

Architecture:
- backend: Node.js + Express + TypeScript + Mongoose + socket.io
- client: Expo (React Native) + TypeScript + SecureStore + socket.io-client

Quick start

1) Backend

Set environment variables in `backend/.env` (or export in your shell):
- `MONGODB_URI` pointing to your MongoDB Atlas or local MongoDB
- `JWT_SECRET` a strong secret for signing tokens

Run:

```powershell
cd "F:\Space App\backend"
npm install
npm run dev
```

2) Client (Expo)

Run:

```powershell
cd "F:\Space App\client"
npm install
npm start
```

Notes
- The client stores the JWT securely using `expo-secure-store` under the key `space_token`.
- Socket.io connections are authenticated with the same JWT and will only connect when a valid token exists.
- The backend does not store plaintext passwords in the `User` schema; `AuthCredential` keeps password hashes.
 - Messaging: clients encrypt messages client-side (AES-GCM) where supported. The server stores only ciphertext blobs and IVs in the `Message` model and broadcasts ciphertexts via Socket.io. Decryption keys remain local to clients.
 - The client stores a generated AES key under `space_aes_key` in `expo-secure-store` (web uses Web Crypto storage). For secure production use, key management should be hardened and synced across user devices via secure key exchange.

Next steps you might want me to do:
- Wire up Google OAuth end-to-end (requires provider credentials and redirect URIs).
- Add integration tests for the auth routes.
- Persist a minimal user profile on the client and implement logout.
