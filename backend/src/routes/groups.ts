import express from 'express';
import { requireAuth } from '../middleware/auth';
import { GroupChat } from '../models/GroupChat';
import { User } from '../models/User';

const router = express.Router();

// Get user's group chats
router.get('/me', requireAuth, async (req: any, res: any) => {
  try {
    const currentUser = await User.findById(req.user.id);
    if (!currentUser) return res.status(404).json({ ok: false, message: 'User not found' });

    const groups = await GroupChat.find({ 'members.userId': currentUser.userId });

    // Populate member details for each group
    const populatedGroups = await Promise.all(
      groups.map(async (group) => {
        const memberUserIds = group.members.map(m => m.userId);
        const users = await User.find({ userId: { $in: memberUserIds } }).select('username displayName avatar publicKey userId badges memberNumber');

        const membersWithDetails = group.members.map(member => {
          const memberData = (member as any).toObject();
          const user = users.find(u => u.userId === memberData.userId);
          return {
            ...memberData,
            username: user?.username,
            displayName: user?.displayName,
            avatar: user?.avatar,
            publicKey: user?.publicKey,
            badges: user?.badges || [],
            memberNumber: user?.memberNumber
          };
        });

        return {
          ...group.toObject(),
          members: membersWithDetails
        };
      })
    );

    return res.json({ ok: true, groups: populatedGroups });
  } catch (err) {
    console.error('Failed to fetch user groups', err);
    return res.status(500).json({ ok: false, message: 'Failed to fetch user groups' });
  }
});

// Get Group Details
router.get('/:id', requireAuth, async (req: any, res: any) => {
  try {
    const currentUser = await User.findById(req.user.id);
    if (!currentUser) return res.status(404).json({ ok: false, message: 'User not found' });

    const group = await GroupChat.findById(req.params.id);
    if (!group) return res.status(404).json({ ok: false, message: 'Group not found' });

    // Check if user is a member
    const isMember = group.members.some(m => m.userId === currentUser.userId);
    if (!isMember) return res.status(403).json({ ok: false, message: 'Not a member' });

    // Populate member details
    const memberUserIds = group.members.map(m => m.userId);
    const users = await User.find({ userId: { $in: memberUserIds } }).select('username displayName avatar publicKey userId badges memberNumber');

    const membersWithDetails = group.members.map(member => {
      const memberData = (member as any).toObject();
      const user = users.find(u => u.userId === memberData.userId);
      return {
        ...memberData,
        username: user?.username,
        displayName: user?.displayName,
        avatar: user?.avatar,
        publicKey: user?.publicKey,
        badges: user?.badges || [],
        memberNumber: user?.memberNumber
      };
    });

    const populatedGroup = {
      ...group.toObject(),
      members: membersWithDetails
    };

    return res.json({ ok: true, group: populatedGroup });
  } catch (err) {
    console.error('Failed to get group', err);
    return res.status(500).json({ ok: false, message: 'Failed to get group' });
  }
});

