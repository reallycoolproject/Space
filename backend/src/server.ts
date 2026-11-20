import helmet from 'helmet';
// System DNS
import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import authRoutes from './routes/auth';
import ticketRoutes from './routes/tickets';
import { createServer } from 'http';
import { Server as IOServer } from 'socket.io';
import rateLimit from 'express-rate-limit';
import Ticket from './models/Ticket';
import { emitMessageNotifications } from './utils/messageNotifications';
import notificationsRoutes from './routes/notifications';
import spacesRoutes from './routes/spaces';
import { Space } from './models/Space';
import { SpaceAuditLog } from './models/SpaceAuditLog';
import { syncSpaceChannelRooms } from './utils/spacePermissions';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3000);

// Disable header that reveals Express
app.disable('x-powered-by');

// Security headers with Helmet
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false
}));

// Recursive NoSQL Injection Sanitizer
const sanitizeInput = (obj: any): any => {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeInput);
  const sanitized: any = {};
  for (const key of Object.keys(obj)) {
    if (key.startsWith('$') || key.includes('.')) continue; // Discard Mongo query injection operators
    sanitized[key] = sanitizeInput(obj[key]);
  }
  return sanitized;
};

// Global rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10000, // relaxed limit for general API dev
  message: { ok: false, message: 'Too many requests, please try again later.' }
});

// Strict rate limiter for authentication routes
const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 40,
  message: { ok: false, message: 'Too many authentication attempts. Please try again in 10 minutes.' }
});

app.use(cors({
  origin: (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(','),
  credentials: true
}));

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Apply NoSQL Sanitizer globally
app.use((req: any, res: any, next: any) => {
  if (req.body) req.body = sanitizeInput(req.body);
  if (req.query) req.query = sanitizeInput(req.query);
  if (req.params) req.params = sanitizeInput(req.params);
  next();
});

// Apply auth rate limiters
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/signup', authLimiter);

import fs from 'fs';
import path from 'path';
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
const ticketsUploadsDir = path.join(uploadsDir, 'tickets');
if (!fs.existsSync(ticketsUploadsDir)) fs.mkdirSync(ticketsUploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

app.use('/api/', apiLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/support/tickets', ticketRoutes);
import messagesRoutes from './routes/messages';
app.use('/api/messages', messagesRoutes);
import groupsRoutes from './routes/groups';
app.use('/api/groups', groupsRoutes);
app.use('/api/spaces', spacesRoutes);
import { router as nikoRoutes } from './routes/niko';
app.use('/api/spaces', nikoRoutes);
app.post('/api/webhooks/:webhookId/:token', (req: any, res: any, next: any) => {
  req.url = `/webhooks/${req.params.webhookId}/${req.params.token}`;
  spacesRoutes(req, res, next);
});
import callsRoutes from './routes/calls';
app.use('/api/calls', callsRoutes);
import livekitRoutes from './routes/livekit';
app.use('/api', livekitRoutes);
import reportsRoutes from './routes/reports';
app.use('/api/v1', reportsRoutes);
import { router as connectionsRoutes } from './routes/connections';
app.use('/api/connections', connectionsRoutes);

import { randomUUID } from 'crypto';
import requireAuth from './middleware/auth';
import { verifyUserToken } from './utils/auth';

app.post('/api/upload', requireAuth, (req: any, res: any) => {
  try {
    const { file, ext } = req.body;
    if (!file) return res.status(400).json({ ok: false, message: 'No file provided' });
    
    // file is a base64 string
    const base64Data = file.replace(/^data:([A-Za-z-+/]+);base64,/, '');
    const safeExt = typeof ext === 'string' && /^[a-z0-9]{1,8}$/i.test(ext) ? ext.toLowerCase() : 'bin';
    const decodedSize = Buffer.byteLength(base64Data, 'base64');
    if (decodedSize > 20 * 1024 * 1024) return res.status(413).json({ ok: false, message: 'File exceeds the 20MB limit' });
    const fileName = `${randomUUID()}.${safeExt}`;
    const filePath = path.join(uploadsDir, fileName);
    
    fs.writeFileSync(filePath, base64Data, 'base64');
    
    res.json({ ok: true, url: `${req.protocol}://${req.get('host')}/uploads/${fileName}` });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ ok: false, message: 'Upload failed' });
  }
});

app.get('/health', (_req: any, res: any) => {
  res.json({ ok: true, message: 'Space backend is live.' });
});

app.get('/api/health', (_req: any, res: any) => {
  res.json({ ok: true, message: 'Space backend is live.' });
});

// Serve frontend
const frontendPath = path.join(__dirname, '../../homepage/dist');
app.use(express.static(frontendPath));

app.get('*', (req: any, res: any) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

const httpServer = createServer(app);


const io = new IOServer(httpServer, {
  cors: {
    origin: (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',')
  },
  maxHttpBufferSize: 25e6
});
app.set('io', io);

io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace(/^Bearer\s/, '');
  if (!token) return next(new Error('Authentication error: No token'));
  try {
    const payload = verifyUserToken(token) as any;
    // attach basic user info to socket
    (socket as any).user = { id: payload.sub, userId: payload.userId, username: payload.username, role: payload.role || 'user' };
    return next();
  } catch (err) {
    return next(new Error('Authentication error: Invalid token'));
  }
});

