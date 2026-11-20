import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { randomUUID, createHash } from 'crypto';
import { snowflake } from '../utils/snowflake';
import { User } from '../models/User';
import { AuthCredential } from '../models/AuthCredential';
import { Conversation } from '../models/Conversation';
import { Message } from '../models/Message';
import requireAuth from '../middleware/auth';
import { isDisposableEmail, isValidEmailFormat } from '../utils/emailValidation';
import { MessageRequest } from '../models/MessageRequest';
import { Report } from '../models/Report';
import xss from 'xss';
import { signUserToken, getJwtSecret } from '../utils/auth';

const router = express.Router();

const sanitize = (text?: string) => text ? xss(text) : undefined;

const signToken = (user: { _id: string; userId: string; username: string; provider: string }) => {
  return signUserToken({ id: user._id, userId: user.userId, username: user.username, provider: user.provider, role: 'user' });
};

async function assignMemberNumberAndBadges() {
  const highestUser = await User.findOne({ memberNumber: { $exists: true } }).sort({ memberNumber: -1 });
  const count = await User.countDocuments();
  const nextMemberNumber = Math.max(highestUser?.memberNumber || 0, count) + 1;
  const badges: any[] = [];
  if (nextMemberNumber <= 100) {
    badges.push({
      id: 'og',
      name: 'OG',
      description: `#${nextMemberNumber} OG`,
      icon: '/badges/og.png',
      awardedAt: new Date(),
      memberNumber: nextMemberNumber
    });
  }
  return { nextMemberNumber, badges };
}

router.post('/signup', async (req: any, res: any) => {
  try {
    const { email, username, password, provider = 'local' } = req.body as {
      email?: string;
      username?: string;
      password?: string;
      provider?: 'local' | 'google';
    };

    if (!email || !username || !password) {
      return res.status(400).json({ ok: false, message: 'Email, username, and password are required.' });
    }

    if (!isValidEmailFormat(email)) {
      return res.status(400).json({ ok: false, message: 'Invalid email format.' });
    }

    if (isDisposableEmail(email)) {
      return res.status(400).json({ ok: false, message: 'Disposable email addresses are not allowed.' });
    }

    if (provider !== 'local' && provider !== 'google') {
      return res.status(400).json({ ok: false, message: 'Unsupported provider.' });
    }

    if (username.length < 3) {
      return res.status(400).json({ ok: false, message: 'Username must be at least 3 characters.' });
    }

    if (password.length < 8) {
      return res.status(400).json({ ok: false, message: 'Password must be at least 8 characters.' });
    }

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ ok: false, message: 'Account already exists with this email or username.' });
    }

    const userId = snowflake.nextId();
    const passwordHash = await bcrypt.hash(password, 12);
    const { nextMemberNumber, badges } = await assignMemberNumberAndBadges();

    const user = await User.create({
      email,
      username,
      userId,
      provider,
      contacts: [],
      pendingRequests: [],
      hasCompletedOnboarding: false,
      memberNumber: nextMemberNumber,
      badges
    });

    await AuthCredential.create({ userId: user._id, provider: 'local', passwordHash });

    const token = signToken({
      _id: String(user._id),
      userId: user.userId,
      username: user.username,
      provider: user.provider
    });

    return res.status(201).json({
      ok: true,
      token,
      user: {
        email: user.email,
        username: user.username,
        userId: user.userId,
        provider: user.provider,
        hasCompletedOnboarding: user.hasCompletedOnboarding,
        badges: user.badges || [],
        memberNumber: user.memberNumber
      }
    });
  } catch (error) {
    console.error('signup failed', error);
    return res.status(500).json({ ok: false, message: 'Registration failed.' });
  }
});

router.post('/login', async (req: any, res: any) => {
  try {
    const { identifier, password, provider = 'local' } = req.body as {
      identifier?: string;
      password?: string;
      provider?: 'local' | 'google';
    };

    if (!identifier || !password) {
      return res.status(400).json({ ok: false, message: 'Username/Email and password are required.' });
    }

    const user = await User.findOne({ 
      $or: [{ email: identifier }, { username: identifier }] 
    });
    if (!user) {
      return res.status(401).json({ ok: false, message: 'Invalid credentials.' });
    }

    if (provider === 'local') {
      const credential = await AuthCredential.findOne({ userId: user._id, provider: 'local' });
      if (!credential?.passwordHash) {
        return res.status(401).json({ ok: false, message: 'Invalid credentials.' });
      }

      const isValid = await bcrypt.compare(password, credential.passwordHash);
      if (!isValid) {
        return res.status(401).json({ ok: false, message: 'Invalid credentials.' });
      }
    }

    if (user.isBanned) return res.status(403).json({ ok: false, message: 'This account is suspended.' });

    const token = signUserToken({
      id: String(user._id),
      userId: user.userId,
      username: user.username,
      provider: user.provider,
      role: user.role || 'user'
    });

    return res.status(200).json({
      ok: true,
      token,
      user: {
        email: user.email,
        username: user.username,
        userId: user.userId,
        provider: user.provider,
        displayName: user.displayName,
        avatar: user.avatar,
        status: user.status,
        hasCompletedOnboarding: user.hasCompletedOnboarding || !!user.displayName,
        encryptedPrivateKey: user.encryptedPrivateKey,
        publicKey: user.publicKey,
        keySalt: user.keySalt,
        badges: user.badges || [],
        memberNumber: user.memberNumber
      }
    });
  } catch (error) {
    console.error('login failed', error);
    return res.status(500).json({ ok: false, message: 'Login failed.' });
  }
});

// In-memory brute force defense for admin gateway
const adminAttemptTracker: Record<string, { attempts: number; lockedUntil: number }> = {};

router.post('/admin/login', async (req: any, res: any) => {
  const clientIp = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown');
  const now = Date.now();

  // Check IP lockout
  const record = adminAttemptTracker[clientIp];
  if (record && record.lockedUntil > now) {
    const remainingSeconds = Math.ceil((record.lockedUntil - now) / 1000);
    return res.status(429).json({
      ok: false,
      message: `Security Lockout: Too many failed admin attempts. Try again in ${remainingSeconds}s.`
    });
  }

  // Gateway key verification (Cloaks endpoint from port scanners & crawlers)
  const gatewayKey = req.headers['x-admin-gateway-key'] || req.query.gate || req.query.key || req.body?.gatewayKey;
  const validGateways = ['space_sec_9942', 'omg', process.env.ADMIN_GATEWAY_KEY || 'space_sec_9942'];
  
  if (!gatewayKey || !validGateways.includes(String(gatewayKey))) {
    // Return 404 to deceive scanners so they think the admin endpoint doesn't exist
    return res.status(404).json({ ok: false, message: 'Not found' });
  }

  const { username, password } = (req.body || {}) as { username?: string; password?: string };
  if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
    return res.status(401).json({ ok: false, message: 'Invalid admin credentials' });
  }

  const cleanUsername = username.trim();
  const envAdminUser = process.env.ADMIN_USERNAME || 'omg';
  const envAdminPass = process.env.ADMIN_PASSWORD || '123';

  // 1. Check against environment admin
  if (cleanUsername === envAdminUser && password === envAdminPass) {
    delete adminAttemptTracker[clientIp];
    return res.json({
      ok: true,
      token: signUserToken({ id: 'admin', userId: 'admin', username: cleanUsername, provider: 'local', role: 'admin' })
    });
  }

  // 2. Check against database admin users
  try {
    const escaped = cleanUsername.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const user = await User.findOne({ username: { $regex: new RegExp(`^${escaped}$`, 'i') } });
    if (user && user.role === 'admin') {
      const cred = await AuthCredential.findOne({ userId: user._id, provider: 'local' });
      if (cred?.passwordHash) {
        const isMatch = await bcrypt.compare(password, cred.passwordHash);
        if (isMatch) {
          delete adminAttemptTracker[clientIp];
          return res.json({
            ok: true,
            token: signUserToken({ id: String(user._id), userId: user.userId, username: user.username, provider: 'local', role: 'admin' })
          });
        }
      }
    }
  } catch (err) {
    console.error('Database admin login check failed:', err);
  }

  // Failed attempt: record and delay to prevent timing attacks & brute force
  if (!adminAttemptTracker[clientIp]) {
    adminAttemptTracker[clientIp] = { attempts: 1, lockedUntil: 0 };
  } else {
    adminAttemptTracker[clientIp].attempts += 1;
    if (adminAttemptTracker[clientIp].attempts >= 5) {
      adminAttemptTracker[clientIp].lockedUntil = now + (15 * 60 * 1000); // 15 minute lockout
    }
  }

  await new Promise(resolve => setTimeout(resolve, 1000)); // 1s anti-timing attack delay
  return res.status(401).json({ ok: false, message: 'Invalid admin credentials' });
});

router.get('/me', requireAuth, async (req: any, res: any) => {
  try {
    const user = await User.findById(req.user.id).select('email username userId provider displayName avatar banner bio pronouns themeGradient note customActivity hasCompletedOnboarding contacts pendingRequests status createdAt allowOneTimeMessages allowGroupAdds groupAddExceptions badges memberNumber role connections activity');
    if (!user) return res.status(404).json({ ok: false, message: 'User not found' });
    return res.json({ ok: true, user });
  } catch (err) {
    console.error('me failed', err);
    return res.status(500).json({ ok: false, message: 'Failed to load profile' });
  }
});

