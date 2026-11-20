import mongoose, { Schema, Document } from 'mongoose';

export interface IMessageRequest extends Document {
  senderUserId: string;
  senderUsername: string;
  recipientUserId: string;
  content: string; // encrypted ciphertext
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Date;
}

const messageRequestSchema = new Schema<IMessageRequest>({
  senderUserId: { type: String, required: true },
  senderUsername: { type: String, required: true },
  recipientUserId: { type: String, required: true },
  content: { type: String, required: true },
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' }
}, { timestamps: { createdAt: true, updatedAt: false } });

messageRequestSchema.index({ recipientUserId: 1, status: 1 });

export const MessageRequest = mongoose.model<IMessageRequest>('MessageRequest', messageRequestSchema);
