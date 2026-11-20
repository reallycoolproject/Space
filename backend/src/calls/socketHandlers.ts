import type { Server, Socket } from 'socket.io';
import {
  calls,
  createCallId,
  deleteCall,
  deleteVoiceRoom,
  getActiveCallForRoom,
  getCall,
  getCallForUser,
  getVoiceRoom,
  getVoiceRoomForUser,
  getVoiceRoomsForSpace,
  isUserBusy,
  makeParticipant,
  makeVoiceParticipant,
  publicCall,
  publicParticipant,
  publicVoiceRoom,
  voiceRoomKey,
  voiceRooms,
  type CallMedia,
  type CallOutcome,
  type CallParticipant,
  type CallSession,
  type VoiceParticipant,
  type VoiceRoom
} from './callRegistry';
import {
  getConversationAccess,
  getSpaceVoiceAccess,
  getUserProfile,
  getUserProfiles,
  type CallerProfile
} from './access';
import { createCallOutcomeMessage, createCallStartedMessage } from './callMessages';

interface SocketUser {
  id: string;
  userId: string;
  username: string;
  role?: string;
}

const MAX_CALL_PARTICIPANTS = 12;
const MAX_VOICE_PARTICIPANTS = 20;
const DM_RING_TIMEOUT_MS = 45_000;
const GROUP_RING_TIMEOUT_MS = 60_000;
const CALL_RECONNECT_GRACE_MS = 20_000;
const VOICE_RECONNECT_GRACE_MS = 25_000;

const getUser = (socket: Socket): SocketUser | null => {
  const user = (socket as any).user as SocketUser | undefined;
  return user?.userId ? user : null;
};

const emitToUsers = (io: Server, userIds: Iterable<string>, event: string, payload: unknown) => {
  for (const userId of new Set(userIds)) {
    if (userId) io.to(userId).emit(event, payload);
  }
};

const callAudience = (call: CallSession) =>
  new Set<string>([...call.memberIds, ...call.inviteeIds, ...call.participants.keys(), ...call.invites.keys()]);

const notifyCall = (io: Server, call: CallSession, event = 'call:updated', extra: Record<string, unknown> = {}) => {
  emitToUsers(io, callAudience(call), event, { call: publicCall(call), ...extra });
};

const emitCallIncoming = (io: Server, call: CallSession, userId: string, invitedBy?: CallerProfile) => {
  io.to(userId).emit('call:incoming', {
    call: publicCall(call),
    caller: invitedBy || {
      userId: call.callerId,
      username: call.callerName,
      displayName: call.callerName,
      avatar: call.callerAvatar
    }
  });
};

const endCall = async (
  io: Server,
  call: CallSession,
  outcome: CallOutcome,
  reason?: string
) => {
  if (call.status === 'ended') return;
  call.status = 'ended';
  call.endedAt = Date.now();
  call.outcome = outcome;
  call.endReason = reason;
  if (call.ringTimer) {
    clearTimeout(call.ringTimer);
    call.ringTimer = undefined;
  }
  for (const timer of call.disconnectTimers.values()) clearTimeout(timer);
  call.disconnectTimers.clear();

  notifyCall(io, call, 'call:ended', { outcome, reason });
  await createCallOutcomeMessage(io, call, outcome);
  deleteCall(call);
};

const startRingTimer = (io: Server, call: CallSession) => {
  const timeout = call.kind === 'dm' ? DM_RING_TIMEOUT_MS : GROUP_RING_TIMEOUT_MS;
  call.ringTimer = setTimeout(() => {
    const current = getCall(call.id);
    if (!current || current.status === 'ended') return;
    if (current.participants.size >= 2) return;
    void endCall(io, current, 'missed', 'No one answered');
  }, timeout);
};

const updateParticipantState = (
  participant: CallParticipant | VoiceParticipant,
  data: Record<string, unknown>
) => {
  if (typeof data.muted === 'boolean') participant.state.muted = data.muted;
  if (typeof data.deafened === 'boolean') participant.state.deafened = data.deafened;
  if (typeof data.camera === 'boolean') participant.state.camera = data.camera;
  if (typeof data.screen === 'boolean') participant.state.screen = data.screen;
  if (typeof data.speaking === 'boolean') participant.speaking = data.speaking;
};