router.patch('/password', requireAuth, async (req: any, res: any) => {
  try {
    const { currentPassword, newPassword, encryptedPrivateKey, keySalt } = req.body as {
      currentPassword?: string;
      newPassword?: string;
      encryptedPrivateKey?: string;
      keySalt?: string;
    };
    if (!currentPassword || !newPassword || newPassword.length < 8) {
      return res.status(400).json({ ok: false, message: 'Enter your current password and a new password with at least 8 characters.' });
    }
    if (!encryptedPrivateKey || !keySalt) {
      return res.status(400).json({ ok: false, message: 'Encryption key recovery data is required to change your password safely.' });
    }

    const credential = await AuthCredential.findOne({ userId: req.user.id, provider: 'local' });
    if (!credential?.passwordHash || !(await bcrypt.compare(currentPassword, credential.passwordHash))) {
      return res.status(401).json({ ok: false, message: 'Current password is incorrect.' });
    }

    const account = await User.findById(req.user.id);
    if (!account) return res.status(404).json({ ok: false, message: 'User not found.' });

    credential.passwordHash = await bcrypt.hash(newPassword, 12);
    account.encryptedPrivateKey = encryptedPrivateKey;
    account.keySalt = keySalt;
    await Promise.all([credential.save(), account.save()]);

    return res.json({ ok: true, message: 'Password updated successfully.' });
  } catch (error) {
    console.error('Failed to update password', error);
    return res.status(500).json({ ok: false, message: 'Failed to update password.' });
  }
});

router.post('/verify-token', async (req: any, res: any) => {
  try {
    const { token } = req.body as { token?: string };
    
    if (!token) {
      return res.status(400).json({ ok: false, message: 'Token is required' });
    }

    const decoded = jwt.verify(token, getJwtSecret()) as any;
    const userDocumentId = decoded.id || decoded.sub;
    if (typeof userDocumentId !== 'string' || !mongoose.isValidObjectId(userDocumentId)) {
      return res.status(401).json({ ok: false, message: 'Invalid token' });
    }

    const user = await User.findById(userDocumentId).select('email username userId provider displayName avatar banner bio pronouns hasCompletedOnboarding contacts pendingRequests encryptedPrivateKey publicKey keySalt status createdAt allowOneTimeMessages allowGroupAdds groupAddExceptions badges memberNumber');
    if (!user) {
      return res.status(404).json({ ok: false, message: 'User not found' });
    }

    return res.json({
      ok: true,
      user: {
        email: user.email,
        username: user.username,
        userId: user.userId,
        provider: user.provider,
        displayName: user.displayName,
        avatar: user.avatar,
        status: user.status,
        banner: user.banner,
        bio: user.bio,
        pronouns: user.pronouns,
        hasCompletedOnboarding: user.hasCompletedOnboarding || !!user.displayName,
        contacts: user.contacts,
        pendingRequests: user.pendingRequests,
        encryptedPrivateKey: user.encryptedPrivateKey,
        publicKey: user.publicKey,
        keySalt: user.keySalt,
        createdAt: user.createdAt,
        allowOneTimeMessages: user.allowOneTimeMessages,
        allowGroupAdds: user.allowGroupAdds,
        groupAddExceptions: user.groupAddExceptions,
        blockedUsers: user.blockedUsers,
        oneTimeMessageCooldowns: user.oneTimeMessageCooldowns,
        oneTimeMessageAcceptedUsers: user.oneTimeMessageAcceptedUsers,
        badges: user.badges || [],
        memberNumber: user.memberNumber
      }
    });
  } catch (error) {
    console.error('token verification failed', error);
    return res.status(401).json({ ok: false, message: 'Invalid or expired token' });
  }
});

router.post('/check-email', async (req: any, res: any) => {
  try {
    const { email } = req.body as { email?: string };
    
    if (!email || !isValidEmailFormat(email)) {
      return res.status(400).json({ ok: false, message: 'Invalid email format' });
    }

    if (isDisposableEmail(email)) {
      return res.status(400).json({ ok: false, message: 'Disposable emails not allowed' });
    }

    const existingUser = await User.findOne({ email });
    
    return res.json({
      ok: true,
      available: !existingUser
    });
  } catch (error) {
    console.error('Email check failed', error);
    return res.status(500).json({ ok: false, message: 'Email check failed' });
  }
});

// Google OAuth callback endpoint
router.post('/google/callback', async (req: any, res: any) => {
  try {
    const { idToken, email, username } = req.body as {
      idToken?: string;
      email?: string;
      username?: string;
    };

    if (!idToken || !email) {
      return res.status(400).json({ ok: false, message: 'Google ID token and email are required' });
    }

    // Hash the Google ID token for zero-knowledge storage
    const hashedToken = createHash('sha256').update(idToken).digest('hex');

    // Check if user exists with this email
    let user = await User.findOne({ email });

    if (user) {
      // Update Google credential if user exists
      await AuthCredential.findOneAndUpdate(
        { userId: user._id, provider: 'google' },
        { googleTokenHash: hashedToken },
        { upsert: true }
      );
    } else {
      // Create new user with Google OAuth
      const generatedUsername = username || email.split('@')[0] + randomUUID().slice(0, 4);
      const { nextMemberNumber, badges } = await assignMemberNumberAndBadges();
      
      user = await User.create({
        email,
        username: generatedUsername,
        userId: randomUUID(),
        provider: 'google',
        memberNumber: nextMemberNumber,
        badges
      });

      await AuthCredential.create({
        userId: user._id,
        provider: 'google',
        googleTokenHash: hashedToken
      });
    }

    const token = signToken({
      _id: String(user._id),
      userId: user.userId,
      username: user.username,
      provider: user.provider
    });

    return res.json({
      ok: true,
      token,
      user: {
        email: user.email,
        username: user.username,
        userId: user.userId,
        provider: user.provider,
        badges: user.badges || [],
        memberNumber: user.memberNumber
      }
    });
  } catch (error) {
    console.error('Google OAuth callback failed', error);
    return res.status(500).json({ ok: false, message: 'Google OAuth failed' });
  }
});

// User search endpoint
router.get('/search', requireAuth, async (req: any, res: any) => {
  try {
    const { q } = req.query as { q?: string };
    
    if (!q || q.length < 2) {
      return res.status(400).json({ ok: false, message: 'Search query must be at least 2 characters' });
    }

    const currentUser = await User.findById(req.user.id);
    if (!currentUser) {
      return res.status(404).json({ ok: false, message: 'User not found' });
    }

    const users = await User.find({
      $or: [
        { username: { $regex: q, $options: 'i' } },
        { displayName: { $regex: q, $options: 'i' } }
      ],
      _id: { $ne: currentUser._id }
    }).select('username displayName avatar userId createdAt badges memberNumber').limit(10);

    return res.json({
      ok: true,
      users
    });
  } catch (error) {
    console.error('User search failed', error);
    return res.status(500).json({ ok: false, message: 'User search failed' });
  }
});

// Get user's spaces (group chats)
router.get('/spaces', requireAuth, async (req: any, res: any) => {
  try {
    const { GroupChat } = await import('../models/GroupChat');
    const currentUser = await User.findById(req.user.id);
    if (!currentUser) {
      return res.status(404).json({ ok: false, message: 'User not found' });
    }

    const groupChats = await GroupChat.find({
      'members.userId': currentUser.userId
    }).select('_id name members createdAt');

    const spaces = groupChats.map(group => ({
      id: group._id,
      name: group.name,
      memberCount: group.members.length,
      createdAt: group.createdAt
    }));

    return res.json({
      ok: true,
      spaces
    });
  } catch (error) {
    console.error('Failed to load spaces', error);
    return res.status(500).json({ ok: false, message: 'Failed to load spaces' });
  }
});

// Get online users (real-time tracking via socket.io)
router.get('/online', requireAuth, async (req: any, res: any) => {
  try {
    const currentUser = await User.findById(req.user.id);
    if (!currentUser) {
      return res.status(404).json({ ok: false, message: 'User not found' });
    }

    const io = req.app.get('io');
    const onlineUserIds: string[] = [];
    
    // Get all users who have active socket connections
    if (io) {
      io.sockets.sockets.forEach((socket: any) => {
        const user = socket.user;
        if (user && user.userId && user.userId !== currentUser.userId) {
          onlineUserIds.push(user.userId);
        }
      });
    }

    const onlineUsers = await User.find({
      userId: { $in: onlineUserIds }
    }).select('username displayName avatar userId');

    return res.json({
      ok: true,
      users: onlineUsers
    });
  } catch (error) {
    console.error('Failed to load online users', error);
    return res.status(500).json({ ok: false, message: 'Failed to load online users' });
  }
});

