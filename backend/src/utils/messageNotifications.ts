import type { Server } from 'socket.io';
import { GroupChat } from '../models/GroupChat';
import { User } from '../models/User';
import { Notification } from '../models/Notification';
import { canReadSpaceChannel, getSpaceChannel, parseSpaceRoomId } from './spacePermissions';
import { Space } from '../models/Space';
import { SpaceThread } from '../models/SpaceThread';

export async function emitMessageNotifications(
  io: Server,
  roomId: string,
  senderId: string,
  senderName: string,
  mentionIds: string[] = [],
  messageId?: string
): Promise<void> {
  const spaceRoom = parseSpaceRoomId(roomId);
  const isGroup = /^[0-9a-fA-F]{24}$/.test(roomId);
  let recipientIds: string[];
  let groupName: string | undefined;

  if (spaceRoom) {
    const space = await Space.findById(spaceRoom.spaceId);
    const channel = space && getSpaceChannel(space, spaceRoom.channelId);
    if (!space || !channel) return;
    groupName = space.name;
    const thread = spaceRoom.threadId ? await SpaceThread.findOne({
      _id: spaceRoom.threadId,
      spaceId: space._id,
      channelId: channel.id
    }).select('private createdBy memberIds') : null;
    if (spaceRoom.threadId && !thread) return;
    recipientIds = space.members
      .filter(member => member.userId !== senderId && canReadSpaceChannel(space, member.userId, channel) &&
        (!thread?.private || thread.createdBy === member.userId || thread.memberIds.includes(member.userId)) &&
        (space.defaultNotifications === 'all' || mentionIds.includes(member.userId)))
      .map(member => member.userId);
  } else if (isGroup) {
    const group = await GroupChat.findById(roomId).select('name members.userId');
    if (!group) return;
    groupName = group.name;
    recipientIds = group.members
      .map(member => member.userId)
      .filter(userId => userId !== senderId);
  } else {
    const participants = roomId.split('_');
    if (participants.length !== 2 || !participants.includes(senderId)) return;
    recipientIds = participants.filter(userId => userId !== senderId);
  }

  if (recipientIds.length === 0) return;
  const recipients = await User.find({ userId: { $in: recipientIds } }).select('userId status');
  const notifications = await Promise.all(recipients.map(recipient => Notification.create({
    recipientUserId: recipient.userId,
    senderId,
    senderName,
    roomId,
    groupName,
    messageId,
    type: mentionIds.includes(recipient.userId) ? 'mention' : 'message'
  })));

  notifications.forEach((notification, index) => {
    const recipient = recipients[index];
    if (recipient.status === 'dnd') return;
    io.to(recipient.userId).emit('notification:new', {
      id: String(notification._id),
      roomId,
      senderId,
      senderName,
      messageId: notification.messageId,
      type: notification.type,
      groupName,
      createdAt: notification.createdAt.toISOString(),
      readAt: notification.readAt?.toISOString()
    });
  });
}