import { Message } from './models/Message';
import { User } from './models/User';
import { GroupChat } from './models/GroupChat';
import { canAccessSpaceRoom, parseSpaceRoomId } from './utils/spacePermissions';
import { registerCallSocketHandlers } from './calls/socketHandlers';
import { startTurnServer } from './calls/turnServer';

const canAccessRoom = async (userId: string, roomId: string, permission: 'VIEW_CHANNEL' | 'SEND_MESSAGES' = 'VIEW_CHANNEL') => {
  if (parseSpaceRoomId(roomId)) return canAccessSpaceRoom(userId, roomId, permission);
  if (roomId.length === 24 && /^[0-9a-fA-F]{24}$/.test(roomId)) {
    const group = await GroupChat.findById(roomId).select('members.userId');
    return Boolean(group?.members.some(member => member.userId === userId));
  }
  const participantIds = roomId.split('_');
  if (participantIds.length !== 2 || !participantIds.includes(userId)) return false;
  const otherUserId = participantIds.find(id => id !== userId);
  if (!otherUserId) return participantIds.every(id => id === userId);
  const userRecord = await User.findOne({ userId }).select('contacts blockedUsers oneTimeMessageAcceptedUsers');
  return Boolean(
    userRecord && 
    otherUserId && 
    !userRecord.blockedUsers.includes(otherUserId) &&
    (userRecord.contacts.includes(otherUserId) || userRecord.oneTimeMessageAcceptedUsers?.includes(otherUserId))
  );
};

const isEncryptedEnvelope = (content: unknown) => {
  if (typeof content !== 'string') return false;
  try {
    const parsed = JSON.parse(content);
    return parsed?.e2ee === true || parsed?.v === 2 || parsed?.v === 3;
  } catch {
    return false;
  }
};

