/**
 * TakeLink Stats Module
 */
export { StatsAggregator } from './stats-aggregator.js';
export type { ClientReport, ClientType, ConnectionMethod, StatsSnapshot } from './types.js';

// Singleton instance
import { StatsAggregator as StatsAggregatorClass } from './stats-aggregator.js';

export const statsAggregator = new StatsAggregatorClass();