// Create Group Chat
router.post('/create', requireAuth, async (req: any, res: any) => {
  try {
    console.log('Group creation request received:', req.body);
    const { name, memberIds } = req.body;

    if (!name || typeof name !== 'string') {
      console.log('Invalid group name');
      return res.status(400).json({ ok: false, message: 'Invalid group name' });
    }

    if (!Array.isArray(memberIds) || memberIds.some(userId => typeof userId !== 'string' || !userId.trim())) {
      console.log('Invalid members array');
      return res.status(400).json({ ok: false, message: 'Invalid members array' });
    }

    console.log('Fetching current user with id:', req.user.id);
    const currentUser = await User.findById(req.user.id);
    if (!currentUser) {
      console.log('User not found');
      return res.status(404).json({ ok: false, message: 'User not found' });
    }

    console.log('Current user found:', currentUser.userId);
    const inviteeIds = Array.from(new Set(memberIds as string[])).filter(userId => userId !== currentUser.userId);
    if (inviteeIds.some(userId => !(currentUser.contacts || []).includes(userId))) {
      return res.status(403).json({ ok: false, message: 'You can only add friends to a group chat.' });
    }

    const invitees = await User.find({ userId: { $in: inviteeIds } }).select('userId username allowGroupAdds groupAddExceptions blockedUsers');
    if (invitees.length !== inviteeIds.length) {
      return res.status(404).json({ ok: false, message: 'One or more selected friends no longer exist.' });
    }
    const blockedByPrivacy = invitees.filter(invitee =>
      invitee.allowGroupAdds === false && !(invitee.groupAddExceptions || []).includes(currentUser.userId)
    );
    if (blockedByPrivacy.length) {
      return res.status(403).json({
        ok: false,
        message: `${blockedByPrivacy.map(invitee => invitee.username).join(', ')} ${blockedByPrivacy.length === 1 ? 'does' : 'do'} not allow group additions from you.`
      });
    }
    if (invitees.some(invitee => invitee.blockedUsers.includes(currentUser.userId))) {
      return res.status(403).json({ ok: false, message: 'You cannot add someone who has blocked you.' });
    }

    // Ensure creator is in the list and unique
    const uniqueIds = Array.from(new Set([...inviteeIds, currentUser.userId]));
    console.log('Unique member IDs:', uniqueIds);

    if (uniqueIds.length > 10) {
      console.log('Too many members');
      return res.status(400).json({ ok: false, message: 'Group chats cannot exceed 10 members' });
    }

    const members = uniqueIds.map(userId => ({
      userId,
      role: userId === currentUser.userId ? 'Owner' : 'Member',
      joinedAt: new Date()
    }));
    console.log('Members array with roles:', members);
    console.log('Current user userId:', currentUser.userId);
    console.log('Setting role for current user:', uniqueIds.map(uid => ({ userId: uid, role: uid === currentUser.userId ? 'Owner' : 'Member' })));

    console.log('Creating group in database...');
    const group = await GroupChat.create({
      name,
      createdBy: currentUser.userId,
      members
    });
    console.log('Group created:', group);

    // Populate member details for the response
    const memberUserIds = group.members.map(m => m.userId);
    const users = await User.find({ userId: { $in: memberUserIds } }).select('username displayName avatar userId');
    console.log('Found users for members:', users.length);

    const membersWithDetails = group.members.map(member => {
      const user = users.find(u => u.userId === member.userId);
      return {
        ...member,
        username: user?.username,
        displayName: user?.displayName,
        avatar: user?.avatar
      };
    });

    const populatedGroup = {
      ...group.toObject(),
      members: membersWithDetails
    };
    console.log('Populated group:', populatedGroup);

    // Notify all members via socket (including offline users who will see it when they connect)
    const io = req.app.get('io');
    if (io) {
      console.log('Emitting group:created to members:', uniqueIds);
      uniqueIds.forEach(userId => {
        io.to(userId).emit('group:created', {
          groupId: group._id,
          name: group.name,
          createdBy: currentUser.userId,
          members: group.members
        });
      });
    }

    console.log('Sending success response');
    return res.json({ ok: true, group: populatedGroup });
  } catch (err) {
    console.error('Failed to create group', err);
    return res.status(500).json({ ok: false, message: 'Failed to create group' });
  }
});