io.on('connection', (socket) => {
  const user = (socket as any).user;
  console.log('socket connected', user?.username || user?.userId);
  
  if (user?.userId) {
    socket.join(user.userId);
  }

  socket.emit('welcome', { message: 'Welcome to Space', user });

  registerCallSocketHandlers(io, socket);

  socket.on('join_room', async (data) => {
    if (data && data.roomId) {
      if (user?.userId && await canAccessRoom(user.userId, data.roomId)) {
        socket.join(data.roomId);
      }
    }
  });

  socket.on('leave_room', (data) => {
    if (typeof data?.roomId === 'string' && parseSpaceRoomId(data.roomId)) {
      socket.leave(data.roomId);
    }
  });

  socket.on('message:send', async (data) => {
    try {
      const { roomId, content } = data;
      let mentions: string[] = [];
      console.log('Message send from', user?.userId, 'to room:', roomId, 'content:', content?.substring(0, 50));
      if (!roomId || !content) return;
      if (!isEncryptedEnvelope(content) || !user?.userId) return;

      const participantIds = roomId.split('_');
      if (participantIds.length === 2 && participantIds.includes(user.userId)) {
        const otherUserId = participantIds.find((id: string) => id !== user.userId);
        if (otherUserId) {
          const [currentUserRecord, targetUserRecord] = await Promise.all([
            User.findOne({ userId: user.userId }).select('blockedUsers username displayName'),
            User.findOne({ userId: otherUserId }).select('blockedUsers username displayName')
          ]);
          const blockerId = currentUserRecord?.blockedUsers?.includes(otherUserId)
            ? user.userId
            : (targetUserRecord?.blockedUsers?.includes(user.userId) ? otherUserId : null);
          if (blockerId) {
            const blocker = blockerId === user.userId ? currentUserRecord : targetUserRecord;
            const systemMessage = await Message.create({
              roomId,
              senderId: 'system',
              senderName: 'Space',
              content: blockerId === user.userId
                ? `Your message couldn't be sent. You blocked ${blocker?.displayName || blocker?.username || 'this user'}. Unblock them to message again.`
                : `Your message couldn't be sent. ${blocker?.displayName || blocker?.username || 'This user'} has blocked you.`,
              isSystemMessage: true,
              systemType: blockerId === user.userId ? 'blocked-send-own' : 'blocked-send',
              systemTargetUserId: blockerId === user.userId ? otherUserId : blockerId
            });
            const payload = {
              id: systemMessage._id,
              roomId: systemMessage.roomId,
              senderId: systemMessage.senderId,
              senderName: systemMessage.senderName,
              content: systemMessage.content,
              timestamp: systemMessage.createdAt,
              isSystemMessage: true,
              systemType: systemMessage.systemType,
              systemTargetUserId: systemMessage.systemTargetUserId
            };
            socket.emit('message:receive', payload);
            return;
          }
        }
      }

      const isServerChannel = Boolean(parseSpaceRoomId(roomId));
      if (!(await canAccessRoom(user.userId, roomId, isServerChannel ? 'SEND_MESSAGES' : 'VIEW_CHANNEL'))) return;
      if (isServerChannel && Array.isArray(data.mentions)) {
        const parsedRoom = parseSpaceRoomId(roomId);
        const space = parsedRoom ? await Space.findById(parsedRoom.spaceId).select('members') : null;
        if (space) {
          mentions = Array.from(new Set<string>(data.mentions.filter((id: unknown): id is string =>
            typeof id === 'string' && space.members.some(member => member.userId === id)
          ))).slice(0, 100);
        }
      }

      const senderId = user.userId;
      const senderName = user.username;

      // Check if this is a group chat (MongoDB ObjectId) or DM (user1_user2 format)
      const isGroupChat = roomId.length === 24 && /^[0-9a-fA-F]{24}$/.test(roomId);
      console.log('Is group chat:', isGroupChat);

      if (isGroupChat) {
        // For group chats, verify user is a member of the group
        const { GroupChat } = await import('./models/GroupChat');
        const group = await GroupChat.findById(roomId);
        console.log('Group found:', !!group, 'Members:', group?.members?.length);
        if (!group) return;

        const isMember = group.members.some(m => m.userId === senderId);
        console.log('Is member:', isMember);
        if (!isMember) return; // Not a member of the group

        // Log all members in the group
        console.log('Group members:', group.members.map(m => m.userId));
      } else if (!isServerChannel) {
        // For DMs, extract target user ID and verify friendship or one-time message acceptance
        const targetUserId = roomId.replace(senderId, '').replace('_', '');

        const senderRecord = await User.findOne({ userId: senderId }).select('contacts blockedUsers oneTimeMessageAcceptedUsers');
        if (!senderRecord) return;
        
        const isFriend = senderRecord.contacts.includes(targetUserId);
        const isOneTimeAccepted = senderRecord.oneTimeMessageAcceptedUsers?.includes(targetUserId);
        const isBlocked = senderRecord.blockedUsers.includes(targetUserId);
        
        if (!isFriend && !isOneTimeAccepted && roomId !== 'dms') {
          return; // unauthorized
        }
        if (isBlocked) {
          return; // blocked
        }
      }

      const newMessage = await Message.create({
        roomId,
        senderId,
        senderName,
        content,
        mentions
      });

      const messagePayload = {
        id: newMessage._id,
        roomId: newMessage.roomId,
        senderId,
        senderName,
        content,
        timestamp: newMessage.createdAt
      };

      console.log('Emitting message to room:', roomId);
      // Emit to the room (works for both DMs and group chats)
      io.to(roomId).emit('message:receive', messagePayload);

      // Log rooms the socket is in
      console.log('Socket rooms:', socket.rooms);

      // We don't need to emit back to sender since the frontend appends optimistically
      // But if they have multiple devices, we should emit to senderId room too
      socket.broadcast.to(senderId).emit('message:receive', messagePayload);
      await emitMessageNotifications(io, roomId, senderId, senderName, mentions, String(newMessage._id));

    } catch (err) {
      console.error('Socket message send error:', err);
    }
  });

  socket.on('typing:start', async (data) => {
    const { roomId } = data;
    if (roomId && user?.userId && await canAccessRoom(user.userId, roomId)) {
      if (!socket.rooms.has(roomId)) socket.join(roomId);
      socket.to(roomId).emit('typing:indicator', { userId: user.userId, username: user.username, isTyping: true });
    }
  });

  socket.on('typing:stop', async (data) => {
    const { roomId } = data;
    if (roomId && user?.userId && await canAccessRoom(user.userId, roomId)) {
      socket.to(roomId).emit('typing:indicator', { userId: user.userId, username: user.username, isTyping: false });
    }
  });

  socket.on('disconnect', (reason) => {
    console.log('socket disconnected', reason);
    if (user?.userId) {
      // Broadcast offline status to all rooms the user was in
      socket.broadcast.emit('user:status', { userId: user.userId, online: false });
    }
  });

  socket.on('check_online_status', (data) => {
    const { userId } = data;
    // Check if user is online by checking if they have an active socket
    const targetSockets = io.sockets.adapter.rooms.get(userId);
    const isOnline = targetSockets && targetSockets.size > 0;
    socket.emit('user:status', { userId, online: isOnline });
  });

  // Broadcast online status when connected
  if (user?.userId) {
    socket.broadcast.emit('user:status', { userId: user.userId, online: true });
  }
});