// Get user's friends
router.get('/friends', requireAuth, async (req: any, res: any) => {
  try {
    const currentUser = await User.findById(req.user.id);
    if (!currentUser) {
      return res.status(404).json({ ok: false, message: 'User not found' });
    }

    const friends = await User.find({
      userId: { $in: currentUser.contacts }
    }).select('username displayName avatar userId bio pronouns banner status website createdAt allowOneTimeMessages badges memberNumber');

    return res.json({
      ok: true,
      friends
    });
  } catch (error) {
    console.error('Failed to load friends', error);
    return res.status(500).json({ ok: false, message: 'Failed to load friends' });
  }
});

router.get('/friends/blocked', requireAuth, async (req: any, res: any) => {
  try {
    const currentUser = await User.findById(req.user.id).select('blockedUsers');
    if (!currentUser) return res.status(404).json({ ok: false, message: 'User not found' });
    const users = await User.find({ userId: { $in: currentUser.blockedUsers || [] } })
      .select('username displayName avatar userId status');
    return res.json({ ok: true, users });
  } catch (error) {
    console.error('Failed to load blocked users', error);
    return res.status(500).json({ ok: false, message: 'Failed to load blocked users' });
  }
});

// Search users by username
router.get('/search', requireAuth, async (req: any, res: any) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ ok: false, message: 'Search query is required' });
    }

    const currentUser = await User.findById(req.user.id);
    if (!currentUser) {
      return res.status(404).json({ ok: false, message: 'User not found' });
    }

    const users = await User.find({
      username: { $regex: q, $options: 'i' },
      userId: { $ne: currentUser.userId }
    }).select('username displayName avatar userId bio pronouns banner status website createdAt allowOneTimeMessages badges memberNumber').limit(10);

    return res.json({
      ok: true,
      users
    });
  } catch (error) {
    console.error('Search failed', error);
    return res.status(500).json({ ok: false, message: 'Search failed' });
  }
});

// Get user profile by userId
router.get('/user/:userId/profile', requireAuth, async (req: any, res: any) => {
  try {
    const { userId } = req.params;
    const targetUser = await User.findOne({ userId }).select(
      'username displayName avatar banner bio pronouns status website createdAt allowOneTimeMessages badges memberNumber themeGradient note customActivity connections activity'
    );
    if (!targetUser) {
      return res.status(404).json({ ok: false, message: 'User not found' });
    }
    const userObj = targetUser.toObject();
    if (userObj.connections && Array.isArray(userObj.connections)) {
      userObj.connections = userObj.connections
        .filter((c: any) => c.visibleOnProfile !== false)
        .map((c: any) => {
          const { accessToken, refreshToken, ...safeConn } = c;
          return safeConn;
        });
    }
    return res.json({
      ok: true,
      user: userObj
    });
  } catch (error) {
    console.error('Failed to get user profile', error);
    return res.status(500).json({ ok: false, message: 'Failed to get user profile' });
  }
});

// Send friend request
router.post('/friends/request', requireAuth, async (req: any, res: any) => {
  try {
    const { userId, note } = req.body as { userId?: string; note?: string };
    
    if (!userId) {
      return res.status(400).json({ ok: false, message: 'Target user ID is required' });
    }

    if (note && note.length > 150) {
      return res.status(400).json({ ok: false, message: 'Note must be 150 characters or less' });
    }

    const currentUser = await User.findById(req.user.id);
    if (!currentUser) {
      return res.status(404).json({ ok: false, message: 'User not found' });
    }

    const targetUser = await User.findOne({ userId });
    if (!targetUser) {
      return res.status(404).json({ ok: false, message: 'Target user not found' });
    }

    if (currentUser.userId === userId) {
      return res.status(400).json({ ok: false, message: 'Cannot send friend request to yourself' });
    }

    if (currentUser.contacts && currentUser.contacts.includes(userId)) {
      return res.status(400).json({ ok: false, message: 'Already friends with this user' });
    }

    if (targetUser.pendingRequests && targetUser.pendingRequests.some((r: any) => r.userId === currentUser.userId)) {
      return res.status(400).json({ ok: false, message: 'Friend request already sent' });
    }

    if (!targetUser.pendingRequests) {
      targetUser.pendingRequests = [];
    }
    targetUser.pendingRequests.push({ userId: currentUser.userId, note: note ? note.substring(0, 150) : undefined } as any);
    await targetUser.save();

    const io = req.app.get('io');
    if (io) {
      io.to(userId).emit('friend_request_received', {
        userId: currentUser.userId,
        username: currentUser.username,
        avatar: currentUser.avatar,
        displayName: currentUser.displayName,
        note: note || ''
      });
    }

    return res.json({
      ok: true,
      message: 'Friend request sent successfully'
    });
  } catch (error) {
    console.error('Failed to send friend request', error);
    return res.status(500).json({ ok: false, message: 'Failed to send friend request' });
  }
});

// Set nickname for friend
router.post('/friends/nickname', requireAuth, async (req: any, res: any) => {
  try {
    const { friendUserId, nickname } = req.body as { friendUserId?: string; nickname?: string };
    
    if (!friendUserId) {
      return res.status(400).json({ ok: false, message: 'Friend user ID is required' });
    }

    const currentUser = await User.findById(req.user.id);
    if (!currentUser) {
      return res.status(404).json({ ok: false, message: 'User not found' });
    }

    if (!currentUser.contacts.includes(friendUserId)) {
      return res.status(400).json({ ok: false, message: 'Not friends with this user' });
    }

    // Store nickname in user's document (could also create a separate Nickname model)
    const nicknameIndex = currentUser.nicknames?.findIndex((n: any) => n.userId === friendUserId);
    if (nicknameIndex !== undefined && nicknameIndex >= 0 && currentUser.nicknames) {
      currentUser.nicknames[nicknameIndex].nickname = nickname || '';
    } else {
      if (!currentUser.nicknames) currentUser.nicknames = [];
      currentUser.nicknames.push({ userId: friendUserId, nickname: nickname || '' });
    }
    
    await currentUser.save();

    return res.json({
      ok: true,
      message: 'Nickname saved successfully'
    });
  } catch (error) {
    console.error('Failed to save nickname', error);
    return res.status(500).json({ ok: false, message: 'Failed to save nickname' });
  }
});

// Accept friend request
router.post('/friends/accept', requireAuth, async (req: any, res: any) => {
  try {
    const { userId } = req.body as { userId?: string };
    
    if (!userId) {
      return res.status(400).json({ ok: false, message: 'User ID is required' });
    }

    const currentUser = await User.findById(req.user.id);
    if (!currentUser) {
      return res.status(404).json({ ok: false, message: 'User not found' });
    }

    if (!currentUser.pendingRequests.some((r: any) => r.userId === userId)) {
      return res.status(400).json({ ok: false, message: 'No pending friend request from this user' });
    }

    const requesterUser = await User.findOne({ userId });
    if (!requesterUser) {
      return res.status(404).json({ ok: false, message: 'Requester not found' });
    }

    // Add each other to contacts
    currentUser.contacts.push(userId);
    requesterUser.contacts.push(currentUser.userId);

    // Remove from pending requests (both directions)
    currentUser.pendingRequests = currentUser.pendingRequests.filter((r: any) => r.userId !== userId);
    requesterUser.pendingRequests = requesterUser.pendingRequests.filter((r: any) => r.userId !== currentUser.userId);

    await currentUser.save();
    await requesterUser.save();

    const io = req.app.get('io');
    if (io) {
      io.to(userId).emit('friend_request_accepted', {
        userId: currentUser.userId,
        username: currentUser.username,
        displayName: currentUser.displayName,
        avatar: currentUser.avatar
      });
      // Emit greeting event to both users
      const roomId = [currentUser.userId, userId].sort().join('_');
      io.to(currentUser.userId).emit('greeting_received', {
        username: requesterUser.displayName || requesterUser.username,
        roomId
      });
      io.to(userId).emit('greeting_received', {
        username: currentUser.displayName || currentUser.username,
        roomId
      });
    }

    return res.json({
      ok: true,
      message: 'Friend request accepted'
    });
  } catch (error) {
    console.error('Failed to accept friend request', error);
    return res.status(500).json({ ok: false, message: 'Failed to accept friend request' });
  }
});

// Decline friend request
router.post('/friends/decline', requireAuth, async (req: any, res: any) => {
  try {
    const { userId } = req.body as { userId?: string };
    
    if (!userId) {
      return res.status(400).json({ ok: false, message: 'User ID is required' });
    }

    const currentUser = await User.findById(req.user.id);
    if (!currentUser) {
      return res.status(404).json({ ok: false, message: 'User not found' });
    }

    if (!currentUser.pendingRequests.some((r: any) => r.userId === userId)) {
      return res.status(400).json({ ok: false, message: 'No pending friend request from this user' });
    }

    const requesterUser = await User.findOne({ userId });
    if (!requesterUser) {
      return res.status(404).json({ ok: false, message: 'Requester not found' });
    }

    // Remove from pending requests (both directions)
    currentUser.pendingRequests = currentUser.pendingRequests.filter((r: any) => r.userId !== userId);
    requesterUser.pendingRequests = requesterUser.pendingRequests.filter((r: any) => r.userId !== currentUser.userId);

    await currentUser.save();
    await requesterUser.save();

    const io = req.app.get('io');
    if (io) {
      io.to(userId).emit('friend_request_declined', {
        userId: currentUser.userId,
        username: currentUser.username,
        displayName: currentUser.displayName
      });
    }

    return res.json({
      ok: true,
      message: 'Friend request declined'
    });
  } catch (error) {
    console.error('Failed to decline friend request', error);
    return res.status(500).json({ ok: false, message: 'Failed to decline friend request' });
  }
});

