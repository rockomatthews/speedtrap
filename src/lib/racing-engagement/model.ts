// Provider-neutral facts. Identifiers are scoped to their source, never matched by name.
export type RacingLap = {
  sourceId: string;
  lapId: number;
  driverId: string | null;
  driverName: string;
  boardKey: string | null;
  boardLabel: string;
  timeMs: number | null;
  occurredAt: string | null;
  valid: boolean;
  exclusion: string | null;
};
export type RacingLapSource = {
  sourceId: string;
  latestId(): Promise<number>;
  page(after: number, count: number): Promise<RacingLap[]>;
};
export const ENGAGEMENT_MODE = 'shadow' as const;
// Deliberately no email provider import, credentials, delivery worker or live-mode switch.
export function formatLap(ms: number) {
  return `${Math.floor(ms / 60000)}:${((ms % 60000) / 1000).toFixed(3).padStart(6, '0')}`;
}
export function recordLostPreview(payload: {boardLabel: string; previousMs: number; newMs: number}) {
  return {
    subject: 'Your Speed Trap record has been beaten',
    text: `Your previous best of ${formatLap(payload.previousMs)} on ${payload.boardLabel} has been beaten by ${( (payload.previousMs - payload.newMs) / 1000).toFixed(3)} seconds. The new time is ${formatLap(payload.newMs)}. Ready for another run?`,
    bookingUrl: 'https://www.speedtrapracing.com/book',
    // No deep link to an unrelated hotlap board: all-time board mapping is a release gate.
    delivery: 'Disabled — shadow preview only',
    releaseGates: ['Verify matching public leaderboard and competition rules', 'Verify driver identity, email preferences and unsubscribe handling', 'Revalidate record immediately before delivery']
  };
}