// attach io to express app so routes can broadcast


const connectWithRetry = async (retries = 5, delay = 2500) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/space', {
        serverSelectionTimeoutMS: 15000
      });
      console.log('MongoDB connected');
      return;
    } catch (err: any) {
      console.warn(`MongoDB connect attempt ${attempt} failed: ${err.message}`);
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, delay));
    }
  }
};

const start = async () => {
  try {
    await connectWithRetry();
    
    // Clean up trash tickets older than 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const deleteResult = await Ticket.deleteMany({
      inTrash: true,
      trashDate: { $lt: thirtyDaysAgo }
    });
    
    if (deleteResult.deletedCount > 0) {
      console.log(`Auto-deleted ${deleteResult.deletedCount} tickets from trash (older than 30 days)`);
    }

    const expireTemporaryRoles = async () => {
      const now = new Date();
      const spaces = await Space.find({ 'members.temporaryRoleAssignments.expiresAt': { $lte: now } });
      for (const space of spaces) {
        const expiredMembers: Array<{ userId: string; roleIds: string[] }> = [];
        for (const member of space.members) {
          const expiredRoleIds = (member.temporaryRoleAssignments || [])
            .filter(assignment => assignment.expiresAt <= now)
            .map(assignment => assignment.roleId);
          if (!expiredRoleIds.length) continue;
          member.roleIds = member.roleIds.filter(roleId => !expiredRoleIds.includes(roleId));
          member.temporaryRoleAssignments = (member.temporaryRoleAssignments || [])
            .filter(assignment => assignment.expiresAt > now) as typeof member.temporaryRoleAssignments;
          expiredMembers.push({ userId: member.userId, roleIds: expiredRoleIds });
        }
        if (!expiredMembers.length) continue;
        await space.save();
        await SpaceAuditLog.insertMany(expiredMembers.map(({ userId, roleIds }) => ({
          spaceId: space._id,
          actorId: 'system',
          action: 'member.temporary-role.expired',
          targetId: userId,
          details: { roleIds }
        })));
        await syncSpaceChannelRooms(io, space);
      }
    };

    try {
      await expireTemporaryRoles();
    } catch (error) {
      console.error('Failed to expire temporary Space roles', error);
    }
    setInterval(() => {
      void expireTemporaryRoles().catch(error => console.error('Failed to expire temporary Space roles', error));
    }, 60 * 1000);
    
    // Schedule cleanup to run daily
    setInterval(async () => {
      const cleanupDate = new Date();
      cleanupDate.setDate(cleanupDate.getDate() - 30);
      
      const result = await Ticket.deleteMany({
        inTrash: true,
        trashDate: { $lt: cleanupDate }
      });
      
      if (result.deletedCount > 0) {
        console.log(`Auto-deleted ${result.deletedCount} tickets from trash (older than 30 days)`);
      }
    }, 24 * 60 * 60 * 1000); // Run every 24 hours
    
    startTurnServer();
    
    httpServer.listen(port, () => {
      console.log(`Server listening on port ${port}`);
    });
  } catch (error) {
    console.error('Failed to start server', error);
    process.exit(1);
  }
};

start();