const joinCall = async (
  io: Server,
  call: CallSession,
  profile: CallerProfile,
  socketId: string
) => {
  const existing = call.participants.get(profile.userId);
  if (existing) {
    existing.socketId = socketId;
    existing.connection = 'connected';
    const timer = call.disconnectTimers.get(profile.userId);
    if (timer) {
      clearTimeout(timer);
      call.disconnectTimers.delete(profile.userId);
    }
    return existing;
  }

  const participant = makeParticipant({
    userId: profile.userId,
    username: profile.username,
    displayName: profile.displayName,
    avatar: profile.avatar,
    socketId
  });
  call.participants.set(profile.userId, participant);
  call.invites.delete(profile.userId);

  if (call.status === 'ringing' && call.participants.size >= 2) {
    call.status = 'active';
    call.startedAt = Date.now();
    if (call.ringTimer) {
      clearTimeout(call.ringTimer);
      call.ringTimer = undefined;
    }
  }
  return participant;
};

const removeCallParticipant = async (io: Server, call: CallSession, userId: string, reason: string) => {
  const participant = call.participants.get(userId);
  if (!participant) return;
  const timer = call.disconnectTimers.get(userId);
  if (timer) {
    clearTimeout(timer);
    call.disconnectTimers.delete(userId);
  }
  call.participants.delete(userId);

  if (call.kind === 'dm') {
    await endCall(io, call, call.startedAt ? 'completed' : 'canceled', reason);
    return;
  }

  notifyCall(io, call, 'call:participant-left', { userId, reason });
  if (call.participants.size === 0) {
    const outcome: CallOutcome = call.startedAt ? 'completed' : 'canceled';
    await endCall(io, call, outcome, reason);
    return;
  }
  notifyCall(io, call, 'call:updated');
};

const broadcastVoiceRoom = (io: Server, room: VoiceRoom, memberIds: string[]) => {
  emitToUsers(io, memberIds, 'voice:updated', publicVoiceRoom(room));
};

const broadcastVoiceRoomToSpace = async (io: Server, room: VoiceRoom) => {
  const access = await getSpaceVoiceAccess(
    room.participants.values().next().value?.userId || '',
    room.spaceId,
    room.channelId
  ).catch(() => null);
  if (access) {
    broadcastVoiceRoom(io, room, access.memberIds);
    return;
  }
  broadcastVoiceRoom(io, room, []);
};

const removeVoiceParticipant = async (
  io: Server,
  room: VoiceRoom,
  userId: string,
  reason: string,
  memberIds: string[] = []
) => {
  const participant = room.participants.get(userId);
  if (!participant) return;
  const timer = room.disconnectTimers.get(userId);
  if (timer) {
    clearTimeout(timer);
    room.disconnectTimers.delete(userId);
  }
  room.participants.delete(userId);
  io.to(`voice:${voiceRoomKey(room.spaceId, room.channelId)}`).emit('voice:participant-left', {
    spaceId: room.spaceId,
    channelId: room.channelId,
    userId,
    reason
  });
  io.in(userId).socketsLeave(`voice:${voiceRoomKey(room.spaceId, room.channelId)}`);
  if (room.participants.size === 0) {
    broadcastVoiceRoom(io, room, memberIds);
    deleteVoiceRoom(room);
    return;
  }
  broadcastVoiceRoom(io, room, memberIds);
};

const emitCallError = (socket: Socket, message: string, code = 'call_error') => {
  socket.emit('call:error', { message, code });
};

const emitVoiceError = (socket: Socket, message: string, code = 'voice_error') => {
  socket.emit('voice:error', { message, code });
};