// Get pending friend requests
router.get('/friends/pending', requireAuth, async (req: any, res: any) => {
  try {
    const currentUser = await User.findById(req.user.id);
    if (!currentUser) {
      return res.status(404).json({ ok: false, message: 'User not found' });
    }

    const pendingUserIds = currentUser.pendingRequests.map((r: any) => r.userId);
    const pendingUsers = await User.find({
      userId: { $in: pendingUserIds }
    }).select('username displayName avatar userId');

    const pendingRequests = pendingUsers.map(user => {
      const requestObj = currentUser.pendingRequests.find((r: any) => r.userId === user.userId);
      return {
        ...user.toObject(),
        note: requestObj ? (requestObj as any).note : undefined
      };
    });

    return res.json({
      ok: true,
      requests: pendingRequests
    });
  } catch (error) {
    console.error('Failed to load pending requests', error);
    return res.status(500).json({ ok: false, message: 'Failed to load pending requests' });
  }
});

// Remove friend
router.post('/friends/remove', requireAuth, async (req: any, res: any) => {
  try {
    const { friendUserId } = req.body as { friendUserId?: string };

    if (!friendUserId) {
      return res.status(400).json({ ok: false, message: 'Friend user ID is required' });
    }

    const currentUser = await User.findById(req.user.id);
    if (!currentUser) {
      return res.status(404).json({ ok: false, message: 'User not found' });
    }

    if (currentUser.userId === friendUserId) {
      return res.status(400).json({ ok: false, message: 'Cannot remove yourself' });
    }

    // Remove from contacts (one-way removal)
    currentUser.contacts = currentUser.contacts.filter((id: string) => id !== friendUserId);

    await currentUser.save();

    // Also remove from the friend's contacts list (two-way removal)
    const friendUser = await User.findOne({ userId: friendUserId });
    if (friendUser) {
      friendUser.contacts = friendUser.contacts.filter((id: string) => id !== currentUser.userId);
      await friendUser.save();
    }

    const io = req.app.get('io');
    if (io) {
      io.to(friendUserId).emit('friend_removed', {
        userId: currentUser.userId,
        username: currentUser.username,
        avatar: currentUser.avatar
      });
    }

    return res.json({
      ok: true,
      message: 'Friend removed successfully'
    });
  } catch (error) {
    console.error('Failed to remove friend', error);
    return res.status(500).json({ ok: false, message: 'Failed to remove friend' });
  }
});

// Block user
router.post('/friends/block', requireAuth, async (req: any, res: any) => {
  try {
    const { targetUserId } = req.body as { targetUserId?: string };

    if (!targetUserId) {
      return res.status(400).json({ ok: false, message: 'Target user ID is required' });
    }

    const currentUser = await User.findById(req.user.id);
    if (!currentUser) {
      return res.status(404).json({ ok: false, message: 'User not found' });
    }

    if (currentUser.userId === targetUserId) {
      return res.status(400).json({ ok: false, message: 'Cannot block yourself' });
    }

    const targetUser = await User.findOne({ userId: targetUserId });
    if (!targetUser) return res.status(404).json({ ok: false, message: 'User not found' });

    if (!currentUser.blockedUsers.includes(targetUserId)) currentUser.blockedUsers.push(targetUserId);
    currentUser.contacts = currentUser.contacts.filter((id: string) => id !== targetUserId);
    currentUser.pendingRequests = currentUser.pendingRequests.filter((request: any) => request.userId !== targetUserId);
    currentUser.oneTimeMessageAcceptedUsers = (currentUser.oneTimeMessageAcceptedUsers || []).filter(id => id !== targetUserId);

    targetUser.contacts = targetUser.contacts.filter((id: string) => id !== currentUser.userId);
    targetUser.pendingRequests = targetUser.pendingRequests.filter((request: any) => request.userId !== currentUser.userId);
    targetUser.oneTimeMessageAcceptedUsers = (targetUser.oneTimeMessageAcceptedUsers || []).filter(id => id !== currentUser.userId);

    await Promise.all([currentUser.save(), targetUser.save()]);

    const roomId = [currentUser.userId, targetUserId].sort().join('_');
    const [blockerNotice, blockedNotice] = await Promise.all([
      Message.create({
        roomId,
        senderId: currentUser.userId,
        senderName: 'Space',
        content: `You blocked ${targetUser.displayName || targetUser.username}. They can no longer message you. You can unblock or report them below.`,
        isSystemMessage: true,
        systemType: 'you-blocked',
        systemTargetUserId: targetUserId
      }),
      Message.create({
        roomId,
        senderId: currentUser.userId,
        senderName: 'Space',
        content: `You and ${currentUser.displayName || currentUser.username} are no longer friends. Messages to this user cannot be sent.`,
        isSystemMessage: true,
        systemType: 'blocked-you',
        systemTargetUserId: currentUser.userId
      })
    ]);
    const serializeNotice = (notice: any) => ({
      id: String(notice._id), roomId, senderId: notice.senderId, senderName: notice.senderName,
      content: notice.content, timestamp: notice.createdAt, isSystemMessage: true,
      systemType: notice.systemType, systemTargetUserId: notice.systemTargetUserId
    });
    const blockerNoticePayload = serializeNotice(blockerNotice);
    const blockedNoticePayload = serializeNotice(blockedNotice);

    const io = req.app.get('io');
    if (io) {
      io.to(currentUser.userId).emit('message:receive', blockerNoticePayload);
      io.to(targetUserId).emit('message:receive', blockedNoticePayload);
      io.to(currentUser.userId).emit('friend_removed', { userId: targetUserId });
      io.to(targetUserId).emit('friend_removed', { userId: currentUser.userId });
      io.to(targetUserId).emit('user:blocked', { userId: currentUser.userId, username: currentUser.username });
    }

    return res.json({ ok: true, message: 'User blocked and removed from friends.', systemMessage: blockerNoticePayload });
  } catch (error) {
    console.error('Failed to block user', error);
    return res.status(500).json({ ok: false, message: 'Failed to block user' });
  }
});

// Update user status
router.patch('/status', requireAuth, async (req: any, res: any) => {
  try {
    const { status } = req.body;
    
    if (!['active', 'inactive', 'dnd'].includes(status)) {
      return res.status(400).json({ ok: false, message: 'Invalid status' });
    }

    const currentUser = await User.findById(req.user.id);
    if (!currentUser) {
      return res.status(404).json({ ok: false, message: 'User not found' });
    }

    currentUser.status = status;
    await currentUser.save();

    const io = req.app.get('io');
    if (io) {
      // Broadcast status change to all friends
      currentUser.contacts.forEach((friendId: string) => {
        io.to(friendId).emit('friend_status_changed', {
          userId: currentUser.userId,
          status
        });
      });
    }

    return res.json({ ok: true, status: currentUser.status });
  } catch (error) {
    console.error('Failed to update status', error);
    return res.status(500).json({ ok: false, message: 'Failed to update status' });
  }
});

// Update custom activity
router.patch('/activity', requireAuth, async (req: any, res: any) => {
  try {
    const { customActivity } = req.body;
    
    if (customActivity && customActivity.length > 100) {
      return res.status(400).json({ ok: false, message: 'Activity must be 100 characters or less' });
    }

    const currentUser = await User.findById(req.user.id);
    if (!currentUser) {
      return res.status(404).json({ ok: false, message: 'User not found' });
    }

    currentUser.customActivity = customActivity || '';
    await currentUser.save();

    const io = req.app.get('io');
    if (io) {
      // Broadcast activity change to all friends
      currentUser.contacts.forEach((friendId: string) => {
        io.to(friendId).emit('user_activity_changed', {
          userId: currentUser.userId,
          customActivity: currentUser.customActivity
        });
      });
    }

    return res.json({ ok: true, customActivity: currentUser.customActivity });
  } catch (error) {
    console.error('Failed to update activity', error);
    return res.status(500).json({ ok: false, message: 'Failed to update activity' });
  }
});

// Complete onboarding (set display name and avatar)
router.post('/onboarding/complete', requireAuth, async (req: any, res: any) => {
  try {
    const { displayName, avatar } = req.body as {
      displayName?: string;
      avatar?: string;
    };

    if (!displayName || displayName.trim().length === 0) {
      return res.status(400).json({ ok: false, message: 'Display name is required' });
    }

    if (displayName.length > 32) {
      return res.status(400).json({ ok: false, message: 'Display name must be 32 characters or less' });
    }

    const currentUser = await User.findById(req.user.id);
    if (!currentUser) {
      return res.status(404).json({ ok: false, message: 'User not found' });
    }

    currentUser.displayName = displayName.trim();
    if (avatar) {
      currentUser.avatar = avatar;
    }
    currentUser.hasCompletedOnboarding = true;

    await currentUser.save();

    return res.json({
      ok: true,
      user: {
        email: currentUser.email,
        username: currentUser.username,
        userId: currentUser.userId,
        provider: currentUser.provider,
        displayName: currentUser.displayName,
        avatar: currentUser.avatar,
        hasCompletedOnboarding: currentUser.hasCompletedOnboarding,
        publicKey: currentUser.publicKey,
        encryptedPrivateKey: currentUser.encryptedPrivateKey
      }
    });
  } catch (error) {
    console.error('Failed to complete onboarding', error);
    return res.status(500).json({ ok: false, message: 'Failed to complete onboarding' });
  }
});

