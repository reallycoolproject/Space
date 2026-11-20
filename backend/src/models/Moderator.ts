import mongoose, { Schema, Document } from 'mongoose';

export interface IModerator extends Document {
  username: string;
  password: string;
  isActive: boolean;
  claimedTickets: string[];
  createdAt: Date;
  updatedAt: Date;
}

const ModeratorSchema = new Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  claimedTickets: [{ type: String }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

ModeratorSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model<IModerator>('Moderator', ModeratorSchema);