const registerCallHandlers = (io: Server, socket: Socket, user: SocketUser) => {
  socket.on('call:start', async (data: { roomId?: string; media?: CallMedia; inviteUserIds?: string[] }) => {
    try {
      const roomId = typeof data?.roomId === 'string' ? data.roomId : '';
      const media: CallMedia = data?.media === 'video' ? 'video' : 'audio';
      if (!roomId) return emitCallError(socket, 'Choose a conversation to call.');

      const access = await getConversationAccess(user.userId, roomId);
      if (!access) return emitCallError(socket, 'You cannot start a call in this conversation.', 'forbidden');

      if (getVoiceRoomForUser(user.userId)) {
        return emitCallError(socket, 'Leave your voice channel before starting a call.', 'busy');
      }
      const currentCall = getCallForUser(user.userId);
      if (currentCall && currentCall.roomId !== roomId) {
        return emitCallError(socket, 'You are already in another call.', 'busy');
      }

      const profile = await getUserProfile(user.userId);
      const existing = getActiveCallForRoom(roomId);
      if (existing) {
        if (existing.participants.size >= MAX_CALL_PARTICIPANTS) {
          return emitCallError(socket, 'This call is full.');
        }
        const participant = await joinCall(io, existing, profile, socket.id);
        if (existing.status === 'active' && existing.startedAt) {
          // Call is already live; joining is instant.
        }
        notifyCall(io, existing, 'call:updated');
        socket.emit('call:joined', { call: publicCall(existing), self: publicParticipant(participant) });
        return;
      }

      if (isUserBusy(user.userId)) {
        return emitCallError(socket, 'You are already in a call or voice channel.', 'busy');
      }

      const requestedInvites = Array.isArray(data?.inviteUserIds)
        ? data.inviteUserIds.filter((id): id is string => typeof id === 'string')
        : [];
      const targets = access.kind === 'dm'
        ? access.memberIds.filter(id => id !== user.userId)
        : (requestedInvites.length
            ? requestedInvites.filter(id => access.memberIds.includes(id) && id !== user.userId)
            : access.memberIds.filter(id => id !== user.userId));

      const busyUserIds = targets.filter(targetId => isUserBusy(targetId));
      const ringableTargets = targets.filter(targetId => !busyUserIds.includes(targetId));

      if (access.kind === 'dm' && ringableTargets.length === 0) {
        return emitCallError(socket, 'That person is already in another call.', 'busy');
      }
      if (access.kind === 'group' && ringableTargets.length === 0) {
        return emitCallError(socket, 'Everyone in this group is already in another call.', 'busy');
      }

      const call: CallSession = {
        id: createCallId(),
        kind: access.kind,
        roomId,
        conversationName: access.name,
        memberIds: access.memberIds,
        inviteeIds: [...targets],
        callerId: user.userId,
        callerName: profile.displayName || profile.username,
        callerAvatar: profile.avatar,
        media,
        status: 'ringing',
        createdAt: Date.now(),
        participants: new Map(),
        invites: new Map(),
        disconnectTimers: new Map(),
        busyUserIds
      };

      const caller = makeParticipant({
        userId: profile.userId,
        username: profile.username,
        displayName: profile.displayName,
        avatar: profile.avatar,
        socketId: socket.id
      });
      call.participants.set(user.userId, caller);
      calls.set(call.id, call);

      const targetProfiles = await getUserProfiles(ringableTargets);
      for (const targetId of ringableTargets) {
        const target = targetProfiles.get(targetId);
        call.invites.set(targetId, {
          userId: targetId,
          username: target?.username || targetId,
          displayName: target?.displayName,
          avatar: target?.avatar,
          invitedAt: Date.now()
        });
      }

      startRingTimer(io, call);

      socket.emit('call:created', { call: publicCall(call), self: publicParticipant(caller) });
      for (const targetId of ringableTargets) {
        emitCallIncoming(io, call, targetId, profile);
      }
      if (busyUserIds.length) {
        socket.emit('call:busy-users', { callId: call.id, userIds: busyUserIds });
      }
      notifyCall(io, call, 'call:updated');
      void createCallStartedMessage(io, call);
    } catch (error) {
      console.error('call:start failed', error);
      emitCallError(socket, 'Could not start the call.');
    }
  });

  socket.on('call:accept', async (data: { callId?: string }) => {
    try {
      const call = getCall(typeof data?.callId === 'string' ? data.callId : '');
      if (!call || call.status === 'ended') return emitCallError(socket, 'This call is no longer available.', 'not_found');
      const invite = call.invites.get(user.userId);
      if (!invite && !call.participants.has(user.userId)) {
        return emitCallError(socket, 'You were not invited to this call.', 'forbidden');
      }
      const otherCall = [...calls.values()].find(item =>
        item.id !== call.id && item.status !== 'ended' && item.participants.has(user.userId)
      );
      if (otherCall) return emitCallError(socket, 'Leave your current call before joining this one.', 'busy');
      if (isUserBusy(user.userId) && !call.participants.has(user.userId)) {
        const current = getVoiceRoomForUser(user.userId);
        if (current) return emitCallError(socket, 'Leave your voice channel before joining this call.', 'busy');
      }
      if (call.participants.size >= MAX_CALL_PARTICIPANTS) {
        return emitCallError(socket, 'This call is full.', 'full');
      }

      const profile = await getUserProfile(user.userId);
      const participant = await joinCall(io, call, profile, socket.id);
      socket.emit('call:joined', { call: publicCall(call), self: publicParticipant(participant) });
      notifyCall(io, call, 'call:participant-joined', { userId: user.userId });
      notifyCall(io, call, 'call:updated');
    } catch (error) {
      console.error('call:accept failed', error);
      emitCallError(socket, 'Could not join the call.');
    }
  });

  socket.on('call:decline', async (data: { callId?: string }) => {
    try {
      const call = getCall(typeof data?.callId === 'string' ? data.callId : '');
      if (!call || call.status === 'ended') return;
      if (!call.invites.has(user.userId)) return;
      call.invites.delete(user.userId);
      notifyCall(io, call, 'call:invite-declined', { userId: user.userId });
      if (call.participants.size <= 1 && call.invites.size === 0) {
        await endCall(io, call, 'declined', 'Everyone declined');
      } else {
        notifyCall(io, call, 'call:updated');
      }
    } catch (error) {
      console.error('call:decline failed', error);
    }
  });

  socket.on('call:cancel', async (data: { callId?: string }) => {
    try {
      const call = getCall(typeof data?.callId === 'string' ? data.callId : '');
      if (!call || call.status === 'ended') return;
      if (call.callerId !== user.userId) return emitCallError(socket, 'Only the caller can cancel this call.', 'forbidden');
      await endCall(io, call, 'canceled', 'Caller canceled');
    } catch (error) {
      console.error('call:cancel failed', error);
    }
  });

  socket.on('call:end', async (data: { callId?: string }) => {
    try {
      const call = getCall(typeof data?.callId === 'string' ? data.callId : '');
      if (!call || call.status === 'ended') return;
      if (!call.participants.has(user.userId)) return;
      if (call.kind === 'dm') {
        await endCall(io, call, call.startedAt ? 'completed' : 'canceled', 'Call ended');
        return;
      }
      await removeCallParticipant(io, call, user.userId, 'left');
    } catch (error) {
      console.error('call:end failed', error);
    }
  });

  socket.on('call:invite', async (data: { callId?: string; userIds?: string[] }) => {
    try {
      const call = getCall(typeof data?.callId === 'string' ? data.callId : '');
      if (!call || call.status === 'ended') return emitCallError(socket, 'This call has ended.', 'not_found');
      if (call.kind !== 'group') return emitCallError(socket, 'Only group calls can invite more people.', 'not_supported');
      if (!call.participants.has(user.userId)) return emitCallError(socket, 'Join the call before inviting people.', 'forbidden');

      const access = await getConversationAccess(user.userId, call.roomId);
      if (!access) return emitCallError(socket, 'You cannot invite people to this call.', 'forbidden');
      const requested = Array.isArray(data?.userIds)
        ? data.userIds.filter((id): id is string => typeof id === 'string' && access.memberIds.includes(id))
        : [];
      const candidates = [...new Set(requested)].filter(id =>
        id !== user.userId && !call.participants.has(id) && !call.invites.has(id)
      );
      if (!candidates.length) return emitCallError(socket, 'Choose at least one group member to invite.');

      const profiles = await getUserProfiles(candidates);
      const inviter = await getUserProfile(user.userId);
      const invited: string[] = [];
      const busy: string[] = [];
      for (const candidate of candidates) {
        if (isUserBusy(candidate)) {
          busy.push(candidate);
          continue;
        }
        if (call.participants.size + call.invites.size >= MAX_CALL_PARTICIPANTS) {
          busy.push(candidate);
          continue;
        }
        call.invites.set(candidate, {
          userId: candidate,
          username: profiles.get(candidate)?.username || candidate,
          displayName: profiles.get(candidate)?.displayName,
          avatar: profiles.get(candidate)?.avatar,
          invitedAt: Date.now()
        });
        if (!call.inviteeIds.includes(candidate)) call.inviteeIds.push(candidate);
        invited.push(candidate);
      }

      for (const candidate of invited) emitCallIncoming(io, call, candidate, inviter);
      if (invited.length) notifyCall(io, call, 'call:updated');
      socket.emit('call:invited', { callId: call.id, userIds: invited, busyUserIds: busy });
      if (busy.length) socket.emit('call:busy-users', { callId: call.id, userIds: busy });
    } catch (error) {
      console.error('call:invite failed', error);
      emitCallError(socket, 'Could not invite those members.');
    }
  });

  socket.on('call:state', (data: { callId?: string; muted?: boolean; deafened?: boolean; camera?: boolean; screen?: boolean }) => {
    const call = getCall(typeof data?.callId === 'string' ? data.callId : '');
    if (!call || call.status === 'ended') return;
    const participant = call.participants.get(user.userId);
    if (!participant) return;
    updateParticipantState(participant, data as Record<string, unknown>);
    emitToUsers(io, callAudience(call), 'call:participant-updated', {
      callId: call.id,
      participant: publicParticipant(participant)
    });
  });

  socket.on('call:speaking', (data: { callId?: string; speaking?: boolean }) => {
    const call = getCall(typeof data?.callId === 'string' ? data.callId : '');
    if (!call || call.status === 'ended') return;
    const participant = call.participants.get(user.userId);
    if (!participant) return;
    participant.speaking = Boolean(data?.speaking);
    socket.to(call.roomId).emit('call:speaking', {
      callId: call.id,
      userId: user.userId,
      speaking: participant.speaking
    });
    // Also notify user rooms so participants in a group call always see it.
    emitToUsers(io, call.participants.keys(), 'call:speaking', {
      callId: call.id,
      userId: user.userId,
      speaking: participant.speaking
    });
  });

  socket.on('call:signal', (data: { callId?: string; targetUserId?: string; signal?: any }) => {
    const call = getCall(typeof data?.callId === 'string' ? data.callId : '');
    const sigType = data?.signal?.description?.type || (data?.signal?.candidate ? 'candidate' : 'unknown');
    if (!call) {
      console.warn(`[WebRTC Signal REJECTED] call not found for callId: ${data?.callId}`);
      return;
    }
    if (call.status === 'ended') {
      console.warn(`[WebRTC Signal REJECTED] call ended: ${call.id}`);
      return;
    }
    if (!call.participants.has(user.userId)) {
      console.warn(`[WebRTC Signal REJECTED] sender ${user.userId} (${user.username}) not in call participants`);
      return;
    }
    const targetUserId = typeof data?.targetUserId === 'string' ? data.targetUserId : '';
    if (!targetUserId || !call.participants.has(targetUserId)) {
      console.warn(`[WebRTC Signal REJECTED] target ${targetUserId} not in call participants`);
      return;
    }
    let extra = '';
    if (data?.signal?.candidate?.candidate) {
      extra = ` cand: ${data.signal.candidate.candidate.slice(0, 60)}`;
    } else if (data?.signal?.description?.sdp) {
      const mLines = data.signal.description.sdp.split('\r\n').filter((l: string) => l.startsWith('m=')).join('; ');
      extra = ` (${mLines})`;
    }
    console.log(`[WebRTC Signal] ${user.username} (${user.userId}) -> ${targetUserId} [${sigType}]${extra}`);
    io.to(targetUserId).emit('call:signal', {
      callId: call.id,
      fromUserId: user.userId,
      signal: data?.signal
    });

    // If an mDNS .local candidate was sent, also emit an unmasked LAN IP candidate (192.168.1.3)
    // so phones on local Wi-Fi can directly reach the laptop without needing mDNS resolution!
    if (data?.signal?.candidate?.candidate && typeof data.signal.candidate.candidate === 'string' && data.signal.candidate.candidate.includes('.local')) {
      const unmaskedCand = data.signal.candidate.candidate.replace(/[a-f0-9-]+\.local/i, '192.168.1.3');
      console.log(`[WebRTC Signal] ${user.username} -> ${targetUserId} [candidate-unmasked] (192.168.1.3)`);
      io.to(targetUserId).emit('call:signal', {
        callId: call.id,
        fromUserId: user.userId,
        signal: {
          candidate: {
            ...data.signal.candidate,
            candidate: unmaskedCand
          }
        }
      });
    }
  });

  socket.on('call:debug', (data: any) => {
    console.log(`[WebRTC Debug ${user.username}]`, JSON.stringify(data));
  });

  socket.on('call:reconnect', async (data: { callId?: string }) => {
    const callId = typeof data?.callId === 'string' ? data.callId : '';
    const call = getCall(callId);
    if (!call || call.status === 'ended') {
      socket.emit('call:reconnect-failed', { callId });
      return;
    }
    const invite = call.invites.get(user.userId);
    if (invite) {
      emitCallIncoming(io, call, user.userId);
      return;
    }
    const participant = call.participants.get(user.userId);
    if (!participant) {
      socket.emit('call:reconnect-failed', { callId });
      return;
    }
    participant.socketId = socket.id;
    participant.connection = 'connected';
    const timer = call.disconnectTimers.get(user.userId);
    if (timer) {
      clearTimeout(timer);
      call.disconnectTimers.delete(user.userId);
    }
    socket.emit('call:joined', { call: publicCall(call), self: publicParticipant(participant) });
    notifyCall(io, call, 'call:updated');
  });

  socket.on('voice:join', async (data: { spaceId?: string; channelId?: string; muted?: boolean; deafened?: boolean }) => {
    try {
      const spaceId = typeof data?.spaceId === 'string' ? data.spaceId : '';
      const channelId = typeof data?.channelId === 'string' ? data.channelId : '';
      if (!spaceId || !channelId) return emitVoiceError(socket, 'Choose a voice channel.');

      const access = await getSpaceVoiceAccess(user.userId, spaceId, channelId);
      if (!access) return emitVoiceError(socket, 'You cannot join this voice channel.', 'forbidden');

      const existingCall = [...calls.values()].find(call =>
        call.status !== 'ended' && call.participants.has(user.userId)
      );
      if (existingCall) return emitVoiceError(socket, 'Leave your call before joining a voice channel.', 'busy');

      const currentRoom = getVoiceRoomForUser(user.userId);
      if (currentRoom && (currentRoom.spaceId !== spaceId || currentRoom.channelId !== channelId)) {
        await removeVoiceParticipant(io, currentRoom, user.userId, 'switched', access.memberIds);
      }

      let room = getVoiceRoom(spaceId, channelId);
      if (!room) {
        room = {
          spaceId,
          channelId,
          channelName: access.channel.name,
          participants: new Map(),
          disconnectTimers: new Map()
        };
        voiceRooms.set(voiceRoomKey(spaceId, channelId), room);
      }
      if (room.participants.size >= MAX_VOICE_PARTICIPANTS && !room.participants.has(user.userId)) {
        return emitVoiceError(socket, 'This voice channel is full.', 'full');
      }

      const profile = await getUserProfile(user.userId);
      const existing = room.participants.get(user.userId);
      if (existing) {
        existing.socketId = socket.id;
        existing.connection = 'connected';
        const timer = room.disconnectTimers.get(user.userId);
        if (timer) {
          clearTimeout(timer);
          room.disconnectTimers.delete(user.userId);
        }
      } else {
        room.participants.set(user.userId, makeVoiceParticipant({
          userId: profile.userId,
          username: profile.username,
          displayName: profile.displayName,
          avatar: profile.avatar,
          socketId: socket.id,
          state: {
            muted: Boolean(data?.muted),
            deafened: Boolean(data?.deafened)
          }
        }));
      }

      const voiceSocketRoom = `voice:${voiceRoomKey(spaceId, channelId)}`;
      await socket.join(voiceSocketRoom);
      const participant = room.participants.get(user.userId)!;
      socket.emit('voice:joined', { room: publicVoiceRoom(room), self: publicParticipant(participant) });
      socket.to(voiceSocketRoom).emit('voice:participant-joined', {
        room: publicVoiceRoom(room),
        userId: user.userId,
        participant: publicParticipant(participant)
      });
      broadcastVoiceRoom(io, room, access.memberIds);
    } catch (error) {
      console.error('voice:join failed', error);
      emitVoiceError(socket, 'Could not join the voice channel.');
    }
  });

  socket.on('voice:leave', async (data: { spaceId?: string; channelId?: string }) => {
    try {
      const spaceId = typeof data?.spaceId === 'string' ? data.spaceId : '';
      const channelId = typeof data?.channelId === 'string' ? data.channelId : '';
      let room = getVoiceRoom(spaceId, channelId);
      if (!room) room = getVoiceRoomForUser(user.userId);
      if (!room || !room.participants.has(user.userId)) return;
      const access = await getSpaceVoiceAccess(user.userId, room.spaceId, room.channelId);
      await removeVoiceParticipant(io, room, user.userId, 'left', access?.memberIds || []);
      socket.emit('voice:left', { spaceId: room.spaceId, channelId: room.channelId });
    } catch (error) {
      console.error('voice:leave failed', error);
    }
  });

  socket.on('voice:state', (data: { spaceId?: string; channelId?: string; muted?: boolean; deafened?: boolean; camera?: boolean; screen?: boolean }) => {
    const room = getVoiceRoom(
      typeof data?.spaceId === 'string' ? data.spaceId : '',
      typeof data?.channelId === 'string' ? data.channelId : ''
    );
    if (!room) return;
    const participant = room.participants.get(user.userId);
    if (!participant) return;
    updateParticipantState(participant, data as Record<string, unknown>);
    const voiceSocketRoom = `voice:${voiceRoomKey(room.spaceId, room.channelId)}`;
    io.to(voiceSocketRoom).emit('voice:participant-updated', {
      spaceId: room.spaceId,
      channelId: room.channelId,
      participant: publicParticipant(participant)
    });
    io.to(voiceSocketRoom).emit('voice:updated', publicVoiceRoom(room));
  });

  socket.on('voice:speaking', (data: { spaceId?: string; channelId?: string; speaking?: boolean }) => {
    const room = getVoiceRoom(
      typeof data?.spaceId === 'string' ? data.spaceId : '',
      typeof data?.channelId === 'string' ? data.channelId : ''
    );
    if (!room) return;
    const participant = room.participants.get(user.userId);
    if (!participant) return;
    participant.speaking = Boolean(data?.speaking);
    socket.to(`voice:${voiceRoomKey(room.spaceId, room.channelId)}`).emit('voice:speaking', {
      spaceId: room.spaceId,
      channelId: room.channelId,
      userId: user.userId,
      speaking: participant.speaking
    });
  });

  socket.on('voice:signal', (data: { spaceId?: string; channelId?: string; targetUserId?: string; signal?: unknown }) => {
    const room = getVoiceRoom(
      typeof data?.spaceId === 'string' ? data.spaceId : '',
      typeof data?.channelId === 'string' ? data.channelId : ''
    );
    if (!room) return;
    if (!room.participants.has(user.userId)) return;
    const targetUserId = typeof data?.targetUserId === 'string' ? data.targetUserId : '';
    if (!targetUserId || !room.participants.has(targetUserId)) return;
    io.to(targetUserId).emit('voice:signal', {
      spaceId: room.spaceId,
      channelId: room.channelId,
      fromUserId: user.userId,
      signal: data?.signal
    });
  });

  socket.on('voice:reconnect', async (data: { spaceId?: string; channelId?: string }) => {
    const spaceId = typeof data?.spaceId === 'string' ? data.spaceId : '';
    const channelId = typeof data?.channelId === 'string' ? data.channelId : '';
    const room = getVoiceRoom(spaceId, channelId);
    if (!room) {
      socket.emit('voice:reconnect-failed', { spaceId, channelId });
      return;
    }
    const participant = room.participants.get(user.userId);
    if (!participant) {
      socket.emit('voice:reconnect-failed', { spaceId, channelId });
      return;
    }
    participant.socketId = socket.id;
    participant.connection = 'connected';
    const timer = room.disconnectTimers.get(user.userId);
    if (timer) {
      clearTimeout(timer);
      room.disconnectTimers.delete(user.userId);
    }
    await socket.join(`voice:${voiceRoomKey(room.spaceId, room.channelId)}`);
    socket.emit('voice:joined', { room: publicVoiceRoom(room), self: publicParticipant(participant) });
    const access = await getSpaceVoiceAccess(user.userId, room.spaceId, room.channelId);
    broadcastVoiceRoom(io, room, access?.memberIds || []);
  });

  socket.on('voice:sync', async (data: { spaceId?: string }) => {
    const spaceId = typeof data?.spaceId === 'string' ? data.spaceId : '';
    if (!spaceId) return;
    const rooms = getVoiceRoomsForSpace(spaceId);
    socket.emit('voice:sync', { spaceId, rooms: rooms.map(publicVoiceRoom) });
  });
};

