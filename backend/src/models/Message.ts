import mongoose, { Schema, Document } from 'mongoose';

export interface IReaction {
  emoji: string;
  userId: string;
  username: string;
}

export interface ICallMessageMeta {
  callId: string;
  kind: 'dm' | 'group';
  media: 'audio' | 'video';
  outcome: 'missed' | 'declined' | 'completed' | 'canceled' | 'disconnected' | 'started';
  durationSeconds?: number;
  callerId: string;
  callerName: string;
  callerAvatar?: string;
  participantIds: string[];
  inviteeIds?: string[];
  startedAt?: Date;
  endedAt?: Date;
}

export interface IMessage extends Document {
  roomId: string;
  senderId: string;
  senderName: string;
  content: string; // encrypted
  ciphertextRecipient?: string; // encrypted with recipient's public key
  ciphertextSender?: string; // encrypted with sender's public key
  clientMsgId?: string;
  replyTo?: string; // ID of message being replied to
  reactions: IReaction[];
  edited: boolean;
  editedAt?: Date;
  deliveredTo?: string[]; // Array of user IDs who received the message
  readBy?: string[]; // Array of user IDs who read the message
  mentions?: string[];
  isSystemMessage?: boolean; // Special message for greetings
  systemType?: 'you-blocked' | 'blocked-you' | 'blocked-send' | 'blocked-send-own' | 'call';
  systemTargetUserId?: string;
  callMeta?: ICallMessageMeta;
  createdAt: Date;
}

const reactionSchema = new Schema<IReaction>({
  emoji: { type: String, required: true },
  userId: { type: String, required: true },
  username: { type: String, required: true }
});

const callMetaSchema = new Schema<ICallMessageMeta>({
  callId: { type: String, required: true },
  kind: { type: String, enum: ['dm', 'group'], required: true },
  media: { type: String, enum: ['audio', 'video'], required: true },
  outcome: { type: String, enum: ['missed', 'declined', 'completed', 'canceled', 'disconnected', 'started'], required: true },
  durationSeconds: { type: Number, min: 0 },
  callerId: { type: String, required: true },
  callerName: { type: String, required: true },
  callerAvatar: { type: String },
  participantIds: { type: [String], default: [] },
  inviteeIds: { type: [String], default: [] },
  startedAt: { type: Date },
  endedAt: { type: Date }
}, { _id: false });

const messageSchema = new Schema<IMessage>({
  roomId: { type: String, required: true, index: true },
  senderId: { type: String, required: true },
  senderName: { type: String, required: true },
  content: { type: String, required: true },
  ciphertextRecipient: { type: String, required: false },
  ciphertextSender: { type: String, required: false },
  clientMsgId: { type: String, required: false },
  replyTo: { type: String, required: false },
  reactions: [reactionSchema],
  edited: { type: Boolean, default: false },
  editedAt: { type: Date },
  deliveredTo: { type: [String], default: [] },
  readBy: { type: [String], default: [] },
  mentions: { type: [String], default: [] },
  isSystemMessage: { type: Boolean, default: false },
  systemType: { type: String, enum: ['you-blocked', 'blocked-you', 'blocked-send', 'blocked-send-own', 'call'] },
  systemTargetUserId: { type: String },
  callMeta: { type: callMetaSchema, required: false }
}, { timestamps: { createdAt: true, updatedAt: false } });

messageSchema.index({ roomId: 1, senderId: 1, createdAt: -1 });

export const Message = mongoose.model<IMessage>('Message', messageSchema);
