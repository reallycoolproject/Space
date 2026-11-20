import mongoose, { Document, Schema } from 'mongoose';

export interface ISpaceWebhook extends Document {
  id: string;
  spaceId: string;
  channelId: string;
  name: string;
  avatar: string;
  token: string;
  creatorId: string;
  createdAt: Date;
}

const spaceWebhookSchema = new Schema<ISpaceWebhook>({
  id: { type: String, required: true, unique: true },
  spaceId: { type: String, required: true, index: true },
  channelId: { type: String, required: true, index: true },
  name: { type: String, required: true, maxlength: 80, default: 'Spidey Bot' },
  avatar: { type: String, default: '' },
  token: { type: String, required: true, index: true },
  creatorId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

export const SpaceWebhook = mongoose.model<ISpaceWebhook>('SpaceWebhook', spaceWebhookSchema);
