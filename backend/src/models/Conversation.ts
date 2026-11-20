import mongoose, { Schema, Document } from 'mongoose';

export type ConversationStatus = 'pending_one_time' | 'accepted' | 'declined';

export interface IConversation extends Document {
  roomId: string;
  participants: string[]; // Array of userIds
  status: ConversationStatus;
  initiatedBy: string; // userId who initiated the one-time message
  isOneTimeMessage: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const conversationSchema = new Schema<IConversation>({
  roomId: { type: String, required: true, unique: true },
  participants: { type: [String], required: true },
  status: { type: String, enum: ['pending_one_time', 'accepted', 'declined'], default: 'pending_one_time' },
  initiatedBy: { type: String, required: true },
  isOneTimeMessage: { type: Boolean, default: true }
}, { timestamps: true });

export const Conversation = mongoose.model<IConversation>('Conversation', conversationSchema);
