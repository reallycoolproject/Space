import mongoose, { Document, Schema } from 'mongoose';

export interface ISpaceAuditLog extends Document {
  spaceId: mongoose.Types.ObjectId;
  actorId: string;
  action: string;
  targetId?: string;
  details: Record<string, unknown>;
  createdAt: Date;
}

const spaceAuditLogSchema = new Schema<ISpaceAuditLog>({
  spaceId: { type: Schema.Types.ObjectId, ref: 'Space', required: true, index: true },
  actorId: { type: String, required: true },
  action: { type: String, required: true, maxlength: 80 },
  targetId: { type: String, default: '' },
  details: { type: Schema.Types.Mixed, default: {} }
}, { timestamps: { createdAt: true, updatedAt: false } });

spaceAuditLogSchema.index({ spaceId: 1, createdAt: -1 });

export const SpaceAuditLog = mongoose.model<ISpaceAuditLog>('SpaceAuditLog', spaceAuditLogSchema);
