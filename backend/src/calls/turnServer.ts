// @ts-ignore
import Turn from 'node-turn';

let turnServerInstance: any = null;

export const startTurnServer = (port = 3478) => {
  if (turnServerInstance) return turnServerInstance;
  try {
    turnServerInstance = new Turn({
      listeningPort: port,
      authMech: 'long-term',
      credentials: {
        'spaceuser': 'spacesecureturnpass2026'
      }
    });
    turnServerInstance.start();
    console.log(`[TURN] Built-in local TURN/STUN relay server running on port ${port}`);
    return turnServerInstance;
  } catch (err) {
    console.warn('[TURN] Could not start built-in TURN server:', err);
    return null;
  }
};
