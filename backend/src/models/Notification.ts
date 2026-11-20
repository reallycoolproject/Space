import mongoose, { Schema, Document } from 'mongoose';

export interface INotification extends Document {
  recipientUserId: string;
  senderId: string;
  senderName: string;
  roomId: string;
  messageId?: string;
  groupName?: string;
  type: 'message' | 'mention';
  readAt?: Date;
  createdAt: Date;
}

const notificationSchema = new Schema<INotification>({
  recipientUserId: { type: String, required: true },
  senderId: { type: String, required: true },
  senderName: { type: String, required: true },
  roomId: { type: String, required: true },
  messageId: { type: String },
  groupName: { type: String },
  type: { type: String, enum: ['message', 'mention'], required: true, default: 'message' },
  readAt: { type: Date }
}, { timestamps: { createdAt: true, updatedAt: false } });

notificationSchema.index({ recipientUserId: 1, createdAt: -1 });

export const Notification = mongoose.model<INotification>('Notification', notificationSchema);
