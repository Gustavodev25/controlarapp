import { Platform } from 'react-native';
import { DeviceTierInfo } from './types';

const MB = 1024 * 1024;
type ExpoDeviceModule = {
  totalMemory?: number | null;
  deviceYearClass?: number | null;
};
type ExpoModulesCoreModule = {
  NativeModulesProxy?: {
    ExpoDevice?: ExpoDeviceModule | null;
  };
};

let cachedExpoDevice: ExpoDeviceModule | null | undefined;
let hasWarnedMissingExpoDevice = false;

function getExpoDevice(): ExpoDeviceModule | null {
  if (cachedExpoDevice !== undefined) {
    return cachedExpoDevice;
  }

  try {
    // Read directly from NativeModulesProxy so we can gracefully handle
    // development clients that were built without ExpoDevice.
    const { NativeModulesProxy } = require('expo-modules-core') as ExpoModulesCoreModule;
    cachedExpoDevice = NativeModulesProxy?.ExpoDevice ?? null;
  } catch {
    cachedExpoDevice = null;
  }

  if (__DEV__ && !cachedExpoDevice && !hasWarnedMissingExpoDevice) {
    hasWarnedMissingExpoDevice = true;
    console.warn('[Performance] expo-device unavailable. Using fallback device tier.');
  }

  return cachedExpoDevice;
}

function readDeviceNumber(
  device: ExpoDeviceModule | null,
  key: keyof ExpoDeviceModule
): number | undefined {
  try {
    const value = device?.[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return undefined;
    }
    return value;
  } catch {
    return undefined;
  }
}

function getHardwareConcurrency(): number | undefined {
  const nav = (globalThis as { navigator?: { hardwareConcurrency?: number } }).navigator;
  const value = nav?.hardwareConcurrency;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }
  return Math.max(1, Math.floor(value));
}

function classifyAndroidTier(totalMemoryMb?: number, cpuCores?: number, deviceYearClass?: number): DeviceTierInfo {
  const memory = totalMemoryMb ?? 4096;
  const cores = cpuCores ?? 8;
  const year = deviceYearClass ?? 9999;

  const entryByMemory = memory <= 2300;
  const entryByCores = cores <= 4;
  const entryByYear = year <= 2018;

  if (entryByMemory || entryByCores || entryByYear) {
    return {
      tier: 'entry_2gb_quad',
      totalMemoryMb,
      cpuCores,
      deviceYearClass,
      reason: `android-entry(memory=${memory}MB, cores=${cores}, year=${year})`,
    };
  }

  const midByMemory = memory <= 3400;
  const midByCores = cores <= 6;
  const midByYear = year <= 2020;

  if (midByMemory || midByCores || midByYear) {
    return {
      tier: 'mid_3gb_quad',
      totalMemoryMb,
      cpuCores,
      deviceYearClass,
      reason: `android-mid(memory=${memory}MB, cores=${cores}, year=${year})`,
    };
  }

  return {
    tier: 'reference',
    totalMemoryMb,
    cpuCores,
    deviceYearClass,
    reason: `android-reference(memory=${memory}MB, cores=${cores}, year=${year})`,
  };
}

export async function detectDeviceTier(): Promise<DeviceTierInfo> {
  const cpuCores = getHardwareConcurrency();
  const device = getExpoDevice();
  const totalMemory = readDeviceNumber(device, 'totalMemory');
  const totalMemoryMb = totalMemory !== undefined ? Math.round(totalMemory / MB) : undefined;
  const deviceYearClass = readDeviceNumber(device, 'deviceYearClass');

  if (Platform.OS !== 'android') {
    return {
      tier: 'reference',
      totalMemoryMb,
      cpuCores,
      deviceYearClass,
      reason: `non-android-${Platform.OS}`,
    };
  }

  return classifyAndroidTier(totalMemoryMb, cpuCores, deviceYearClass);
}
