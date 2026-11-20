import { GroupChat } from '../models/GroupChat';
import { Space, type ISpace, type ISpaceChannel } from '../models/Space';
import { User } from '../models/User';
import { getSpaceChannel, getSpaceMember, hasSpacePermission } from '../utils/spacePermissions';

export interface ConversationAccess {
  kind: 'dm' | 'group';
  roomId: string;
  name: string;
  memberIds: string[];
  otherUserId?: string;
}

export interface CallerProfile {
  userId: string;
  username: string;
  displayName?: string;
  avatar?: string;
}

const isObjectId = (value: string) => /^[0-9a-fA-F]{24}$/.test(value);

export const getUserProfile = async (userId: string): Promise<CallerProfile> => {
  const user = await User.findOne({ userId })
    .select('userId username displayName avatar')
    .lean()
    .catch(() => null);
  if (!user) return { userId, username: userId };
  return {
    userId: user.userId,
    username: user.username || user.userId,
    displayName: user.displayName,
    avatar: user.avatar
  };
};

export const getUserProfiles = async (userIds: string[]) => {
  const unique = [...new Set(userIds)].filter(Boolean);
  if (!unique.length) return new Map<string, CallerProfile>();
  const users = await User.find({ userId: { $in: unique } })
    .select('userId username displayName avatar')
    .lean()
    .catch(() => []);
  const map = new Map<string, CallerProfile>();
  for (const user of users) {
    map.set(user.userId, {
      userId: user.userId,
      username: user.username || user.userId,
      displayName: user.displayName,
      avatar: user.avatar
    });
  }
  for (const userId of unique) {
    if (!map.has(userId)) map.set(userId, { userId, username: userId });
  }
  return map;
};

/**
 * Validate that a user can participate in a DM or group conversation and
 * return every member that should be notified about a call.
 */
export const getConversationAccess = async (userId: string, roomId: string): Promise<ConversationAccess | null> => {
  if (!roomId || typeof roomId !== 'string') return null;

  if (isObjectId(roomId)) {
    const group = await GroupChat.findById(roomId).select('name members.userId').lean().catch(() => null);
    if (!group) return null;
    const memberIds = group.members.map(member => member.userId);
    if (!memberIds.includes(userId)) return null;
    return { kind: 'group', roomId, name: group.name, memberIds };
  }

  const participantIds = roomId.split('_');
  if (participantIds.length !== 2 || !participantIds.includes(userId)) return null;
  const otherUserId = participantIds.find(id => id !== userId);
  if (!otherUserId || otherUserId === userId) return null;

  const [currentUser, otherUser] = await Promise.all([
    User.findOne({ userId }).select('contacts blockedUsers oneTimeMessageAcceptedUsers').lean(),
    User.findOne({ userId: otherUserId }).select('blockedUsers username displayName avatar').lean()
  ]);
  if (!currentUser || !otherUser) return null;
  if (currentUser.blockedUsers?.includes(otherUserId) || otherUser.blockedUsers?.includes(userId)) return null;

  const isFriend = currentUser.contacts?.includes(otherUserId);
  const isOneTimeAccepted = currentUser.oneTimeMessageAcceptedUsers?.includes(otherUserId);
  if (!isFriend && !isOneTimeAccepted) return null;

  return {
    kind: 'dm',
    roomId,
    name: otherUser.displayName || otherUser.username || otherUserId,
    memberIds: [userId, otherUserId],
    otherUserId
  };
};

export interface SpaceVoiceAccess {
  space: ISpace;
  channel: ISpaceChannel;
  canSpeak: boolean;
  memberIds: string[];
}

/**
 * Validate that a user may join a Space voice channel. Voice channels use the
 * CONNECT permission and never ring every Space member.
 */
export const getSpaceVoiceAccess = async (
  userId: string,
  spaceId: string,
  channelId: string
): Promise<SpaceVoiceAccess | null> => {
  if (!isObjectId(spaceId) || !channelId) return null;
  const space = await Space.findById(spaceId).catch(() => null);
  if (!space) return null;
  const channel = getSpaceChannel(space, channelId);
  if (!channel || channel.type !== 'voice') return null;
  if (!getSpaceMember(space, userId)) return null;
  if (!hasSpacePermission(space, userId, 'VIEW_CHANNEL', channel)) return null;
  if (!hasSpacePermission(space, userId, 'CONNECT', channel)) return null;

  return {
    space,
    channel,
    canSpeak: hasSpacePermission(space, userId, 'SPEAK', channel),
    memberIds: space.members.map(member => member.userId)
  };
};
