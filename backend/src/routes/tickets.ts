import express from 'express';
import Ticket, { Note } from '../models/Ticket';
import Moderator from '../models/Moderator';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import requireAuth, { requireRole } from '../middleware/auth';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req: any, file: any, cb: any) => {
    cb(null, 'uploads/tickets/');
  },
  filename: (req: any, file: any, cb: any) => {
    const uniqueName = `${uuidv4()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req: any, file: any, cb: any) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|mp4|webm/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Invalid file type'));
  }
});

// Create a new ticket (Supports authenticated Space users or secure visitor tickets)
router.post('/', upload.array('media', 5), async (req: any, res: any) => {
  try {
    const { category, type, subject, description, isGuest, contactEmail, guestName } = req.body;
    let userId: string;
    let username: string;
    let guestMode = false;

    // Authenticate token if present
    const authHeader = req.headers?.authorization || req.headers?.Authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;

    if (token) {
      try {
        const { verifyUserToken } = await import('../utils/auth');
        const payload = verifyUserToken(token);
        userId = payload.userId;
        username = payload.username;
      } catch (err) {
        return res.status(401).json({ ok: false, message: 'Invalid or expired session. Please sign in again.' });
      }
    } else if (isGuest === 'true' || isGuest === true) {
      guestMode = true;
      userId = 'guest_' + uuidv4().slice(0, 8);
      username = (guestName || contactEmail || 'Visitor').trim();
    } else {
      return res.status(401).json({ ok: false, message: 'Please sign in to your Space account or submit as a guest.' });
    }
    
    // Auto-categorize priority based on type
    let priority = 'medium';
    let autoCategory = 'minor';
    
    if (type === 'csam' || type === 'infrastructure') {
      priority = 'critical';
      autoCategory = 'major';
    } else if (type === 'bug') {
      priority = 'high';
      autoCategory = 'major';
    } else if (type === 'suggestion') {
      priority = 'low';
      autoCategory = 'minor';
    }

    // Override auto-category if user specified one
    const finalCategory = category || autoCategory;

    const mediaUrls = req.files ? (req.files as Express.Multer.File[]).map(file => `/uploads/tickets/${file.filename}`) : [];

    const ticket = new Ticket({
      userId,
      username,
      isGuest: guestMode,
      contactEmail: guestMode ? contactEmail : undefined,
      category: finalCategory,
      priority,
      type,
      subject,
      description,
      mediaUrls,
      status: 'open'
    });

    await ticket.save();
    res.status(201).json({ ok: true, ticket });
  } catch (error) {
    console.error('Error creating ticket:', error);
    res.status(500).json({ ok: false, message: 'Failed to create ticket' });
  }
});

// Get all tickets for a user
router.get('/user/:userId', requireAuth, async (req: any, res: any) => {
  try {
    if (req.user.userId !== req.params.userId && req.user.role !== 'moderator' && req.user.role !== 'admin') {
      return res.status(403).json({ ok: false, message: 'You can only view your own tickets' });
    }
    const tickets = await Ticket.find({ userId: req.params.userId }).sort({ createdAt: -1 });
    res.json({ ok: true, tickets });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Failed to fetch tickets' });
  }
});

// Get a single ticket by ID
router.get('/:id', requireAuth, async (req: any, res: any) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ ok: false, message: 'Ticket not found' });
    }
    if (ticket.userId !== req.user.userId && req.user.role !== 'moderator' && req.user.role !== 'admin') {
      return res.status(403).json({ ok: false, message: 'You cannot view this ticket' });
    }
    res.json({ ok: true, ticket });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Failed to fetch ticket' });
  }
});

// Search or track ticket by ID or User ID
router.post('/track', async (req: any, res: any) => {
  try {
    const { ticketId, userId } = req.body;
    if (ticketId) {
      const ticket = await Ticket.findById(ticketId);
      if (!ticket) return res.status(404).json({ ok: false, message: 'Ticket not found' });
      return res.json({ ok: true, tickets: [ticket] });
    }
    if (userId) {
      const query = userId === 'all' ? {} : { userId };
      const tickets = await Ticket.find(query).sort({ createdAt: -1 });
      return res.json({ ok: true, tickets });
    }
    return res.status(400).json({ ok: false, message: 'Ticket ID or User ID is required' });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'Failed to search ticket' });
  }
});

// Moderator login
router.post('/moderator/login', async (req: any, res: any) => {
  try {
    const { username, password } = req.body;
    
    const moderator = await Moderator.findOne({ username, password });
    if (!moderator) {
      return res.status(401).json({ ok: false, message: 'Invalid credentials' });
    }

    if (!moderator.isActive) {
      return res.status(403).json({ ok: false, message: 'Moderator account is inactive' });
    }

    const token = (await import('../utils/auth')).signUserToken({ id: String(moderator._id), userId: String(moderator._id), username: moderator.username, provider: 'local', role: 'moderator' });
    res.json({ 
      ok: true, 
      token,
      moderator: {
        id: moderator._id,
        username: moderator.username,
        claimedTickets: moderator.claimedTickets
      }
    });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Login failed' });
  }
});

// Get all tickets (for moderators)
router.get('/moderator/all/:moderatorId', requireAuth, requireRole('moderator', 'admin'), async (req: any, res: any) => {
  try {
    const moderator = await Moderator.findById(req.user.id);
    if (!moderator) {
      return res.status(401).json({ ok: false, message: 'Unauthorized' });
    }

    const tickets = await Ticket.find().sort({ 
      priority: -1, 
      createdAt: -1 
    });
    res.json({ ok: true, tickets });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Failed to fetch tickets' });
  }
});

// Get claimed tickets for a moderator
router.get('/moderator/claimed/:moderatorId', requireAuth, requireRole('moderator', 'admin'), async (req: any, res: any) => {
  try {
    const moderator = await Moderator.findById(req.user.id);
    if (!moderator) {
      return res.status(401).json({ ok: false, message: 'Unauthorized' });
    }

    const tickets = await Ticket.find({ claimedBy: moderator.username }).sort({ 
      createdAt: -1 
    });
    res.json({ ok: true, tickets });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Failed to fetch claimed tickets' });
  }
});

// Claim a ticket (Supports Admin & Moderator)
router.post('/:id/claim', requireAuth, requireRole('moderator', 'admin'), async (req: any, res: any) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ ok: false, message: 'Ticket not found' });
    }

    let claimerUsername = req.user.username || 'Admin';
    if (req.user.role !== 'admin') {
      const moderator = await Moderator.findById(req.user.id);
      if (!moderator) {
        return res.status(401).json({ ok: false, message: 'Unauthorized' });
      }
      claimerUsername = moderator.username;
      moderator.claimedTickets.push(ticket._id.toString());
      await moderator.save();
    }

    ticket.status = 'claimed';
    ticket.claimedBy = claimerUsername;
    
    const claimNote: Note = {
      type: 'claim',
      content: `Ticket claimed by ${claimerUsername}`,
      author: claimerUsername,
      timestamp: new Date()
    };
    ticket.notes.push(claimNote);
    
    await ticket.save();
    res.json({ ok: true, ticket });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Failed to claim ticket' });
  }
});

// Update ticket status, priority, or assignee directly
router.patch('/:id/status', requireAuth, requireRole('moderator', 'admin'), async (req: any, res: any) => {
  try {
    const { status, claimedBy, priority } = req.body;
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ ok: false, message: 'Ticket not found' });
    }

    if (status) ticket.status = status;
    if (claimedBy !== undefined) ticket.claimedBy = claimedBy;
    if (priority) ticket.priority = priority;

    const author = req.user.username || 'Staff';
    ticket.notes.push({
      type: status === 'done' || status === 'closed' ? 'done' : 'update',
      content: `Status changed to ${status}${claimedBy ? ` (Assigned to ${claimedBy})` : ''}`,
      author,
      timestamp: new Date()
    });

    await ticket.save();
    return res.json({ ok: true, ticket });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'Failed to update ticket status' });
  }
});

// Add note or reply to ticket (Supports Admin & Moderator)
router.post('/:id/notes', requireAuth, requireRole('moderator', 'admin'), async (req: any, res: any) => {
  try {
    const { type, content, status } = req.body;
    
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ ok: false, message: 'Ticket not found' });
    }

    let author = req.user.username || 'Staff';
    if (req.user.role !== 'admin') {
      const moderator = await Moderator.findById(req.user.id);
      if (!moderator) {
        return res.status(401).json({ ok: false, message: 'Unauthorized' });
      }
      author = moderator.username;
    }

    const note: Note = {
      type: type || 'update',
      content,
      author,
      timestamp: new Date()
    };

    ticket.notes.push(note);
    
    // Update status if passed explicitly or based on note type
    if (status) {
      ticket.status = status;
    } else if (type === 'done') {
      ticket.status = 'done';
    } else if (type === 'update' || type === 'info') {
      ticket.status = 'in_progress';
    }
    
    await ticket.save();
    res.json({ ok: true, ticket });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Failed to add note' });
  }
});

// Mark ticket as finished (by moderator)
router.post('/:id/finish', requireAuth, requireRole('moderator', 'admin'), async (req: any, res: any) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ ok: false, message: 'Ticket not found' });
    }

    const moderator = await Moderator.findById(req.user.id);
    if (!moderator) {
      return res.status(401).json({ ok: false, message: 'Unauthorized' });
    }

    if (ticket.claimedBy !== moderator.username) {
      return res.status(403).json({ ok: false, message: 'You can only finish tickets you claimed' });
    }

    ticket.status = 'closed';
    ticket.inTrash = true;
    ticket.trashDate = new Date();
    await ticket.save();

    // Remove from moderator's claimed tickets
    moderator.claimedTickets = moderator.claimedTickets.filter(id => id !== ticket._id.toString());
    await moderator.save();

    res.json({ ok: true, ticket });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Failed to finish ticket' });
  }
});

// Get moderator's claimed tickets
router.get('/moderator/claimed/:moderatorId', requireAuth, requireRole('moderator', 'admin'), async (req: any, res: any) => {
  try {
    const moderator = await Moderator.findById(req.user.id);
    if (!moderator) {
      return res.status(401).json({ ok: false, message: 'Unauthorized' });
    }

    const tickets = await Ticket.find({ claimedBy: moderator.username }).sort({ 
      createdAt: -1 
    });
    res.json({ ok: true, tickets });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Failed to fetch claimed tickets' });
  }
});

// Get all tickets in trash (for moderators)
router.get('/moderator/trash/:moderatorId', requireAuth, requireRole('moderator', 'admin'), async (req: any, res: any) => {
  try {
    const moderator = await Moderator.findById(req.user.id);
    if (!moderator) {
      return res.status(401).json({ ok: false, message: 'Unauthorized' });
    }

    const tickets = await Ticket.find({ inTrash: true }).sort({ trashDate: -1 });
    res.json({ ok: true, tickets });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Failed to fetch trash tickets' });
  }
});

// Delete ticket permanently from trash
router.delete('/:id/permanent', requireAuth, requireRole('moderator', 'admin'), async (req: any, res: any) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ ok: false, message: 'Ticket not found' });
    }

    const moderator = await Moderator.findById(req.user.id);
    if (!moderator) {
      return res.status(401).json({ ok: false, message: 'Unauthorized' });
    }

    if (!ticket.inTrash) {
      return res.status(400).json({ ok: false, message: 'Ticket is not in trash' });
    }

    await Ticket.findByIdAndDelete(req.params.id);
    res.json({ ok: true, message: 'Ticket permanently deleted' });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Failed to delete ticket' });
  }
});

// Restore ticket from trash
router.post('/:id/restore', requireAuth, requireRole('moderator', 'admin'), async (req: any, res: any) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ ok: false, message: 'Ticket not found' });
    }

    const moderator = await Moderator.findById(req.user.id);
    if (!moderator) {
      return res.status(401).json({ ok: false, message: 'Unauthorized' });
    }

    if (!ticket.inTrash) {
      return res.status(400).json({ ok: false, message: 'Ticket is not in trash' });
    }

    ticket.inTrash = false;
    ticket.trashDate = undefined;
    ticket.status = 'open';
    await ticket.save();

    res.json({ ok: true, ticket });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Failed to restore ticket' });
  }
});

export default router;
