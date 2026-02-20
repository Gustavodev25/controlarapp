import { resolveApiBaseUrl, resolveApiBaseUrlCandidates } from '../services/apiBaseUrl';

describe('resolveApiBaseUrl', () => {
    test('prioritizes EXPO_PUBLIC_API_URL when provided', () => {
        const result = resolveApiBaseUrl({
            envApiUrl: 'http://192.168.0.163:3001',
            isDev: true,
            platform: 'android',
            expoHostUri: '192.168.0.10:8081',
        });

        expect(result).toBe('http://192.168.0.163:3001');
    });

    test('uses production Railway fallback when not in development', () => {
        const result = resolveApiBaseUrl({
            envApiUrl: '',
            isDev: false,
            platform: 'android',
            expoHostUri: null,
        });

        expect(result).toBe('https://controlar-production.up.railway.app');
    });

    test('infers LAN host from Expo host URI in development', () => {
        const result = resolveApiBaseUrl({
            envApiUrl: null,
            isDev: true,
            platform: 'android',
            expoHostUri: '192.168.0.163:8081',
        });

        expect(result).toBe('http://192.168.0.163:3001');
    });

    test('falls back to Android emulator host when Expo host is unavailable', () => {
        const result = resolveApiBaseUrl({
            envApiUrl: null,
            isDev: true,
            platform: 'android',
            expoHostUri: null,
        });

        expect(result).toBe('http://10.0.2.2:3001');
    });

    test('uses local development fallback in development when Expo host is a tunnel domain', () => {
        const result = resolveApiBaseUrl({
            envApiUrl: null,
            isDev: true,
            platform: 'android',
            expoHostUri: '7d6pefk-gustavodev25-8081.exp.direct',
        });

        expect(result).toBe('http://10.0.2.2:3001');
    });

    test('falls back to localhost for web/general development', () => {
        const result = resolveApiBaseUrl({
            envApiUrl: null,
            isDev: true,
            platform: 'web',
            expoHostUri: null,
        });

        expect(result).toBe('http://localhost:3001');
    });

    test('normalizes trailing slashes', () => {
        const fromEnv = resolveApiBaseUrl({
            envApiUrl: 'http://192.168.0.163:3001/',
            isDev: true,
            platform: 'android',
            expoHostUri: null,
        });

        const fromProd = resolveApiBaseUrl({
            envApiUrl: null,
            isDev: false,
            platform: 'android',
            expoHostUri: null,
            productionUrl: 'https://controlar-production.up.railway.app/',
        });

        expect(fromEnv).toBe('http://192.168.0.163:3001');
        expect(fromProd).toBe('https://controlar-production.up.railway.app');
    });

    test('returns development candidates with production fallback at the end', () => {
        const result = resolveApiBaseUrlCandidates({
            envApiUrl: 'http://192.168.0.163:3001',
            isDev: true,
            platform: 'android',
            expoHostUri: '192.168.0.10:8081',
        });

        expect(result[0]).toBe('http://192.168.0.163:3001');
        expect(result[result.length - 1]).toBe('https://controlar-production.up.railway.app');
        expect(result).toContain('http://10.0.2.2:3001');
    });

    test('keeps local fallback and production fallback for tunnel development hosts', () => {
        const result = resolveApiBaseUrlCandidates({
            envApiUrl: null,
            isDev: true,
            platform: 'android',
            expoHostUri: '7d6pefk-gustavodev25-8081.exp.direct',
        });

        expect(result).toEqual([
            'http://10.0.2.2:3001',
            'https://controlar-production.up.railway.app',
        ]);
    });
});