// Update privacy settings
router.post('/privacy/one-time-messages', requireAuth, async (req: any, res: any) => {
  try {
    const { allow } = req.body as { allow?: boolean };
    
    if (typeof allow !== 'boolean') {
      return res.status(400).json({ ok: false, message: 'allow must be a boolean' });
    }

    const currentUser = await User.findById(req.user.id);
    if (!currentUser) return res.status(404).json({ ok: false, message: 'User not found' });

    currentUser.allowOneTimeMessages = allow;
    await currentUser.save();

    return res.json({ ok: true, allowOneTimeMessages: allow });
  } catch (error) {
    console.error('Failed to update privacy setting', error);
    return res.status(500).json({ ok: false, message: 'Failed to update privacy setting' });
  }
});

router.get('/privacy/group-adds', requireAuth, async (req: any, res: any) => {
  try {
    const currentUser = await User.findById(req.user.id).select('allowGroupAdds groupAddExceptions contacts');
    if (!currentUser) return res.status(404).json({ ok: false, message: 'User not found' });
    return res.json({
      ok: true,
      allowGroupAdds: currentUser.allowGroupAdds !== false,
      groupAddExceptions: currentUser.groupAddExceptions || [],
      contacts: currentUser.contacts || []
    });
  } catch (error) {
    console.error('Failed to load group-add privacy settings', error);
    return res.status(500).json({ ok: false, message: 'Failed to load group-add privacy settings' });
  }
});

router.post('/privacy/group-adds', requireAuth, async (req: any, res: any) => {
  try {
    const { allow, exceptions } = req.body as { allow?: boolean; exceptions?: unknown };
    if (typeof allow !== 'boolean' || !Array.isArray(exceptions) || exceptions.some(id => typeof id !== 'string')) {
      return res.status(400).json({ ok: false, message: 'allow and a list of friend exceptions are required' });
    }

    const currentUser = await User.findById(req.user.id);
    if (!currentUser) return res.status(404).json({ ok: false, message: 'User not found' });

    const uniqueExceptions = Array.from(new Set(exceptions as string[])).filter(id => id !== currentUser.userId);
    if (uniqueExceptions.some(id => !currentUser.contacts.includes(id))) {
      return res.status(400).json({ ok: false, message: 'Exceptions can only include your friends.' });
    }

    currentUser.allowGroupAdds = allow;
    currentUser.groupAddExceptions = uniqueExceptions;
    await currentUser.save();

    return res.json({ ok: true, allowGroupAdds: allow, groupAddExceptions: uniqueExceptions });
  } catch (error) {
    console.error('Failed to update group-add privacy settings', error);
    return res.status(500).json({ ok: false, message: 'Failed to update group-add privacy settings' });
  }
});

// Admin route to clear all messages and chats (for testing)
router.post('/admin/clear-messages', requireAuth, async (req: any, res: any) => {
  if (req.user.role !== 'admin') return res.status(403).json({ ok: false, message: 'Insufficient permissions' });
  try {
    const { Message } = await import('../models/Message');
    const { GroupChat } = await import('../models/GroupChat');
    
    const messageResult = await Message.deleteMany({});
    const groupChatResult = await GroupChat.deleteMany({});
    
    return res.json({
      ok: true,
      message: `Deleted ${messageResult.deletedCount} messages and ${groupChatResult.deletedCount} group chats`
    });
  } catch (error) {
    console.error('Failed to clear messages and chats', error);
    return res.status(500).json({ ok: false, message: 'Failed to clear messages and chats' });
  }
});

// Admin route to clear all users (for testing)
router.post('/admin/clear-all-users', requireAuth, async (req: any, res: any) => {
  if (req.user.role !== 'admin') return res.status(403).json({ ok: false, message: 'Insufficient permissions' });
  try {
    const result = await User.deleteMany({});
    await AuthCredential.deleteMany({});
    await MessageRequest.deleteMany({});
    await Report.deleteMany({});
    return res.json({
      ok: true,
      message: `Deleted ${result.deletedCount} users and all related data`
    });
  } catch (error) {
    console.error('Failed to clear users', error);
    return res.status(500).json({ ok: false, message: 'Failed to clear users' });
  }
});

// (updateProfileHandler moved above)

// Update one-time messages privacy setting
router.post('/privacy/one-time-messages', requireAuth, async (req: any, res: any) => {
  try {
    const { allow } = req.body;
    
    if (typeof allow !== 'boolean') {
      return res.status(400).json({ ok: false, message: 'allow must be a boolean' });
    }

    const currentUser = await User.findById(req.user.id);
    if (!currentUser) return res.status(404).json({ ok: false, message: 'User not found' });

    currentUser.allowOneTimeMessages = allow;
    await currentUser.save();

    return res.json({
      ok: true,
      message: 'Privacy setting updated',
      allowOneTimeMessages: currentUser.allowOneTimeMessages
    });
  } catch (error) {
    console.error('Failed to update privacy setting', error);
    return res.status(500).json({ ok: false, message: 'Failed to update privacy setting' });
  }
});

// Update profile directly (Settings)
router.patch('/user/profile', requireAuth, async (req: any, res: any) => {
  try {
    const { displayName, pronouns, bio, avatar, banner, themeGradient, customActivity } = req.body;
    
    const currentUser = await User.findById(req.user.id);
    if (!currentUser) return res.status(404).json({ ok: false, message: 'User not found' });

    if (customActivity !== undefined) currentUser.customActivity = sanitize(customActivity);
    if (displayName) currentUser.displayName = sanitize(displayName);
    if (pronouns !== undefined) currentUser.pronouns = sanitize(pronouns);
    if (bio !== undefined) currentUser.bio = sanitize(bio);
    if (avatar) currentUser.avatar = avatar;
    if (banner) currentUser.banner = banner;
    if (themeGradient) currentUser.themeGradient = themeGradient;

    await currentUser.save();

    return res.json({
      ok: true,
      message: 'Profile updated successfully',
      user: {
        _id: currentUser._id,
        username: currentUser.username,
        userId: currentUser.userId,
        provider: currentUser.provider,
        displayName: currentUser.displayName,
        avatar: currentUser.avatar,
        banner: currentUser.banner,
        bio: currentUser.bio,
        pronouns: currentUser.pronouns,
        themeGradient: currentUser.themeGradient,
        customActivity: currentUser.customActivity,
        hasCompletedOnboarding: currentUser.hasCompletedOnboarding
      }
    });
  } catch (error) {
    console.error('Failed to update profile', error);
    return res.status(500).json({ ok: false, message: 'Failed to update profile' });
  }
});

// Get mutual friends with another user
router.get('/user/:userId/mutual-friends', requireAuth, async (req: any, res: any) => {
  try {
    const { userId } = req.params;
    const currentUser = await User.findById(req.user.id);
    if (!currentUser) return res.status(404).json({ ok: false, message: 'User not found' });

    const targetUser = await User.findOne({ userId });
    if (!targetUser) return res.status(404).json({ ok: false, message: 'Target user not found' });

    // Find mutual friends (users in both contact lists)
    const mutualFriendIds = currentUser.contacts.filter((id: string) => 
      targetUser.contacts.includes(id)
    );

    const mutualFriends = await User.find({
      userId: { $in: mutualFriendIds }
    }).select('username displayName avatar userId status');

    return res.json({
      ok: true,
      friends: mutualFriends
    });
  } catch (error) {
    console.error('Failed to get mutual friends', error);
    return res.status(500).json({ ok: false, message: 'Failed to get mutual friends' });
  }
});

// Get mutual spaces with another user
router.get('/user/:userId/mutual-spaces', requireAuth, async (req: any, res: any) => {
  try {
    const { userId } = req.params;
    const currentUser = await User.findById(req.user.id);
    if (!currentUser) return res.status(404).json({ ok: false, message: 'User not found' });

    // For now, return empty array as spaces feature is not fully implemented
    // This can be expanded later when spaces/groups are fully implemented
    return res.json({
      ok: true,
      spaces: []
    });
  } catch (error) {
    console.error('Failed to get mutual spaces', error);
    return res.status(500).json({ ok: false, message: 'Failed to get mutual spaces' });
  }
});

// Report User
router.post('/reports', requireAuth, async (req: any, res: any) => {
  try {
    const { reportedUserId, reason, customReason, chatHistoryPayload } = req.body;
    
    if (!reportedUserId || !reason || !chatHistoryPayload) {
      return res.status(400).json({ ok: false, message: 'Missing report data' });
    }

    const currentUser = await User.findById(req.user.id);
    if (!currentUser) return res.status(404).json({ ok: false, message: 'User not found' });

    await Report.create({
      reporterId: currentUser.userId,
      reportedUserId,
      reason: sanitize(reason),
      customReason: customReason ? sanitize(customReason) : undefined,
      chatHistoryPayload // could be base64 or encrypted
    });

    return res.json({ ok: true, message: 'Report submitted successfully' });
  } catch (error) {
    console.error('Failed to report user', error);
    return res.status(500).json({ ok: false, message: 'Failed to submit report' });
  }
});

