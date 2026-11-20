import mongoose, { Schema, Document } from 'mongoose';

export type GroupRole = 'Owner' | 'Admin' | 'Member';

export interface IGroupMember {
  userId: string;
  role: GroupRole;
  joinedAt: Date;
}

export interface IGroupChat extends Document {
  name: string;
  description: string;
  members: IGroupMember[];
  allowMemberAdds: boolean;
  allowMemberEditInfo: boolean;
  nicknames: Record<string, string>; // Map of userId to nickname
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const groupMemberSchema = new Schema<IGroupMember>({
  userId: { type: String, required: true },
  role: { type: String, enum: ['Owner', 'Admin', 'Member'], default: 'Member' },
  joinedAt: { type: Date, default: Date.now }
}, { _id: false });

const groupChatSchema = new Schema<IGroupChat>({
  name: { type: String, required: true, maxlength: 100 },
  description: { type: String, default: '', maxlength: 500 },
  members: [groupMemberSchema],
  allowMemberAdds: { type: Boolean, default: false },
  allowMemberEditInfo: { type: Boolean, default: false },
  nicknames: { type: Object, default: {} },
  createdBy: { type: String, required: true }
}, { timestamps: true });

export const GroupChat = mongoose.model<IGroupChat>('GroupChat', groupChatSchema);
