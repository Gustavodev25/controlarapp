import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { DeviceTier, LodLevel, PerfSample, PerformanceConfig } from './types';

type SampleListener = (sample: PerfSample) => void;

const STORAGE_KEY = '@controlar/perf_samples_v1';
const MAX_PERSISTED_SAMPLES = 1500;
const LOG_BATCH_SIZE = 10;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

class RuntimeMonitor {
  private listeners = new Set<SampleListener>();

  private running = false;

  private frameRafId: number | null = null;

  private sampleIntervalId: ReturnType<typeof setInterval> | null = null;

  private frameTimes: number[] = [];

  private lastFrameTs = 0;

  private screen = 'unknown';

  private tier: DeviceTier = 'reference';

  private lod: LodLevel = 0;

  private targetFps: 30 | 45 | 60 = 60;

  private latest: PerfSample | null = null;

  private samplesCollected = 0;

  private config: PerformanceConfig = {
    realtimeHud: false,
    logToFile: false,
    adaptiveFps: true,
  };

  private persistenceQueue: PerfSample[] = [];

  private readonly onFrame = (ts: number) => {
    if (!this.running) {
      return;
    }

    if (this.lastFrameTs > 0) {
      const delta = ts - this.lastFrameTs;
      if (delta > 0 && delta < 250) {
        this.frameTimes.push(delta);
      }
    }

    this.lastFrameTs = ts;
    this.frameRafId = requestAnimationFrame(this.onFrame);
  };

  start(config: PerformanceConfig): void {
    this.config = config;
    if (this.running) {
      return;
    }

    this.running = true;
    this.lastFrameTs = 0;
    this.frameTimes = [];
    this.frameRafId = requestAnimationFrame(this.onFrame);
    this.sampleIntervalId = setInterval(() => {
      this.emitSample();
    }, 1000);
  }

  stop(): void {
    this.running = false;
    if (this.frameRafId !== null) {
      cancelAnimationFrame(this.frameRafId);
      this.frameRafId = null;
    }
    if (this.sampleIntervalId) {
      clearInterval(this.sampleIntervalId);
      this.sampleIntervalId = null;
    }
    this.frameTimes = [];
    this.lastFrameTs = 0;
    if (this.persistenceQueue.length > 0) {
      const pending = this.persistenceQueue.splice(0, this.persistenceQueue.length);
      void this.persistBatch(pending);
    }
  }

  setConfig(config: PerformanceConfig): void {
    this.config = config;
  }

  setScreen(screen: string): void {
    this.screen = screen || 'unknown';
  }

  setTier(tier: DeviceTier): void {
    this.tier = tier;
  }

  setLod(lod: LodLevel): void {
    this.lod = lod;
  }

  setTargetFps(targetFps: 30 | 45 | 60): void {
    this.targetFps = targetFps;
  }

  subscribe(listener: SampleListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getLatestSample(): PerfSample | null {
    return this.latest;
  }

  getSamplesCollected(): number {
    return this.samplesCollected;
  }

  async getPersistedSamples(): Promise<PerfSample[]> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw) as PerfSample[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async clearPersistedSamples(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage clear errors in runtime profiling.
    }
  }

  async exportPersistedCsv(): Promise<string> {
    const samples = await this.getPersistedSamples();
    return perfSamplesToCsv(samples);
  }

  private emitSample(): void {
    if (!this.running) {
      return;
    }

    const times = this.frameTimes;
    this.frameTimes = [];
    if (times.length === 0) {
      return;
    }

    const averageFrameMs = times.reduce((sum, value) => sum + value, 0) / times.length;
    const p95FrameMs = percentile(times, 95);
    const jsFps = round2(Math.max(1, Math.min(60, 1000 / averageFrameMs)));
    const uiFps = jsFps;
    const dropThreshold = (1000 / this.targetFps) * 1.2;
    const droppedFrames = times.filter((value) => value > dropThreshold).length;
    const droppedFramesPct = round2((droppedFrames / times.length) * 100);
    const jsLagP95Ms = round2(Math.max(0, p95FrameMs - 1000 / this.targetFps));

    const sample: PerfSample = {
      ts: Date.now(),
      screen: this.screen,
      tier: this.tier,
      lod: this.lod,
      uiFps,
      jsFps,
      p95FrameMs: round2(p95FrameMs),
      droppedFramesPct,
      jsLagP95Ms,
    };

    this.latest = sample;
    this.samplesCollected += 1;
    this.listeners.forEach((listener) => listener(sample));

    if (this.config.logToFile) {
      this.persistenceQueue.push(sample);
      if (this.persistenceQueue.length >= LOG_BATCH_SIZE) {
        const batch = this.persistenceQueue.splice(0, this.persistenceQueue.length);
        void this.persistBatch(batch);
      }
    }
  }

  private async persistBatch(batch: PerfSample[]): Promise<void> {
    if (batch.length === 0) {
      return;
    }

    try {
      const existing = await this.getPersistedSamples();
      const merged = [...existing, ...batch].slice(-MAX_PERSISTED_SAMPLES);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    } catch {
      // Ignore AsyncStorage errors for telemetry persistence.
    }

    try {
      const baseDir = `${FileSystem.documentDirectory}performance`;
      const filePath = `${baseDir}/perf-samples.ndjson`;
      const info = await FileSystem.getInfoAsync(baseDir);
      if (!info.exists) {
        await FileSystem.makeDirectoryAsync(baseDir, { intermediates: true });
      }
      const content = `${batch.map((sample) => JSON.stringify(sample)).join('\n')}\n`;
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      const previous = fileInfo.exists ? await FileSystem.readAsStringAsync(filePath) : '';
      await FileSystem.writeAsStringAsync(filePath, `${previous}${content}`, {
        encoding: FileSystem.EncodingType.UTF8,
      });
    } catch {
      // Ignore file IO errors on devices where document storage is not writable.
    }
  }
}

export function perfSamplesToCsv(samples: PerfSample[]): string {
  const header = [
    'ts',
    'screen',
    'tier',
    'lod',
    'uiFps',
    'jsFps',
    'p95FrameMs',
    'droppedFramesPct',
    'jsLagP95Ms',
    'pssMb',
    'cpuPct',
    'gpuFrameP95Ms',
    'batteryDropPct30m',
  ];

  const rows = samples.map((sample) =>
    [
      sample.ts,
      sample.screen,
      sample.tier,
      sample.lod,
      sample.uiFps,
      sample.jsFps,
      sample.p95FrameMs,
      sample.droppedFramesPct,
      sample.jsLagP95Ms,
      sample.pssMb ?? '',
      sample.cpuPct ?? '',
      sample.gpuFrameP95Ms ?? '',
      sample.batteryDropPct30m ?? '',
    ].join(',')
  );

  return [header.join(','), ...rows].join('\n');
}

export const runtimeMonitor = new RuntimeMonitor();
