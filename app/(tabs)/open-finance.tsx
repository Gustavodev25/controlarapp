// OpenFinanceScreen.tsx - VERSÃO ATUALIZADA COM NOVA TELA DE SELEÇÃO + MINI BOTTOM MODAL CPF
// Última atualização: Modal CPF com textos alinhados à esquerda, sem botão cancelar, continuar menor, input estilo lembrete
// Programador nível sênior Fintech | Fluxo limpo, moderno, UX Nubank-style, 100% funcional com Pluggy + OAuth + Sync

import { ConnectAccountModal } from '@/components/ConnectAccountModal';
import { UniversalBackground } from '@/components/UniversalBackground';
import { BankConnectorLogo } from '@/components/open-finance/BankConnectorLogo';
import { ConnectedBankCard, BankSyncStatus as SyncStatus } from '@/components/open-finance/ConnectedBankCard';
import { SyncCreditsDisplay, useSyncCredits } from '@/components/open-finance/SyncCreditsDisplay';
import { DelayedLoopLottie } from '@/components/ui/DelayedLoopLottie';
import { DeleteConfirmationModal } from '@/components/ui/DeleteConfirmationModal';
import { useAuthContext as useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { API_BASE_URL_CANDIDATES } from '@/services/apiBaseUrl';
import { databaseService } from '@/services/firebase';
import { notificationService } from '@/services/notifications';
import { openFinanceConnectionState } from '@/services/openFinanceConnectionState';
import { getConnectorLogoUrl, normalizeHexColor } from '@/utils/connectorLogo';
import { BlurView } from 'expo-blur';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import LottieView from 'lottie-react-native';
import { CheckCircle, ChevronRight, RefreshCw, Search, X, XCircle } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    Animated,
    AppState,
    Dimensions,
    Image,
    Keyboard,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    UIManager,
    View
} from 'react-native';
import AnimatedReanimated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

if (Platform.OS === 'android') {
    if (UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
    }
}

// ====================== CONFIGURAÇÃO DE API ======================
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

const fetchWithTimeout = async (resource: string, options: RequestInit & { timeout?: number } = {}) => {
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const OAUTH_REDIRECT_URI = Linking.createURL('open-finance/callback');

// ====================== COMPONENTE INLINE BANNER ======================
const springConfigInline = { damping: 14, stiffness: 200, mass: 0.6 };

const AnimatedInlineBanner = ({ show, step, error, statusText }: { show: boolean, step: string, error: string | null, statusText: string }) => {
    const opacity = useSharedValue(0);
    const insets = useSafeAreaInsets();

    useEffect(() => {
        if (show) {
            opacity.value = withSpring(1, springConfigInline);
        } else {
            opacity.value = withSpring(0, { damping: 16, stiffness: 220, mass: 0.5 });
        }
    }, [show, step]);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [
            { scale: opacity.value },
            { translateY: (1 - opacity.value) * 15 } // Sobe de leve ao aparecer
        ],
        bottom: 80 + Math.max(insets.bottom, 0)
    }));

    return (
        <AnimatedReanimated.View
            pointerEvents={show ? 'auto' : 'none'}
            style={[
                styles.dynamicIslandContainer,
                styles.dynamicIsland,
                step === 'error' && styles.dynamicIslandError,
                step === 'success' && styles.dynamicIslandSuccess,
                animatedStyle,
                {
                    overflow: 'hidden',
                    justifyContent: 'flex-start', // Começa tudo na esquerda
                    alignItems: 'center',
                    minWidth: 100,
                    maxWidth: (Dimensions.get('window').width * 0.75) - 40, // Strict threshold
                    minHeight: 48,
                }
            ]}
        >
            {step === 'error' ? (
                <XCircle size={18} color="#ef4444" style={{ marginRight: 8, flexShrink: 0 }} />
            ) : step === 'success' ? (
                <CheckCircle size={18} color="#22c55e" style={{ marginRight: 8, flexShrink: 0 }} />
            ) : (
                <RefreshCw size={18} color="#66BB6A" style={{ marginRight: 8, flexShrink: 0 }} />
            )}
            <Text
                style={[
                    styles.dynamicIslandText,
                    step === 'error' && { color: '#ffb3b3' },
                    step === 'success' && { color: '#b3ffcc' },
                    { flexShrink: 1, textAlign: 'left', flexWrap: 'wrap' }
                ]}
                numberOfLines={2}
            >
                {step === 'error' ? error : (statusText || 'Sincronizando...')}
            </Text>
        </AnimatedReanimated.View>
    );
};

