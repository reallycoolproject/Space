import mongoose, { Schema, Document } from 'mongoose';

export interface Note {
  type: 'update' | 'done' | 'info' | 'claim';
  content: string;
  author: string;
  timestamp: Date;
}

export interface ITicket extends Document {
  userId: string;
  username: string;
  isGuest?: boolean;
  contactEmail?: string;
  category: 'major' | 'minor';
  priority: 'critical' | 'high' | 'medium' | 'low';
  type: 'bug' | 'suggestion' | 'infrastructure' | 'csam' | 'other';
  subject: string;
  description: string;
  mediaUrls: string[];
  status: 'open' | 'claimed' | 'in_progress' | 'done' | 'closed';
  claimedBy?: string;
  notes: Note[];
  inTrash: boolean;
  trashDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const NoteSchema = new Schema({
  type: { type: String, enum: ['update', 'done', 'info', 'claim'], required: true },
  content: { type: String, required: true },
  author: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

const TicketSchema = new Schema({
  userId: { type: String, required: true },
  username: { type: String, required: true },
  isGuest: { type: Boolean, default: false },
  contactEmail: { type: String },
  category: { type: String, enum: ['major', 'minor'], required: true },
  priority: { type: String, enum: ['critical', 'high', 'medium', 'low'], default: 'medium' },
  type: { type: String, enum: ['bug', 'suggestion', 'infrastructure', 'csam', 'other'], required: true },
  subject: { type: String, required: true },
  description: { type: String, required: true },
  mediaUrls: [{ type: String }],
  status: { type: String, enum: ['open', 'claimed', 'in_progress', 'done', 'closed'], default: 'open' },
  claimedBy: { type: String },
  notes: [NoteSchema],
  inTrash: { type: Boolean, default: false },
  trashDate: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

TicketSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model<ITicket>('Ticket', TicketSchema);