// Unblock User
router.post('/friends/unblock', requireAuth, async (req: any, res: any) => {
  try {
    const { targetUserId } = req.body;
    
    if (!targetUserId) return res.status(400).json({ ok: false, message: 'Target user ID required' });

    const currentUser = await User.findById(req.user.id);
    if (!currentUser) return res.status(404).json({ ok: false, message: 'User not found' });

    currentUser.blockedUsers = currentUser.blockedUsers.filter(id => id !== targetUserId);
    await currentUser.save();
    
    return res.json({ ok: true, message: 'User unblocked' });
  } catch (error) {
    console.error('Failed to unblock user', error);
    return res.status(500).json({ ok: false, message: 'Failed to unblock user' });
  }
});

// Reject friend request
router.post('/friends/reject', requireAuth, async (req: any, res: any) => {
  try {
    const { requesterUserId } = req.body;
    if (!requesterUserId) return res.status(400).json({ ok: false, message: 'Requester ID required' });

    const currentUser = await User.findById(req.user.id);
    if (!currentUser) return res.status(404).json({ ok: false, message: 'User not found' });

    currentUser.pendingRequests = currentUser.pendingRequests.filter((r: any) => r.userId !== requesterUserId);
    await currentUser.save();

    return res.json({ ok: true, message: 'Friend request rejected' });
  } catch (error) {
    console.error('Failed to reject friend request', error);
    return res.status(500).json({ ok: false, message: 'Failed to reject friend request' });
  }
});

// Send Message Request
router.post('/messages/request', requireAuth, async (req: any, res: any) => {
  try {
    const { recipientUserId, content } = req.body;
    if (!recipientUserId || !content) return res.status(400).json({ ok: false, message: 'Recipient and content required' });

    const currentUser = await User.findById(req.user.id);
    if (!currentUser) return res.status(404).json({ ok: false, message: 'User not found' });

    const recipient = await User.findOne({ userId: recipientUserId });
    if (!recipient) return res.status(404).json({ ok: false, message: 'Recipient not found' });

    // Check if recipient allows one-time messages
    if (recipient.allowOneTimeMessages === false) {
      return res.status(403).json({ ok: false, message: 'User does not accept one-time messages' });
    }

    // Check if users are already friends (with null check)
    if (currentUser.contacts && currentUser.contacts.includes(recipientUserId)) {
      return res.status(400).json({ ok: false, message: 'You are already friends with this user' });
    }

    // Check if user is blocked (with proper null checks)
    if (currentUser.blockedUsers && currentUser.blockedUsers.includes(recipientUserId)) {
      console.log(`User ${currentUser.userId} has blocked ${recipientUserId}. Blocked users:`, currentUser.blockedUsers);
      return res.status(403).json({ ok: false, message: 'You have blocked this user' });
    }
    if (recipient.blockedUsers && recipient.blockedUsers.includes(currentUser.userId)) {
      console.log(`User ${recipientUserId} has blocked ${currentUser.userId}. Blocked users:`, recipient.blockedUsers);
      return res.status(403).json({ ok: false, message: 'This user has blocked you' });
    }

    // Check if user previously rejected by this recipient (permanent block)
    if (currentUser.oneTimeMessageRejectedUsers && currentUser.oneTimeMessageRejectedUsers.includes(recipientUserId)) {
      console.log(`User ${recipientUserId} has rejected one-time message from ${currentUser.userId}. Rejected users:`, currentUser.oneTimeMessageRejectedUsers);
      return res.status(403).json({ ok: false, message: 'This user has rejected your one-time message request' });
    }

    // Check 3-day cooldown
    const cooldownPeriod = 3 * 24 * 60 * 60 * 1000; // 3 days in milliseconds
    const existingCooldown = currentUser.oneTimeMessageCooldowns?.find(
      (c: any) => c.targetUserId === recipientUserId && Date.now() - new Date(c.lastSent).getTime() < cooldownPeriod
    );
    
    if (existingCooldown) {
      const timeRemaining = Math.ceil((cooldownPeriod - (Date.now() - new Date(existingCooldown.lastSent).getTime())) / (1000 * 60 * 60 * 24));
      return res.status(429).json({ ok: false, message: `You can send another one-time message in ${timeRemaining} days` });
    }

    const existingRequest = await MessageRequest.findOne({
      senderUserId: currentUser.userId,
      recipientUserId,
      status: 'pending'
    });
    if (existingRequest) return res.status(400).json({ ok: false, message: 'Request already pending' });

    // Create conversation with pending_one_time status
    const roomId = [currentUser.userId, recipientUserId].sort().join('_');
    let conversation = await Conversation.findOne({ roomId });
    
    if (!conversation) {
      conversation = await Conversation.create({
        roomId,
        participants: [currentUser.userId, recipientUserId],
        status: 'pending_one_time',
        initiatedBy: currentUser.userId,
        isOneTimeMessage: true
      });
    } else if (conversation.status === 'declined') {
      // Reset to pending if previously declined
      conversation.status = 'pending_one_time';
      conversation.initiatedBy = currentUser.userId;
      conversation.isOneTimeMessage = true;
      await conversation.save();
    }

    const newRequest = await MessageRequest.create({
      senderUserId: currentUser.userId,
      senderUsername: currentUser.username,
      recipientUserId,
      content,
      status: 'pending'
    });

    // Update cooldown
    if (!currentUser.oneTimeMessageCooldowns) {
      currentUser.oneTimeMessageCooldowns = [];
    }
    // Remove old cooldown if exists
    currentUser.oneTimeMessageCooldowns = currentUser.oneTimeMessageCooldowns.filter(
      (c: any) => c.targetUserId !== recipientUserId
    );
    // Add new cooldown
    currentUser.oneTimeMessageCooldowns.push({
      targetUserId: recipientUserId,
      lastSent: new Date()
    });
    await currentUser.save();

    const io = req.app.get('io');
    if (io) {
      io.to(recipientUserId).emit('message_request_received', {
        id: newRequest._id,
        senderId: currentUser.userId,
        username: currentUser.username,
        avatar: currentUser.avatar,
        content: newRequest.content,
        timestamp: newRequest.createdAt
      });
    }

    return res.json({ ok: true, message: 'Message request sent' });
  } catch (error) {
    console.error('Failed to send message request', error);
    return res.status(500).json({ ok: false, message: 'Failed to send message request' });
  }
});

// Get Message Requests
router.get('/messages/requests', requireAuth, async (req: any, res: any) => {
  try {
    const currentUser = await User.findById(req.user.id);
    if (!currentUser) return res.status(404).json({ ok: false, message: 'User not found' });

    const requests = await MessageRequest.find({
      recipientUserId: currentUser.userId,
      status: 'pending'
    }).sort({ createdAt: -1 });

    const formattedRequests = requests.map(r => ({
      id: r._id,
      senderId: r.senderUserId,
      username: r.senderUsername,
      content: r.content,
      timestamp: r.createdAt
    }));

    return res.json({ ok: true, requests: formattedRequests });
  } catch (error) {
    console.error('Failed to fetch message requests', error);
    return res.status(500).json({ ok: false, message: 'Failed to fetch message requests' });
  }
});

