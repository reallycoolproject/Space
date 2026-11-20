import mongoose, { Schema, Document } from 'mongoose';

export interface IReport extends Document {
  reporter: mongoose.Schema.Types.ObjectId;
  reportedUser: mongoose.Schema.Types.ObjectId;
  reason: string;
  details: string;
  chatTranscript: any[];
  status: 'pending' | 'resolved' | 'dismissed';
  createdAt: Date;
  updatedAt: Date;
}

const reportSchema = new Schema<IReport>({
  reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reportedUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reason: { type: String, required: true },
  details: { type: String, default: '' },
  chatTranscript: [],
  status: { type: String, enum: ['pending', 'resolved', 'dismissed'], default: 'pending' }
}, { timestamps: true });

export const Report = mongoose.model<IReport>('Report', reportSchema);
