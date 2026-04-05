/**
 * TakeLink StatsAggregator
 *
 * Lightweight, in-memory analytics with periodic JSON persistence.
 * Zero external dependencies. Privacy-first: never logs terminal content.
 */

import fs from 'fs';
import path from 'path';
import type {
  StatsSnapshot,
  StatsPersistence,
  TimeBucket,
  ClientReport,
  ClientType,
  ConnectionMethod
} from './types.js';

const MAX_HOURLY_BUCKETS = 48; // Keep 48 hours of history
const PERSIST_INTERVAL_MS = 60_000; // Persist every 60 seconds
const DATA_DIR = path.join(process.cwd(), 'data');
const STATS_FILE = path.join(DATA_DIR, 'stats.json');

export class StatsAggregator {
  // ============ Session Totals (reset on restart) ============
  private startedAt = Date.now();

  // ============ In-memory counters ============
  private connectionAttempts = 0;
  private connectionSuccesses = 0;
  private connectionFailures = 0;
  private terminalsCreated = 0;
  private terminalsDestroyed = 0;
  private customCommandInvocations = 0;
  private authSuccesses = 0;
  private authFailures = 0;
  private virtualKeyInteractions = 0;

  // ============ Distribution counters ============
  private clientTypeCounts: Record<ClientType, number> = { capacitor: 0, 'web-mobile': 0, 'web-desktop': 0 };
  private connectionMethodCounts: Record<ConnectionMethod, number> = { 'qr-scan': 0, 'manual-input': 0, direct: 0 };
  private authMethodCounts: Record<string, number> = {};
  private customCommandUsage: Record<string, number> = {};

  // ============ Time buckets ============
  private hourlyBuckets = new Map<string, TimeBucket>();

  // ============ Active sessions ============
  private activeSessions = new Map<string, { clientType: ClientType; connectedAt: number }>();

  // ============ Lifetime (survives restart) ============
  private lifetimeTotals: StatsSnapshot['totals'] = this.createEmptyTotals();
  private lifetimeDistributions: StatsSnapshot['distributions'] = this.createEmptyDistributions();

  // ============ Persistence ============
  private persistInterval?: ReturnType<typeof setInterval>;

  constructor() {
    // Ensure data dir exists
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    this.load();
    this.persistInterval = setInterval(() => this.persist(), PERSIST_INTERVAL_MS);
  }

  // ============ Public API ============

  recordConnectionAttempt(report: ClientReport, success: boolean): void {
    this.connectionAttempts++;
    if (success) this.connectionSuccesses++;
    else this.connectionFailures++;

    this.clientTypeCounts[report.clientType]++;
    this.connectionMethodCounts[report.connectionMethod]++;

    const bucket = this.getCurrentHourBucket();
    bucket.connectionAttempts++;
    if (success) bucket.connectionSuccesses++;
    else bucket.connectionFailures++;
    bucket.clientTypeDistribution[report.clientType]++;
    bucket.connectionMethodDistribution[report.connectionMethod]++;
  }

  registerSession(socketId: string, clientType: ClientType): void {
    this.activeSessions.set(socketId, { clientType, connectedAt: Date.now() });
  }

  removeSession(socketId: string): void {
    this.activeSessions.delete(socketId);
  }

  recordAuth(method: string, success: boolean): void {
    const key = `${method}-${success ? 'success' : 'failed'}`;
    this.authMethodCounts[key] = (this.authMethodCounts[key] || 0) + 1;
    if (success) {
      this.authSuccesses++;
    } else {
      this.authFailures++;
    }
  }

  recordTerminalCreated(isTmux: boolean): void {
    this.terminalsCreated++;
    const bucket = this.getCurrentHourBucket();
    bucket.terminalsCreated++;
    if (isTmux) {
      // Track tmux usage via realtime
    }
  }

  recordTerminalDestroyed(): void {
    this.terminalsDestroyed++;
  }

  recordCustomCommand(commandName: string): void {
    this.customCommandInvocations++;
    this.customCommandUsage[commandName] = (this.customCommandUsage[commandName] || 0) + 1;
    const bucket = this.getCurrentHourBucket();
    bucket.customCommandInvocations++;
  }

  recordVirtualKey(): void {
    this.virtualKeyInteractions++;
  }

  /**
   * Get full stats snapshot for API endpoint.
   */
  getSnapshot(processManagerInfo?: { terminalCount: number; tmuxCount: number }): StatsSnapshot {
    // Calculate active client types from sessions
    const activeClientTypes: Record<string, number> = {};
    for (const session of this.activeSessions.values()) {
      activeClientTypes[session.clientType] = (activeClientTypes[session.clientType] || 0) + 1;
    }

    return {
      uptime: Date.now() - this.startedAt,
      serverStartedAt: this.startedAt,
      lastPersistedAt: this.lastPersistedAt,
      totals: {
        connectionAttempts: this.connectionAttempts,
        connectionSuccesses: this.connectionSuccesses,
        connectionFailures: this.connectionFailures,
        terminalsCreated: this.terminalsCreated,
        terminalsDestroyed: this.terminalsDestroyed,
        customCommandInvocations: this.customCommandInvocations,
        authSuccesses: this.authSuccesses,
        authFailures: this.authFailures,
        virtualKeyInteractions: this.virtualKeyInteractions,
      },
      distributions: {
        clientType: { ...this.clientTypeCounts },
        connectionMethod: { ...this.connectionMethodCounts },
        authMethod: { ...this.authMethodCounts },
      },
      hourlyBuckets: Array.from(this.hourlyBuckets.values())
        .sort((a, b) => a.period.localeCompare(b.period)),
      realtime: {
        currentConnections: this.activeSessions.size,
        currentTerminals: processManagerInfo?.terminalCount ?? 0,
        activeTmuxSessions: processManagerInfo?.tmuxCount ?? 0,
      },
      customCommandUsage: { ...this.customCommandUsage },
    };
  }

