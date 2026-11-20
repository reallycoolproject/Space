import type { Server } from 'socket.io';
import { Message } from '../models/Message';
import type { CallSession, CallOutcome } from './callRegistry';

export const formatCallDuration = (totalSeconds: number) => {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${rest.toString().padStart(2, '0')}s`;
  return `${rest}s`;
};

const outcomeText = (call: CallSession, outcome: CallOutcome, durationSeconds: number) => {
  const mediaLabel = call.media === 'video' ? 'video' : 'voice';
  const groupPrefix = call.kind === 'group' ? 'group ' : '';
  switch (outcome) {
    case 'missed':
      return `Missed ${groupPrefix}${mediaLabel} call`;
    case 'declined':
      return call.kind === 'group' ? 'Group call declined' : 'Call declined';
    case 'canceled':
      return call.kind === 'group' ? 'Group call canceled' : 'Call canceled';
    case 'disconnected':
      return call.kind === 'group' ? 'Group call disconnected' : 'Call disconnected';
    case 'completed':
    default:
      return `${call.kind === 'group' ? 'Group ' : ''}${call.media === 'video' ? 'Video' : 'Voice'} call ended${durationSeconds > 0 ? ` · ${formatCallDuration(durationSeconds)}` : ''}`;
  }
};

export const serializeCallSystemMessage = (message: any) => ({
  id: String(message._id),
  roomId: message.roomId,
  senderId: message.senderId || 'system',
  senderName: message.senderName || 'Space',
  content: message.content,
  timestamp: message.createdAt || new Date(),
  isSystemMessage: true,
  systemType: 'call',
  callMeta: message.callMeta
});

/**
 * Persist an initial call started system message so it appears immediately
 * in the conversation history with Frutiger/Y2K call status.
 */
export const createCallStartedMessage = async (
  io: Server | null | undefined,
  call: CallSession
) => {
  try {
    const startedAt = new Date(call.startedAt || Date.now());
    const mediaLabel = call.media === 'video' ? 'video' : 'voice';
    const content = `${call.callerName || 'Someone'} started a ${call.kind === 'group' ? 'group ' : ''}${mediaLabel} call`;
    const participantIds = [...call.participants.keys()];

    const message = await Message.create({
      roomId: call.roomId,
      senderId: 'system',
      senderName: 'Space',
      content,
      isSystemMessage: true,
      systemType: 'call',
      callMeta: {
        callId: call.id,
        kind: call.kind,
        media: call.media,
        outcome: 'started',
        durationSeconds: 0,
        callerId: call.callerId,
        callerName: call.callerName,
        callerAvatar: call.callerAvatar,
        participantIds,
        inviteeIds: call.inviteeIds,
        startedAt
      }
    });

    const payload = serializeCallSystemMessage(message);
    if (io) {
      const notifyIds = new Set<string>([...call.memberIds, ...call.inviteeIds, ...participantIds]);
      io.to(call.roomId).emit('message:receive', payload);
      for (const targetId of notifyIds) {
        io.to(targetId).emit('message:receive', payload);
        io.to(targetId).emit('conversation:message', { roomId: call.roomId, timestamp: message.createdAt });
      }
    }
    return message;
  } catch (error) {
    console.error('Failed to create call started message', error);
    return null;
  }
};

/**
 * Persist a call outcome as a normal (unencrypted) system message so it
 * appears in the conversation history exactly like a Discord call event.
 */
export const createCallOutcomeMessage = async (
  io: Server | null | undefined,
  call: CallSession,
  outcome: CallOutcome
) => {
  if (call.finalized) return null;
  call.finalized = true;

  const endedAt = new Date(call.endedAt || Date.now());
  const startedAt = call.startedAt ? new Date(call.startedAt) : undefined;
  const durationSeconds = startedAt ? Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 1000)) : 0;
  const content = outcomeText(call, outcome, durationSeconds);
  const participantIds = [...call.participants.keys()];

  try {
    let message = await Message.findOne({ 'callMeta.callId': call.id });
    if (message) {
      message.content = content;
      message.callMeta = {
        callId: call.id,
        kind: call.kind,
        media: call.media,
        callerId: call.callerId,
        callerName: call.callerName,
        callerAvatar: call.callerAvatar,
        inviteeIds: call.inviteeIds,
        startedAt,
        ...(message.callMeta ? (message.callMeta as any).toObject?.() || message.callMeta : {}),
        outcome,
        durationSeconds,
        participantIds,
        endedAt
      };
      await message.save();
    } else {
      message = await Message.create({
        roomId: call.roomId,
        senderId: 'system',
        senderName: 'Space',
        content,
        isSystemMessage: true,
        systemType: 'call',
        callMeta: {
          callId: call.id,
          kind: call.kind,
          media: call.media,
          outcome,
          durationSeconds,
          callerId: call.callerId,
          callerName: call.callerName,
          callerAvatar: call.callerAvatar,
          participantIds,
          inviteeIds: call.inviteeIds,
          startedAt,
          endedAt
        }
      });
    }

    const payload = serializeCallSystemMessage(message);
    if (io) {
      const notifyIds = new Set<string>([...call.memberIds, ...call.inviteeIds, ...participantIds]);
      io.to(call.roomId).emit('message:receive', payload);
      for (const targetId of notifyIds) {
        io.to(targetId).emit('message:receive', payload);
        io.to(targetId).emit('conversation:message', { roomId: call.roomId, timestamp: message.createdAt });
      }
    }
    return message;
  } catch (error) {
    console.error('Failed to persist call outcome message', error);
    return null;
  }
};
