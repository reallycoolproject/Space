import mongoose, { Document, Schema } from 'mongoose';

export interface ISpaceEvent extends Document {
  spaceId: mongoose.Types.ObjectId;
  name: string;
  description: string;
  location: string;
  scheduledStartAt: Date;
  scheduledEndAt?: Date;
  createdBy: string;
  interestedUserIds: string[];
  cancelledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const spaceEventSchema = new Schema<ISpaceEvent>({
  spaceId: { type: Schema.Types.ObjectId, ref: 'Space', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  description: { type: String, default: '', maxlength: 2000 },
  location: { type: String, default: '', maxlength: 200 },
  scheduledStartAt: { type: Date, required: true, index: true },
  scheduledEndAt: { type: Date },
  createdBy: { type: String, required: true },
  interestedUserIds: { type: [String], default: [] },
  cancelledAt: { type: Date }
}, { timestamps: true });

spaceEventSchema.index({ spaceId: 1, scheduledStartAt: 1 });

export const SpaceEvent = mongoose.model<ISpaceEvent>('SpaceEvent', spaceEventSchema);
