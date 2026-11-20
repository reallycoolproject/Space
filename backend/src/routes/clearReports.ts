import express from 'express';
import { Report } from '../models/Report';

const router = express.Router();

// DELETE /api/v1/admin/reports/clear - Clear all reports (for testing)
router.delete('/admin/reports/clear', async (req: any, res: any) => {
  try {
    await Report.deleteMany({});
    return res.json({ ok: true, message: 'All reports cleared' });
  } catch (error) {
    console.error('Failed to clear reports:', error);
    return res.status(500).json({ ok: false, message: 'Failed to clear reports' });
  }
});

export default router;
