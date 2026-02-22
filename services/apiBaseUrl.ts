export interface ApiBaseUrlConfig {
    envApiUrl?: string | null;
    isDev?: boolean;
    platform?: string | null;
    expoHostUri?: string | null;
    defaultPort?: number;
    productionUrl?: string | null;
}

const DEFAULT_PORT = 3001;
const DEFAULT_PRODUCTION_URL = 'https://backendcontrolarapp-production.up.railway.app';
const TUNNEL_HOST_SUFFIXES = ['.exp.direct', '.expo.dev'];
const LOCAL_HOSTNAMES = new Set(['localhost', '10.0.2.2']);

const normalizeBaseUrl = (url: string): string => url.trim().replace(/\/+$/, '');

const toNormalizedUrlOrNull = (url?: string | null): string | null => {
    if (!url || typeof url !== 'string') return null;
    const normalized = normalizeBaseUrl(url);
    return normalized.length > 0 ? normalized : null;
};

const extractHost = (hostUri?: string | null): string | null => {
    if (!hostUri) return null;

    const trimmed = hostUri.trim();
    if (!trimmed) return null;

    try {
        if (trimmed.includes('://')) {
            const parsedUrl = new URL(trimmed);
            if (parsedUrl.hostname) return parsedUrl.hostname;
        }
    } catch {
        // Fall back to manual parsing below.
    }

    const withoutPath = trimmed.split('/')[0];
    const hostCandidate = withoutPath.split(':')[0]?.trim();
    if (!hostCandidate) return null;

    const hostPattern = /^[a-zA-Z0-9.-]+$/;
    return hostPattern.test(hostCandidate) ? hostCandidate : null;
};

const isIpv4Address = (host: string): boolean => {
    const octets = host.split('.');
    if (octets.length !== 4) return false;

    for (const octet of octets) {
        if (!/^\d+$/.test(octet)) return false;
        const value = Number(octet);
        if (value < 0 || value > 255) return false;
    }

    return true;
};

const isPrivateOrLoopbackIpv4 = (host: string): boolean => {
    if (!isIpv4Address(host)) return false;

    const [first, second] = host.split('.').map(Number);

    if (first === 10 || first === 127) return true;
    if (first === 192 && second === 168) return true;
    if (first === 172 && second >= 16 && second <= 31) return true;
    if (first === 169 && second === 254) return true;

    return false;
};

const isTunnelHost = (host: string): boolean => {
    const normalized = host.toLowerCase();
    return TUNNEL_HOST_SUFFIXES.some((suffix) => (
        normalized === suffix.slice(1) || normalized.endsWith(suffix)
    ));
};

const isLocalDevelopmentHost = (host: string): boolean => {
    const normalized = host.toLowerCase();
    if (LOCAL_HOSTNAMES.has(normalized)) return true;
    if (normalized.endsWith('.local')) return true;

    return isPrivateOrLoopbackIpv4(normalized);
};

const getRuntimeIsDev = (): boolean => {
    const globalIsDev = (globalThis as any)?.__DEV__;
    if (typeof globalIsDev === 'boolean') return globalIsDev;
    return process.env.NODE_ENV !== 'production';
};

const getRuntimePlatform = (): string => {
    try {
        // Lazy require to keep this module test-friendly in Node.
        const reactNative = require('react-native');
        return reactNative?.Platform?.OS || 'web';
    } catch {
        return 'web';
    }
};

const getRuntimeExpoHostUri = (): string | null => {
    try {
        // Lazy require to avoid hard dependency during unit tests.
        const constantsModule = require('expo-constants');
        const constants = constantsModule?.default || constantsModule;

        return (
            constants?.expoConfig?.hostUri ||
            constants?.manifest2?.extra?.expoGo?.debuggerHost ||
            constants?.manifest?.debuggerHost ||
            null
        );
    } catch {
        return null;
    }
};

const getDevelopmentLocalFallbackUrl = (platform: string, port: number): string => {
    if (platform.toLowerCase() === 'android') return `http://10.0.2.2:${port}`;
    return `http://localhost:${port}`;
};

const appendCandidate = (candidates: string[], value?: string | null): void => {
    const normalized = toNormalizedUrlOrNull(value);
    if (!normalized) return;
    if (!candidates.includes(normalized)) {
        candidates.push(normalized);
    }
};

export function resolveApiBaseUrlCandidates(config: ApiBaseUrlConfig = {}): string[] {
    const candidates: string[] = [];
    const envApiUrl = toNormalizedUrlOrNull(config.envApiUrl);
    const productionUrl = toNormalizedUrlOrNull(config.productionUrl) || DEFAULT_PRODUCTION_URL;
    const isDev = config.isDev ?? getRuntimeIsDev();

    appendCandidate(candidates, envApiUrl);

    // Always prioritize production URL if we want "nothing local anymore"
    appendCandidate(candidates, productionUrl);

    if (!isDev) {
        return candidates;
    }

    const port = config.defaultPort ?? DEFAULT_PORT;
    const runtimePlatform = (config.platform || getRuntimePlatform()).toLowerCase();
    const localFallbackUrl = getDevelopmentLocalFallbackUrl(runtimePlatform, port);
    const inferredHost = extractHost(config.expoHostUri);
    if (inferredHost) {
        if (isLocalDevelopmentHost(inferredHost)) {
            appendCandidate(candidates, `http://${inferredHost}:${port}`);
        }

        if (isTunnelHost(inferredHost)) {
            // Keep development traffic local by default; use EXPO_PUBLIC_API_URL for LAN/ngrok overrides.
            appendCandidate(candidates, localFallbackUrl);
            appendCandidate(candidates, productionUrl);
            return candidates;
        }
    }

    appendCandidate(candidates, localFallbackUrl);
    return candidates;
}

export function resolveApiBaseUrl(config: ApiBaseUrlConfig = {}): string {
    const candidates = resolveApiBaseUrlCandidates(config);
    if (candidates.length > 0) return candidates[0];

    return toNormalizedUrlOrNull(config.productionUrl) || DEFAULT_PRODUCTION_URL;
}

export const API_BASE_URL = resolveApiBaseUrl({
    envApiUrl: process.env.EXPO_PUBLIC_API_URL,
    isDev: getRuntimeIsDev(),
    platform: getRuntimePlatform(),
    expoHostUri: getRuntimeExpoHostUri(),
});

export const API_BASE_URL_CANDIDATES = resolveApiBaseUrlCandidates({
    envApiUrl: process.env.EXPO_PUBLIC_API_URL,
    isDev: getRuntimeIsDev(),
    platform: getRuntimePlatform(),
    expoHostUri: getRuntimeExpoHostUri(),
});