// Invite / Add Members
router.post('/:id/invite', requireAuth, async (req: any, res: any) => {
  try {
    const { memberIds } = req.body as { memberIds?: unknown };
    if (!Array.isArray(memberIds) || memberIds.some(userId => typeof userId !== 'string' || !userId.trim())) {
      return res.status(400).json({ ok: false, message: 'Invalid members array' });
    }

    const group = await GroupChat.findById(req.params.id);
    if (!group) return res.status(404).json({ ok: false, message: 'Group not found' });

    const currentUser = await User.findById(req.user.id);
    if (!currentUser) return res.status(404).json({ ok: false, message: 'User not found' });

    const currentMember = group.members.find(m => m.userId === currentUser.userId);
    if (!currentMember) return res.status(403).json({ ok: false, message: 'Not a group member' });
    const canAddMembers = currentMember.role !== 'Member' || group.allowMemberAdds;
    if (!canAddMembers) {
      return res.status(403).json({ ok: false, message: 'Only the owner and admins can add members until member invites are enabled.' });
    }

    const requestedIds = Array.from(new Set(memberIds as string[]));
    const newMemberIds = requestedIds.filter(userId => !group.members.some(member => member.userId === userId));
    if (!newMemberIds.length) return res.json({ ok: true, group, addedMemberIds: [] });

    const notFriends = newMemberIds.filter(userId => !(currentUser.contacts || []).includes(userId));
    if (notFriends.length) {
      return res.status(403).json({ ok: false, message: 'You can only add people from your friends list.' });
    }

    const targetUsers = await User.find({ userId: { $in: newMemberIds } }).select('userId username allowGroupAdds groupAddExceptions blockedUsers');
    if (targetUsers.length !== newMemberIds.length) {
      return res.status(404).json({ ok: false, message: 'One or more selected friends no longer exist.' });
    }

    const blockedByPrivacy = targetUsers.filter(target =>
      target.allowGroupAdds === false && !(target.groupAddExceptions || []).includes(currentUser.userId)
    );
    if (blockedByPrivacy.length) {
      return res.status(403).json({
        ok: false,
        message: `${blockedByPrivacy.map(target => target.username).join(', ')} ${blockedByPrivacy.length === 1 ? 'does' : 'do'} not allow group additions from you.`
      });
    }

    const blockedInviter = targetUsers.filter(target => target.blockedUsers.includes(currentUser.userId));
    if (blockedInviter.length) {
      return res.status(403).json({ ok: false, message: 'You cannot add someone who has blocked you.' });
    }

    if (group.members.length + newMemberIds.length > 10) {
      return res.status(400).json({ ok: false, message: 'Adding these members would exceed the 10-member limit' });
    }

    newMemberIds.forEach(userId => {
      group.members.push({ userId, role: 'Member', joinedAt: new Date() } as any);
    });

    await group.save();

    const io = req.app.get('io');
    if (io) {
      const groupId = String(group._id);
      io.to(groupId).emit('group:members-updated', { groupId, addedMemberIds: newMemberIds });
      newMemberIds.forEach(userId => io.to(userId).emit('group:member-added', { groupId, name: group.name, addedBy: currentUser.userId }));
    }

    return res.json({ ok: true, group, addedMemberIds: newMemberIds });
  } catch (err) {
    console.error('Failed to invite members', err);
    return res.status(500).json({ ok: false, message: 'Failed to invite members' });
  }
});

router.patch('/:id/settings', requireAuth, async (req: any, res: any) => {
  try {
    const body = req.body as {
      allowMemberAdds?: unknown;
      allowMemberEditInfo?: unknown;
      name?: unknown;
      description?: unknown;
    };
    const allowedKeys = new Set(['allowMemberAdds', 'allowMemberEditInfo', 'name', 'description']);
    if (!body || Object.keys(body).length === 0 || Object.keys(body).some(key => !allowedKeys.has(key))) {
      return res.status(400).json({ ok: false, message: 'Provide valid group settings to update.' });
    }
    if (body.allowMemberAdds !== undefined && typeof body.allowMemberAdds !== 'boolean') {
      return res.status(400).json({ ok: false, message: 'allowMemberAdds must be a boolean' });
    }
    if (body.allowMemberEditInfo !== undefined && typeof body.allowMemberEditInfo !== 'boolean') {
      return res.status(400).json({ ok: false, message: 'allowMemberEditInfo must be a boolean' });
    }
    if (body.name !== undefined && (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 100)) {
      return res.status(400).json({ ok: false, message: 'Group names must be between 1 and 100 characters.' });
    }
    if (body.description !== undefined && (typeof body.description !== 'string' || body.description.length > 500)) {
      return res.status(400).json({ ok: false, message: 'Group descriptions must be 500 characters or shorter.' });
    }

    const group = await GroupChat.findById(req.params.id);
    if (!group) return res.status(404).json({ ok: false, message: 'Group not found' });
    const currentUser = await User.findById(req.user.id);
    if (!currentUser) return res.status(404).json({ ok: false, message: 'User not found' });

    const currentMember = group.members.find(member => member.userId === currentUser.userId);
    if (!currentMember) {
      return res.status(403).json({ ok: false, message: 'Not a group member.' });
    }

    const changingPermissions = body.allowMemberAdds !== undefined || body.allowMemberEditInfo !== undefined;
    if (changingPermissions && currentMember.role !== 'Owner') {
      return res.status(403).json({ ok: false, message: 'Only the group owner can change member permissions.' });
    }
    const changingProfile = body.name !== undefined || body.description !== undefined;
    if (changingProfile && currentMember.role !== 'Owner' && currentMember.role !== 'Admin' && !group.allowMemberEditInfo) {
      return res.status(403).json({ ok: false, message: 'You do not have permission to edit this group’s details.' });
    }

    if (body.allowMemberAdds !== undefined) group.allowMemberAdds = body.allowMemberAdds;
    if (body.allowMemberEditInfo !== undefined) group.allowMemberEditInfo = body.allowMemberEditInfo;
    if (body.name !== undefined) group.name = body.name.trim();
    if (body.description !== undefined) group.description = body.description.trim();
    await group.save();
    const groupId = String(group._id);
    const io = req.app.get('io');
    const settings = {
      groupId,
      allowMemberAdds: group.allowMemberAdds,
      allowMemberEditInfo: group.allowMemberEditInfo,
      name: group.name,
      description: group.description
    };
    if (io) {
      io.to(groupId).emit('group:settings-updated', settings);
      group.members.forEach(member => io.to(member.userId).emit('group:settings-updated', settings));
    }

    return res.json({ ok: true, ...settings });
  } catch (error) {
    console.error('Failed to update group settings', error);
    return res.status(500).json({ ok: false, message: 'Failed to update group settings' });
  }
});

