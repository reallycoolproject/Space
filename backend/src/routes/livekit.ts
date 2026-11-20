import express from 'express';
import { AccessToken } from 'livekit-server-sdk';

const router = express.Router();

router.post('/get-token', async (req: any, res: any) => {
  try {
    const { roomName, userName } = req.body;
    if (!roomName || !userName) {
      return res.status(400).json({ ok: false, message: 'roomName and userName are required.' });
    }

    const apiKey = process.env.LIVEKIT_API_KEY || 'APIsa9EUuoYdHvh';
    const apiSecret = process.env.LIVEKIT_API_SECRET || 'AVnFHMpWUfqoQerOqVo0Cm89M2dFzhIJ8VSvWFkNwLM';

    const at = new AccessToken(apiKey, apiSecret, {
      identity: String(userName),
      name: String(userName),
    });

    at.addGrant({
      roomJoin: true,
      room: String(roomName),
      canPublish: true,
      canSubscribe: true,
    });

    const token = await at.toJwt();
    return res.json({ ok: true, token });
  } catch (error) {
    console.error('Error generating LiveKit token:', error);
    return res.status(500).json({ ok: false, message: 'Failed to generate token' });
  }
});

export default router;
