import type { Href, Router } from 'expo-router';

export const AUTH_FALLBACK_ROUTE = '/(public)/welcome' as Href;
export const APP_FALLBACK_ROUTE = '/(tabs)/dashboard' as Href;

export function safeBack(router: Router, fallback: Href = APP_FALLBACK_ROUTE) {
    if (router.canGoBack()) {
        router.back();
        return;
    }

    router.replace(fallback);
}
