import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { generateE2EEKeyPair, deriveKeyFromPassword, encryptPrivateKey, decryptPrivateKey } from '../utils/crypto'
import { getPrivateKeyFromDB, savePrivateKeyToDB } from '../utils/db'
import { API_BASE } from '../config'

interface User {
  _id: string
  userId: string
  username: string
  email: string
  provider: string
  displayName?: string
  avatar?: string
  bio?: string
  pronouns?: string
  status?: 'active' | 'inactive' | 'dnd'
  banner?: string
  themeGradient?: { color1?: string; color2?: string; angle?: number }
  hasCompletedOnboarding: boolean
  contacts?: string[]
  allowGroupAdds?: boolean
  groupAddExceptions?: string[]
  pendingRequests?: string[]
  publicKey?: string
  encryptedPrivateKey?: string
  keySalt?: string
  badges?: any[]
  memberNumber?: number
  connections?: any[]
  activity?: any
}

interface AuthContextType {
  user: User | null
  setUser: (user: any) => void
  token: string | null
  privateKey: CryptoKey | null
  isAuthenticated: boolean
  isLoading: boolean
  isPrivateKeyReady: boolean
  keyInitializationError: string | null
  login: (user: User, token: string, password?: string) => void
  logout: () => void
  verifyToken: () => Promise<void>
  retryKeyInitialization: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [privateKey, setPrivateKey] = useState<CryptoKey | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isPrivateKeyReady, setIsPrivateKeyReady] = useState(false)
  const [keyInitializationError, setKeyInitializationError] = useState<string | null>(null)


  const initCipher = async (userData: User, authToken: string, password?: string) => {
    setKeyInitializationError(null)
    try {
      // Add timeout guard for key operations
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Key initialization timeout')), 10000)
      );
      
      let key = await Promise.race([
        getPrivateKeyFromDB(userData.userId),
        timeoutPromise
      ]) as CryptoKey | null;
      
      let pubKeyPem = ''
      let newEncryptedPrivateKey = ''
      let newKeySalt = ''
      
      // If no local key in IndexedDB, attempt to restore escrowed key if available
      if (!key && userData.encryptedPrivateKey && userData.keySalt && password) {
        try {
          const aesKey = await Promise.race([
            deriveKeyFromPassword(password, userData.keySalt),
            timeoutPromise
          ]) as CryptoKey;
          key = await Promise.race([
            decryptPrivateKey(userData.encryptedPrivateKey, aesKey),
            timeoutPromise
          ]) as CryptoKey;
          if (key) {
            await savePrivateKeyToDB(userData.userId, key);
          }
        } catch (error) {
          console.warn('Failed to decrypt escrowed key, will generate a fresh pair:', error);
          key = null;
        }
      }

      // If still no key (new device, legacy account missing salt, failed decryption, or fresh login):
      // ALWAYS generate a fresh, secure keypair so the user is NEVER locked out!
      if (!key) {
        const pair = await Promise.race([
          generateE2EEKeyPair(),
          timeoutPromise
        ]) as { publicKeyPem: string; privateKey: CryptoKey };
        key = pair.privateKey
        pubKeyPem = pair.publicKeyPem
        await savePrivateKeyToDB(userData.userId, key)

        if (password) {
          const saltArray = window.crypto.getRandomValues(new Uint8Array(16));
          newKeySalt = Array.from(saltArray).map(b => b.toString(16).padStart(2, '0')).join('');
          
          const aesKey = await Promise.race([
            deriveKeyFromPassword(password, newKeySalt),
            timeoutPromise
          ]) as CryptoKey;
          newEncryptedPrivateKey = await Promise.race([
            encryptPrivateKey(key, aesKey),
            timeoutPromise
          ]) as string;
        }
      }
      
      setPrivateKey(key)

      // Only upload public key if the user had no public key on the server or we have a newly escrowed key
      const shouldUploadKey = (!userData.publicKey && pubKeyPem) || Boolean(newEncryptedPrivateKey);
      if (shouldUploadKey) {
        const response = await fetch(`${API_BASE}/api/auth/user/public-key`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`
          },
          body: JSON.stringify({
            publicKey: pubKeyPem || undefined,
            encryptedPrivateKey: newEncryptedPrivateKey || undefined,
            keySalt: newKeySalt || undefined
          })
        })
        const data = await response.json()
        if (response.ok && data.ok) {
          setUser({
            ...userData,
            publicKey: pubKeyPem || userData.publicKey,
            encryptedPrivateKey: newEncryptedPrivateKey || userData.encryptedPrivateKey,
            keySalt: newKeySalt || userData.keySalt
          })
        }
      }
      setIsPrivateKeyReady(true)
      setKeyInitializationError(null)
    } catch (err) {
      console.error('Failed to init cipher', err)
      setIsPrivateKeyReady(false)
      setKeyInitializationError(err instanceof Error ? err.message : 'Secure key setup failed.')
    }
  }

  const retryKeyInitialization = async () => {
    if (!user || !token) return
    setIsPrivateKeyReady(false)
    await initCipher(user, token)
  }

  const login = async (userData: User, authToken: string, password?: string) => {
    setUser(userData)
    setToken(authToken)
    localStorage.setItem('token', authToken)
    await initCipher(userData, authToken, password)
    setIsAuthenticated(true)
    // Set Frutiger theme as default on login
    document.documentElement.setAttribute('data-theme', localStorage.getItem('theme') || 'frutiger-metro')
  }

  const logout = () => {
    setUser(null)
    setToken(null)
    setPrivateKey(null)
    setIsAuthenticated(false)
    setIsPrivateKeyReady(false)
    setKeyInitializationError(null)
    localStorage.removeItem('token')
  }

  const verifyToken = async () => {
    const storedToken = localStorage.getItem('token')
    if (storedToken) {
      try {
        const response = await fetch(`${API_BASE}/api/auth/verify-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: storedToken })
        })
        const data = await response.json()
        if (data.ok && data.user) {
          setUser(data.user)
          setToken(storedToken)
          await initCipher(data.user, storedToken)
          setIsAuthenticated(true)
          // Set Frutiger theme as default on token verification
          document.documentElement.setAttribute('data-theme', localStorage.getItem('theme') || 'frutiger-metro')
        } else {
          localStorage.removeItem('token')
        }
      } catch (error) {
        console.error('Token verification failed:', error)
        localStorage.removeItem('token')
      } finally {
        setIsLoading(false)
      }
    } else {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    verifyToken()
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        token,
        privateKey,
        isAuthenticated,
        isLoading,
        isPrivateKeyReady,
        keyInitializationError,
        login,
        logout,
        verifyToken,
        retryKeyInitialization
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
