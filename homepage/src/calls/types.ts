export type CallKind = 'dm' | 'group'
export type CallMedia = 'audio' | 'video'
export type CallStatus = 'ringing' | 'active' | 'ended'
export type CallOutcome = 'missed' | 'declined' | 'completed' | 'canceled' | 'disconnected'
export type ParticipantConnection = 'connected' | 'reconnecting'

export interface CallerProfile {
  userId: string
  username: string
  displayName?: string
  avatar?: string
}

export interface CallParticipant {
  userId: string
  username: string
  displayName?: string
  avatar?: string
  muted: boolean
  deafened: boolean
  camera: boolean
  screen: boolean
  speaking: boolean
  connection: ParticipantConnection
  joinedAt: number
}

export interface CallSession {
  id: string
  kind: CallKind
  roomId: string
  conversationName?: string
  memberIds: string[]
  inviteeIds: string[]
  callerId: string
  callerName: string
  callerAvatar?: string
  media: CallMedia
  status: CallStatus
  createdAt: number
  startedAt?: number
  endedAt?: number
  participants: CallParticipant[]
  invitedUserIds: string[]
  busyUserIds: string[]
  endReason?: string
  outcome?: CallOutcome
}

export interface IncomingCall {
  call: CallSession
  caller: CallerProfile
}

export interface VoiceRoom {
  spaceId: string
  channelId: string
  channelName?: string
  participants: CallParticipant[]
}

export interface CallMessageMeta {
  callId: string
  kind: CallKind
  media: CallMedia
  outcome: CallOutcome
  durationSeconds?: number
  callerId: string
  callerName: string
  callerAvatar?: string
  participantIds: string[]
  inviteeIds?: string[]
  startedAt?: string | Date
  endedAt?: string | Date
}

export interface DeviceOption {
  deviceId: string
  label: string
}

export interface MediaDeviceState {
  microphones: DeviceOption[]
  cameras: DeviceOption[]
  speakers: DeviceOption[]
}

export interface SelectedDevices {
  microphoneId: string
  cameraId: string
  speakerId: string
}