const handleCallDisconnect = async (io: Server, userId: string, socketId: string) => {
  for (const call of calls.values()) {
    if (call.status === 'ended') continue;
    const participant = call.participants.get(userId);
    if (!participant || participant.socketId !== socketId) continue;

    const otherSockets = await io.in(userId).fetchSockets().catch(() => []);
    const replacement = otherSockets.find(item => item.id !== socketId);
    if (replacement) {
      participant.socketId = replacement.id;
      participant.connection = 'connected';
      continue;
    }

    participant.connection = 'reconnecting';
    notifyCall(io, call, 'call:participant-updated', {
      callId: call.id,
      participant: publicParticipant(participant)
    });
    const existingTimer = call.disconnectTimers.get(userId);
    if (existingTimer) clearTimeout(existingTimer);
    const timer = setTimeout(() => {
      const current = getCall(call.id);
      if (!current || current.status === 'ended') return;
      const currentParticipant = current.participants.get(userId);
      if (!currentParticipant || currentParticipant.connection !== 'reconnecting') return;
      void removeCallParticipant(io, current, userId, 'disconnected');
    }, CALL_RECONNECT_GRACE_MS);
    call.disconnectTimers.set(userId, timer);
  }
};

const handleVoiceDisconnect = async (io: Server, userId: string, socketId: string) => {
  for (const room of voiceRooms.values()) {
    const participant = room.participants.get(userId);
    if (!participant || participant.socketId !== socketId) continue;

    const otherSockets = await io.in(userId).fetchSockets().catch(() => []);
    const replacement = otherSockets.find(item => item.id !== socketId);
    if (replacement) {
      participant.socketId = replacement.id;
      participant.connection = 'connected';
      continue;
    }

    participant.connection = 'reconnecting';
    const voiceSocketRoom = `voice:${voiceRoomKey(room.spaceId, room.channelId)}`;
    io.to(voiceSocketRoom).emit('voice:participant-updated', {
      spaceId: room.spaceId,
      channelId: room.channelId,
      participant: publicParticipant(participant)
    });
    const existingTimer = room.disconnectTimers.get(userId);
    if (existingTimer) clearTimeout(existingTimer);
    const timer = setTimeout(async () => {
      const current = getVoiceRoom(room.spaceId, room.channelId);
      if (!current) return;
      const currentParticipant = current.participants.get(userId);
      if (!currentParticipant || currentParticipant.connection !== 'reconnecting') return;
      const access = await getSpaceVoiceAccess(userId, room.spaceId, room.channelId);
      await removeVoiceParticipant(io, current, userId, 'disconnected', access?.memberIds || []);
    }, VOICE_RECONNECT_GRACE_MS);
    room.disconnectTimers.set(userId, timer);
  }
};

export const registerCallSocketHandlers = (io: Server, socket: Socket) => {
  const user = getUser(socket);
  if (!user) return;

  registerCallHandlers(io, socket, user);

  socket.on('disconnect', () => {
    void handleCallDisconnect(io, user.userId, socket.id);
    void handleVoiceDisconnect(io, user.userId, socket.id);
  });
};

export const getActiveCallForUser = (userId: string) =>
  [...calls.values()].find(call => call.status !== 'ended' && call.participants.has(userId));

export const getIncomingCallForUser = (userId: string) =>
  [...calls.values()].find(call => call.status !== 'ended' && call.invites.has(userId));

export const getVoiceStateForSpace = (spaceId: string) =>
  getVoiceRoomsForSpace(spaceId).map(publicVoiceRoom);
