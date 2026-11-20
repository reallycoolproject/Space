import mongoose, { Document, Schema } from 'mongoose';

export interface ISpaceThread extends Document {
  spaceId: mongoose.Types.ObjectId;
  channelId: string;
  title: string;
  starterMessageId?: string;
  createdBy: string;
  private: boolean;
  memberIds: string[];
  tags: string[];
  archived: boolean;
  locked: boolean;
  lastActivityAt: Date;
  archivedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const spaceThreadSchema = new Schema<ISpaceThread>({
  spaceId: { type: Schema.Types.ObjectId, ref: 'Space', required: true, index: true },
  channelId: { type: String, required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 100 },
  starterMessageId: { type: String },
  createdBy: { type: String, required: true },
  private: { type: Boolean, default: false },
  memberIds: { type: [String], default: [] },
  tags: { type: [String], default: [] },
  archived: { type: Boolean, default: false },
  locked: { type: Boolean, default: false },
  lastActivityAt: { type: Date, default: Date.now },
  archivedAt: { type: Date }
}, { timestamps: true });

spaceThreadSchema.index({ spaceId: 1, channelId: 1, archived: 1, lastActivityAt: -1 });
spaceThreadSchema.index({ spaceId: 1, starterMessageId: 1 }, { sparse: true });

export const SpaceThread = mongoose.model<ISpaceThread>('SpaceThread', spaceThreadSchema);
