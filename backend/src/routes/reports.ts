import express from 'express';
import { Report } from '../models/Report';
import { User } from '../models/User';
import requireAuth, { requireRole } from '../middleware/auth';

const router = express.Router();

// POST /api/v1/reports - User submits a report
router.post('/reports', requireAuth, async (req: any, res: any) => {
  try {
    const { reportedUserId, reason, details } = req.body;
    const reporterId = req.user.userId;

    if (!reporterId || !reportedUserId || !reason) {
      return res.status(400).json({ ok: false, message: 'Missing required fields' });
    }

    const reporter = await User.findOne({ userId: reporterId });
    const reportedUser = await User.findOne({ userId: reportedUserId });

    if (!reporter || !reportedUser) {
      return res.status(404).json({ ok: false, message: 'User not found' });
    }

    const report = new Report({
      reporter: reporter._id,
      reportedUser: reportedUser._id,
      reason,
      details: details || '',
      chatTranscript: []
    });

    await report.save();

    return res.json({ ok: true, message: 'Report submitted successfully' });
  } catch (error) {
    console.error('Failed to submit report:', error);
    return res.status(500).json({ ok: false, message: 'Failed to submit report' });
  }
});

// GET /api/v1/admin/reports - Admin fetches all reports
router.get('/admin/reports', requireAuth, requireRole('admin'), async (req: any, res: any) => {
  try {
    const reports = await Report.find()
      .populate('reporter', 'username displayName avatar userId')
      .populate('reportedUser', 'username displayName avatar userId')
      .sort({ createdAt: -1 });

    return res.json({ ok: true, reports });
  } catch (error) {
    console.error('Failed to fetch reports:', error);
    return res.status(500).json({ ok: false, message: 'Failed to fetch reports' });
  }
});

// POST /api/v1/admin/ban-user - Admin bans a user
router.post('/admin/ban-user', requireAuth, requireRole('admin'), async (req: any, res: any) => {
  try {
    const { userId, reportId } = req.body;

    if (!userId || !reportId) {
      return res.status(400).json({ ok: false, message: 'Missing required fields' });
    }

    const user = await User.findOne({ userId });
    if (!user) {
      return res.status(404).json({ ok: false, message: 'User not found' });
    }

    user.isBanned = true;
    await user.save();

    const report = await Report.findById(reportId);
    if (report) {
      report.status = 'resolved';
      await report.save();
    }

    return res.json({ ok: true, message: 'User banned successfully' });
  } catch (error) {
    console.error('Failed to ban user:', error);
    return res.status(500).json({ ok: false, message: 'Failed to ban user' });
  }
});

// PATCH /api/v1/admin/reports/:id/dismiss - Admin dismisses a report
router.patch('/admin/reports/:id/dismiss', requireAuth, requireRole('admin'), async (req: any, res: any) => {
  try {
    const { id } = req.params;

    const report = await Report.findById(id);
    if (!report) {
      return res.status(404).json({ ok: false, message: 'Report not found' });
    }

    report.status = 'dismissed';
    await report.save();

    return res.json({ ok: true, message: 'Report dismissed successfully' });
  } catch (error) {
    console.error('Failed to dismiss report:', error);
    return res.status(500).json({ ok: false, message: 'Failed to dismiss report' });
  }
});

// PATCH /api/v1/admin/reports/:id/resolve - Admin marks report resolved
router.patch('/admin/reports/:id/resolve', requireAuth, requireRole('admin'), async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const report = await Report.findById(id);
    if (!report) {
      return res.status(404).json({ ok: false, message: 'Report not found' });
    }

    report.status = 'resolved';
    await report.save();

    return res.json({ ok: true, message: 'Report resolved successfully' });
  } catch (error) {
    console.error('Failed to resolve report:', error);
    return res.status(500).json({ ok: false, message: 'Failed to resolve report' });
  }
});

// GET /api/v1/admin/banned-users - Admin lists banned users
router.get('/admin/banned-users', requireAuth, requireRole('admin'), async (req: any, res: any) => {
  try {
    const bannedUsers = await User.find({ isBanned: true }).select('userId username displayName avatar createdAt email');
    return res.json({ ok: true, users: bannedUsers });
  } catch (error) {
    console.error('Failed to fetch banned users:', error);
    return res.status(500).json({ ok: false, message: 'Failed to fetch banned users' });
  }
});

// POST /api/v1/admin/unban-user - Admin unbans a user
router.post('/admin/unban-user', requireAuth, requireRole('admin'), async (req: any, res: any) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ ok: false, message: 'Missing userId' });
    }

    const user = await User.findOne({ userId });
    if (!user) {
      return res.status(404).json({ ok: false, message: 'User not found' });
    }

    user.isBanned = false;
    await user.save();

    return res.json({ ok: true, message: 'User unbanned successfully' });
  } catch (error) {
    console.error('Failed to unban user:', error);
    return res.status(500).json({ ok: false, message: 'Failed to unban user' });
  }
});

// DELETE /api/v1/admin/reports/clear - Clear all reports (for testing)
router.delete('/admin/reports/clear', requireAuth, requireRole('admin'), async (req: any, res: any) => {
  try {
    await Report.deleteMany({});
    return res.json({ ok: true, message: 'All reports cleared' });
  } catch (error) {
    console.error('Failed to clear reports:', error);
    return res.status(500).json({ ok: false, message: 'Failed to clear reports' });
  }
});

export default router;