// ====================== COMPONENTE ======================
export default function OpenFinanceScreen() {
    const { user, profile, refreshProfile } = useAuth();
    const { showError, showWarning } = useToast();

    // ====================== ESTADOS ======================
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<any>(null);
    const [accounts, setAccounts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingDots, setLoadingDots] = useState('');
    const [dataRefreshKey, setDataRefreshKey] = useState(0);
    const [refreshing, setRefreshing] = useState(false);

    const { credits: syncCredits, refresh: refreshCredits, consumeCredit, hasCredits, canSyncItem } = useSyncCredits(user?.uid);

    const [connectionStep, setConnectionStep] = useState<'info' | 'banks' | 'credentials' | 'connecting' | 'oauth_pending' | 'success' | 'error'>('info');
    const [connectors, setConnectors] = useState<any[]>([]);
    const [loadingConnectors, setLoadingConnectors] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [connectorsFetchError, setConnectorsFetchError] = useState<string | null>(null);
    const [selectedConnector, setSelectedConnector] = useState<any>(null);
    const [credentialValues, setCredentialValues] = useState<Record<string, string>>({});
    const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
    const [useCNPJ, setUseCNPJ] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [connectionError, setConnectionError] = useState<string | null>(null);
    const [connectionProgress, setConnectionProgress] = useState(0);
    const [connectionStatusText, setConnectionStatusText] = useState('');
    const [pendingItemId, setPendingItemId] = useState<string | null>(null);

    // ====================== NOVOS ESTADOS - MINI BOTTOM MODAL CPF ======================
    const [showCpfModal, setShowCpfModal] = useState(false);
    const [cpfInput, setCpfInput] = useState('');
    const [cpfConnector, setCpfConnector] = useState<any>(null);
    const [cpfModalStep, setCpfModalStep] = useState<'cpf' | 'confirm'>('cpf');
    const confirmLogoScale = useRef(new Animated.Value(0)).current;
    const confirmLogoOpacity = useRef(new Animated.Value(0)).current;
    const keyboardHeight = useRef(new Animated.Value(0)).current;

    // Keyboard listener para o modal CPF subir com o teclado
    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const showSub = Keyboard.addListener(showEvent, (e) => {
            if (showCpfModal) {
                Animated.timing(keyboardHeight, {
                    toValue: e.endCoordinates.height,
                    duration: Platform.OS === 'ios' ? 250 : 100,
                    useNativeDriver: false,
                }).start();
            }
        });
        const hideSub = Keyboard.addListener(hideEvent, () => {
            Animated.timing(keyboardHeight, {
                toValue: 0,
                duration: Platform.OS === 'ios' ? 250 : 100,
                useNativeDriver: false,
            }).start();
        });

        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, [showCpfModal]);

    // ====================== REFS ======================
    const lastApiHealthCheckRef = useRef(0);
    const [apiBaseUrl, setApiBaseUrl] = useState(API_BASE_URL_FALLBACKS[0] || RAILWAY_FALLBACK_API_URL);
    const pendingItemIdRef = useRef<string | null>(null);
    const openedOAuthUrlRef = useRef(false);
    const isRestoringPendingRef = useRef(false);

    useEffect(() => { pendingItemIdRef.current = pendingItemId; }, [pendingItemId]);

    const clearPersistedOpenFinanceState = useCallback(async () => {
        await Promise.all([
            openFinanceConnectionState.clearPendingConnection(),
            openFinanceConnectionState.clearCallbackPayload(),
            openFinanceConnectionState.clearBackgroundSync()
        ]);
    }, []);

    const savePendingConnectionState = useCallback(async (itemId: string, connector?: any, syncPhase?: string) => {
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
        // Também salva estado de background sync
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
                    pendingState?.connector?.name || 'Banco', false, 'O banco recusou a conexão.'
                ).catch(() => null);
                setTimeout(() => setConnectionStep('info'), 5000);
                return;
            }
            if (!restoredItemId) return;
            // Verificar se já tem polling ativo para evitar duplicação
            if (pendingItemIdRef.current === restoredItemId && ['connecting', 'oauth_pending'].includes(connectionStep)) {
                return;
            }
            if (!selectedConnector && (pendingState?.connector || bgSync)) {
                setSelectedConnector(pendingState?.connector || bgSync);
            }
            setPendingItemId(restoredItemId);
            setIsModalVisible(false);
            // Restaurar na fase correta baseado no estado salvo
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
    }, [clearPersistedOpenFinanceState, connectionStep, selectedConnector, user]);

    // ====================== API RESOLVER ======================
    const resolveReachableApiBaseUrl = useCallback(async (): Promise<string> => {
        const now = Date.now();
        if ((now - lastApiHealthCheckRef.current) < API_HEALTH_CACHE_TTL_MS) return apiBaseUrl;
        const candidates = [apiBaseUrl, ...API_BASE_URL_FALLBACKS.filter((url) => url !== apiBaseUrl)];
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

    const apiFetch = useCallback(async (path: string, options: RequestInit & { timeout?: number } = {}) => {
        const resolved = await resolveReachableApiBaseUrl();
        return fetchWithTimeout(`${resolved}${path}`, { ...options, timeout: options.timeout ?? API_DEFAULT_TIMEOUT_MS });
    }, [resolveReachableApiBaseUrl]);

    // ====================== EFEITOS ======================
    useEffect(() => {
        if (!loading) return;
        const interval = setInterval(() => setLoadingDots(p => p === '...' ? '' : p + '.'), 500);
        return () => clearInterval(interval);
    }, [loading]);

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

    // ====================== HANDLE TOGGLE VISIBILITY ======================
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
            setDataRefreshKey(prev => prev + 1);
        } catch (error) {
            console.error('handleToggleVisibility error:', error);
            showError('Erro', 'Não foi possível alterar a visibilidade da conta.');
        }
    }, [user, profile, refreshProfile, showError]);

    // ====================== FUNÇÕES ======================
    const fetchAccounts = async () => {
        if (!user) return;
        try {
            const result = await databaseService.getAccounts(user.uid);
            if (result.success && result.data) {
                setAccounts(result.data);
                setDataRefreshKey(p => p + 1);
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
            if (event.url.includes('open-finance') || event.url.includes('pluggy') || event.url.includes('oauth-callback')) {
                handleOAuthCallback(event.url);
            }
        });
        Linking.getInitialURL().then((url) => {
            if (url && (url.includes('open-finance') || url.includes('pluggy') || url.includes('oauth-callback'))) {
                handleOAuthCallback(url);
            }
        });
        return () => subscription.remove();
    }, [handleOAuthCallback]);

    // Helper: nome do banco ativo para notificações
    const getActiveConnectorName = useCallback(() => {
        return selectedConnector?.name || cpfConnector?.name || 'Banco';
    }, [selectedConnector, cpfConnector]);

    // Polling OAuth & Sync — COM SUPORTE A BACKGROUND + NOTIFICAÇÃO
    useEffect(() => {
        if (!['oauth_pending', 'connecting'].includes(connectionStep) || !pendingItemId || !user) return;
        let pollCount = 0;
        const maxPolls = 180;
        let cancelled = false;
        let intervalId: ReturnType<typeof setInterval> | null = null;
        const bankName = getActiveConnectorName();

        // Atualiza estado de background sync a cada poll
        const updateBgPhase = (phase: string) => {
            openFinanceConnectionState.updateBackgroundSyncPhase(phase as any).catch(() => null);
            openFinanceConnectionState.updateSyncPhase(phase as any).catch(() => null);
        };

        const checkStatus = async () => {
            if (cancelled) return;
            pollCount++;
            // Keepalive no background sync
            updateBgPhase('polling');
            try {
                const token = await user.getIdToken();
                const response = await apiFetch(`/api/pluggy/items/${pendingItemId}`, {
                    headers: { 'Authorization': `Bearer ${token}` },
                    timeout: 15000
                });
                if (response.ok) {
                    const data = await response.json();
                    const item = data.item || data;
                    const status = item.status;
                    const normalizedStatus = String(status || '').toUpperCase();
                    const clientUrl = getItemOAuthUrl(item);

                    if (normalizedStatus === 'WAITING_USER_INPUT' && clientUrl && !openedOAuthUrlRef.current) {
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
                            notificationService.sendSyncCompleteNotification(bankName, false, 'Não foi possível abrir a autorização.').catch(() => null);
                            setTimeout(() => setConnectionStep('info'), 5000);
                            return;
                        }
                    }
                    if (normalizedStatus === 'WAITING_USER_INPUT') {
                        setConnectionStep('oauth_pending');
                        setConnectionProgress((previous) => (previous < 35 ? 35 : previous));
                        setConnectionStatusText(clientUrl
                            ? 'Abra o app do banco para aprovar a conexão.'
                            : 'Aguardando você concluir a autorização no banco...');
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
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token2}` },
                            body: JSON.stringify({ itemId: pendingItemId, autoRefresh: true, fullHistory: true }),
                            timeout: 240000
                        });
                        if (syncResponse.ok) {
                            let syncData = await syncResponse.json();
                            let totalTx = syncData.accounts?.reduce((acc: any, a: any) => acc + (a.transactions?.length || 0), 0) || 0;
                            if (totalTx === 0 && syncData.accounts?.length > 0) {
                                setConnectionStatusText('O banco ainda está processando seu extrato. Tentando novamente...');
                                await new Promise(resolve => setTimeout(resolve, 3000));
                                const retryResponse = await apiFetch('/api/pluggy/sync', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token2}` },
                                    body: JSON.stringify({ itemId: pendingItemId, autoRefresh: true, fullHistory: true }),
                                    timeout: 240000
                                });
                                if (retryResponse.ok) {
                                    syncData = await retryResponse.json();
                                    totalTx = syncData.accounts?.reduce((acc: any, a: any) => acc + (a.transactions?.length || 0), 0) || 0;
                                }
                            }
                            setConnectionProgress(80);
                            updateBgPhase('saving');
                            if (syncData.accounts && syncData.accounts.length > 0) {
                                setConnectionStatusText(`Organizando ${syncData.accounts.length} contas...`);
                                await Promise.all(
                                    syncData.accounts.map((account: any) =>
                                        databaseService.saveAccount(user.uid, account, syncData.connector || selectedConnector)
                                    )
                                );
                                setConnectionStatusText(`Salvando ${totalTx} transações...`);
                                await databaseService.saveOpenFinanceTransactions(user.uid, syncData.accounts, syncData.connector || selectedConnector);
                            }
                            setConnectionProgress(100);
                            setConnectionStatusText('Sincronização concluída com sucesso!');
                            setConnectionStep('success');
                            setPendingItemId(null);
                            setIsModalVisible(false);
                            await clearPersistedOpenFinanceState();
                            // 🔔 Notificação de sucesso
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
                            // 🔔 Notificação de erro
                            notificationService.sendSyncCompleteNotification(bankName, false, errMsg).catch(() => null);
                            setTimeout(() => setConnectionStep('info'), 5000);
                            return;
                        }
                        return;
                    }
                    if (normalizedStatus === 'UPDATING') {
                        setConnectionStep('connecting');
                        setConnectionProgress((previous) => (previous < 50 ? 50 : previous));
                        setConnectionStatusText('O banco autorizou. Extraindo dados...');
                        updateBgPhase('syncing');
                        return;
                    }
                    if (normalizedStatus === 'LOGIN_ERROR' || normalizedStatus === 'OUTDATED' || normalizedStatus === 'ERROR') {
                        cancelled = true;
                        if (intervalId) clearInterval(intervalId);
                        const resolvedError = buildPluggyConnectionErrorMessage(item);
                        setConnectionError(resolvedError);
                        setConnectionStep('error');
                        setPendingItemId(null);
                        setIsModalVisible(false);
                        await clearPersistedOpenFinanceState();
                        // 🔔 Notificação de erro
                        notificationService.sendSyncCompleteNotification(bankName, false, resolvedError).catch(() => null);
                        setTimeout(() => setConnectionStep('info'), 5000);
                        return;
                    }
                } else {
                    const errPayload = await response.json().catch(() => null);
                    cancelled = true;
                    if (intervalId) clearInterval(intervalId);
                    const errMsg = errPayload?.error || `Falha ao consultar status da conexão (HTTP ${response.status}).`;
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
                notificationService.sendSyncCompleteNotification(bankName, false, 'Tempo expirado aguardando o banco.').catch(() => null);
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
        user
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
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
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
        } catch (error) {
            const msg = isNetworkTransportError(error) ? getApiConnectionErrorMessage(error instanceof Error ? error.message : undefined) : (error instanceof Error ? error.message : 'Não foi possível carregar os bancos.');
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
        const isActiveConnection = ['connecting', 'oauth_pending'].includes(connectionStep) && pendingItemId;

        openedOAuthUrlRef.current = false;
        setIsModalVisible(false);
        setShowCpfModal(false);
        setCpfInput('');
        setCpfConnector(null);
        setSearchQuery('');
        setConnectorsFetchError(null);

        if (isActiveConnection) {
            // ✅ NÃO cancela a conexão — continua em segundo plano
            // O polling continua rodando e o banner inline mostra o progresso
            return;
        }

        // Só reseta tudo se NÃO há conexão ativa
        setConnectionStep('banks');
        setSelectedConnector(null);
        setCredentialValues({});
        setConnectionError(null);
        setUseCNPJ(false);
        setConnectionStatusText('');
        setPendingItemId(null);
        clearPersistedOpenFinanceState().catch(() => null);
    };

    // ====================== NOVA FUNÇÃO - SELECIONAR BANCO → MINI BOTTOM MODAL CPF ======================
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

        // Transiciona para tela de confirmação
        Keyboard.dismiss();
        setCpfModalStep('confirm');

        // Animação da logo
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

        // Encontra o campo de documento (CPF/CNPJ) automaticamente
        const creds = cpfConnector.credentials || [];
        const documentCred = creds.find((c: any) => credentialHasCpf(c) || credentialHasCnpj(c));
        const credName = documentCred ? documentCred.name : (creds[0]?.name || 'document');

        // Em vez de aguardar o state do React, construímos as credenciais para o HandleConnect localmente
        const credentialsPayload = { [credName]: cpfInput };
        setCredentialValues(credentialsPayload);

        setShowCpfModal(false);
        setIsModalVisible(false); // Fecha o modal para mostrar direto no banner
        setConnectionStep('connecting');

        // Pequeno delay para a animação do modal sumir antes de enviar via rede
        setTimeout(() => {
            handleConnect(credentialsPayload, cpfConnector);
        }, 100);
    };

    const handleRequestDelete = (group: any) => {
        setItemToDelete(group);
        setDeleteModalVisible(true);
    };

    const handleConfirmDelete = async () => {
        if (!user || !itemToDelete) return;
        setLoading(true);
        setDeleteModalVisible(false);
        try {
            const accountIds = (itemToDelete.accounts || []).map((acc: any) => acc?.id).filter(Boolean);
            await databaseService.deleteOpenFinanceConnection(user.uid, accountIds);
            await fetchAccounts();
            setItemToDelete(null);
        } catch (error) {
            Alert.alert('Erro', 'Não foi possível desconectar.');
        } finally {
            setLoading(false);
        }
    };

    const handleSyncBank = async (group: any, onStatusUpdate: (status: SyncStatus) => void) => {
        if (!user) return;
        const accountWithItem = (group.accounts || []).find((account: any) => account?.pluggyItemId || account?.itemId);
        const itemId = accountWithItem?.pluggyItemId || accountWithItem?.itemId || null;
        if (!itemId) {
            onStatusUpdate({ step: 'error', message: 'Item ID ausente', progress: 0 });
            setTimeout(() => onStatusUpdate({ step: 'idle', message: '', progress: 0 }), 3000);
            return;
        }
        try {
            onStatusUpdate({ step: 'connecting', message: 'Atualizando no banco...', progress: 10 });
            const token = await user.getIdToken();
            const refreshResponse = await apiFetch(`/api/pluggy/force-refresh/${itemId}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!refreshResponse.ok) {
                const refreshError = await refreshResponse.json().catch(() => null);
                throw new Error(refreshError?.error || 'Falha ao iniciar atualização no banco.');
            }

            onStatusUpdate({ step: 'connecting', message: 'Aguardando atualização do banco...', progress: 20 });

            const maxPollAttempts = 20;
            let itemUpdated = false;
            for (let attempt = 1; attempt <= maxPollAttempts; attempt++) {
                const statusResponse = await apiFetch(`/api/pluggy/items/${itemId}`, {
                    headers: { 'Authorization': `Bearer ${token}` },
                    timeout: 15000
                });

                if (!statusResponse.ok) {
                    const statusError = await statusResponse.json().catch(() => null);
                    throw new Error(statusError?.error || 'Falha ao consultar status da atualização.');
                }

                const statusData = await statusResponse.json().catch(() => null);
                const item = statusData?.item || statusData;
                const normalizedStatus = String(item?.status || '').toUpperCase();

                if (normalizedStatus === 'UPDATED') {
                    itemUpdated = true;
                    break;
                }

                if (normalizedStatus === 'LOGIN_ERROR' || normalizedStatus === 'OUTDATED' || normalizedStatus === 'ERROR') {
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
                    await new Promise((resolve) => setTimeout(resolve, 3000));
                }
            }

            if (!itemUpdated) {
                throw new Error('Tempo de atualização do banco expirou. Tente sincronizar novamente em instantes.');
            }

            onStatusUpdate({ step: 'fetching_accounts', message: 'Buscando dados atualizados...', progress: 40 });

            const syncResponse = await apiFetch('/api/pluggy/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ itemId, autoRefresh: false }),
                timeout: 240000
            });
            if (syncResponse.ok) {
                const syncData = await syncResponse.json();
                onStatusUpdate({ step: 'fetching_accounts', message: `${syncData.accounts?.length || 0} contas`, progress: 50 });
                if (syncData.accounts?.length) {
                    onStatusUpdate({ step: 'fetching_accounts', message: 'Organizando contas...', progress: 65 });
                    await Promise.all(
                        syncData.accounts.map((account: any) =>
                            databaseService.saveAccount(user.uid, account, syncData.connector || group.connector)
                        )
                    );
                    await databaseService.saveOpenFinanceTransactions(user.uid, syncData.accounts, syncData.connector || group.connector);
                }
                onStatusUpdate({ step: 'done', message: 'Sincronizado!', progress: 100 });
                setTimeout(() => onStatusUpdate({ step: 'idle', message: '', progress: 0 }), 3000);
                fetchAccounts();
            } else {
                const errData = await syncResponse.json().catch(() => null);
                throw new Error(errData?.error || 'Falha na resposta do servidor');
            }
        } catch (error: any) {
            onStatusUpdate({ step: 'error', message: error.message || 'Erro na sincronização', progress: 0 });
        }
    };

    const handleConnect = async (customCredentials?: Record<string, string>, customConnector?: any) => {
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

        const creditResult = await consumeCredit('connect');
        if (!creditResult.success) {
            showError('Erro', creditResult.error || 'Erro ao consumir crédito.');
            return;
        }

        setConnecting(true);
        setIsModalVisible(false);
        setConnectionStep('connecting');
        setConnectionProgress(5);
        setConnectionStatusText('Criando conexão com o banco...');

        const sanitizedCredentials = { ...credsToUse };
        connectorCredentials.filter(isDocumentCredential).forEach((cred: any) => {
            if (sanitizedCredentials[cred.name]) sanitizedCredentials[cred.name] = sanitizedCredentials[cred.name].replace(/\D/g, '');
        });

        openedOAuthUrlRef.current = false;

        try {
            const token = await user.getIdToken();
            const createResponse = await apiFetch('/api/pluggy/create-item', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    connectorId: currentConnector.id,
                    credentials: sanitizedCredentials,
                    appRedirectUri: OAUTH_REDIRECT_URI,
                    oauthRedirectUri: OAUTH_REDIRECT_URI,
                    webhookUrl: BACKEND_WEBHOOK_URL
                }),
                timeout: 90000
            });

            const createData = await createResponse.json();
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

                    // Pequeno delay para exibir o status no modal antes de minimizar o app
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

    const filteredConnectors = connectors.filter(connector => connector.name.toLowerCase().includes(searchQuery.toLowerCase()));

    const sortedConnectors = [...connectors].sort((a, b) => {
        const priorityA = getBankPriority(a.name);
        const priorityB = getBankPriority(b.name);
        if (priorityA === priorityB) {
            return a.name.localeCompare(b.name);
        }
        return priorityA - priorityB;
    });

    const displayConnectors = searchQuery.trim() === '' ? sortedConnectors.slice(0, 15) : filteredConnectors;

    const shouldShowConnectorsNetworkError = !loadingConnectors && displayConnectors.length === 0 && Boolean(connectorsFetchError);

    // Filtra duplicatas de contas corrente (mesmo final, removendo as zeradas)
    const filteredAccounts = useMemo(() => {
        const checkingGroups: Record<string, any[]> = {};
        const otherAccounts: any[] = [];

        accounts.forEach(acc => {
            // Verifica se é Conta Corrente
            const isChecking = acc.type === 'BANK' || acc.subtype === 'CHECKING_ACCOUNT';

            if (isChecking && acc.number) {
                const connectorId = acc.connector?.id || acc.connectorId || 'unknown';
                // Usa os últimos 4 dígitos pois o usuário mencionou "mesmo final"
                const cleanNumber = String(acc.number).replace(/\D/g, '');
                const last4 = cleanNumber.slice(-4);

                // Se não tiver número válido, trata como único
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

        const bestCheckingAccounts = Object.values(checkingGroups).map(group => {
            if (group.length === 1) return group[0];

            // Ordena por magnitude do saldo decrescente para manter a conta com valor
            // Isso resolve o caso "uma zerada e outra com valor"
            group.sort((a, b) => Math.abs(b.balance || 0) - Math.abs(a.balance || 0));

            // Retorna a primeira (maior magnitude de saldo)
            return group[0];
        });

        return [...otherAccounts, ...bestCheckingAccounts];
    }, [accounts]);

    const groupedAccounts = filteredAccounts.reduce((acc, account) => {
        const connectorName = account.connector?.name || account.name || 'Outros';
        if (!acc[connectorName]) acc[connectorName] = { connector: account.connector, accounts: [] };
        acc[connectorName].accounts.push(account);
        return acc;
    }, {} as Record<string, any>);

    const renderModalContent = () => {
        switch (connectionStep) {
            case 'banks':
                if (loadingConnectors) {
                    return (
                        <View style={[styles.loadingContainer, { minHeight: 400 }]}>
                            <LottieView source={require('@/assets/carregando.json')} autoPlay loop style={{ width: 50, height: 50 }} />
                            <Text style={styles.loadingText}>Carregando bancos...</Text>
                        </View>
                    );
                }
                if (shouldShowConnectorsNetworkError) {
                    return (
                        <View style={styles.connectorsErrorContainer}>
                            <Text style={styles.connectorsErrorTitle}>Falha na comunicação</Text>
                            <Text style={styles.connectorsErrorText}>{connectorsFetchError}</Text>
                            <TouchableOpacity style={styles.connectorsRetryButton} onPress={fetchConnectors} activeOpacity={0.8}>
                                <Text style={styles.connectorsRetryButtonText}>Tentar novamente</Text>
                            </TouchableOpacity>
                        </View>
                    );
                }
            default:
                // Only render banks list, if it's another step the modal is closing anyway
                return (
                    <ScrollView
                        style={styles.banksListContainer}
                        contentContainerStyle={styles.banksListContent}
                    >
                        {displayConnectors.length === 0 ? (
                            <Text style={[styles.emptyText, { padding: 20 }]}>Nenhum banco encontrado</Text>
                        ) : (
                            displayConnectors.map((item) => (
                                <ConnectorCard key={item.id.toString()} item={item} onSelect={handleSelectConnector} styles={styles} />
                            ))
                        )}
                    </ScrollView>
                );
        }
    };

    return (
        <View style={styles.mainContainer}>
            <UniversalBackground backgroundColor="#0C0C0C" glowSize={350} height={320} showParticles={true} particleCount={15} />

            <View style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.title}>Contas Bancárias</Text>
                    <View style={styles.headerRight}>
                        {user && <SyncCreditsDisplay userId={user.uid} compact onConnect={handleOpenModal} connectDisabled={!hasCredits} />}
                    </View>
                </View>

                <View style={styles.content}>
                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <LottieView source={require('@/assets/carregando.json')} autoPlay loop style={{ width: 50, height: 50 }} />
                            <Text style={styles.loadingText}>Carregando contas{loadingDots}</Text>
                        </View>
                    ) : (
                        <ScrollView
                            style={styles.accountsScroll}
                            contentContainerStyle={styles.accountsScrollContent}
                            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#D97757" />}
                        >
                            {accounts.length === 0 ? (
                                <View style={styles.emptyState}>
                                    <DelayedLoopLottie source={require('@/assets/banco.json')} style={{ width: 100, height: 100 }} delay={3000} initialDelay={100} jitterRatio={0.2} renderMode="HARDWARE" />
                                    <Text style={styles.emptyTitle}>Nenhuma conta conectada</Text>
                                    <Text style={styles.emptyText}>Conecte suas contas bancárias para usar o poder do Open Finance.</Text>
                                </View>
                            ) : (
                                Object.values(groupedAccounts).map((group: any, index) => {
                                    const groupItemId = group.accounts?.[0]?.pluggyItemId || group.accounts?.[0]?.itemId || group.connector?.id || `bank-${index}`;
                                    return (
                                        <ConnectedBankCard
                                            key={`${groupItemId}-${dataRefreshKey}`}
                                            group={group}
                                            onDelete={handleRequestDelete}
                                            onSync={handleSyncBank}
                                            hasCredits={hasCredits}
                                            canSyncItem={canSyncItem}
                                            onConsumeCredit={consumeCredit}
                                            hiddenAccountIds={(profile?.preferences as any)?.hiddenAccountIds}
                                            onToggleVisibility={handleToggleVisibility}
                                        />
                                    );
                                })
                            )}
                        </ScrollView>
                    )}
                </View>

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
                        connectionStep === 'banks' ? 'Selecione o seu banco' :
                            connectionStep === 'connecting' ? 'Conectando' :
                                connectionStep === 'oauth_pending' ? 'Autorização' :
                                    connectionStep === 'success' ? 'Sucesso!' : 'Erro'
                    }
                    subtitle={
                        connectionStep === 'banks' ? 'Escolha a instituição que deseja conectar' : undefined
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
                            <View style={styles.searchContainer}>
                                <Search size={18} color="#666" />
                                <TextInput
                                    style={styles.searchInput}
                                    placeholder="Buscar banco..."
                                    placeholderTextColor="#666"
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                    clearButtonMode="never"
                                />
                            </View>
                        ) : undefined
                    }
                    overlayElement={
                        showCpfModal ? (
                            <View style={styles.cpfOverlay}>
                                <BlurView intensity={80} tint="dark" experimentalBlurMethod="dimezisBlurView" style={StyleSheet.absoluteFill} />
                                <TouchableOpacity style={styles.bottomModalBackdrop} activeOpacity={1} onPress={() => setShowCpfModal(false)} />
                                <Animated.View style={[styles.bottomModalContent, { paddingBottom: Animated.add(Platform.OS === 'ios' ? 48 : 32, keyboardHeight) }]}>
                                    {cpfModalStep === 'cpf' ? (
                                        <>
                                            <View style={styles.bottomModalHeader}>
                                                <Text style={styles.bottomModalTitle}>Confirme seu CPF</Text>
                                                <TouchableOpacity onPress={() => setShowCpfModal(false)}>
                                                    <X size={24} color="#8E8E93" />
                                                </TouchableOpacity>
                                            </View>

                                            <Text style={styles.bottomModalSubtitle}>
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

                                            <TouchableOpacity
                                                style={[styles.continuarButton, cpfInput.replace(/\D/g, '').length !== 11 && styles.continuarButtonDisabled]}
                                                onPress={handleConfirmCpf}
                                                activeOpacity={0.85}
                                                disabled={cpfInput.replace(/\D/g, '').length !== 11}
                                            >
                                                <Text style={styles.continuarButtonText}>Continuar</Text>
                                            </TouchableOpacity>
                                        </>
                                    ) : (
                                        <>
                                            <View style={styles.bottomModalHeader}>
                                                <Text style={styles.bottomModalTitle}>Confirmar conexão</Text>
                                                <TouchableOpacity onPress={() => setCpfModalStep('cpf')}>
                                                    <X size={24} color="#8E8E93" />
                                                </TouchableOpacity>
                                            </View>

                                            <View style={styles.confirmLogosRow}>
                                                <Animated.View style={[styles.confirmLogoCircle, { transform: [{ scale: confirmLogoScale }], opacity: confirmLogoOpacity }]}>
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

                                                <Animated.View style={[styles.confirmDashedLineContainer, { opacity: confirmLogoOpacity }]}>
                                                    <View style={styles.confirmDashedLine} />
                                                </Animated.View>

                                                <Animated.View style={[styles.confirmAppLogoCircle, { transform: [{ scale: confirmLogoScale }], opacity: confirmLogoOpacity }]}>
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
                                                    <Text style={styles.confirmSummaryValue}>{cpfConnector?.name || 'Banco'}</Text>
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
                                                    <Text style={styles.confirmSummaryValue}>Contas e transações</Text>
                                                </View>
                                            </View>

                                            <Text style={styles.confirmDisclaimer}>
                                                Ao confirmar, seus dados serão sincronizados de forma segura via Open Finance.
                                            </Text>

                                            <TouchableOpacity
                                                style={styles.confirmConnectButton}
                                                onPress={handleStartConnection}
                                                activeOpacity={0.85}
                                            >
                                                <Text style={styles.confirmConnectButtonText}>Conectar ao {cpfConnector?.name || 'banco'}</Text>
                                            </TouchableOpacity>
                                        </>
                                    )}
                                </Animated.View>
                            </View>
                        ) : undefined
                    }
                >
                    {renderModalContent()}
                </ConnectAccountModal>

                {/* INLINE BOTTOM NAV BAR BANNER */}
                <AnimatedInlineBanner
                    show={['connecting', 'oauth_pending', 'success', 'error'].includes(connectionStep) && !isModalVisible}
                    step={connectionStep}
                    error={connectionError}
                    statusText={connectionStatusText}
                />
            </View>
        </View>
    );
}

// ====================== HELPERS ======================
const getBankPriority = (name: string): number => {
    return 0;
};

const formatCPF = (value: string) => value.replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4').slice(0, 14);

const credentialHasCpf = (cred: any) => /cpf|documento/i.test(cred.label || cred.name || '');
const credentialHasCnpj = (cred: any) => /cnpj/i.test(cred.label || cred.name || '');
const isDocumentCredential = (cred: any) => credentialHasCpf(cred) || credentialHasCnpj(cred);

const getConnectorDocumentSupport = (credentials: any[]) => {
    const hasCpf = credentials.some(credentialHasCpf);
    const hasCnpj = credentials.some(credentialHasCnpj);
    return { acceptsBothDocuments: hasCpf && hasCnpj };
};

// ====================== COMPONENTE ConnectorCard ======================
const ConnectorCard = ({ item, onSelect, styles }: any) => (
    <TouchableOpacity onPress={() => onSelect(item)} style={styles.bankListRow} activeOpacity={0.7}>
        <View style={styles.bankListLogoContainer}>
            <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center' }}>
                <BankConnectorLogo
                    connector={item}
                    size={28}
                    borderRadius={14}
                    backgroundColor="transparent"
                    showBorder={false}
                />
            </View>
        </View>
        <Text style={styles.bankRowTitle}>{item.name}</Text>
        <ChevronRight size={20} color="#555" />
    </TouchableOpacity>
);

const styles = StyleSheet.create({
    mainContainer: { flex: 1, backgroundColor: '#0C0C0C' },
    container: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, paddingTop: 60, paddingHorizontal: 20, zIndex: 10 },
    header: { marginBottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    title: { fontSize: 24, fontWeight: '700', color: '#FFFFFF' },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    content: { flex: 1 },
    banksListContainer: { flex: 1, marginTop: 10 },
    banksListContent: { paddingBottom: 40 },
    connectorsErrorContainer: { backgroundColor: '#1A1A1A', borderRadius: 16, borderWidth: 1, borderColor: '#2A2A2A', padding: 16, alignItems: 'center' },
    connectorsErrorTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', textAlign: 'center' },
    connectorsErrorText: { color: '#909090', fontSize: 14, textAlign: 'center', lineHeight: 20, marginTop: 8 },
    connectorsRetryButton: { backgroundColor: '#D97757', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, marginTop: 16, alignItems: 'center', width: '100%' },
    connectorsRetryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
    bankListRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 20 },
    bankListLogoContainer: { marginRight: 12 },
    bankListSeparator: { height: 1, backgroundColor: '#2A2A2A', width: '100%' },
    bankRowTitle: { flex: 1, fontSize: 16, color: '#FFFFFF', fontWeight: '500' },
    statusContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, minHeight: 400 },
    statusIconContainer: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
    statusTitle: { color: '#FFFFFF', fontSize: 24, fontWeight: '600', marginBottom: 12, textAlign: 'center' },
    statusText: { color: '#909090', fontSize: 16, textAlign: 'center', lineHeight: 24, marginBottom: 24 },
    stepContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 12, marginTop: 24, width: '100%' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
    loadingText: { color: '#909090', fontSize: 14 },
    emptyText: { color: '#888', textAlign: 'center', fontSize: 14, lineHeight: 20, maxWidth: 280 },
    accountsScroll: { flex: 1 },
    accountsScrollContent: { paddingBottom: 20 },
    emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 80, paddingHorizontal: 40 },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', marginTop: 20, marginBottom: 8, textAlign: 'center' },
    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A1A', borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: '#2A2A2A', height: 48, width: '100%' },
    searchInput: { flex: 1, color: '#FFFFFF', fontSize: 16, paddingVertical: 12, marginLeft: 8 },

    // ====================== CPF OVERLAY STYLES ======================
    cpfOverlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 999,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    bottomModalBackdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    bottomModalContent: {
        backgroundColor: '#1A1A1A',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingHorizontal: 24,
        paddingTop: 24,
        paddingBottom: Platform.OS === 'ios' ? 48 : 32,
    },
    bottomModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    bottomModalTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    bottomModalSubtitle: {
        fontSize: 14,
        color: '#8E8E93',
        textAlign: 'left',
        marginBottom: 20,
        lineHeight: 20,
    },
    cpfSectionCard: {
        backgroundColor: '#1A1A1A',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#2A2A2A',
        marginBottom: 20,
    },
    cpfInput: {
        color: '#FFFFFF',
        fontSize: 16,
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    continuarButton: {
        backgroundColor: '#D97757',
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
    },
    continuarButtonDisabled: {
        opacity: 0.5,
    },
    continuarButtonText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '600',
    },

    // ====================== CONFIRM STEP STYLES ======================
    confirmLogosRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: 24,
        gap: 0,
    },
    confirmLogoCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    confirmLogoInner: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    confirmDashedLineContainer: {
        width: 50,
        height: 2,
        justifyContent: 'center',
        alignItems: 'center',
    },
    confirmDashedLine: {
        width: '100%',
        height: 2,
        borderStyle: 'dashed',
        borderWidth: 1,
        borderColor: '#D97757',
        borderRadius: 1,
    },
    confirmAppLogoCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(217, 119, 87, 0.12)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    confirmAppLogoImage: {
        width: 40,
        height: 40,
        borderRadius: 20,
    },
    confirmSummaryCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
    },
    confirmSummaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    confirmSummaryLabel: {
        fontSize: 14,
        color: '#8E8E93',
    },
    confirmSummaryValue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    confirmSummarySeparator: {
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        marginVertical: 12,
    },
    confirmDisclaimer: {
        fontSize: 12,
        color: '#8E8E93',
        textAlign: 'center',
        lineHeight: 16,
        marginBottom: 24,
    },
    confirmConnectButton: {
        backgroundColor: '#D97757',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    confirmConnectButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },

    // ====================== DYNAMIC ISLAND STYLES ======================
    dynamicIslandContainer: {
        position: 'absolute',
        alignSelf: 'center',
        zIndex: 5,
    },
    dynamicIsland: {
        backgroundColor: '#141414',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        borderWidth: 1,
        borderBottomWidth: 0,
        borderColor: 'rgba(255, 255, 255, 0.12)',
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        minWidth: 180,
        gap: 8,
    },
    dynamicIslandError: {
        backgroundColor: 'rgba(239, 68, 68, 0.08)',
        borderColor: 'rgba(239, 68, 68, 0.3)',
    },
    dynamicIslandSuccess: {
        backgroundColor: 'rgba(102, 187, 106, 0.08)',
        borderColor: 'rgba(102, 187, 106, 0.3)',
    },
    dynamicIslandText: {
        color: '#66BB6A',
        fontSize: 13,
        fontWeight: '500',
    },
    actionButton: { backgroundColor: '#D97757', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 10 },
    actionButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' }
});
