import mongoose, { Schema, Document } from 'mongoose';

export interface IAuthCredential extends Document {
  userId: mongoose.Types.ObjectId;
  provider: 'local' | 'google';
  passwordHash?: string;
  googleTokenHash?: string;
  createdAt: Date;
  updatedAt: Date;
}

const credentialSchema = new Schema<IAuthCredential>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  provider: { type: String, required: true, enum: ['local', 'google'], default: 'local' },
  passwordHash: { type: String },
  googleTokenHash: { type: String }
}, { timestamps: true });

export const AuthCredential = mongoose.model<IAuthCredential>('AuthCredential', credentialSchema);
