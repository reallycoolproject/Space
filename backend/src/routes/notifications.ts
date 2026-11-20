import express from 'express';
import mongoose from 'mongoose';
import requireAuth from '../middleware/auth';
import { Notification } from '../models/Notification';

const router = express.Router();

router.get('/', requireAuth, async (req: any, res: any) => {
  try {
    const notifications = await Notification.find({ recipientUserId: req.user.userId })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    return res.json({
      ok: true,
      notifications: notifications.map(notification => ({
        id: String(notification._id),
        roomId: notification.roomId,
        senderId: notification.senderId,
        senderName: notification.senderName,
        messageId: notification.messageId,
        type: notification.type,
        groupName: notification.groupName,
        createdAt: notification.createdAt.toISOString(),
        readAt: notification.readAt?.toISOString()
      }))
    });
  } catch (error) {
    console.error('Failed to load notifications', error);
    return res.status(500).json({ ok: false, message: 'Failed to load notifications.' });
  }
});

router.patch('/:id/read', requireAuth, async (req: any, res: any) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ ok: false, message: 'Invalid notification id.' });
    }
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipientUserId: req.user.userId },
      { $set: { readAt: new Date() } },
      { new: true }
    ).select('_id readAt');
    if (!notification) return res.status(404).json({ ok: false, message: 'Notification not found.' });
    return res.json({ ok: true, readAt: notification.readAt });
  } catch (error) {
    console.error('Failed to mark notification as read', error);
    return res.status(500).json({ ok: false, message: 'Failed to update notification.' });
  }
});

router.patch('/read-all', requireAuth, async (req: any, res: any) => {
  try {
    await Notification.updateMany(
      { recipientUserId: req.user.userId, readAt: { $exists: false } },
      { $set: { readAt: new Date() } }
    );
    return res.json({ ok: true });
  } catch (error) {
    console.error('Failed to mark notifications as read', error);
    return res.status(500).json({ ok: false, message: 'Failed to update notifications.' });
  }
});

export default router;
