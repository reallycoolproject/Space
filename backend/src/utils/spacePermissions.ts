import { ISpace, ISpaceChannel, SPACE_PERMISSIONS, Space, SpacePermission } from '../models/Space';
import { SpaceThread } from '../models/SpaceThread';
import type { Server } from 'socket.io';

export const getSpaceMember = (space: ISpace, userId: string) =>
  space.members.find(member => member.userId === userId);

export const getSpaceChannel = (space: ISpace, channelId: string) =>
  space.channels.find(channel => channel.id === channelId);

export const getActiveSpaceRoleIds = (space: ISpace, userId: string, at = new Date()) => {
  const member = getSpaceMember(space, userId);
  if (!member) return [];
  const activeTemporaryIds = new Set(
    (member.temporaryRoleAssignments || [])
      .filter(assignment => assignment.expiresAt > at)
      .map(assignment => assignment.roleId)
  );
  const temporaryIds = new Set((member.temporaryRoleAssignments || []).map(assignment => assignment.roleId));
  return member.roleIds.filter(roleId => !temporaryIds.has(roleId) || activeTemporaryIds.has(roleId));
};

export const getCategoryAncestors = (space: ISpace, categoryId: string) => {
  const ancestors: NonNullable<ISpace['categories'][number]>[] = [];
  const seen = new Set<string>();
  let category = space.categories.find(item => item.id === categoryId);
  while (category && !seen.has(category.id)) {
    ancestors.unshift(category);
    seen.add(category.id);
    category = category.parentId ? space.categories.find(item => item.id === category!.parentId) : undefined;
  }
  return ancestors;
};

export const getSpacePermissions = (space: ISpace, userId: string, channel?: ISpaceChannel) => {
  const member = getSpaceMember(space, userId);
  if (!member) return 0;

  if (space.ownerId === userId) return Object.values(SPACE_PERMISSIONS).reduce((all, bit) => all | bit, 0);

  const everyoneRole = space.roles.find(role => role.id === 'everyone');
  let permissions = everyoneRole?.permissions || 0;
  const activeRoleIds = getActiveSpaceRoleIds(space, userId);
  for (const roleId of activeRoleIds) {
    const role = space.roles.find(item => item.id === roleId);
    if (role) permissions |= role.permissions;
  }

  if (permissions & SPACE_PERMISSIONS.ADMINISTRATOR) {
    return Object.values(SPACE_PERMISSIONS).reduce((all, bit) => all | bit, 0);
  }
  if (!channel) return permissions;

  const layers = [
    ...getCategoryAncestors(space, channel.categoryId).map(category => category.permissionOverwrites || []),
    channel.permissionOverwrites || []
  ];
  for (const layer of layers) {
    const everyoneOverwrite = layer.find(overwrite => overwrite.roleId === 'everyone');
    if (everyoneOverwrite) permissions = (permissions & ~everyoneOverwrite.deny) | everyoneOverwrite.allow;

    let roleDeny = 0;
    let roleAllow = 0;
    for (const overwrite of layer) {
      if (activeRoleIds.includes(overwrite.roleId)) {
        roleDeny |= overwrite.deny;
        roleAllow |= overwrite.allow;
      }
    }
    permissions = (permissions & ~roleDeny) | roleAllow;

    const memberOverwrite = layer.find(overwrite => overwrite.roleId === userId);
    if (memberOverwrite) permissions = (permissions & ~memberOverwrite.deny) | memberOverwrite.allow;
  }
  return permissions;
};

export const hasSpacePermission = (
  space: ISpace,
  userId: string,
  permission: SpacePermission,
  channel?: ISpaceChannel
) => Boolean(getSpacePermissions(space, userId, channel) & SPACE_PERMISSIONS[permission]);

export const canReadSpaceChannel = (space: ISpace, userId: string, channel: ISpaceChannel) =>
  hasSpacePermission(space, userId, 'VIEW_CHANNEL', channel);

export const parseSpaceRoomId = (roomId: string) => {
  const match = /^space:([0-9a-fA-F]{24}):([a-zA-Z0-9-]{1,64})(?::([a-zA-Z0-9-]{1,64}))?$/.exec(roomId);
  return match ? { spaceId: match[1], channelId: match[2], threadId: match[3] } : null;
};

export const canAccessSpaceRoom = async (
  userId: string,
  roomId: string,
  permission: SpacePermission = 'VIEW_CHANNEL'
) => {
  const parsed = parseSpaceRoomId(roomId);
  if (!parsed) return false;
  const space = await Space.findById(parsed.spaceId);
  const channel = space && getSpaceChannel(space, parsed.channelId);
  if (!space || !channel || !hasSpacePermission(space, userId, 'VIEW_CHANNEL', channel)) return false;
  const member = getSpaceMember(space, userId);
  if (permission !== 'VIEW_CHANNEL' && userId !== space.ownerId &&
    !(getSpacePermissions(space, userId) & SPACE_PERMISSIONS.ADMINISTRATOR) &&
    member?.mutedUntil && member.mutedUntil > new Date()) return false;
  const effectivePermission = permission === 'SEND_MESSAGES_IN_THREADS' && channel.type === 'forum'
    ? 'SEND_MESSAGES'
    : permission;
  if (parsed.threadId) {
    const thread = await SpaceThread.findOne({ _id: parsed.threadId, spaceId: space._id, channelId: channel.id });
    if (!thread) return false;
    if (thread.private && thread.createdBy !== userId && !thread.memberIds.includes(userId) &&
      !hasSpacePermission(space, userId, 'MANAGE_THREADS', channel)) return false;
    if (permission === 'SEND_MESSAGES_IN_THREADS' &&
      (thread.archived || thread.locked || !hasSpacePermission(space, userId, effectivePermission, channel))) return false;
    if (permission !== 'VIEW_CHANNEL' && permission !== 'SEND_MESSAGES_IN_THREADS' &&
      !hasSpacePermission(space, userId, permission, channel)) return false;
  }
  return permission === 'VIEW_CHANNEL' || hasSpacePermission(space, userId, effectivePermission, channel);
};

export const syncSpaceChannelRooms = async (io: Server, space: ISpace) => {
  const sockets = await io.fetchSockets();
  for (const socket of sockets) {
    const userId = (socket as any).user?.userId as string | undefined;
    const roomPrefix = `space:${space.id}:`;
    for (const roomId of socket.rooms) {
      if (!roomId.startsWith(roomPrefix)) continue;
      if (!userId || !(await canAccessSpaceRoom(userId, roomId))) {
        await socket.leave(roomId);
      }
    }
    if (!userId) continue;
    for (const channel of space.channels) {
      const roomId = `space:${space.id}:${channel.id}`;
      if (canReadSpaceChannel(space, userId, channel)) await socket.join(roomId);
      else await socket.leave(roomId);
    }
    const threads = await SpaceThread.find({ spaceId: space._id, archived: false }).select('_id channelId');
    for (const thread of threads) {
      const roomId = `space:${space.id}:${thread.channelId}:${thread.id}`;
      if (await canAccessSpaceRoom(userId, roomId)) await socket.join(roomId);
    }
  }
  for (const member of space.members) {
    io.to(member.userId).emit('space:updated', { spaceId: String(space.id) });
  }
};