// Kick Member
router.post('/:id/kick', requireAuth, async (req: any, res: any) => {
  try {
    const { targetUserId } = req.body;
    
    const group = await GroupChat.findById(req.params.id);
    if (!group) return res.status(404).json({ ok: false, message: 'Group not found' });

    const currentUser = await User.findById(req.user.id);
    if (!currentUser) return res.status(404).json({ ok: false, message: 'User not found' });

    const currentMember = group.members.find(m => m.userId === currentUser.userId);
    if (!currentMember) return res.status(403).json({ ok: false, message: 'Not a member' });

    const targetMember = group.members.find(m => m.userId === targetUserId);
    if (!targetMember) return res.status(404).json({ ok: false, message: 'Target user not found in group' });

    // Permissions: Owner can kick anyone (except themselves usually, but let's just check roles).
    // Admin can kick Members, but not Owner or other Admins.
    if (currentMember.role === 'Member') {
      return res.status(403).json({ ok: false, message: 'Permission denied' });
    }
    
    if (currentMember.role === 'Admin') {
      if (targetMember.role === 'Owner' || targetMember.role === 'Admin') {
        return res.status(403).json({ ok: false, message: 'Admins cannot kick Owners or other Admins' });
      }
    }

    group.members = group.members.filter(m => m.userId !== targetUserId) as any;
    await group.save();
    const io = req.app.get('io');
    if (io) {
      const groupId = String(group._id);
      io.to(groupId).emit('group:members-updated', { groupId, removedMemberIds: [targetUserId] });
      io.to(targetUserId).emit('group:member-removed', { groupId });
    }

    return res.json({ ok: true, message: 'User kicked successfully', group });
  } catch (err) {
    console.error('Failed to kick member', err);
    return res.status(500).json({ ok: false, message: 'Failed to kick member' });
  }
});

// Update Roles
router.patch('/:id/roles', requireAuth, async (req: any, res: any) => {
  try {
    const { targetUserId, newRole } = req.body;

    if (!['Owner', 'Admin', 'Member'].includes(newRole)) {
      return res.status(400).json({ ok: false, message: 'Invalid role' });
    }

    const group = await GroupChat.findById(req.params.id);
    if (!group) return res.status(404).json({ ok: false, message: 'Group not found' });

    const currentUser = await User.findById(req.user.id);
    if (!currentUser) return res.status(404).json({ ok: false, message: 'User not found' });

    const currentMember = group.members.find(m => m.userId === currentUser.userId);
    if (!currentMember || currentMember.role !== 'Owner') {
      return res.status(403).json({ ok: false, message: 'Only Owners can manage roles' });
    }

    const targetMemberIndex = group.members.findIndex(m => m.userId === targetUserId);
    if (targetMemberIndex === -1) return res.status(404).json({ ok: false, message: 'Target user not found in group' });
    if (group.members[targetMemberIndex].role === 'Owner' && newRole !== 'Owner' && targetUserId !== currentUser.userId) {
      return res.status(400).json({ ok: false, message: 'Transfer ownership before changing the owner’s role.' });
    }
    if (targetUserId === currentUser.userId && newRole !== 'Owner') {
      return res.status(400).json({ ok: false, message: 'Transfer ownership before changing your role.' });
    }

    // If transferring ownership
    if (newRole === 'Owner') {
      currentMember.role = 'Admin'; // Current owner becomes admin
    }

    group.members[targetMemberIndex].role = newRole;
    await group.save();
    const io = req.app.get('io');
    if (io) io.to(String(group._id)).emit('group:members-updated', { groupId: String(group._id) });

    return res.json({ ok: true, group });
  } catch (err) {
    console.error('Failed to update roles', err);
    return res.status(500).json({ ok: false, message: 'Failed to update roles' });
  }
});

