import { ConnectAccountModal } from '@/components/ConnectAccountModal';
import { UniversalBackground } from '@/components/UniversalBackground';
import { BankConnectorLogo } from '@/components/open-finance/BankConnectorLogo';
import { ConnectedBankCard, BankSyncStatus as SyncStatus } from '@/components/open-finance/ConnectedBankCard';
import { SyncCreditsDisplay, useSyncCredits } from '@/components/open-finance/SyncCreditsDisplay';
import { AnimatedInlineBanner } from '@/components/ui/AnimatedInlineBanner';
import { DeleteConfirmationModal } from '@/components/ui/DeleteConfirmationModal';
import { IosCoreLoader } from '@/components/ui/IosCoreLoader';
import { ModalPadrao } from '@/components/ui/ModalPadrao';
import { useAuthContext as useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { API_BASE_URL_CANDIDATES } from '@/services/apiBaseUrl';
import { databaseService } from '@/services/firebase';
import { notificationService } from '@/services/notifications';
import { openFinanceConnectionState } from '@/services/openFinanceConnectionState';
import { getConnectorLogoUrl, normalizeHexColor } from '@/utils/connectorLogo';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import LottieView from 'lottie-react-native';
import { ChevronRight, Landmark, Search } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    Animated,
    AppState,
    Image,
    Keyboard,
    LayoutAnimation,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    UIManager,
    useWindowDimensions,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Reanimated, {
    Easing,
    Extrapolation,
    FadeIn,
    FadeInDown,
    FadeOut,
    FadeOutUp,
    interpolate,
    LinearTransition,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withRepeat,
    withSequence,
    withSpring,
    withTiming,
} from 'react-native-reanimated';

if (Platform.OS === 'android') {
    if (UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
    }
}

const AnimatedTouchableOpacity = Reanimated.createAnimatedComponent(TouchableOpacity);

const SPRING_ENTRY = {
    damping: 16,
    stiffness: 195,
    mass: 1.05,
    overshootClamping: false,
    restDisplacementThreshold: 0.001,
    restSpeedThreshold: 0.001,
} as const;

const SPRING_MORPH = {
    damping: 15,
    stiffness: 185,
    mass: 1.08,
    overshootClamping: false,
    restDisplacementThreshold: 0.001,
    restSpeedThreshold: 0.001,
} as const;

const SPRING_STRETCH = {
    damping: 12,
    stiffness: 165,
    mass: 1.1,
    overshootClamping: false,
    restDisplacementThreshold: 0.001,
    restSpeedThreshold: 0.001,
} as const;

const SPRING_RECOIL = {
    damping: 16,
    stiffness: 150,
    mass: 1.05,
    overshootClamping: false,
    restDisplacementThreshold: 0.001,
    restSpeedThreshold: 0.001,
} as const;

const SPRING_SETTLE = {
    damping: 22,
    stiffness: 160,
    mass: 1,
    overshootClamping: false,
    restDisplacementThreshold: 0.001,
    restSpeedThreshold: 0.001,
} as const;

const PRESS_SPRING = {
    damping: 16,
    stiffness: 360,
    mass: 0.5,
    overshootClamping: false,
} as const;

const BANK_CARD_IOS_LAYOUT = LinearTransition
    .springify()
    .damping(15)
    .stiffness(185)
    .mass(1.08);

const BANK_CARD_ENTER = FadeInDown
    .springify()
    .damping(16)
    .stiffness(195)
    .mass(1.05);

const BANK_CARD_EXIT = FadeOutUp.duration(160);

const RAILWAY_FALLBACK_API_URL = 'https://backendcontrolarapp-production.up.railway.app';
const BACKEND_WEBHOOK_URL = `${RAILWAY_FALLBACK_API_URL}/api/pluggy/webhook`;

const API_BASE_URL_FALLBACKS = Array.from(new Set([
    ...API_BASE_URL_CANDIDATES,
    RAILWAY_FALLBACK_API_URL
]));

const API_HEALTH_CHECK_TIMEOUT_MS = 20000;
const API_HEALTH_CACHE_TTL_MS = 120000;
const API_DEFAULT_TIMEOUT_MS = 60000;
const CONNECTORS_TIMEOUT_MS = 40000;
const OAUTH_POLL_MAX_DURATION_MS = 10 * 60 * 1000;
const OAUTH_POLL_INITIAL_DELAY_MS = 3000;
const OAUTH_POLL_MAX_DELAY_MS = 12000;
const SYNC_REQUEST_TIMEOUT_MS = 240000;
const MANUAL_REFRESH_MAX_DURATION_MS = 5 * 60 * 1000;

const triggerBankCardMorph = () => {
    LayoutAnimation.configureNext({
        duration: 430,
        create: {
            type: LayoutAnimation.Types.easeInEaseOut,
            property: LayoutAnimation.Properties.opacity,
        },
        update: {
            type: LayoutAnimation.Types.spring,
            springDamping: 0.74,
        },
        delete: {
            type: LayoutAnimation.Types.easeInEaseOut,
            property: LayoutAnimation.Properties.opacity,
        },
    });
};

const useElasticEntrance = (delay = 0, translateStart = 18) => {
    const visibility = useSharedValue(0);
    const squash = useSharedValue(1);

    useEffect(() => {
        squash.value = 0.84;

        visibility.value = withDelay(
            delay,
            withSpring(1, SPRING_ENTRY)
        );

        squash.value = withDelay(
            delay,
            withSequence(
                withSpring(1.085, SPRING_STRETCH),
                withSpring(0.976, SPRING_RECOIL),
                withSpring(1, SPRING_SETTLE)
            )
        );
    }, [delay, squash, visibility]);

    return useAnimatedStyle(() => {
        const stretchX = interpolate(
            squash.value,
            [0.84, 0.976, 1, 1.085],
            [0.92, 0.99, 1, 1.04],
            Extrapolation.CLAMP
        );

        const stretchY = interpolate(
            squash.value,
            [0.84, 0.976, 1, 1.085],
            [1.08, 1.018, 1, 0.976],
            Extrapolation.CLAMP
        );

        const baseScaleX = interpolate(
            visibility.value,
            [0, 0.34, 0.68, 1],
            [0.18, 1.028, 0.992, 1],
            Extrapolation.CLAMP
        );

        const baseScaleY = interpolate(
            visibility.value,
            [0, 0.42, 0.78, 1],
            [0.18, 0.94, 1.012, 1],
            Extrapolation.CLAMP
        );

        const translateY = interpolate(
            visibility.value,
            [0, 0.5, 0.82, 1],
            [translateStart, -3, 1, 0],
            Extrapolation.CLAMP
        );

        return {
            opacity: interpolate(
                visibility.value,
                [0, 0.22, 1],
                [0, 0.86, 1],
                Extrapolation.CLAMP
            ),
            transform: [
                { translateY },
                { scaleX: baseScaleX * stretchX },
                { scaleY: baseScaleY * stretchY },
            ],
        };
    });
};

const isNetworkTransportError = (error: unknown): boolean => {
    if (error instanceof TypeError) return true;
    const msg = error instanceof Error ? error.message : String(error ?? '');
    return /timeout|network request failed|abort/i.test(msg);
};

const getApiConnectionErrorMessage = (errorMsg?: string): string =>
    `Erro de rede: ${errorMsg || 'Falha na conexão'}. Verifique sua internet e tente novamente.`;

const toNonEmptyString = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
};

const extractPluggyItemError = (item: any) => {
    const directError = item?.error && typeof item.error === 'object' ? item.error : {};
    const statusDetail = item?.statusDetail && typeof item.statusDetail === 'object' ? item.statusDetail : {};
    const statusDetailError = statusDetail?.error && typeof statusDetail.error === 'object' ? statusDetail.error : {};

    const code = toNonEmptyString(
        directError.code ||
        statusDetailError.code ||
        item?.errorCode ||
        item?.code
    );

    const message = toNonEmptyString(
        directError.message ||
        statusDetailError.message ||
        item?.message
    );

    const providerMessage = toNonEmptyString(
        directError.providerMessage ||
        statusDetailError.providerMessage
    );

    return { code, message, providerMessage };
};

const buildPluggyConnectionErrorMessage = (item: any): string => {
    const status = String(item?.status || '').toUpperCase();
    const executionStatus = String(item?.executionStatus || '').toUpperCase();
    const { code, message, providerMessage } = extractPluggyItemError(item);
    const normalizedCode = String(code || executionStatus || status).toUpperCase();

    if (normalizedCode.includes('INVALID_CREDENTIALS') || status === 'LOGIN_ERROR') {
        return 'Credenciais inválidas. Confira usuário e senha do banco e tente novamente.';
    }

    if (
        normalizedCode.includes('SITE_NOT_AVAILABLE') ||
        normalizedCode.includes('INSTITUTION_UNAVAILABLE')
    ) {
        return 'O banco está temporariamente indisponível. Tente novamente em alguns minutos.';
    }

    if (
        normalizedCode.includes('MFA') ||
        normalizedCode.includes('OTP') ||
        normalizedCode.includes('2FA')
    ) {
        return 'O banco pediu validação adicional. Finalize no app do banco e tente novamente.';
    }

    if (status === 'OUTDATED') {
        return 'A conexão expirou ou o banco recusou a atualização. Tente reconectar.';
    }

    const bestDetail = providerMessage || message;
    if (bestDetail) return `O banco retornou erro: ${bestDetail}`;

    return status === 'LOGIN_ERROR' ? 'Acesso negado pelo banco.' : 'Erro ao conectar no banco.';
};

const getItemOAuthUrl = (payload: any): string | null => {
    const candidates = [
        payload?.oauthUrl,
        payload?.clientUrl,
        payload?.parameter?.oauthUrl,
        payload?.parameter?.data,
        payload?.userAction?.url,
        payload?.userAction?.attributes?.url,
        payload?.item?.oauthUrl,
        payload?.item?.clientUrl,
        payload?.item?.parameter?.oauthUrl,
        payload?.item?.parameter?.data,
        payload?.item?.userAction?.url,
        payload?.item?.userAction?.attributes?.url
    ];

    for (const candidate of candidates) {
        const normalized = toNonEmptyString(candidate);
        if (normalized) return normalized;
    }

    return null;
};

const fetchWithTimeout = async (
    resource: string,
    options: RequestInit & { timeout?: number } = {}
) => {
    const { timeout = API_DEFAULT_TIMEOUT_MS, ...fetchOptions } = options;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(resource, {
            ...fetchOptions,
            signal: controller.signal as any
        });

        clearTimeout(id);
        return response;
    } catch (error: any) {
        clearTimeout(id);
        if (error.name === 'AbortError') throw new TypeError('Network request timed out');
        throw error;
    }
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getPollingDelay = (attempt: number) => (
    Math.min(OAUTH_POLL_INITIAL_DELAY_MS + attempt * 750, OAUTH_POLL_MAX_DELAY_MS)
);

const readApiPayload = async (response: Response): Promise<any | null> => {
    try {
        return await response.json();
    } catch {
        return null;
    }
};

