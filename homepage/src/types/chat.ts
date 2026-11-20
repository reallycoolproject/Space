import type { CallMessageMeta } from '../calls/types'

export interface Reaction {
  emoji: string
  userId: string
  username: string
}

export interface Message {
  id: string
  roomId?: string
  senderId: string
  senderName: string
  content: string
  timestamp: Date
  clientMsgId?: string
  replyTo?: string
  reactions?: Reaction[]
  mentions?: string[]
  edited?: boolean
  editedAt?: Date
  deliveredTo?: string[]
  readBy?: string[]
  isSystemMessage?: boolean
  systemType?: 'you-blocked' | 'blocked-you' | 'blocked-send' | 'blocked-send-own' | 'call'
  systemTargetUserId?: string
  callMeta?: CallMessageMeta
}

export interface UserBadge {
  id: string
  name: string
  description?: string
  icon: string
  awardedAt?: string | Date
  memberNumber?: number
}

export interface User {
  _id: string
  username: string
  email: string
  userId: string
  displayName?: string
  avatar?: string
  bio?: string
  pronouns?: string
  publicKey?: string
  encryptedPrivateKey?: string
  online?: boolean
  status?: 'active' | 'inactive' | 'dnd'
  note?: string
  badges?: UserBadge[]
  memberNumber?: number
}

export interface Space {
  id: string
  name: string
  members: string[]
}

export type ActiveContext = { type: 'dms' | 'space' | 'server' | 'request' | 'group'; id?: string; name?: string; channelId?: string }