// Action on Message Request (accept/reject)
router.post('/messages/request/action', requireAuth, async (req: any, res: any) => {
  try {
    const { requestId, action } = req.body; // action: 'accept' | 'reject'
    if (!requestId || !['accept', 'reject'].includes(action)) {
      return res.status(400).json({ ok: false, message: 'Invalid payload' });
    }

    const currentUser = await User.findById(req.user.id);
    if (!currentUser) return res.status(404).json({ ok: false, message: 'User not found' });

    const mRequest = await MessageRequest.findOne({ _id: requestId, recipientUserId: currentUser.userId, status: 'pending' });
    if (!mRequest) return res.status(404).json({ ok: false, message: 'Request not found' });

    const sender = await User.findOne({ userId: mRequest.senderUserId });
    if (!sender) return res.status(404).json({ ok: false, message: 'Sender not found' });

    mRequest.status = action === 'accept' ? 'accepted' : 'rejected';
    await mRequest.save();

    if (action === 'accept') {
      // Update conversation status to accepted
      const roomId = [currentUser.userId, sender.userId].sort().join('_');
      const conversation = await Conversation.findOne({ roomId });
      
      if (conversation) {
        conversation.status = 'accepted';
        await conversation.save();
      }

      // Add to accepted users list (allows chat while unfriended)
      if (!currentUser.oneTimeMessageAcceptedUsers) {
        currentUser.oneTimeMessageAcceptedUsers = [];
      }
      if (!currentUser.oneTimeMessageAcceptedUsers.includes(sender.userId)) {
        currentUser.oneTimeMessageAcceptedUsers.push(sender.userId);
      }
      if (!sender.oneTimeMessageAcceptedUsers) {
        sender.oneTimeMessageAcceptedUsers = [];
      }
      if (!sender.oneTimeMessageAcceptedUsers.includes(currentUser.userId)) {
        sender.oneTimeMessageAcceptedUsers.push(currentUser.userId);
      }
      await currentUser.save();
      await sender.save();

      // Save the original message from the request
      await Message.create({
        roomId,
        senderId: sender.userId,
        senderName: sender.displayName || sender.username,
        content: mRequest.content,
        timestamp: mRequest.createdAt
      });

      const io = req.app.get('io');
      if (io) {
        io.to(sender.userId).emit('message_request_accepted', {
          roomId,
          recipientId: currentUser.userId,
          recipientName: currentUser.displayName || currentUser.username
        });
        io.to(currentUser.userId).emit('one_time_accepted', {
          roomId,
          senderId: sender.userId,
          senderName: sender.displayName || sender.username
        });
      }
    } else {
      // Update conversation status to declined
      const roomId = [currentUser.userId, sender.userId].sort().join('_');
      const conversation = await Conversation.findOne({ roomId });
      
      if (conversation) {
        conversation.status = 'declined';
        await conversation.save();
      }

      // Add to rejected users list (permanent block for sender)
      if (!sender.oneTimeMessageRejectedUsers) {
        sender.oneTimeMessageRejectedUsers = [];
      }
      if (!sender.oneTimeMessageRejectedUsers.includes(currentUser.userId)) {
        sender.oneTimeMessageRejectedUsers.push(currentUser.userId);
      }
      await sender.save();
    }

    return res.json({ ok: true, message: `Request ${action}ed` });
  } catch (error) {
    console.error('Failed to process message request action', error);
    return res.status(500).json({ ok: false, message: 'Failed to process message request action' });
  }
});

// Get user's conversations
router.get('/conversations', requireAuth, async (req: any, res: any) => {
  try {
    const currentUser = await User.findById(req.user.id);
    if (!currentUser) return res.status(404).json({ ok: false, message: 'User not found' });

    const conversations = await Conversation.find({
      participants: currentUser.userId,
      status: { $in: ['accepted', 'pending_one_time'] }
    });

    const friendIds = currentUser.contacts || [];
    const blockedUsers = currentUser.blockedUsers || [];
    const usersWhoBlockedMe = await User.find({ blockedUsers: currentUser.userId }).distinct('userId');
    const blockedConversationIds = Array.from(new Set([...blockedUsers, ...usersWhoBlockedMe]));
    const otherUserIds = Array.from(new Set([
      ...friendIds,
      ...blockedConversationIds,
      ...conversations.flatMap(conversation => conversation.participants.filter((id: string) => id !== currentUser.userId))
    ]));
    const users = await User.find({ userId: { $in: otherUserIds } }).select('userId username displayName avatar status');
    const usersById = new Map(users.map(otherUser => [otherUser.userId, otherUser]));
    const roomIds = Array.from(new Set([
      ...friendIds.map((friendId: string) => [currentUser.userId, friendId].sort().join('_')),
      ...blockedConversationIds.map((blockedId: string) => [currentUser.userId, blockedId].sort().join('_')),
      ...conversations.map(conversation => conversation.roomId)
    ]));
    const recentMessages = await Message.find({ roomId: { $in: roomIds } })
      .sort({ createdAt: -1 })
      .select('roomId senderId content createdAt readBy')
      .lean();
    const latestMessageByRoom = new Map<string, any>();
    const unreadCountByRoom = new Map<string, number>();
    recentMessages.forEach(message => {
      if (!latestMessageByRoom.has(message.roomId)) latestMessageByRoom.set(message.roomId, message);
      if (message.senderId !== currentUser.userId && (!message.readBy || !message.readBy.includes(currentUser.userId))) {
        unreadCountByRoom.set(message.roomId, (unreadCountByRoom.get(message.roomId) || 0) + 1);
      }
    });
    const serializeLastMessage = (message: any) => message ? {
      id: message._id,
      content: message.content,
      timestamp: message.createdAt,
      senderId: message.senderId,
      readBy: message.readBy,
      isSystemMessage: message.isSystemMessage,
      systemType: message.systemType
    } : null;

    const conversationsWithDetails = conversations.map(conversation => {
      const otherUserId = conversation.participants.find((id: string) => id !== currentUser.userId);
      const otherUser = otherUserId ? usersById.get(otherUserId) : null;
      const lastMessage = latestMessageByRoom.get(conversation.roomId);
      return {
        roomId: conversation.roomId,
        status: conversation.status,
        isOneTimeMessage: conversation.isOneTimeMessage,
        initiatedBy: conversation.initiatedBy,
        otherUser: otherUser ? {
          userId: otherUser.userId,
          username: otherUser.username,
          displayName: otherUser.displayName,
          avatar: otherUser.avatar,
          status: otherUser.status
        } : null,
        lastMessage: serializeLastMessage(lastMessage),
        unreadCount: unreadCountByRoom.get(conversation.roomId) || 0,
        updatedAt: conversation.updatedAt
      };
    });

    const includedRooms = new Set(conversations.map(conversation => conversation.roomId));
    friendIds.forEach((friendId: string) => {
      const roomId = [currentUser.userId, friendId].sort().join('_');
      if (includedRooms.has(roomId)) return;
      const otherUser = usersById.get(friendId);
      if (!otherUser) return;
      const lastMessage = latestMessageByRoom.get(roomId);
      conversationsWithDetails.push({
        roomId,
        status: 'accepted',
        isOneTimeMessage: false,
        initiatedBy: currentUser.userId,
        otherUser: {
          userId: otherUser.userId,
          username: otherUser.username,
          displayName: otherUser.displayName,
          avatar: otherUser.avatar,
          status: otherUser.status
        },
        lastMessage: serializeLastMessage(lastMessage),
        unreadCount: unreadCountByRoom.get(roomId) || 0,
        updatedAt: lastMessage?.createdAt || new Date(0)
      });
    });

    blockedConversationIds.forEach((blockedId: string) => {
      const roomId = [currentUser.userId, blockedId].sort().join('_');
      if (includedRooms.has(roomId)) return;
      const otherUser = usersById.get(blockedId);
      if (!otherUser) return;
      const lastMessage = latestMessageByRoom.get(roomId);
      conversationsWithDetails.push({
        roomId,
        status: 'accepted',
        isOneTimeMessage: false,
        initiatedBy: currentUser.userId,
        otherUser: {
          userId: otherUser.userId,
          username: otherUser.username,
          displayName: otherUser.displayName,
          avatar: otherUser.avatar,
          status: otherUser.status
        },
        lastMessage: serializeLastMessage(lastMessage),
        unreadCount: unreadCountByRoom.get(roomId) || 0,
        updatedAt: lastMessage?.createdAt || new Date(0)
      });
    });

    conversationsWithDetails.sort((a, b) => {
      const aActivity = new Date(a.lastMessage?.timestamp || a.updatedAt).getTime();
      const bActivity = new Date(b.lastMessage?.timestamp || b.updatedAt).getTime();
      return bActivity - aActivity;
    });

    return res.json({ ok: true, conversations: conversationsWithDetails });
  } catch (error) {
    console.error('Failed to get conversations', error);
    return res.status(500).json({ ok: false, message: 'Failed to get conversations' });
  }
});

// Decline conversation (with optional block)
router.post('/conversations/:roomId/decline', requireAuth, async (req: any, res: any) => {
  try {
    const { roomId } = req.params;
    const { blockUser = false } = req.body;

    const currentUser = await User.findById(req.user.id);
    if (!currentUser) return res.status(404).json({ ok: false, message: 'User not found' });

    const conversation = await Conversation.findOne({ roomId });
    if (!conversation) return res.status(404).json({ ok: false, message: 'Conversation not found' });

    if (!conversation.participants.includes(currentUser.userId)) {
      return res.status(403).json({ ok: false, message: 'Not a participant in this conversation' });
    }

    // Update conversation status to declined
    conversation.status = 'declined';
    await conversation.save();

    // Find the other participant
    const otherUserId = conversation.participants.find((id: string) => id !== currentUser.userId);
    if (otherUserId && blockUser) {
      // Block the user
      if (!currentUser.blockedUsers) {
        currentUser.blockedUsers = [];
      }
      if (!currentUser.blockedUsers.includes(otherUserId)) {
        currentUser.blockedUsers.push(otherUserId);
      }
      await currentUser.save();
    }

    // Add sender to rejected users list
    if (otherUserId) {
      const sender = await User.findOne({ userId: otherUserId });
      if (sender) {
        if (!sender.oneTimeMessageRejectedUsers) {
          sender.oneTimeMessageRejectedUsers = [];
        }
        if (!sender.oneTimeMessageRejectedUsers.includes(currentUser.userId)) {
          sender.oneTimeMessageRejectedUsers.push(currentUser.userId);
        }
        await sender.save();
      }
    }

    return res.json({ ok: true, message: 'Conversation declined' });
  } catch (error) {
    console.error('Failed to decline conversation', error);
    return res.status(500).json({ ok: false, message: 'Failed to decline conversation' });
  }
});

