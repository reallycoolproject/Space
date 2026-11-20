import express from 'express';
import requireAuth from '../middleware/auth';
import { Space } from '../models/Space';
import { getSpaceMember } from '../utils/spacePermissions';
import {
  calls,
  getActiveCallForRoom,
  getVoiceRoom,
  getVoiceRoomForUser,
  getVoiceRoomsForSpace,
  publicCall,
  publicVoiceRoom
} from '../calls/callRegistry';
import { getConversationAccess, getSpaceVoiceAccess } from '../calls/access';

const router = express.Router();

const splitEnvList = (value?: string) =>
  (value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);

const buildIceServers = (req?: any) => {
  const hostHeader = (req && req.get ? req.get('host') : '') || '';
  const reqHost = hostHeader.split(':')[0] || '192.168.1.3';
  const lanHost = (reqHost === 'localhost' || reqHost === '127.0.0.1') ? '192.168.1.3' : reqHost;

  const stunUrls = splitEnvList(process.env.STUN_URLS || process.env.STUN_URL);
  const defaultStuns = [
    'stun:stun.l.google.com:19302',
    'stun:stun1.l.google.com:19302',
    'stun:stun2.l.google.com:19302',
    'stun:stun.cloudflare.com:3478',
    'stun:stun.services.mozilla.com:3478'
  ];
  const iceServers: Array<Record<string, unknown>> = [{
    urls: stunUrls.length ? stunUrls : defaultStuns
  }];

  // Built-in 24/7 unlimited local TURN/STUN server (no external account, no credit card required)
  iceServers.push({
    urls: [
      `turn:${lanHost}:3478`,
      'turn:192.168.1.3:3478',
      'turn:127.0.0.1:3478'
    ],
    username: 'spaceuser',
    credential: 'spacesecureturnpass2026'
  });

  const turnUrls = splitEnvList(process.env.TURN_URLS || process.env.TURN_URL);
  if (turnUrls.length) {
    iceServers.push({
      urls: turnUrls,
      username: process.env.TURN_USERNAME || '',
      credential: process.env.TURN_CREDENTIAL || ''
    });
  }

  return iceServers;
};

router.get('/ice', requireAuth, (req: any, res: any) => {
  res.json({ ok: true, iceServers: buildIceServers(req) });
});

router.get('/active', requireAuth, (req: any, res: any) => {
  const userId = req.user.userId;
  const activeCall = [...calls.values()].find(call =>
    call.status !== 'ended' && call.participants.has(userId)
  );
  const incomingCall = [...calls.values()].find(call =>
    call.status !== 'ended' && call.invites.has(userId)
  );
  const voiceRoom = getVoiceRoomForUser(userId);

  res.json({
    ok: true,
    call: activeCall ? publicCall(activeCall) : null,
    incomingCall: incomingCall ? publicCall(incomingCall) : null,
    voiceRoom: voiceRoom ? publicVoiceRoom(voiceRoom) : null
  });
});

router.get('/room/:roomId', requireAuth, async (req: any, res: any) => {
  const access = await getConversationAccess(req.user.userId, req.params.roomId);
  if (!access) return res.status(403).json({ ok: false, message: 'You do not have access to this conversation.' });
  const call = getActiveCallForRoom(req.params.roomId);
  return res.json({ ok: true, call: call ? publicCall(call) : null });
});

router.get('/spaces/:spaceId/voice', requireAuth, async (req: any, res: any) => {
  const { spaceId } = req.params;
  if (!/^[0-9a-fA-F]{24}$/.test(spaceId)) {
    return res.status(400).json({ ok: false, message: 'Invalid Space.' });
  }
  const space = await Space.findById(spaceId).select('members.userId').lean();
  if (!space || !getSpaceMember(space as any, req.user.userId)) {
    return res.status(403).json({ ok: false, message: 'You are not a member of this Space.' });
  }
  return res.json({
    ok: true,
    rooms: getVoiceRoomsForSpace(spaceId).map(publicVoiceRoom)
  });
});

router.get('/spaces/:spaceId/channels/:channelId', requireAuth, async (req: any, res: any) => {
  const { spaceId, channelId } = req.params;
  const access = await getSpaceVoiceAccess(req.user.userId, spaceId, channelId);
  if (!access) {
    return res.status(403).json({ ok: false, message: 'You cannot join this voice channel.' });
  }
  const room = getVoiceRoom(spaceId, channelId);
  return res.json({
    ok: true,
    room: room ? publicVoiceRoom(room) : { spaceId, channelId, channelName: access.channel.name, participants: [] },
    canSpeak: access.canSpeak
  });
});

export default router;