const isRetryableApiResponse = (response: Response, payload?: any | null): boolean => {
    if (payload?.retryable === true) return true;
    return [408, 409, 425, 429, 500, 502, 503, 504].includes(response.status);
};

const getApiErrorText = (payload: any | null, fallback: string): string => (
    toNonEmptyString(payload?.error) ||
    toNonEmptyString(payload?.message) ||
    fallback
);

const OAUTH_REDIRECT_URI = Linking.createURL('open-finance/callback');

export default function OpenFinanceScreen() {
    const { user, profile, refreshProfile } = useAuth();
    const { showError, showWarning } = useToast();
    const insets = useSafeAreaInsets();
    const { width, height } = useWindowDimensions();
    const isNarrowPhone = width < 360;
    const isShortPhone = height < 700;
    const horizontalPadding = isNarrowPhone ? 12 : 16;

    const headerAnimatedStyle = useElasticEntrance(0, 18);
    const contentAnimatedStyle = useElasticEntrance(80, 16);

    const [isModalVisible, setIsModalVisible] = useState(false);
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<any>(null);
    const [accounts, setAccounts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [dataRefreshKey, setDataRefreshKey] = useState(0);
    const [refreshing, setRefreshing] = useState(false);

    const {
        refresh: refreshCredits,
        consumeCredit,
        hasCredits,
        canSyncItem
    } = useSyncCredits(user?.uid);

    const [connectionStep, setConnectionStep] = useState<'info' | 'banks' | 'credentials' | 'connecting' | 'oauth_pending' | 'success' | 'error'>('info');
    const [connectors, setConnectors] = useState<any[]>([]);
    const [loadingConnectors, setLoadingConnectors] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [connectorsFetchError, setConnectorsFetchError] = useState<string | null>(null);
    const [selectedConnector, setSelectedConnector] = useState<any>(null);
    const [credentialValues, setCredentialValues] = useState<Record<string, string>>({});
    const [useCNPJ, setUseCNPJ] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [connectionError, setConnectionError] = useState<string | null>(null);
    const [connectionProgress, setConnectionProgress] = useState(0);
    const [connectionStatusText, setConnectionStatusText] = useState('');

    const [bankSyncBanner, setBankSyncBanner] = useState<{
        step: 'idle' | 'connecting' | 'success' | 'error';
        statusText: string;
        error: string | null;
    }>({
        step: 'idle',
        statusText: '',
        error: null
    });

    const [pendingItemId, setPendingItemId] = useState<string | null>(null);

    const [showCpfModal, setShowCpfModal] = useState(false);
    const [cpfInput, setCpfInput] = useState('');
    const [cpfConnector, setCpfConnector] = useState<any>(null);
    const [cpfModalStep, setCpfModalStep] = useState<'cpf' | 'confirm'>('cpf');

    const confirmLogoScale = useRef(new Animated.Value(0)).current;
    const confirmLogoOpacity = useRef(new Animated.Value(0)).current;

    const lastApiHealthCheckRef = useRef(0);
    const [apiBaseUrl, setApiBaseUrl] = useState(API_BASE_URL_FALLBACKS[0] || RAILWAY_FALLBACK_API_URL);
    const pendingItemIdRef = useRef<string | null>(null);
    const openedOAuthUrlRef = useRef(false);
    const isRestoringPendingRef = useRef(false);
    const bankSyncBannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const legacyPollingDisabledRef = useRef(true);
    const activePollingItemIdRef = useRef<string | null>(null);
    const pendingItemSyncInFlightRef = useRef(false);
    const activeManualSyncsRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        pendingItemIdRef.current = pendingItemId;
    }, [pendingItemId]);

    const clearBankSyncBannerTimer = useCallback(() => {
        if (bankSyncBannerTimerRef.current) {
            clearTimeout(bankSyncBannerTimerRef.current);
            bankSyncBannerTimerRef.current = null;
        }
    }, []);

    useEffect(() => clearBankSyncBannerTimer, [clearBankSyncBannerTimer]);

    const hideBankSyncBanner = useCallback(() => {
        setBankSyncBanner({
            step: 'idle',
            statusText: '',
            error: null
        });
    }, []);

    const handleBankSyncStatusChange = useCallback((group: any, status: SyncStatus) => {
        clearBankSyncBannerTimer();

        if (status.step === 'idle') {
            hideBankSyncBanner();
            return;
        }

        if (status.step === 'done') {
            setBankSyncBanner({
                step: 'success',
                statusText: status.message || 'Sincronizado!',
                error: null
            });

            bankSyncBannerTimerRef.current = setTimeout(hideBankSyncBanner, 3000);
            return;
        }

        if (status.step === 'error') {
            setBankSyncBanner({
                step: 'error',
                statusText: '',
                error: status.message || 'Erro na sincronização'
            });

            bankSyncBannerTimerRef.current = setTimeout(hideBankSyncBanner, 4000);
            return;
        }

        setBankSyncBanner({
            step: 'connecting',
            statusText: status.message || `Sincronizando ${group.connector?.name || 'banco'}...`,
            error: null
        });
    }, [clearBankSyncBannerTimer, hideBankSyncBanner]);

    const clearPersistedOpenFinanceState = useCallback(async () => {
        await Promise.all([
            openFinanceConnectionState.clearPendingConnection(),
            openFinanceConnectionState.clearCallbackPayload(),
            openFinanceConnectionState.clearBackgroundSync()
        ]);
    }, []);

    const savePendingConnectionState = useCallback(async (
        itemId: string,
        connector?: any,
        syncPhase?: string
    ) => {
        const connectorSnapshot = connector
            ? {
                id: connector.id,
                name: connector.name ?? null,
                primaryColor: connector.primaryColor ?? null,
                imageUrl: connector.imageUrl ?? null,
                type: connector.type ?? null
            }
            : null;

        await openFinanceConnectionState.savePendingConnection({
            itemId,
            startedAt: Date.now(),
            connector: connectorSnapshot,
            userId: user?.uid ?? null,
            syncPhase: (syncPhase as any) ?? 'polling'
        });

        if (user?.uid) {
            await openFinanceConnectionState.saveBackgroundSync({
                active: true,
                itemId,
                userId: user.uid,
                connectorName: connector?.name ?? null,
                syncPhase: (syncPhase as any) ?? 'polling',
                startedAt: Date.now(),
                lastUpdatedAt: Date.now()
            });
        }
    }, [user]);

    const openOAuthUrlSafely = useCallback(async (url: string) => {
        if (!url) throw new Error('URL OAuth não fornecida.');

        const canOpen = await Linking.canOpenURL(url);
        const isWebUrl = /^https?:\/\//i.test(url);

        if (!canOpen && !isWebUrl) {
            throw new Error('Não foi possível abrir o link de autorização do banco.');
        }

        await WebBrowser.openBrowserAsync(url);
    }, []);

    const extractItemIdFromDeepLink = useCallback((url: string): string | null => {
        try {
            const { queryParams } = Linking.parse(url);
            const rawItemId = queryParams?.itemId;

            if (typeof rawItemId === 'string' && rawItemId.trim()) return rawItemId.trim();
            if (Array.isArray(rawItemId) && rawItemId[0]?.trim()) return rawItemId[0].trim();
        } catch { }

        return null;
    }, []);

    const restorePendingConnectionIfNeeded = useCallback(async () => {
        if (!user || isRestoringPendingRef.current) return;

        isRestoringPendingRef.current = true;

        try {
            const [pendingState, callbackPayload, bgSync] = await Promise.all([
                openFinanceConnectionState.getPendingConnection(),
                openFinanceConnectionState.consumeCallbackPayload(),
                openFinanceConnectionState.getBackgroundSync(),
            ]);

            const callbackItemId = callbackPayload?.itemId?.trim() || null;
            const restoredItemId = callbackItemId || pendingState?.itemId || bgSync?.itemId || pendingItemIdRef.current;
            const callbackError = callbackPayload?.error || null;

            if (callbackError) {
                setIsModalVisible(false);
                setConnectionError('O banco recusou a conexão ou ocorreu um erro.');
                setConnectionStep('error');
                setPendingItemId(null);

                await clearPersistedOpenFinanceState();

                notificationService.sendSyncCompleteNotification(
                    pendingState?.connector?.name || 'Banco',
                    false,
                    'O banco recusou a conexão.'
                ).catch(() => null);

                setTimeout(() => setConnectionStep('info'), 5000);
                return;
            }

            if (!restoredItemId) return;

            if (
                pendingItemIdRef.current === restoredItemId &&
                ['connecting', 'oauth_pending'].includes(connectionStep)
            ) {
                return;
            }

            if (!selectedConnector && (pendingState?.connector || bgSync)) {
                setSelectedConnector(pendingState?.connector || bgSync);
            }

            setPendingItemId(restoredItemId);
            setIsModalVisible(false);

            const savedPhase = pendingState?.syncPhase || bgSync?.syncPhase || 'polling';

            if (savedPhase === 'syncing' || savedPhase === 'saving') {
                setConnectionStep('connecting');
                setConnectionProgress(55);
                setConnectionStatusText('Retomando sincronização...');
            } else {
                setConnectionStep('oauth_pending');
                setConnectionProgress(40);
                setConnectionStatusText('Retomando conexão com o banco...');
            }
        } finally {
            isRestoringPendingRef.current = false;
        }
    }, [
        clearPersistedOpenFinanceState,
        connectionStep,
        selectedConnector,
        user
    ]);

    const resolveReachableApiBaseUrl = useCallback(async (): Promise<string> => {
        const now = Date.now();

        if ((now - lastApiHealthCheckRef.current) < API_HEALTH_CACHE_TTL_MS) {
            return apiBaseUrl;
        }

        const candidates = [
            apiBaseUrl,
            ...API_BASE_URL_FALLBACKS.filter((url) => url !== apiBaseUrl)
        ];

        for (const candidate of candidates) {
            try {
                const response = await fetchWithTimeout(`${candidate}/health`, {
                    method: 'GET',
                    timeout: API_HEALTH_CHECK_TIMEOUT_MS
                });

                if (response.ok) {
                    lastApiHealthCheckRef.current = Date.now();
                    setApiBaseUrl(candidate);
                    return candidate;
                }
            } catch { }
        }

        return apiBaseUrl;
    }, [apiBaseUrl]);

    const apiFetch = useCallback(async (
        path: string,
        options: RequestInit & { timeout?: number } = {}
    ) => {
        const resolved = await resolveReachableApiBaseUrl();

        return fetchWithTimeout(`${resolved}${path}`, {
            ...options,
            timeout: options.timeout ?? API_DEFAULT_TIMEOUT_MS
        });
    }, [resolveReachableApiBaseUrl]);

    const persistPluggySyncData = useCallback(async (
        syncData: any,
        connector: any,
        setStatusText?: (text: string) => void
    ) => {
        if (!user?.uid) throw new Error('Usuario nao autenticado.');

        const syncedAccounts = Array.isArray(syncData?.accounts) ? syncData.accounts : [];
        const totalTx = syncedAccounts.reduce(
            (acc: number, account: any) => acc + (Array.isArray(account?.transactions) ? account.transactions.length : 0),
            0
        );

        const accountErrors: any[] = Array.isArray(syncData?.accountErrors) ? [...syncData.accountErrors] : [];

        if (syncedAccounts.length > 0) {
            setStatusText?.(`Organizando ${syncedAccounts.length} contas...`);

            const accountResults = await Promise.all(
                syncedAccounts.map((account: any) =>
                    databaseService.saveAccount(user.uid, account, connector)
                )
            );

            accountResults.forEach((result: any, index: number) => {
                if (!result?.success) {
                    accountErrors.push({
                        stage: 'local_account_save',
                        accountId: syncedAccounts[index]?.id || null,
                        accountName: syncedAccounts[index]?.name || null,
                        error: result?.error || 'Falha ao salvar conta no app.',
                        retryable: true,
                    });
                }
            });

            setStatusText?.(`Salvando ${totalTx} transacoes...`);

            const transactionResult = await databaseService.saveOpenFinanceTransactions(
                user.uid,
                syncedAccounts,
                connector
            );

            if (!transactionResult?.success) {
                throw new Error(transactionResult?.error || 'Falha ao salvar transacoes no app.');
            }

            const transactionErrorCount = Number(transactionResult?.errorCount || 0);
            const transactionErrors = transactionResult?.details?.errors || [];

            if (transactionErrorCount > 0 || transactionErrors.length > 0) {
                accountErrors.push({
                    stage: 'local_transaction_save',
                    error: 'Algumas transacoes nao foram salvas.',
                    retryable: true,
                    details: transactionErrors,
                });
            }
        }

        return {
            totalTx,
            partial: syncData?.partial === true || accountErrors.length > 0,
            accountErrors,
        };
    }, [user]);

    useEffect(() => {
        notificationService.scheduleDailySyncResetNotification();
    }, []);

    useEffect(() => {
        if (user) {
            fetchAccounts();
        }
    }, [user]);

    useEffect(() => {
        if (!user) return;
        restorePendingConnectionIfNeeded();
    }, [restorePendingConnectionIfNeeded, user]);

    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextState) => {
            if (nextState === 'active') {
                restorePendingConnectionIfNeeded();
            }
        });

        return () => subscription.remove();
    }, [restorePendingConnectionIfNeeded]);

    const handleToggleVisibility = useCallback(async (accountId: string) => {
        if (!user?.uid || !profile) {
            showError('Erro', 'Usuário não autenticado.');
            return;
        }

        try {
            const preferences = (profile.preferences as any) || {};

            let hiddenAccountIds: string[] = Array.isArray(preferences.hiddenAccountIds)
                ? [...preferences.hiddenAccountIds]
                : [];

            const currentlyHidden = hiddenAccountIds.includes(accountId);

            if (currentlyHidden) {
                hiddenAccountIds = hiddenAccountIds.filter((id: string) => id !== accountId);
            } else if (!hiddenAccountIds.includes(accountId)) {
                hiddenAccountIds.push(accountId);
            }

            await databaseService.updatePreference(user.uid, { hiddenAccountIds });
            await refreshProfile();
            setDataRefreshKey((prev) => prev + 1);
        } catch (error) {
            console.error('handleToggleVisibility error:', error);
            showError('Erro', 'Não foi possível alterar a visibilidade da conta.');
        }
    }, [
        user,
        profile,
        refreshProfile,
        showError
    ]);

    const fetchAccounts = async () => {
        if (!user) return;

        try {
            const result = await databaseService.getAccounts(user.uid);

            if (result.success && result.data) {
                setAccounts(result.data);
                setDataRefreshKey((p) => p + 1);
            }
        } catch (e) {
            console.error('Error fetching accounts:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleOAuthCallback = useCallback(async (url: string) => {
        const parsedItemId = extractItemIdFromDeepLink(url);
        const fallbackItemId = pendingItemIdRef.current;

        let queryParams: Record<string, any> | null = null;

        try {
            ({ queryParams } = Linking.parse(url));
        } catch { }

        const callbackError = typeof queryParams?.error === 'string' ? queryParams.error : null;
        const callbackStatus = typeof queryParams?.status === 'string' ? queryParams.status : null;
        const itemId = parsedItemId || fallbackItemId;

        await openFinanceConnectionState.saveCallbackPayload({
            itemId: itemId || null,
            status: callbackStatus,
            error: callbackError,
            receivedAt: Date.now(),
            rawUrl: url
        });

        if (itemId) {
            setPendingItemId(itemId);
            await savePendingConnectionState(itemId, selectedConnector, 'oauth_pending');
        }

        if (callbackError) {
            setConnectionError('O banco recusou a conexão ou ocorreu um erro.');
            setConnectionStep('error');
            setIsModalVisible(false);

            await clearPersistedOpenFinanceState();

            setTimeout(() => setConnectionStep('info'), 5000);
            return;
        }

        if (!itemId || !user) return;

        setIsModalVisible(false);
        setConnectionStep('oauth_pending');
        setConnectionProgress(40);
        setConnectionStatusText('Autorização recebida do banco. Finalizando conexão...');
    }, [
        clearPersistedOpenFinanceState,
        extractItemIdFromDeepLink,
        savePendingConnectionState,
        selectedConnector,
        user
    ]);

    useEffect(() => {
        const subscription = Linking.addEventListener('url', (event) => {
            if (
                event.url.includes('open-finance') ||
                event.url.includes('pluggy') ||
                event.url.includes('oauth-callback')
            ) {
                handleOAuthCallback(event.url);
            }
        });

        Linking.getInitialURL().then((url) => {
            if (
                url &&
                (
                    url.includes('open-finance') ||
                    url.includes('pluggy') ||
                    url.includes('oauth-callback')
                )
            ) {
                handleOAuthCallback(url);
            }
        });

        return () => subscription.remove();
    }, [handleOAuthCallback]);

    const getActiveConnectorName = useCallback(() => {
        return selectedConnector?.name || cpfConnector?.name || 'Banco';
    }, [selectedConnector, cpfConnector]);

    useEffect(() => {
        if (!pendingItemId || !user) return;

        const itemId = pendingItemId;
        if (activePollingItemIdRef.current === itemId) return;

        let cancelled = false;
        let attempt = 0;
        const startedAt = Date.now();
        const bankName = getActiveConnectorName();
        activePollingItemIdRef.current = itemId;

        const updateBgPhase = (phase: string) => {
            openFinanceConnectionState.updateBackgroundSyncPhase(phase as any).catch(() => null);
            openFinanceConnectionState.updateSyncPhase(phase as any).catch(() => null);
        };

        const failConnection = async (message: string, notifyMessage = message) => {
            cancelled = true;
            setConnectionError(message);
            setConnectionStep('error');
            setPendingItemId(null);
            setIsModalVisible(false);

            await clearPersistedOpenFinanceState();

            notificationService.sendSyncCompleteNotification(
                bankName,
                false,
                notifyMessage
            ).catch(() => null);

            setTimeout(() => setConnectionStep('info'), 5000);
        };

        const runPollingLoop = async () => {
            while (!cancelled && activePollingItemIdRef.current === itemId) {
                if (Date.now() - startedAt > OAUTH_POLL_MAX_DURATION_MS) {
                    await failConnection('Tempo expirado aguardando o banco.');
                    return;
                }

                attempt += 1;
                updateBgPhase('polling');

                try {
                    const token = await user.getIdToken();
                    const response = await apiFetch(`/api/pluggy/items/${itemId}`, {
                        headers: {
                            'Authorization': `Bearer ${token}`
                        },
                        timeout: 15000
                    });

                    const payload = await readApiPayload(response);

                    if (!response.ok) {
                        if (isRetryableApiResponse(response, payload)) {
                            setConnectionStatusText('Ainda tentando falar com o banco...');
                            await sleep(getPollingDelay(attempt));
                            continue;
                        }

                        await failConnection(
                            getApiErrorText(payload, `Falha ao consultar status da conexao (HTTP ${response.status}).`)
                        );
                        return;
                    }

                    const item = payload?.item || payload;
                    const normalizedStatus = String(item?.status || '').toUpperCase();
                    const clientUrl = getItemOAuthUrl(item);

                    if (
                        normalizedStatus === 'WAITING_USER_INPUT' &&
                        clientUrl &&
                        !openedOAuthUrlRef.current
                    ) {
                        try {
                            openedOAuthUrlRef.current = true;
                            setConnectionStep('oauth_pending');
                            updateBgPhase('oauth_pending');
                            await openOAuthUrlSafely(clientUrl);
                        } catch (openError: any) {
                            await failConnection(
                                openError?.message || 'Nao foi possivel abrir a autorizacao do banco.',
                                'Nao foi possivel abrir a autorizacao.'
                            );
                            return;
                        }
                    }

                    if (normalizedStatus === 'WAITING_USER_INPUT') {
                        setConnectionStep('oauth_pending');
                        setConnectionProgress((previous) => previous < 40 ? 40 : previous);
                        setConnectionStatusText(
                            clientUrl
                                ? 'Abra o app do banco para aprovar a conexao.'
                                : 'Aguardando voce concluir a autorizacao no banco...'
                        );
                        await sleep(getPollingDelay(attempt));
                        continue;
                    }

                    if (normalizedStatus === 'UPDATING' || normalizedStatus === 'PROCESSING') {
                        setConnectionStep('connecting');
                        setConnectionProgress((previous) => previous < 55 ? 55 : previous);
                        setConnectionStatusText('O banco autorizou. Extraindo dados...');
                        updateBgPhase('syncing');
                        await sleep(getPollingDelay(attempt));
                        continue;
                    }

                    if (normalizedStatus === 'UPDATED') {
                        if (pendingItemSyncInFlightRef.current) {
                            await sleep(1000);
                            continue;
                        }

                        pendingItemSyncInFlightRef.current = true;
                        setConnectionStep('connecting');
                        setConnectionProgress(60);
                        setConnectionStatusText('Autorizacao confirmada! Extraindo suas contas e transacoes...');
                        updateBgPhase('syncing');

                        const token2 = await user.getIdToken();
                        let syncResponse = await apiFetch('/api/pluggy/sync', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token2}`
                            },
                            body: JSON.stringify({
                                itemId,
                                fullHistory: true
                            }),
                            timeout: SYNC_REQUEST_TIMEOUT_MS
                        });

                        let syncPayload = await readApiPayload(syncResponse);

                        if (
                            syncResponse.ok &&
                            Array.isArray(syncPayload?.accounts) &&
                            syncPayload.accounts.length > 0 &&
                            Number(syncPayload.totalTransactions || 0) === 0
                        ) {
                            setConnectionStatusText('O banco ainda esta processando seu extrato. Tentando novamente...');
                            await sleep(3000);

                            syncResponse = await apiFetch('/api/pluggy/sync', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${token2}`
                                },
                                body: JSON.stringify({
                                    itemId,
                                    fullHistory: true
                                }),
                                timeout: SYNC_REQUEST_TIMEOUT_MS
                            });
                            syncPayload = await readApiPayload(syncResponse);
                        }

                        if (!syncResponse.ok) {
                            if (isRetryableApiResponse(syncResponse, syncPayload)) {
                                pendingItemSyncInFlightRef.current = false;
                                setConnectionStatusText(getApiErrorText(syncPayload, 'Banco ainda processando. Tentando novamente...'));
                                await sleep(getPollingDelay(attempt));
                                continue;
                            }

                            await failConnection(getApiErrorText(syncPayload, 'Falha ao baixar transacoes do banco.'));
                            return;
                        }

                        setConnectionProgress(80);
                        updateBgPhase('saving');

                        const persistResult = await persistPluggySyncData(
                            syncPayload,
                            syncPayload?.connector || selectedConnector,
                            setConnectionStatusText
                        );

                        if (persistResult.partial) {
                            showWarning('Sincronizacao parcial', 'Algumas contas ou transacoes nao foram atualizadas. Tente sincronizar novamente depois.');
                        }

                        const creditResult = await consumeCredit('connect');
                        if (!creditResult.success) {
                            console.warn('[OpenFinance] Connection completed but credit was not consumed:', creditResult.error);
                            refreshCredits();
                        }

                        setConnectionProgress(100);
                        setConnectionStatusText(
                            persistResult.partial
                                ? 'Sincronizacao concluida com avisos.'
                                : 'Sincronizacao concluida com sucesso!'
                        );
                        setConnectionStep('success');
                        setPendingItemId(null);
                        setIsModalVisible(false);

                        await clearPersistedOpenFinanceState();

                        notificationService.sendSyncCompleteNotification(bankName, true).catch(() => null);

                        setTimeout(() => {
                            fetchAccounts();
                            refreshCredits();
                            setConnectionStep('info');
                        }, 3500);
                        return;
                    }

                    if (
                        normalizedStatus === 'LOGIN_ERROR' ||
                        normalizedStatus === 'OUTDATED' ||
                        normalizedStatus === 'ERROR'
                    ) {
                        await failConnection(buildPluggyConnectionErrorMessage(item));
                        return;
                    }

                    setConnectionStatusText('Aguardando retorno do banco...');
                    await sleep(getPollingDelay(attempt));
                } catch (error) {
                    console.warn('[OAuth Polling] Error:', error);
                    pendingItemSyncInFlightRef.current = false;
                    setConnectionStatusText('Conexao instavel. Tentando novamente...');
                    await sleep(getPollingDelay(attempt));
                } finally {
                    if (pendingItemSyncInFlightRef.current && cancelled) {
                        pendingItemSyncInFlightRef.current = false;
                    }
                }
            }
        };

        runPollingLoop().finally(() => {
            if (activePollingItemIdRef.current === itemId) {
                activePollingItemIdRef.current = null;
            }
            pendingItemSyncInFlightRef.current = false;
        });

        return () => {
            cancelled = true;
        };
    // Keep this effect keyed only by item/user; several callbacks above are recreated each render and would cancel the active polling loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pendingItemId, user]);

    useEffect(() => {
        if (legacyPollingDisabledRef.current) return;
        if (!['oauth_pending', 'connecting'].includes(connectionStep) || !pendingItemId || !user) return;

        let pollCount = 0;
        const maxPolls = 180;
        let cancelled = false;
        let intervalId: ReturnType<typeof setInterval> | null = null;
        const bankName = getActiveConnectorName();

        const updateBgPhase = (phase: string) => {
            openFinanceConnectionState.updateBackgroundSyncPhase(phase as any).catch(() => null);
            openFinanceConnectionState.updateSyncPhase(phase as any).catch(() => null);
        };

        const checkStatus = async () => {
            if (cancelled) return;

            pollCount++;
            updateBgPhase('polling');

            try {
                const token = await user.getIdToken();

                const response = await apiFetch(`/api/pluggy/items/${pendingItemId}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    timeout: 15000
                });

                if (response.ok) {
                    const data = await response.json();
                    const item = data.item || data;
                    const status = item.status;
                    const normalizedStatus = String(status || '').toUpperCase();
                    const clientUrl = getItemOAuthUrl(item);

                    if (
                        normalizedStatus === 'WAITING_USER_INPUT' &&
                        clientUrl &&
                        !openedOAuthUrlRef.current
                    ) {
                        try {
                            openedOAuthUrlRef.current = true;
                            setConnectionStep('oauth_pending');
                            updateBgPhase('oauth_pending');
                            await openOAuthUrlSafely(clientUrl);
                        } catch (openError: any) {
                            cancelled = true;

                            if (intervalId) clearInterval(intervalId);

                            setConnectionError(openError?.message || 'Não foi possível abrir a autorização do banco.');
                            setConnectionStep('error');
                            setPendingItemId(null);
                            setIsModalVisible(false);

                            await clearPersistedOpenFinanceState();

                            notificationService.sendSyncCompleteNotification(
                                bankName,
                                false,
                                'Não foi possível abrir a autorização.'
                            ).catch(() => null);

                            setTimeout(() => setConnectionStep('info'), 5000);
                            return;
                        }
                    }

                    if (normalizedStatus === 'WAITING_USER_INPUT') {
                        setConnectionStep('oauth_pending');
                        setConnectionProgress((previous) => previous < 35 ? 35 : previous);
                        setConnectionStatusText(
                            clientUrl
                                ? 'Abra o app do banco para aprovar a conexão.'
                                : 'Aguardando você concluir a autorização no banco...'
                        );
                        return;
                    }

                    if (normalizedStatus === 'UPDATED') {
                        cancelled = true;

                        if (intervalId) clearInterval(intervalId);

                        setConnectionStep('connecting');
                        setConnectionProgress(60);
                        setConnectionStatusText('Autorização confirmada! Extraindo suas contas e transações...');
                        updateBgPhase('syncing');

                        const token2 = await user.getIdToken();

                        let syncResponse = await apiFetch('/api/pluggy/sync', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token2}`
                            },
                            body: JSON.stringify({
                                itemId: pendingItemId,
                                autoRefresh: true,
                                fullHistory: true
                            }),
                            timeout: 240000
                        });

                        if (syncResponse.ok) {
                            let syncData = await syncResponse.json();

                            let totalTx =
                                syncData.accounts?.reduce(
                                    (acc: any, a: any) => acc + (a.transactions?.length || 0),
                                    0
                                ) || 0;

                            if (totalTx === 0 && syncData.accounts?.length > 0) {
                                setConnectionStatusText('O banco ainda está processando seu extrato. Tentando novamente...');

                                await new Promise((resolve) => setTimeout(resolve, 3000));

                                const retryResponse = await apiFetch('/api/pluggy/sync', {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'Authorization': `Bearer ${token2}`
                                    },
                                    body: JSON.stringify({
                                        itemId: pendingItemId,
                                        autoRefresh: true,
                                        fullHistory: true
                                    }),
                                    timeout: 240000
                                });

                                if (retryResponse.ok) {
                                    syncData = await retryResponse.json();

                                    totalTx =
                                        syncData.accounts?.reduce(
                                            (acc: any, a: any) => acc + (a.transactions?.length || 0),
                                            0
                                        ) || 0;
                                }
                            }

                            setConnectionProgress(80);
                            updateBgPhase('saving');

                            if (syncData.accounts && syncData.accounts.length > 0) {
                                setConnectionStatusText(`Organizando ${syncData.accounts.length} contas...`);

                                await Promise.all(
                                    syncData.accounts.map((account: any) =>
                                        databaseService.saveAccount(
                                            user.uid,
                                            account,
                                            syncData.connector || selectedConnector
                                        )
                                    )
                                );

                                setConnectionStatusText(`Salvando ${totalTx} transações...`);

                                await databaseService.saveOpenFinanceTransactions(
                                    user.uid,
                                    syncData.accounts,
                                    syncData.connector || selectedConnector
                                );
                            }

                            setConnectionProgress(100);
                            setConnectionStatusText('Sincronização concluída com sucesso!');
                            setConnectionStep('success');
                            setPendingItemId(null);
                            setIsModalVisible(false);

                            await clearPersistedOpenFinanceState();

                            notificationService.sendSyncCompleteNotification(bankName, true).catch(() => null);

                            setTimeout(() => {
                                fetchAccounts();
                                refreshCredits();
                                setConnectionStep('info');
                            }, 3500);
                        } else {
                            const errPayload = await syncResponse.json().catch(() => null);

                            cancelled = true;

                            if (intervalId) clearInterval(intervalId);

                            const errMsg = errPayload?.error || 'Falha ao baixar transações do banco.';

                            setConnectionError(errMsg);
                            setConnectionStep('error');
                            setPendingItemId(null);
                            setIsModalVisible(false);

                            await clearPersistedOpenFinanceState();

                            notificationService.sendSyncCompleteNotification(bankName, false, errMsg).catch(() => null);

                            setTimeout(() => setConnectionStep('info'), 5000);
                            return;
                        }

                        return;
                    }

                    if (normalizedStatus === 'UPDATING') {
                        setConnectionStep('connecting');
                        setConnectionProgress((previous) => previous < 50 ? 50 : previous);
                        setConnectionStatusText('O banco autorizou. Extraindo dados...');
                        updateBgPhase('syncing');
                        return;
                    }

                    if (
                        normalizedStatus === 'LOGIN_ERROR' ||
                        normalizedStatus === 'OUTDATED' ||
                        normalizedStatus === 'ERROR'
                    ) {
                        cancelled = true;

                        if (intervalId) clearInterval(intervalId);

                        const resolvedError = buildPluggyConnectionErrorMessage(item);

                        setConnectionError(resolvedError);
                        setConnectionStep('error');
                        setPendingItemId(null);
                        setIsModalVisible(false);

                        await clearPersistedOpenFinanceState();

                        notificationService.sendSyncCompleteNotification(bankName, false, resolvedError).catch(() => null);

                        setTimeout(() => setConnectionStep('info'), 5000);
                        return;
                    }
                } else {
                    const errPayload = await response.json().catch(() => null);

                    cancelled = true;

                    if (intervalId) clearInterval(intervalId);

                    const errMsg =
                        errPayload?.error ||
                        `Falha ao consultar status da conexão (HTTP ${response.status}).`;

                    setConnectionError(errMsg);
                    setConnectionStep('error');
                    setPendingItemId(null);
                    setIsModalVisible(false);

                    await clearPersistedOpenFinanceState();

                    notificationService.sendSyncCompleteNotification(bankName, false, errMsg).catch(() => null);

                    setTimeout(() => setConnectionStep('info'), 5000);
                    return;
                }
            } catch (error) {
                console.warn('[OAuth Polling] Error:', error);
            }

            if (pollCount >= maxPolls && !cancelled) {
                cancelled = true;

                if (intervalId) clearInterval(intervalId);

                setConnectionError('Tempo expirado aguardando o banco.');
                setConnectionStep('error');
                setPendingItemId(null);
                setIsModalVisible(false);

                await clearPersistedOpenFinanceState();

                notificationService.sendSyncCompleteNotification(
                    bankName,
                    false,
                    'Tempo expirado aguardando o banco.'
                ).catch(() => null);

                setTimeout(() => setConnectionStep('info'), 5000);
            }
        };

        checkStatus();
        intervalId = setInterval(checkStatus, 3000);

        return () => {
            cancelled = true;
            if (intervalId) clearInterval(intervalId);
        };
    }, [
        clearPersistedOpenFinanceState,
        connectionStep,
        getActiveConnectorName,
        openOAuthUrlSafely,
        pendingItemId,
        selectedConnector,
        user,
        apiFetch,
        refreshCredits
    ]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchAccounts();
    };

    const fetchConnectors = async () => {
        setLoadingConnectors(true);
        setConnectorsFetchError(null);

        try {
            if (!user) return;

            const token = await user.getIdToken();

            const response = await apiFetch('/api/pluggy/connectors', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                timeout: CONNECTORS_TIMEOUT_MS
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => null);
                throw new Error(errData?.error || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.results) {
                const bankConnectors = data.results
                    .filter((c: any) => c.type === 'PERSONAL_BANK' || c.type === 'BUSINESS_BANK')
                    .map((c: any) => ({
                        ...c,
                        imageUrl: getConnectorLogoUrl(c) || '',
                        primaryColor: normalizeHexColor(c.primaryColor, '#30302E'),
                        credentials: Array.isArray(c.credentials) ? c.credentials : []
                    }));

                setConnectors(bankConnectors);
            }
        } catch (error: any) {
            const msg = isNetworkTransportError(error)
                ? getApiConnectionErrorMessage(error instanceof Error ? error.message : undefined)
                : error instanceof Error
                    ? error.message
                    : 'Não foi possível carregar os bancos.';

            setConnectorsFetchError(msg);
        } finally {
            setLoadingConnectors(false);
        }
    };

    const handleOpenModal = () => {
        openedOAuthUrlRef.current = false;
        setIsModalVisible(true);
        setConnectionStep('banks');
        setSelectedConnector(null);
        setCredentialValues({});
        setConnectorsFetchError(null);
        setConnectionError(null);
        setConnectionStatusText('');
        setSearchQuery('');
        setShowCpfModal(false);
        setCpfInput('');
        setCpfConnector(null);

        openFinanceConnectionState.clearCallbackPayload().catch(() => null);

        fetchConnectors();
    };

    const handleCloseModal = () => {
        const isActiveConnection =
            ['connecting', 'oauth_pending'].includes(connectionStep) &&
            pendingItemId;

        openedOAuthUrlRef.current = false;
        setIsModalVisible(false);
        setShowCpfModal(false);
        setCpfInput('');
        setCpfConnector(null);
        setSearchQuery('');
        setConnectorsFetchError(null);

        if (isActiveConnection) {
            return;
        }

        setConnectionStep('banks');
        setSelectedConnector(null);
        setCredentialValues({});
        setConnectionError(null);
        setUseCNPJ(false);
        setConnectionStatusText('');
        setPendingItemId(null);

        clearPersistedOpenFinanceState().catch(() => null);
    };

    const handleSelectConnector = (connector: any) => {
        setCpfConnector(connector);
        setCpfInput('');
        setCpfModalStep('cpf');
        setShowCpfModal(true);
    };

    const handleConfirmCpf = () => {
        const cleanCpf = cpfInput.replace(/\D/g, '');

        if (cleanCpf.length !== 11) {
            showError('CPF inválido', 'Digite um CPF válido com 11 dígitos.');
            return;
        }

        if (!cpfConnector) return;

        Keyboard.dismiss();
        setCpfModalStep('confirm');

        confirmLogoScale.setValue(0.3);
        confirmLogoOpacity.setValue(0);

        Animated.parallel([
            Animated.spring(confirmLogoScale, {
                toValue: 1,
                friction: 5,
                tension: 80,
                useNativeDriver: true,
            }),
            Animated.timing(confirmLogoOpacity, {
                toValue: 1,
                duration: 400,
                useNativeDriver: true,
            }),
        ]).start();
    };

    const handleStartConnection = async () => {
        if (!cpfConnector) return;

        setSelectedConnector(cpfConnector);

        const creds = cpfConnector.credentials || [];
        const documentCred = creds.find((c: any) => credentialHasCpf(c) || credentialHasCnpj(c));
        const credName = documentCred ? documentCred.name : (creds[0]?.name || 'document');

        const credentialsPayload = {
            [credName]: cpfInput
        };

        setCredentialValues(credentialsPayload);

        setShowCpfModal(false);
        setIsModalVisible(false);
        setConnectionStep('connecting');

        setTimeout(() => {
            handleConnect(credentialsPayload, cpfConnector);
        }, 100);
    };

    const handleRequestDelete = (group: any) => {
        triggerBankCardMorph();
        setItemToDelete(group);
        setDeleteModalVisible(true);
    };

    const handleConfirmDelete = async () => {
        if (!user || !itemToDelete) return;

        setLoading(true);
        setDeleteModalVisible(false);

        try {
            const accountIds = (itemToDelete.accounts || [])
                .map((acc: any) => acc?.id)
                .filter(Boolean);
            const accountWithItem = (itemToDelete.accounts || [])
                .find((account: any) => account?.pluggyItemId || account?.itemId);
            const itemId = accountWithItem?.pluggyItemId || accountWithItem?.itemId || null;

            if (itemId) {
                const token = await user.getIdToken();
                const deleteResponse = await apiFetch(`/api/pluggy/items/${itemId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    timeout: 45000
                });

                if (!deleteResponse.ok && deleteResponse.status !== 404) {
                    const deletePayload = await readApiPayload(deleteResponse);
                    throw new Error(getApiErrorText(deletePayload, 'Nao foi possivel desconectar no banco.'));
                }
            }

            await databaseService.deleteOpenFinanceConnection(user.uid, accountIds);
            await fetchAccounts();

            setItemToDelete(null);
        } catch {
            Alert.alert('Erro', 'Não foi possível desconectar.');
        } finally {
            setLoading(false);
        }
    };

    const handleSyncBank = async (
        group: any,
        onStatusUpdate: (status: SyncStatus) => void
    ) => {
        if (!user) return;

        const accountWithItem = (group.accounts || [])
            .find((account: any) => account?.pluggyItemId || account?.itemId);

        const itemId = accountWithItem?.pluggyItemId || accountWithItem?.itemId || null;

        if (!itemId) {
            onStatusUpdate({
                step: 'error',
                message: 'Item ID ausente',
                progress: 0
            });

            setTimeout(() => {
                onStatusUpdate({
                    step: 'idle',
                    message: '',
                    progress: 0
                });
            }, 3000);

            return;
        }

        if (activeManualSyncsRef.current.has(itemId)) {
            onStatusUpdate({
                step: 'connecting',
                message: 'Sincronizacao ja em andamento...',
                progress: 15
            });
            return;
        }

        activeManualSyncsRef.current.add(itemId);

        try {
            onStatusUpdate({
                step: 'connecting',
                message: 'Atualizando no banco...',
                progress: 10
            });

            const token = await user.getIdToken();

            const refreshResponse = await apiFetch(`/api/pluggy/force-refresh/${itemId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!refreshResponse.ok && !isRetryableApiResponse(refreshResponse, await readApiPayload(refreshResponse))) {
                const refreshError = await readApiPayload(refreshResponse);
                throw new Error(refreshError?.error || 'Falha ao iniciar atualização no banco.');
            }

            onStatusUpdate({
                step: 'connecting',
                message: 'Aguardando atualização do banco...',
                progress: 20
            });

            const maxPollAttempts = Math.ceil(MANUAL_REFRESH_MAX_DURATION_MS / OAUTH_POLL_INITIAL_DELAY_MS);
            let itemUpdated = false;

            for (let attempt = 1; attempt <= maxPollAttempts; attempt++) {
                const statusResponse = await apiFetch(`/api/pluggy/items/${itemId}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    timeout: 15000
                });

                if (!statusResponse.ok && !isRetryableApiResponse(statusResponse, await readApiPayload(statusResponse))) {
                    const statusError = await readApiPayload(statusResponse);
                    throw new Error(statusError?.error || 'Falha ao consultar status da atualização.');
                }

                const statusData = await readApiPayload(statusResponse);
                const item = statusData?.item || statusData;
                const normalizedStatus = String(item?.status || '').toUpperCase();

                if (normalizedStatus === 'UPDATED') {
                    itemUpdated = true;
                    break;
                }

                if (
                    normalizedStatus === 'LOGIN_ERROR' ||
                    normalizedStatus === 'OUTDATED' ||
                    normalizedStatus === 'ERROR'
                ) {
                    throw new Error(buildPluggyConnectionErrorMessage(item));
                }

                if (normalizedStatus === 'WAITING_USER_INPUT') {
                    throw new Error('O banco pediu uma nova autorização. Reconecte a conta e tente novamente.');
                }

                if (attempt < maxPollAttempts) {
                    onStatusUpdate({
                        step: 'connecting',
                        message: 'Banco processando atualização...',
                        progress: Math.min(20 + attempt, 35)
                    });

                    await sleep(getPollingDelay(attempt));
                }
            }

            if (!itemUpdated) {
                throw new Error('Tempo de atualização do banco expirou. Tente sincronizar novamente em instantes.');
            }

            onStatusUpdate({
                step: 'fetching_accounts',
                message: 'Buscando dados atualizados...',
                progress: 40
            });

            const syncResponse = await apiFetch('/api/pluggy/sync', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    itemId,
                    autoRefresh: false
                }),
                timeout: SYNC_REQUEST_TIMEOUT_MS
            });

            if (syncResponse.ok) {
                const syncData = await readApiPayload(syncResponse) || {};

                onStatusUpdate({
                    step: 'fetching_accounts',
                    message: `${syncData.accounts?.length || 0} contas`,
                    progress: 50
                });

                onStatusUpdate({
                    step: 'fetching_accounts',
                    message: 'Organizando contas...',
                    progress: 65
                });

                const persistResult = await persistPluggySyncData(
                    syncData,
                    syncData.connector || group.connector,
                    (message) => onStatusUpdate({
                        step: 'fetching_accounts',
                        message,
                        progress: 72
                    })
                );

                onStatusUpdate({
                    step: 'done',
                    message: persistResult.partial ? 'Sincronizado com avisos' : 'Sincronizado!',
                    progress: 100
                });

                setTimeout(() => {
                    onStatusUpdate({
                        step: 'idle',
                        message: '',
                        progress: 0
                    });
                }, 3000);

                activeManualSyncsRef.current.delete(itemId);
                fetchAccounts();
            } else {
                const errData = await readApiPayload(syncResponse);
                throw new Error(getApiErrorText(errData, 'Falha na resposta do servidor'));
            }
        } catch (error: any) {
            activeManualSyncsRef.current.delete(itemId);
            onStatusUpdate({
                step: 'error',
                message: error.message || 'Erro na sincronização',
                progress: 0
            });
        }
    };

    const handleConnect = async (
        customCredentials?: Record<string, string>,
        customConnector?: any
    ) => {
        const currentConnector = customConnector || selectedConnector;

        if (!user || !currentConnector) return;

        const connectorCredentials = currentConnector.credentials || [];
        const credsToUse = customCredentials || credentialValues;

        if (!hasCredits) {
            const resetTime = databaseService.getTimeUntilReset();
            showWarning('Créditos esgotados', `Seus créditos renovam em ${resetTime.formatted}.`);
            return;
        }

        const missingFields = connectorCredentials.filter((cred: any) => {
            if (credsToUse[cred.name]?.trim()) return false;
            return true;
        });

        if (missingFields.length > 0 && connectorCredentials.length > 1) {
            console.warn('[Fintech] Prosseguindo com CPF apenas - outros campos serão tratados pelo Pluggy');
        }

        const creditResult: { success: boolean; error?: string } = { success: true };

        if (!creditResult.success) {
            showError('Erro', creditResult.error || 'Erro ao consumir crédito.');
            return;
        }

        setConnecting(true);
        setIsModalVisible(false);
        setConnectionStep('connecting');
        setConnectionProgress(5);
        setConnectionStatusText('Criando conexão com o banco...');

        const sanitizedCredentials = {
            ...credsToUse
        };

        connectorCredentials.filter(isDocumentCredential).forEach((cred: any) => {
            if (sanitizedCredentials[cred.name]) {
                sanitizedCredentials[cred.name] = sanitizedCredentials[cred.name].replace(/\D/g, '');
            }
        });

        openedOAuthUrlRef.current = false;

        try {
            const token = await user.getIdToken();

            const createResponse = await apiFetch('/api/pluggy/create-item', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    connectorId: currentConnector.id,
                    credentials: sanitizedCredentials,
                    appRedirectUri: OAUTH_REDIRECT_URI,
                    oauthRedirectUri: OAUTH_REDIRECT_URI,
                    webhookUrl: BACKEND_WEBHOOK_URL
                }),
                timeout: 90000
            });

            const createData = await readApiPayload(createResponse) || {};

            if (!createResponse.ok) {
                setConnectionError(createData.error || 'Falha ao criar item no servidor');
                setConnectionStep('error');
                setPendingItemId(null);
                setIsModalVisible(false);

                await clearPersistedOpenFinanceState();

                setTimeout(() => setConnectionStep('info'), 5000);
                return;
            }

            const createItemOAuthUrl = getItemOAuthUrl(createData);
            const itemId = createData.item?.id;

            if (!itemId) {
                setConnectionError('O servidor não retornou o ID da conexão.');
                setConnectionStep('error');
                setPendingItemId(null);
                setIsModalVisible(false);

                await clearPersistedOpenFinanceState();

                setTimeout(() => setConnectionStep('info'), 5000);
                return;
            }

            setPendingItemId(itemId);

            await savePendingConnectionState(itemId, currentConnector, 'creating');

            if (createItemOAuthUrl) {
                try {
                    openedOAuthUrlRef.current = true;
                    setConnectionStep('oauth_pending');
                    setConnectionStatusText('Redirecionando para o banco...');

                    setTimeout(async () => {
                        await openOAuthUrlSafely(createItemOAuthUrl);
                    }, 1000);
                } catch (openError: any) {
                    setConnectionError(openError?.message || 'Não foi possível abrir o app do banco.');
                    setConnectionStep('error');
                    setPendingItemId(null);
                    setIsModalVisible(false);

                    await clearPersistedOpenFinanceState();

                    setTimeout(() => setConnectionStep('info'), 5000);
                }
            } else {
                setConnectionStep('oauth_pending');
                setConnectionStatusText('Aguardando você autorizar no banco...');
            }
        } catch (error: any) {
            setConnectionError(error?.message || 'Erro de conexão na internet');
            setConnectionStep('error');
            setPendingItemId(null);
            setIsModalVisible(false);

            await clearPersistedOpenFinanceState();

            setTimeout(() => setConnectionStep('info'), 5000);
        } finally {
            setConnecting(false);
        }
    };

    const filteredConnectors = connectors.filter((connector) =>
        connector.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const sortedConnectors = [...connectors].sort((a, b) => {
        const priorityA = getBankPriority(a.name);
        const priorityB = getBankPriority(b.name);

        if (priorityA === priorityB) {
            return a.name.localeCompare(b.name);
        }

        return priorityA - priorityB;
    });

    const displayConnectors =
        searchQuery.trim() === ''
            ? sortedConnectors.slice(0, 15)
            : filteredConnectors;

    const shouldShowConnectorsNetworkError =
        !loadingConnectors &&
        displayConnectors.length === 0 &&
        Boolean(connectorsFetchError);

    const filteredAccounts = useMemo(() => {
        const checkingGroups: Record<string, any[]> = {};
        const otherAccounts: any[] = [];

        accounts.forEach((acc) => {
            const isChecking = acc.type === 'BANK' || acc.subtype === 'CHECKING_ACCOUNT';

            if (isChecking && acc.number) {
                const connectorId = acc.connector?.id || acc.connectorId || 'unknown';
                const cleanNumber = String(acc.number).replace(/\D/g, '');
                const last4 = cleanNumber.slice(-4);

                if (!last4) {
                    otherAccounts.push(acc);
                    return;
                }

                const key = `${connectorId}-${last4}`;

                if (!checkingGroups[key]) checkingGroups[key] = [];
                checkingGroups[key].push(acc);
            } else {
                otherAccounts.push(acc);
            }
        });

        const bestCheckingAccounts = Object.values(checkingGroups).map((group) => {
            if (group.length === 1) return group[0];

            group.sort((a, b) => Math.abs(b.balance || 0) - Math.abs(a.balance || 0));

            return group[0];
        });

        return [
            ...otherAccounts,
            ...bestCheckingAccounts
        ];
    }, [accounts]);

    const groupedAccounts = filteredAccounts.reduce((acc, account) => {
        const connectorName = account.connector?.name || account.name || 'Outros';

        if (!acc[connectorName]) {
            acc[connectorName] = {
                connector: account.connector,
                accounts: []
            };
        }

        acc[connectorName].accounts.push(account);

        return acc;
    }, {} as Record<string, any>);

    const renderModalContent = () => {
        switch (connectionStep) {
            case 'banks':
                if (loadingConnectors) {
                    return (
                        <IosCoreLoader style={{ minHeight: 400 }} />
                    );
                }

                if (shouldShowConnectorsNetworkError) {
                    return (
                        <Reanimated.View
                            entering={FadeIn.duration(180).springify().damping(16).stiffness(195)}
                            exiting={FadeOut.duration(120)}
                            style={styles.connectorsErrorContainer}
                        >
                            <View pointerEvents="none" style={styles.cardBlurLayer}>
                                <BlurView intensity={22} tint="dark" style={StyleSheet.absoluteFillObject} />
                            </View>

                            <View pointerEvents="none" style={styles.cardTint}>
                                <LinearGradient
                                    colors={[
                                        'rgba(255,255,255,0.02)',
                                        'rgba(20,20,20,0.04)',
                                        'rgba(0,0,0,0.12)',
                                    ]}
                                    locations={[0, 0.48, 1]}
                                    start={{ x: 0.5, y: 0 }}
                                    end={{ x: 0.5, y: 1 }}
                                    style={StyleSheet.absoluteFillObject}
                                />
                            </View>

                            <Text style={styles.connectorsErrorTitle}>Falha na comunicação</Text>
                            <Text style={styles.connectorsErrorText}>{connectorsFetchError}</Text>

                            <TouchableOpacity
                                style={styles.connectorsRetryButton}
                                onPress={fetchConnectors}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.connectorsRetryButtonText}>Tentar novamente</Text>
                            </TouchableOpacity>
                        </Reanimated.View>
                    );
                }

            default:
                return (
                    <ScrollView
                        style={styles.banksListContainer}
                        contentContainerStyle={[
                            styles.banksListContent,
                            { paddingHorizontal: horizontalPadding },
                            isShortPhone && styles.banksListContentShort
                        ]}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                    >
                        {displayConnectors.length === 0 ? (
                            <Text style={[styles.emptyText, { padding: 20 }]}>
                                Nenhum banco encontrado
                            </Text>
                        ) : (
                            displayConnectors.map((item, index) => (
                                <ConnectorCard
                                    key={item.id.toString()}
                                    item={item}
                                    index={index}
                                    onSelect={handleSelectConnector}
                                    styles={styles}
                                />
                            ))
                        )}
                    </ScrollView>
                );
        }
    };

    return (
        <View style={styles.mainContainer}>
            <View style={StyleSheet.absoluteFill}>
                <UniversalBackground
                    backgroundColor="#0A0A0A"
                    glowSize={350}
                    showParticles={true}
                    particleCount={15}
                />
            </View>

            <View
                style={[
                    styles.container,
                    {
                        paddingTop: Math.max(insets.top + (isShortPhone ? 10 : 14), isShortPhone ? 44 : 56)
                    }
                ]}
            >
                <Reanimated.View
                    style={[
                        styles.header,
                        isNarrowPhone && styles.headerCompact,
                        headerAnimatedStyle
                    ]}
                >
                    <View style={styles.headerLeft}>
                        <View style={[styles.headerIconShell, isNarrowPhone && styles.headerIconShellCompact]}>
                            <Image
                                source={require('../../assets/images/icon.png')}
                                style={[styles.headerIcon, isNarrowPhone && styles.headerIconCompact]}
                                resizeMode="contain"
                            />
                        </View>

                        <Text
                            style={[styles.title, isNarrowPhone && styles.titleCompact]}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.82}
                        >
                            Contas Bancárias
                        </Text>
                    </View>

                    <View style={styles.headerRight}>
                        {user && (
                            <SyncCreditsDisplay
                                userId={user.uid}
                                compact
                                onConnect={handleOpenModal}
                                connectDisabled={!hasCredits}
                            />
                        )}
                    </View>
                </Reanimated.View>

                <Reanimated.View style={[styles.content, contentAnimatedStyle]}>
                    {loading ? (
                        <IosCoreLoader />
                    ) : (
                        <ScrollView
                            style={styles.accountsScroll}
                            contentContainerStyle={[
                                styles.accountsScrollContent,
                                { paddingHorizontal: horizontalPadding },
                                isShortPhone && styles.accountsScrollContentShort,
                                accounts.length === 0 && styles.accountsScrollContentEmpty
                            ]}
                            refreshControl={
                                <RefreshControl
                                    refreshing={refreshing}
                                    onRefresh={onRefresh}
                                    tintColor="#D97757"
                                />
                            }
                        >
                            {accounts.length === 0 ? (
                                <EmptyAccountsState styles={styles} />
                            ) : (
                                Object.values(groupedAccounts).map((group: any, index) => {
                                    const groupItemId =
                                        group.accounts?.[0]?.pluggyItemId ||
                                        group.accounts?.[0]?.itemId ||
                                        group.connector?.id ||
                                        `bank-${index}`;

                                    return (
                                        <Reanimated.View
                                            key={`${groupItemId}-${dataRefreshKey}`}
                                            layout={BANK_CARD_IOS_LAYOUT}
                                            entering={BANK_CARD_ENTER.delay(index * 45)}
                                            exiting={BANK_CARD_EXIT}
                                            collapsable={false}
                                            onTouchStart={triggerBankCardMorph}
                                            onStartShouldSetResponderCapture={() => {
                                                triggerBankCardMorph();
                                                return false;
                                            }}
                                            style={styles.bankCardMorphWrapper}
                                        >
                                            <ConnectedBankCard
                                                group={group}
                                                onDelete={handleRequestDelete}
                                                onSync={handleSyncBank}
                                                hasCredits={hasCredits}
                                                canSyncItem={canSyncItem}
                                                onConsumeCredit={consumeCredit}
                                                hiddenAccountIds={(profile?.preferences as any)?.hiddenAccountIds}
                                                onToggleVisibility={handleToggleVisibility}
                                                onStatusChange={handleBankSyncStatusChange}
                                            />
                                        </Reanimated.View>
                                    );
                                })
                            )}
                        </ScrollView>
                    )}
                </Reanimated.View>

                <DeleteConfirmationModal
                    visible={deleteModalVisible}
                    title={`Excluir ${itemToDelete?.connector?.name || 'Conta'}?`}
                    onCancel={() => setDeleteModalVisible(false)}
                    onConfirm={handleConfirmDelete}
                    confirmText="Excluir"
                    cancelText="Cancelar"
                />

                <ConnectAccountModal
                    visible={isModalVisible}
                    onClose={handleCloseModal}
                    title={
                        connectionStep === 'banks'
                            ? 'Selecione o seu banco'
                            : connectionStep === 'connecting'
                                ? 'Conectando'
                                : connectionStep === 'oauth_pending'
                                    ? 'Autorização'
                                    : connectionStep === 'success'
                                        ? 'Sucesso!'
                                        : 'Erro'
                    }
                    subtitle={
                        connectionStep === 'banks'
                            ? 'Escolha a instituição que deseja conectar'
                            : undefined
                    }
                    warningText={
                        connectionStep === 'connecting' || connectionStep === 'oauth_pending'
                            ? 'Pode demorar alguns minutos. Você pode sair — será notificado ao concluir.'
                            : undefined
                    }
                    connectionStep={connectionStep}
                    banksCount={displayConnectors.length}
                    isBanksLoading={loadingConnectors}
                    credentialsCount={selectedConnector?.credentials?.length || 0}
                    onBack={connectionStep === 'credentials' ? () => setConnectionStep('banks') : undefined}
                    searchElement={
                        connectionStep === 'banks' ? (
                            <SearchInputShell
                                searchQuery={searchQuery}
                                setSearchQuery={setSearchQuery}
                                styles={styles}
                            />
                        ) : undefined
                    }
                >
                    {renderModalContent()}
                </ConnectAccountModal>

                <ModalPadrao
                    visible={showCpfModal}
                    onClose={() => setShowCpfModal(false)}
                    title={cpfModalStep === 'cpf' ? 'Confirme seu CPF' : 'Confirmar conexão'}
                    presentation="center"
                    size="md"
                    maxWidth={Math.min(390, width - 24)}
                    scrollable={false}
                    enableDragToClose={false}
                    footerBorder={false}
                    contentStyle={styles.cpfModalContent}
                    headerStyle={styles.cpfModalHeader}
                    bodyStyle={styles.cpfModalBody}
                    titleStyle={styles.cpfModalTitle}
                    footerStyle={styles.cpfModalFooter}
                    footer={
                        cpfModalStep === 'cpf' ? (
                            <TouchableOpacity
                                style={[
                                    styles.continuarButton,
                                    cpfInput.replace(/\D/g, '').length !== 11 &&
                                    styles.continuarButtonDisabled
                                ]}
                                onPress={handleConfirmCpf}
                                activeOpacity={0.85}
                                disabled={cpfInput.replace(/\D/g, '').length !== 11}
                            >
                                <Text style={styles.continuarButtonText}>
                                    Continuar
                                </Text>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity
                                style={styles.confirmConnectButton}
                                onPress={handleStartConnection}
                                activeOpacity={0.85}
                            >
                                <Text style={styles.confirmConnectButtonText}>
                                    Conectar ao {cpfConnector?.name || 'banco'}
                                </Text>
                            </TouchableOpacity>
                        )
                    }
                >
                    {cpfModalStep === 'cpf' ? (
                        <>
                            <Text style={styles.cpfModalSubtitle}>
                                Para continuar com {cpfConnector?.name || 'o banco selecionado'}
                            </Text>

                            <View style={styles.cpfSectionCard}>
                                <TextInput
                                    style={styles.cpfInput}
                                    placeholder="CPF"
                                    placeholderTextColor="#555"
                                    keyboardType="number-pad"
                                    maxLength={14}
                                    value={cpfInput}
                                    onChangeText={(text) => setCpfInput(formatCPF(text))}
                                    autoFocus
                                />
                            </View>
                        </>
                    ) : (
                        <>
                            <View style={styles.confirmLogosRow}>
                                <Animated.View
                                    style={[
                                        styles.confirmLogoCircle,
                                        {
                                            transform: [{ scale: confirmLogoScale }],
                                            opacity: confirmLogoOpacity
                                        }
                                    ]}
                                >
                                    <View style={styles.confirmLogoInner}>
                                        <BankConnectorLogo
                                            connector={cpfConnector}
                                            size={38}
                                            borderRadius={19}
                                            backgroundColor="transparent"
                                            showBorder={false}
                                        />
                                    </View>
                                </Animated.View>

                                <Animated.View
                                    style={[
                                        styles.confirmDashedLineContainer,
                                        {
                                            opacity: confirmLogoOpacity
                                        }
                                    ]}
                                >
                                    <View style={styles.confirmDashedLine} />
                                </Animated.View>

                                <Animated.View
                                    style={[
                                        styles.confirmAppLogoCircle,
                                        {
                                            transform: [{ scale: confirmLogoScale }],
                                            opacity: confirmLogoOpacity
                                        }
                                    ]}
                                >
                                    <View style={styles.confirmLogoInner}>
                                        <Image
                                            source={require('@/assets/images/logo.png')}
                                            style={styles.confirmAppLogoImage}
                                            resizeMode="contain"
                                        />
                                    </View>
                                </Animated.View>
                            </View>

                            <View style={styles.confirmSummaryCard}>
                                <View style={styles.confirmSummaryRow}>
                                    <Text style={styles.confirmSummaryLabel}>Banco</Text>
                                    <Text style={styles.confirmSummaryValue}>
                                        {cpfConnector?.name || 'Banco'}
                                    </Text>
                                </View>

                                <View style={styles.confirmSummarySeparator} />

                                <View style={styles.confirmSummaryRow}>
                                    <Text style={styles.confirmSummaryLabel}>CPF</Text>
                                    <Text style={styles.confirmSummaryValue}>
                                        {cpfInput.replace(/\d{3}\.\d{3}/, '•••.•••')}
                                    </Text>
                                </View>

                                <View style={styles.confirmSummarySeparator} />

                                <View style={styles.confirmSummaryRow}>
                                    <Text style={styles.confirmSummaryLabel}>Dados</Text>
                                    <Text style={styles.confirmSummaryValue}>
                                        Contas e transações
                                    </Text>
                                </View>
                            </View>

                            <Text style={styles.confirmDisclaimer}>
                                Ao confirmar, seus dados serão sincronizados de forma segura via Open Finance.
                            </Text>
                        </>
                    )}
                </ModalPadrao>

                <AnimatedInlineBanner
                    show={
                        bankSyncBanner.step !== 'idle' ||
                        (
                            ['connecting', 'oauth_pending', 'success', 'error'].includes(connectionStep) &&
                            !isModalVisible
                        )
                    }
                    step={bankSyncBanner.step !== 'idle' ? bankSyncBanner.step : connectionStep}
                    error={bankSyncBanner.step !== 'idle' ? bankSyncBanner.error : connectionError}
                    statusText={bankSyncBanner.step !== 'idle' ? bankSyncBanner.statusText : connectionStatusText}
                />
            </View>
        </View>
    );
}

const getBankPriority = (name: string): number => {
    return 0;
};

const formatCPF = (value: string) =>
    value
        .replace(/\D/g, '')
        .replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
        .slice(0, 14);

const credentialHasCpf = (cred: any) =>
    /cpf|documento/i.test(cred.label || cred.name || '');

const credentialHasCnpj = (cred: any) =>
    /cnpj/i.test(cred.label || cred.name || '');

const isDocumentCredential = (cred: any) =>
    credentialHasCpf(cred) || credentialHasCnpj(cred);

const SearchInputShell = ({ searchQuery, setSearchQuery, styles }: any) => {
    const entranceStyle = useElasticEntrance(40, 10);
    const press = useSharedValue(0);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            {
                scaleX: interpolate(press.value, [0, 1], [1, 0.988], Extrapolation.CLAMP),
            },
            {
                scaleY: interpolate(press.value, [0, 1], [1, 1.026], Extrapolation.CLAMP),
            },
        ],
    }));

    return (
        <Reanimated.View style={[styles.searchContainer, entranceStyle, animatedStyle]}>
            <Search size={18} color="#7A7A7A" style={styles.searchIcon} />

            <TextInput
                style={styles.searchInput}
                placeholder="Buscar banco..."
                placeholderTextColor="#666"
                value={searchQuery}
                onChangeText={setSearchQuery}
                clearButtonMode="never"
                onFocus={() => {
                    press.value = withSpring(1, PRESS_SPRING);
                }}
                onBlur={() => {
                    press.value = withSpring(0, PRESS_SPRING);
                }}
            />
        </Reanimated.View>
    );
};

const EmptyAccountsState = ({ styles }: any) => {
    const entranceStyle = useElasticEntrance(120, 18);
    const lottieRef = useRef<LottieView>(null);

    useEffect(() => {
        const timer = setTimeout(() => {
            lottieRef.current?.play();
        }, 150);
        return () => clearTimeout(timer);
    }, []);

    return (
        <Reanimated.View style={[styles.emptyState, entranceStyle]}>
            <View style={styles.emptyIconShell}>
                <LottieView
                    ref={lottieRef}
                    source={require('@/assets/banco.json')}
                    autoPlay={false}
                    loop={false}
                    style={{ width: 26, height: 26 }}
                    colorFilters={[
                        {
                            keypath: '**',
                            color: '#A1A1AA',
                        },
                    ]}
                />
            </View>

            <Text style={styles.emptyTitle}>
                Nenhuma conta
            </Text>

            <Text style={styles.emptyDescription}>
                Conecte uma conta para ver seu saldo.
            </Text>
        </Reanimated.View>
    );
};

const ConnectorCard = ({ item, index, onSelect, styles }: any) => {
    const press = useSharedValue(0);

    const cardStyle = useAnimatedStyle(() => {
        const stretchX = interpolate(press.value, [0, 1], [1, 0.988], Extrapolation.CLAMP);
        const stretchY = interpolate(press.value, [0, 1], [1, 1.026], Extrapolation.CLAMP);

        return {
            transform: [
                { scaleX: stretchX },
                { scaleY: stretchY },
            ],
        };
    });

    const chevronStyle = useAnimatedStyle(() => ({
        opacity: interpolate(press.value, [0, 1], [0.5, 1], Extrapolation.CLAMP),
        transform: [
            {
                translateX: interpolate(press.value, [0, 1], [0, 2], Extrapolation.CLAMP),
            },
            {
                scale: interpolate(press.value, [0, 1], [1, 0.92], Extrapolation.CLAMP),
            },
        ],
    }));

    return (
        <AnimatedTouchableOpacity
            onPress={() => onSelect(item)}
            onPressIn={() => {
                press.value = withSpring(1, PRESS_SPRING);
            }}
            onPressOut={() => {
                press.value = withSpring(0, PRESS_SPRING);
            }}
            style={[styles.bankListRow, cardStyle]}
            activeOpacity={0.9}
            entering={FadeInDown
                .springify()
                .damping(16)
                .stiffness(195)
                .mass(1.05)
                .delay(index * 26)}
            exiting={FadeOut.duration(120)}
            layout={LinearTransition.springify()
                .damping(15)
                .stiffness(185)
                .mass(1.08)}
        >
            <View style={styles.bankListLogoContainer}>
                <View style={styles.bankListLogoBubble}>
                    <BankConnectorLogo
                        connector={item}
                        size={26}
                        borderRadius={13}
                        backgroundColor="transparent"
                        showBorder={false}
                    />
                </View>
            </View>

            <Text style={styles.bankRowTitle}>{item.name}</Text>

            <Reanimated.View style={chevronStyle}>
                <ChevronRight size={18} color="#7A7A7A" />
            </Reanimated.View>
        </AnimatedTouchableOpacity>
    );
};

const styles = StyleSheet.create({
    mainContainer: {
        flex: 1,
        backgroundColor: '#0A0A0A'
    },

    container: {
        flex: 1,
        paddingTop: 60
    },

    header: {
        marginBottom: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20
    },

    headerCompact: {
        paddingHorizontal: 12,
        marginBottom: 14,
    },

    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1,
        minWidth: 0,
        paddingRight: 8,
    },

    headerIconShell: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: 'transparent',
        borderWidth: 0,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },

    headerIconShellCompact: {
        width: 34,
        height: 34,
        borderRadius: 9,
    },

    headerIcon: {
        width: 40,
        height: 40,
        borderRadius: 10,
    },

    headerIconCompact: {
        width: 34,
        height: 34,
        borderRadius: 9,
    },

    title: {
        fontSize: 18,
        fontFamily: 'AROneSans_400Regular',
        color: '#E5E5E5',
        letterSpacing: 0,
        flexShrink: 1,
    },

    titleCompact: {
        fontSize: 16,
    },

    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flexShrink: 0,
    },

    content: {
        flex: 1
    },

    banksListContainer: {
        flex: 1,
        marginTop: 10
    },

    banksListContent: {
        paddingBottom: 40,
        paddingHorizontal: 20,
        gap: 10,
    },

    banksListContentShort: {
        paddingBottom: 24,
    },

    connectorsErrorContainer: {
        backgroundColor: '#111111',
        borderRadius: 24,
        padding: 16,
        alignItems: 'center',
        marginHorizontal: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#2B2B2B',
    },

    connectorsErrorTitle: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
        textAlign: 'center',
        zIndex: 4,
    },

    connectorsErrorText: {
        color: '#909090',
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
        marginTop: 8,
        zIndex: 4,
    },

    connectorsRetryButton: {
        backgroundColor: '#FFFFFF',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 16,
        marginTop: 16,
        alignItems: 'center',
        width: '100%',
        zIndex: 4,
    },

    connectorsRetryButtonText: {
        color: '#000000',
        fontSize: 15,
        fontFamily: 'AROneSans_400Regular'
    },

    bankListRow: {
        minHeight: 68,
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 20,
        overflow: 'hidden',
        backgroundColor: '#101010',
        borderWidth: 1,
        borderColor: '#252525',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.24,
        shadowRadius: 18,
        elevation: 8,
    },

    cardBlurLayer: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 0,
        overflow: 'hidden',
    },

    cardTint: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 1,
        opacity: 0.92,
        backgroundColor: 'rgba(16, 16, 16, 0.92)',
    },

    cardRightGlow: {
        position: 'absolute',
        top: -20,
        right: -46,
        width: 132,
        height: 88,
        borderRadius: 999,
        overflow: 'hidden',
        zIndex: 2,
    },

    bankListLogoContainer: {
        marginRight: 12,
        zIndex: 4,
    },

    bankListLogoBubble: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        overflow: 'hidden',
    },

    bankRowTitle: {
        flex: 1,
        fontSize: 16,
        color: '#E5E5E5',
        fontFamily: 'AROneSans_400Regular',
        zIndex: 4,
    },

    bankCardMorphWrapper: {
        marginBottom: 12,
        backgroundColor: 'transparent',
        borderWidth: 0,
        overflow: 'visible',
    },

    statusContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        minHeight: 400
    },

    statusIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24
    },

    statusTitle: {
        color: '#E5E5E5',
        fontSize: 22,
        fontFamily: 'AROneSans_400Regular',
        marginBottom: 12,
        textAlign: 'center'
    },

    statusText: {
        color: '#909090',
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 24,
        fontFamily: 'AROneSans_400Regular'
    },

    stepContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 14,
        borderRadius: 12,
        marginTop: 24,
        width: '100%'
    },

    emptyText: {
        color: '#8E8E93',
        textAlign: 'center',
        fontSize: 13,
        lineHeight: 18,
        maxWidth: 232,
        fontFamily: 'AROneSans_400Regular'
    },

    accountsScroll: {
        flex: 1
    },

    accountsScrollContent: {
        paddingBottom: 120,
        paddingHorizontal: 16,
        paddingTop: 4
    },

    accountsScrollContentShort: {
        paddingBottom: 84,
    },

    accountsScrollContentEmpty: {
        flexGrow: 1,
        justifyContent: 'center',
        paddingTop: 0,
        paddingBottom: 96
    },

    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
        paddingVertical: 42,
        marginHorizontal: 4,
    },

    emptyStateCardBase: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 0,
        overflow: 'hidden',
    },

    emptyStateTint: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 1,
        opacity: 0.9,
    },

    emptyIconShell: {
        width: 48,
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
        zIndex: 4,
    },

    emptyIconGlow: {
        position: 'absolute',
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: 'rgba(217,119,87,0.16)',
    },

    emptyTitle: {
        fontSize: 17,
        fontFamily: 'AROneSans_400Regular',
        color: '#E5E5E5',
        marginBottom: 6,
        textAlign: 'center',
        zIndex: 4,
    },

    emptyDescription: {
        fontSize: 13,
        color: '#606060',
        textAlign: 'center',
        lineHeight: 18,
        maxWidth: 232,
        fontFamily: 'AROneSans_400Regular',
        zIndex: 4,
    },

    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        alignSelf: 'stretch',
        backgroundColor: '#101010',
        borderRadius: 20,
        paddingHorizontal: 14,
        height: 52,
        marginHorizontal: 0,
        marginBottom: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#252525',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 14,
        elevation: 6,
    },

    searchBlurLayer: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 0,
        overflow: 'hidden',
    },

    searchTintLayer: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 1,
        opacity: 0.92,
    },

    searchInput: {
        flex: 1,
        color: '#FFFFFF',
        fontSize: 16,
        paddingVertical: 10,
        marginLeft: 8,
        fontFamily: 'AROneSans_400Regular',
        zIndex: 3,
    },

    searchIcon: {
        zIndex: 3,
    },

    cpfModalContent: {
        backgroundColor: '#101010',
        borderColor: '#252525',
    },

    cpfModalHeader: {
        backgroundColor: '#101010',
        borderBottomWidth: 0,
        paddingHorizontal: 20,
    },

    cpfModalBody: {
        backgroundColor: '#101010',
        paddingHorizontal: 20,
        paddingTop: 2,
        paddingBottom: 2,
    },

    cpfModalFooter: {
        backgroundColor: '#101010',
        paddingHorizontal: 20,
        paddingTop: 8,
        borderTopWidth: 0,
    },

    cpfModalTitle: {
        fontSize: 20,
        fontFamily: 'AROneSans_400Regular',
        color: '#E5E5E5',
        fontWeight: '400',
    },

    cpfModalSubtitle: {
        fontSize: 14,
        color: '#606060',
        fontFamily: 'AROneSans_400Regular',
        textAlign: 'left',
        marginBottom: 24,
        lineHeight: 20
    },

    cpfSectionCard: {
        backgroundColor: '#161616',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#252525',
        marginBottom: 4,
        overflow: 'hidden',
    },

    cpfInput: {
        color: '#FFFFFF',
        fontSize: 16,
        fontFamily: 'AROneSans_400Regular',
        paddingVertical: 14,
        paddingHorizontal: 16
    },

    continuarButton: {
        backgroundColor: '#FFFFFF',
        paddingVertical: 14,
        borderRadius: 18,
        alignItems: 'center'
    },

    continuarButtonDisabled: {
        opacity: 0.3
    },

    continuarButtonText: {
        color: '#000000',
        fontSize: 16,
        fontFamily: 'AROneSans_400Regular'
    },

    confirmLogosRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: 24,
        gap: 0
    },

    confirmLogoCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        justifyContent: 'center',
        alignItems: 'center'
    },

    confirmLogoInner: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center'
    },

    confirmDashedLineContainer: {
        width: 50,
        height: 2,
        justifyContent: 'center',
        alignItems: 'center'
    },

    confirmDashedLine: {
        width: '100%',
        height: 2,
        borderStyle: 'dashed',
        borderWidth: 1,
        borderColor: '#D97757',
        borderRadius: 1
    },

    confirmAppLogoCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(217, 119, 87, 0.12)',
        justifyContent: 'center',
        alignItems: 'center'
    },

    confirmAppLogoImage: {
        width: 40,
        height: 40,
        borderRadius: 20
    },

    confirmSummaryCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 18,
        padding: 16,
        marginBottom: 20,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255,255,255,0.08)',
    },

    confirmSummaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },

    confirmSummaryLabel: {
        fontSize: 14,
        color: '#8E8E93'
    },

    confirmSummaryValue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF'
    },

    confirmSummarySeparator: {
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        marginVertical: 12
    },

    confirmDisclaimer: {
        fontSize: 12,
        color: '#8E8E93',
        textAlign: 'center',
        lineHeight: 16,
        marginBottom: 24
    },

    confirmConnectButton: {
        backgroundColor: '#D97757',
        paddingVertical: 14,
        borderRadius: 16,
        alignItems: 'center'
    },

    confirmConnectButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600'
    },

    actionButton: {
        backgroundColor: '#D97757',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 10
    },

    actionButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600'
    }
});
