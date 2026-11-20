import { randomUUID } from 'crypto';

export type CallKind = 'dm' | 'group';
export type CallMedia = 'audio' | 'video';
export type CallStatus = 'ringing' | 'active' | 'ended';
export type CallOutcome = 'missed' | 'declined' | 'completed' | 'canceled' | 'disconnected';
export type ParticipantConnection = 'connected' | 'reconnecting';

export interface CallParticipantState {
  muted: boolean;
  deafened: boolean;
  camera: boolean;
  screen: boolean;
}

export interface CallParticipant {
  userId: string;
  username: string;
  displayName?: string;
  avatar?: string;
  socketId: string;
  joinedAt: number;
  state: CallParticipantState;
  connection: ParticipantConnection;
  speaking: boolean;
}

export interface CallInvite {
  userId: string;
  username: string;
  displayName?: string;
  avatar?: string;
  invitedAt: number;
  declined?: boolean;
}

export interface CallSession {
  id: string;
  kind: CallKind;
  roomId: string;
  conversationName?: string;
  memberIds: string[];
  inviteeIds: string[];
  callerId: string;
  callerName: string;
  callerAvatar?: string;
  media: CallMedia;
  status: CallStatus;
  createdAt: number;
  startedAt?: number;
  endedAt?: number;
  participants: Map<string, CallParticipant>;
  invites: Map<string, CallInvite>;
  disconnectTimers: Map<string, ReturnType<typeof setTimeout>>;
  ringTimer?: ReturnType<typeof setTimeout>;
  busyUserIds: string[];
  endReason?: string;
  outcome?: CallOutcome;
  finalized?: boolean;
}

export interface VoiceParticipant {
  userId: string;
  username: string;
  displayName?: string;
  avatar?: string;
  socketId: string;
  joinedAt: number;
  state: CallParticipantState;
  connection: ParticipantConnection;
  speaking: boolean;
}

export interface VoiceRoom {
  spaceId: string;
  channelId: string;
  channelName?: string;
  participants: Map<string, VoiceParticipant>;
  disconnectTimers: Map<string, ReturnType<typeof setTimeout>>;
}

export const calls = new Map<string, CallSession>();
export const voiceRooms = new Map<string, VoiceRoom>();

export const voiceRoomKey = (spaceId: string, channelId: string) => `${spaceId}:${channelId}`;

export const createCallId = () => randomUUID();

export const getCall = (callId: string) => calls.get(callId);

export const getActiveCallForRoom = (roomId: string) => {
  for (const call of calls.values()) {
    if (call.roomId === roomId && call.status !== 'ended') return call;
  }
  return undefined;
};

export const getCallForUser = (userId: string, includeInvites = true) => {
  for (const call of calls.values()) {
    if (call.status === 'ended') continue;
    if (call.participants.has(userId)) return call;
    if (includeInvites && call.invites.has(userId)) return call;
  }
  return undefined;
};

export const getVoiceRoom = (spaceId: string, channelId: string) =>
  voiceRooms.get(voiceRoomKey(spaceId, channelId));

export const getVoiceRoomForUser = (userId: string) => {
  for (const room of voiceRooms.values()) {
    if (room.participants.has(userId)) return room;
  }
  return undefined;
};

export const getVoiceRoomsForSpace = (spaceId: string) =>
  [...voiceRooms.values()].filter(room => room.spaceId === spaceId);

export const isUserBusy = (userId: string) =>
  Boolean(getCallForUser(userId) || getVoiceRoomForUser(userId));

export const makeParticipant = (params: {
  userId: string;
  username: string;
  displayName?: string;
  avatar?: string;
  socketId: string;
  state?: Partial<CallParticipantState>;
}): CallParticipant => ({
  userId: params.userId,
  username: params.username,
  displayName: params.displayName,
  avatar: params.avatar,
  socketId: params.socketId,
  joinedAt: Date.now(),
  state: {
    muted: false,
    deafened: false,
    camera: false,
    screen: false,
    ...params.state
  },
  connection: 'connected',
  speaking: false
});

export const makeVoiceParticipant = (params: {
  userId: string;
  username: string;
  displayName?: string;
  avatar?: string;
  socketId: string;
  state?: Partial<CallParticipantState>;
}): VoiceParticipant => ({
  userId: params.userId,
  username: params.username,
  displayName: params.displayName,
  avatar: params.avatar,
  socketId: params.socketId,
  joinedAt: Date.now(),
  state: {
    muted: false,
    deafened: false,
    camera: false,
    screen: false,
    ...params.state
  },
  connection: 'connected',
  speaking: false
});

export const publicParticipant = (participant: CallParticipant | VoiceParticipant) => ({
  userId: participant.userId,
  username: participant.username,
  displayName: participant.displayName,
  avatar: participant.avatar,
  muted: participant.state.muted,
  deafened: participant.state.deafened,
  camera: participant.state.camera,
  screen: participant.state.screen,
  speaking: participant.speaking,
  connection: participant.connection,
  joinedAt: participant.joinedAt
});

export const publicCall = (call: CallSession) => ({
  id: call.id,
  kind: call.kind,
  roomId: call.roomId,
  conversationName: call.conversationName,
  memberIds: call.memberIds,
  inviteeIds: call.inviteeIds,
  callerId: call.callerId,
  callerName: call.callerName,
  callerAvatar: call.callerAvatar,
  media: call.media,
  status: call.status,
  createdAt: call.createdAt,
  startedAt: call.startedAt,
  endedAt: call.endedAt,
  participants: [...call.participants.values()].map(publicParticipant),
  invitedUserIds: [...call.invites.keys()],
  busyUserIds: call.busyUserIds,
  endReason: call.endReason,
  outcome: call.outcome
});

export const publicVoiceRoom = (room: VoiceRoom) => ({
  spaceId: room.spaceId,
  channelId: room.channelId,
  channelName: room.channelName,
  participants: [...room.participants.values()].map(publicParticipant)
});

export const clearCallTimers = (call: CallSession) => {
  if (call.ringTimer) {
    clearTimeout(call.ringTimer);
    call.ringTimer = undefined;
  }
  for (const timer of call.disconnectTimers.values()) clearTimeout(timer);
  call.disconnectTimers.clear();
};

export const clearVoiceTimers = (room: VoiceRoom) => {
  for (const timer of room.disconnectTimers.values()) clearTimeout(timer);
  room.disconnectTimers.clear();
};

export const deleteCall = (call: CallSession) => {
  clearCallTimers(call);
  calls.delete(call.id);
};

export const deleteVoiceRoom = (room: VoiceRoom) => {
  clearVoiceTimers(room);
  voiceRooms.delete(voiceRoomKey(room.spaceId, room.channelId));
};