// Set Nickname
router.patch('/:id/nickname', requireAuth, async (req: any, res: any) => {
  try {
    const { targetUserId, nickname } = req.body;

    if (typeof targetUserId !== 'string' || !targetUserId.trim()) {
      return res.status(400).json({ ok: false, message: 'Target user ID required.' });
    }
    if (typeof nickname !== 'string' || nickname.length > 32) {
      return res.status(400).json({ ok: false, message: 'Nicknames must be 32 characters or shorter.' });
    }

    const group = await GroupChat.findById(req.params.id);
    if (!group) return res.status(404).json({ ok: false, message: 'Group not found' });

    const currentUser = await User.findById(req.user.id);
    if (!currentUser) return res.status(404).json({ ok: false, message: 'User not found' });

    // Check if current user is a member
    const currentMember = group.members.find(m => m.userId === currentUser.userId);
    if (!currentMember) {
      return res.status(403).json({ ok: false, message: 'Not a member' });
    }
    if (currentMember.role === 'Member' && targetUserId !== currentUser.userId) {
      return res.status(403).json({ ok: false, message: 'You can only change your own nickname.' });
    }

    // Check if target user is a member
    const targetMember = group.members.find(m => m.userId === targetUserId);
    if (!targetMember) {
      return res.status(404).json({ ok: false, message: 'Target user not found in group' });
    }

    // Set or remove nickname
    if (nickname && nickname.trim()) {
      if (!group.nicknames) group.nicknames = {};
      (group.nicknames as Record<string, string>)[targetUserId] = nickname.trim();
    } else {
      if (group.nicknames) {
        delete (group.nicknames as Record<string, string>)[targetUserId];
      }
    }

    await group.save();

    const io = req.app.get('io');
    if (io) io.to(String(group._id)).emit('group:members-updated', { groupId: String(group._id) });
    return res.json({ ok: true, group });
  } catch (err) {
    console.error('Failed to set nickname', err);
    return res.status(500).json({ ok: false, message: 'Failed to set nickname' });
  }
});

// Leave Group
router.post('/:id/leave', requireAuth, async (req: any, res: any) => {
  try {
    const currentUser = await User.findById(req.user.id);
    if (!currentUser) return res.status(404).json({ ok: false, message: 'User not found' });

    const group = await GroupChat.findById(req.params.id);
    if (!group) return res.status(404).json({ ok: false, message: 'Group not found' });

    // Check if user is a member
    const memberIndex = group.members.findIndex(m => m.userId === currentUser.userId);
    if (memberIndex === -1) {
      return res.status(403).json({ ok: false, message: 'Not a member' });
    }

    let ownershipTransferred = false;
    if (group.members[memberIndex].role === 'Owner') {
      const nextOwner = group.members
        .filter(member => member.userId !== currentUser.userId)
        .sort((left, right) => new Date(left.joinedAt).getTime() - new Date(right.joinedAt).getTime())[0];
      if (!nextOwner) return res.status(400).json({ ok: false, message: 'You are the only member and cannot leave this group.' });
      nextOwner.role = 'Owner';
      group.createdBy = nextOwner.userId;
      ownershipTransferred = true;
    }

    // Remove member from group
    group.members.splice(memberIndex, 1);
    await group.save();

    // Notify via socket
    const io = req.app.get('io');
    if (io) {
      const groupId = String(group._id);
      io.to(groupId).emit('group:member_left', { groupId, userId: currentUser.userId });
      if (ownershipTransferred) {
        io.to(groupId).emit('group:owner-changed', { groupId, ownerId: group.createdBy });
      }
      io.to(currentUser.userId).emit('group:member-removed', { groupId });
    }

    return res.json({ ok: true, message: 'Left group successfully' });
  } catch (err) {
    console.error('Failed to leave group', err);
    return res.status(500).json({ ok: false, message: 'Failed to leave group' });
  }
});

export default router;