// Update user profile settings
const updateProfileHandler = async (req: any, res: any) => {
  try {
    const { displayName, pronouns, bio, avatar, banner, themeGradient, customActivity } = req.body;
    const currentUser = await User.findById(req.user.id);
    if (!currentUser) return res.status(404).json({ ok: false, message: 'User not found' });

    if (displayName !== undefined) currentUser.displayName = displayName;
    if (pronouns !== undefined) (currentUser as any).pronouns = pronouns;
    if (bio !== undefined) currentUser.bio = bio;
    if (avatar !== undefined) currentUser.avatar = avatar;
    if (banner !== undefined) (currentUser as any).banner = banner;
    if (themeGradient !== undefined) currentUser.themeGradient = themeGradient;
    if (customActivity !== undefined) currentUser.customActivity = customActivity;

    await currentUser.save();
    const updatedUser = await User.findById(req.user.id).select(
      'email username userId provider displayName avatar banner bio pronouns themeGradient note customActivity hasCompletedOnboarding contacts pendingRequests status createdAt allowOneTimeMessages allowGroupAdds groupAddExceptions badges memberNumber role'
    );
    const io = req.app.get('io');
    if (io && updatedUser) {
      io.emit('user:profile-updated', {
        userId: updatedUser.userId,
        username: updatedUser.username,
        displayName: updatedUser.displayName,
        avatar: updatedUser.avatar,
        banner: updatedUser.banner,
        bio: updatedUser.bio,
        pronouns: updatedUser.pronouns,
        themeGradient: updatedUser.themeGradient,
        customActivity: updatedUser.customActivity,
        note: updatedUser.note,
        badges: updatedUser.badges,
        memberNumber: updatedUser.memberNumber,
        status: updatedUser.status
      });
    }
    return res.json({ ok: true, user: updatedUser });
  } catch (error) {
    console.error('Failed to update profile', error);
    return res.status(500).json({ ok: false, message: 'Failed to update profile' });
  }
};

router.patch('/profile', requireAuth, updateProfileHandler);
router.patch('/user/profile', requireAuth, updateProfileHandler);
router.put('/profile', requireAuth, updateProfileHandler);

// Favorite GIFs
router.get('/favorite-gifs', requireAuth, async (req: any, res: any) => {
  try {
    const user = await User.findById(req.user.id).select('favoriteGifs');
    return res.json({ ok: true, favoriteGifs: user?.favoriteGifs || [] });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'Failed to fetch favorite GIFs' });
  }
});

router.post('/favorite-gifs', requireAuth, async (req: any, res: any) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') return res.status(400).json({ ok: false, message: 'GIF URL is required' });
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ ok: false, message: 'User not found' });
    if (!user.favoriteGifs) user.favoriteGifs = [];
    if (!user.favoriteGifs.includes(url)) {
      user.favoriteGifs.unshift(url);
      if (user.favoriteGifs.length > 100) user.favoriteGifs = user.favoriteGifs.slice(0, 100);
      await user.save();
    }
    return res.json({ ok: true, favoriteGifs: user.favoriteGifs });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'Failed to add favorite GIF' });
  }
});

router.delete('/favorite-gifs', requireAuth, async (req: any, res: any) => {
  try {
    const url = req.body?.url || (req.query?.url as string);
    if (!url || typeof url !== 'string') return res.status(400).json({ ok: false, message: 'GIF URL is required' });
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ ok: false, message: 'User not found' });
    if (user.favoriteGifs) {
      user.favoriteGifs = user.favoriteGifs.filter(u => u !== url);
      await user.save();
    }
    return res.json({ ok: true, favoriteGifs: user.favoriteGifs || [] });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'Failed to remove favorite GIF' });
  }
});

// Update public key
router.post('/user/public-key', requireAuth, async (req: any, res: any) => {
  try {
    const { publicKey, encryptedPrivateKey, keySalt } = req.body;
    if (!publicKey && !encryptedPrivateKey) return res.status(400).json({ ok: false, message: 'Public key or encrypted private key required' });
    const currentUser = await User.findById(req.user.id);
    if (!currentUser) return res.status(404).json({ ok: false, message: 'User not found' });
    if (publicKey) currentUser.publicKey = publicKey;
    if (encryptedPrivateKey) currentUser.encryptedPrivateKey = encryptedPrivateKey;
    if (keySalt) currentUser.keySalt = keySalt;
    await currentUser.save();
    return res.json({ ok: true, message: 'Public key updated' });
  } catch (error) {
    console.error('Failed to update public key', error);
    return res.status(500).json({ ok: false, message: 'Failed to update public key' });
  }
});

// Get user's note
router.get('/user/:userId/note', requireAuth, async (req: any, res: any) => {
  try {
    const { userId } = req.params;
    const user = await User.findOne({ userId }).select('note');
    if (!user) return res.status(404).json({ ok: false, message: 'User not found' });
    
    // Check if note is expired
    if (user.note && user.note.expiresAt && new Date() > user.note.expiresAt) {
      user.note = undefined;
      await user.save();
    }
    
    return res.json({ ok: true, note: user.note });
  } catch (error) {
    console.error('Failed to get user note', error);
    return res.status(500).json({ ok: false, message: 'Failed to get user note' });
  }
});

// Update user's note
router.post('/user/note', requireAuth, async (req: any, res: any) => {
  try {
    const { text, song, gif, duration } = req.body;
    const currentUser = await User.findById(req.user.id);
    if (!currentUser) return res.status(404).json({ ok: false, message: 'User not found' });

    // Validate that only two of the three types are present
    const hasText = text && text.trim();
    const hasSong = song;
    const hasGif = gif;
    const typeCount = [hasText, hasSong, hasGif].filter(Boolean).length;

    if (typeCount > 2) {
      return res.status(400).json({ ok: false, message: 'Note can only contain two of text, song, or GIF' });
    }

    if (typeCount === 0) {
      return res.status(400).json({ ok: false, message: 'Note must contain at least one of text, song, or GIF' });
    }

    // Calculate expiry date
    let expiresAt: Date | undefined;
    if (duration !== 'manual') {
      const now = new Date();
      switch (duration) {
        case '1day':
          expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
          break;
        case '3days':
          expiresAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
          break;
        case '1week':
          expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          break;
      }
    }

    currentUser.note = {
      text: text?.trim() || '',
      song,
      gif,
      duration,
      expiresAt
    };

    await currentUser.save();
    return res.json({ ok: true, note: currentUser.note });
  } catch (error) {
    console.error('Failed to update user note', error);
    return res.status(500).json({ ok: false, message: 'Failed to update user note' });
  }
});

// Delete user's note
router.delete('/user/note', requireAuth, async (req: any, res: any) => {
  try {
    const currentUser = await User.findById(req.user.id);
    if (!currentUser) return res.status(404).json({ ok: false, message: 'User not found' });

    currentUser.note = undefined;
    await currentUser.save();
    return res.json({ ok: true, message: 'Note deleted' });
  } catch (error) {
    console.error('Failed to delete user note', error);
    return res.status(500).json({ ok: false, message: 'Failed to delete user note' });
  }
});

// Get user public key
router.get('/user/:userId/public-key', requireAuth, async (req: any, res: any) => {
  try {
    const targetUser = await User.findOne({ userId: req.params.userId });
    if (!targetUser || !targetUser.publicKey) return res.status(404).json({ ok: false, message: 'Public key not found' });
    return res.json({ ok: true, publicKey: targetUser.publicKey });
  } catch (error) {
    console.error('Failed to get public key', error);
    return res.status(500).json({ ok: false, message: 'Failed to get public key' });
  }
});

// Delete account
router.delete('/account', requireAuth, async (req: any, res: any) => {
  try {
    const currentUser = await User.findById(req.user.id);
    if (!currentUser) return res.status(404).json({ ok: false, message: 'User not found' });

    const userId = currentUser.userId;

    // Delete user's auth credentials
    await AuthCredential.deleteMany({ userId: currentUser._id });

    // Delete user's messages
    await Message.deleteMany({ senderId: userId });

    // Delete user's message requests (both sent and received)
    await MessageRequest.deleteMany({ $or: [{ senderId: userId }, { recipientUserId: userId }] });

    // Remove user from other users' contact lists
    await User.updateMany(
      { contacts: userId },
      { $pull: { contacts: userId } }
    );

    // Remove user from other users' pending requests
    await User.updateMany(
      { 'pendingRequests.userId': userId },
      { $pull: { pendingRequests: { userId } } }
    );

    // Remove user from other users' blocked lists
    await User.updateMany(
      { blockedUsers: userId },
      { $pull: { blockedUsers: userId } }
    );

    // Remove user from other users' accepted/rejected one-time message lists
    await User.updateMany(
      { oneTimeMessageAcceptedUsers: userId },
      { $pull: { oneTimeMessageAcceptedUsers: userId } }
    );

    await User.updateMany(
      { oneTimeMessageRejectedUsers: userId },
      { $pull: { oneTimeMessageRejectedUsers: userId } }
    );

    // Delete the user
    await User.findByIdAndDelete(currentUser._id);

    return res.json({ ok: true, message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Failed to delete account', error);
    return res.status(500).json({ ok: false, message: 'Failed to delete account' });
  }
});

export default router;
