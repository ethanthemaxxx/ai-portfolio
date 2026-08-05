import type { StageTiming, TimingRecord } from './types.ts';

/**
 * The only clock read in the pipeline, and it is monotonic (plan.md D11).
 * Nothing here feeds content, and no test asserts on a duration.
 */
export class StageTimer {
  private readonly totals = new Map<string, number>();
  private readonly order: string[] = [];
  private readonly startedAt = performance.now();

  async time<T>(stage: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    try {
      return await fn();
    } finally {
      this.add(stage, performance.now() - start);
    }
  }

  timeSync<T>(stage: string, fn: () => T): T {
    const start = performance.now();
    try {
      return fn();
    } finally {
      this.add(stage, performance.now() - start);
    }
  }

  private add(stage: string, ms: number): void {
    if (!this.totals.has(stage)) this.order.push(stage);
    this.totals.set(stage, (this.totals.get(stage) ?? 0) + ms);
  }

  stages(): StageTiming[] {
    return this.order.map((stage) => ({
      stage,
      ms: Math.round((this.totals.get(stage) ?? 0) * 1000) / 1000,
    }));
  }

  record(): TimingRecord {
    return {
      stages: this.stages(),
      totalMs: Math.round((performance.now() - this.startedAt) * 1000) / 1000,
    };
  }
}

export function formatMinutes(ms: number): string {
  return (ms / 60000).toFixed(3);
}
