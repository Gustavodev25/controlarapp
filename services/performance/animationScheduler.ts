import { AnimationBudget } from './types';

type TaskKind = 'interval' | 'once';

interface SchedulerTask {
  id: string;
  kind: TaskKind;
  callback: () => void;
  baseDelayMs: number;
  jitterRatio: number;
  timeout: ReturnType<typeof setTimeout> | null;
  active: boolean;
}

const DEFAULT_BUDGET: AnimationBudget = {
  targetFps: 60,
  maxConcurrentLottie: 12,
  particleCount: 15,
  blurIntensity: 80,
  chartAnimationMs: 1000,
  spriteScale: 1,
};

class AnimationScheduler {
  private budget: AnimationBudget = DEFAULT_BUDGET;

  private tasks = new Map<string, SchedulerTask>();

  setBudget(budget: AnimationBudget): void {
    this.budget = budget;
    this.restartIntervalTasks();
  }

  scheduleInterval(
    id: string,
    callback: () => void,
    baseDelayMs: number,
    options?: { jitterRatio?: number }
  ): () => void {
    this.cancel(id);
    const task: SchedulerTask = {
      id,
      kind: 'interval',
      callback,
      baseDelayMs,
      jitterRatio: options?.jitterRatio ?? 0,
      timeout: null,
      active: true,
    };
    this.tasks.set(id, task);
    this.scheduleNext(task);
    return () => this.cancel(id);
  }

  scheduleOnce(id: string, callback: () => void, delayMs: number): () => void {
    this.cancel(id);
    const task: SchedulerTask = {
      id,
      kind: 'once',
      callback,
      baseDelayMs: delayMs,
      jitterRatio: 0,
      timeout: null,
      active: true,
    };
    this.tasks.set(id, task);
    this.scheduleNext(task);
    return () => this.cancel(id);
  }

  cancel(id: string): void {
    const task = this.tasks.get(id);
    if (!task) {
      return;
    }
    task.active = false;
    if (task.timeout) {
      clearTimeout(task.timeout);
    }
    this.tasks.delete(id);
  }

  cancelByPrefix(prefix: string): void {
    const ids = [...this.tasks.keys()].filter((key) => key.startsWith(prefix));
    ids.forEach((id) => this.cancel(id));
  }

  private restartIntervalTasks(): void {
    this.tasks.forEach((task) => {
      if (task.kind !== 'interval') {
        return;
      }
      if (task.timeout) {
        clearTimeout(task.timeout);
      }
      this.scheduleNext(task);
    });
  }

  private scheduleNext(task: SchedulerTask): void {
    if (!task.active) {
      return;
    }

    const delay = this.computeDelay(task.baseDelayMs, task.jitterRatio);
    task.timeout = setTimeout(() => {
      if (!task.active) {
        return;
      }
      task.callback();
      if (task.kind === 'interval') {
        this.scheduleNext(task);
      } else {
        this.tasks.delete(task.id);
      }
    }, delay);
  }

  private computeDelay(baseDelayMs: number, jitterRatio: number): number {
    const fpsFactor = this.budget.targetFps === 60 ? 1 : this.budget.targetFps === 45 ? 1.2 : 1.5;
    const concurrencyFactor = this.budget.maxConcurrentLottie <= 4 ? 1.25 : this.budget.maxConcurrentLottie <= 6 ? 1.1 : 1;
    const jitter = jitterRatio > 0 ? (Math.random() * 2 - 1) * baseDelayMs * jitterRatio : 0;
    return Math.max(120, Math.round(baseDelayMs * fpsFactor * concurrencyFactor + jitter));
  }
}

export const animationScheduler = new AnimationScheduler();