  // ============ Persistence ============

  private get lastPersistedAt(): number {
    return this._lastPersistedAt;
  }
  private _lastPersistedAt = 0;

  persist(): void {
    this._lastPersistedAt = Date.now();

    // Merge session counters into lifetime
    this.lifetimeTotals.connectionAttempts += this.connectionAttempts;
    this.lifetimeTotals.connectionSuccesses += this.connectionSuccesses;
    this.lifetimeTotals.connectionFailures += this.connectionFailures;
    this.lifetimeTotals.terminalsCreated += this.terminalsCreated;
    this.lifetimeTotals.terminalsDestroyed += this.terminalsDestroyed;
    this.lifetimeTotals.customCommandInvocations += this.customCommandInvocations;
    this.lifetimeTotals.authSuccesses += this.authSuccesses;
    this.lifetimeTotals.authFailures += this.authFailures;
    this.lifetimeTotals.virtualKeyInteractions += this.virtualKeyInteractions;

    // Merge distributions
    for (const [k, v] of Object.entries(this.clientTypeCounts)) {
      const key = k as ClientType;
      this.lifetimeDistributions.clientType[key] = (this.lifetimeDistributions.clientType[key] || 0) + v;
    }
    for (const [k, v] of Object.entries(this.connectionMethodCounts)) {
      const key = k as ConnectionMethod;
      this.lifetimeDistributions.connectionMethod[key] = (this.lifetimeDistributions.connectionMethod[key] || 0) + v;
    }

    const data: StatsPersistence = {
      version: 1,
      savedAt: Date.now(),
      lifetimeTotals: this.lifetimeTotals,
      lifetimeDistributions: this.lifetimeDistributions,
      customCommandUsage: this.customCommandUsage,
    };

    try {
      const tmpPath = STATS_FILE + '.tmp';
      fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tmpPath, STATS_FILE);
    } catch (err) {
      console.error('[Stats] Persist failed:', (err as Error).message);
    }
  }

  private load(): void {
    try {
      if (!fs.existsSync(STATS_FILE)) return;
      const raw = fs.readFileSync(STATS_FILE, 'utf-8');
      const data: StatsPersistence = JSON.parse(raw);
      if (data.version !== 1) return;

      this.lifetimeTotals = { ...this.createEmptyTotals(), ...data.lifetimeTotals };
      this.lifetimeDistributions = { ...this.createEmptyDistributions(), ...data.lifetimeDistributions };
      this.customCommandUsage = data.customCommandUsage || {};
    } catch {
      // Corrupt file, start fresh
    }
  }

  destroy(): void {
    if (this.persistInterval) clearInterval(this.persistInterval);
    this.persist();
  }

  // ============ Internal: Time Buckets ============

  private getHourKey(ts: number): string {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:00`;
  }

  private getCurrentHourBucket(): TimeBucket {
    const key = this.getHourKey(Date.now());
    if (!this.hourlyBuckets.has(key)) {
      this.hourlyBuckets.set(key, this.createEmptyTimeBucket(key));
      this.pruneHourlyBuckets();
    }
    return this.hourlyBuckets.get(key)!;
  }

  private pruneHourlyBuckets(): void {
    const keys = Array.from(this.hourlyBuckets.keys()).sort();
    while (keys.length > MAX_HOURLY_BUCKETS) {
      const old = keys.shift()!;
      this.hourlyBuckets.delete(old);
    }
  }

  // ============ Factory ============

  private createEmptyTotals(): StatsSnapshot['totals'] {
    return {
      connectionAttempts: 0, connectionSuccesses: 0, connectionFailures: 0,
      terminalsCreated: 0, terminalsDestroyed: 0,
      customCommandInvocations: 0, authSuccesses: 0, authFailures: 0,
      virtualKeyInteractions: 0,
    };
  }

  private createEmptyDistributions(): StatsSnapshot['distributions'] {
    return {
      clientType: { capacitor: 0, 'web-mobile': 0, 'web-desktop': 0 },
      connectionMethod: { 'qr-scan': 0, 'manual-input': 0, direct: 0 },
      authMethod: {},
    };
  }

  private createEmptyTimeBucket(period: string): TimeBucket {
    return {
      period,
      connectionAttempts: 0, connectionSuccesses: 0, connectionFailures: 0,
      clientTypeDistribution: { capacitor: 0, 'web-mobile': 0, 'web-desktop': 0 },
      connectionMethodDistribution: { 'qr-scan': 0, 'manual-input': 0, direct: 0 },
      terminalsCreated: 0, customCommandInvocations: 0,
      authSuccesses: 0, authFailures: 0,
    };
  }
}
