/**
 * TakeLink Analytics - Lightweight self-hosted tracking
 *
 * Zero external dependencies. Only metadata, NEVER terminal content.
 */

// ============ Client Identity ============

export type ClientType = 'capacitor' | 'web-mobile' | 'web-desktop';
export type ConnectionMethod = 'qr-scan' | 'manual-input' | 'direct';
export type AuthResult = 'password-success' | 'password-failed' | 'token-success' | 'token-failed';

// ============ Client Report (sent from browser on connect) ============

export interface ClientReport {
  clientType: ClientType;
  connectionMethod: ConnectionMethod;
  userAgent?: string;
  screenSize?: string;
}

// ============ Aggregated Snapshot ============

export interface TimeBucket {
  period: string; // e.g. "2026-04-05T14:00"
  connectionAttempts: number;
  connectionSuccesses: number;
  connectionFailures: number;
  clientTypeDistribution: Record<ClientType, number>;
  connectionMethodDistribution: Record<ConnectionMethod, number>;
  terminalsCreated: number;
  customCommandInvocations: number;
  authSuccesses: number;
  authFailures: number;
}

export interface RealtimeState {
  currentConnections: number;
  currentTerminals: number;
  activeTmuxSessions: number;
}

export interface StatsSnapshot {
  uptime: number;
  serverStartedAt: number;
  lastPersistedAt: number;
  totals: {
    connectionAttempts: number;
    connectionSuccesses: number;
    connectionFailures: number;
    terminalsCreated: number;
    terminalsDestroyed: number;
    customCommandInvocations: number;
    authSuccesses: number;
    authFailures: number;
    virtualKeyInteractions: number;
  };
  distributions: {
    clientType: Record<ClientType, number>;
    connectionMethod: Record<ConnectionMethod, number>;
    authMethod: Record<string, number>;
  };
  hourlyBuckets: TimeBucket[];
  realtime: RealtimeState;
  customCommandUsage: Record<string, number>;
}

// ============ Persistence File Format ============

export interface StatsPersistence {
  version: 1;
  savedAt: number;
  lifetimeTotals: StatsSnapshot['totals'];
  lifetimeDistributions: StatsSnapshot['distributions'];
  customCommandUsage: Record<string, number>;
}
