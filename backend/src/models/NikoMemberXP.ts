import mongoose, { Document, Schema } from 'mongoose';

export interface INikoMemberXP extends Document {
  spaceId: string;
  userId: string;
  username: string;
  avatar: string;
  xp: number;
  level: number;
  messagesCount: number;
  voiceMinutes: number;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const nikoMemberXPSchema = new Schema<INikoMemberXP>(
  {
    spaceId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    username: { type: String, required: true },
    avatar: { type: String, default: '' },
    xp: { type: Number, default: 0, index: -1 },
    level: { type: Number, default: 0 },
    messagesCount: { type: Number, default: 0 },
    voiceMinutes: { type: Number, default: 0 },
    lastMessageAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

nikoMemberXPSchema.index({ spaceId: 1, xp: -1 });
nikoMemberXPSchema.index({ spaceId: 1, userId: 1 }, { unique: true });

export const NikoMemberXP = mongoose.model<INikoMemberXP>('NikoMemberXP', nikoMemberXPSchema);
