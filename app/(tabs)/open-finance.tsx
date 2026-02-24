// OpenFinanceScreen.tsx - VERSÃO COM REDIRECIONAMENTO E SYNC CORRIGIDOS

import { ConnectAccountModal } from '@/components/ConnectAccountModal';
import { UniversalBackground } from '@/components/UniversalBackground';
import { BankConnectorLogo } from '@/components/open-finance/BankConnectorLogo';
import { ConnectedBankCard, BankSyncStatus as SyncStatus } from '@/components/open-finance/ConnectedBankCard';
import { SyncCreditsDisplay, useSyncCredits } from '@/components/open-finance/SyncCreditsDisplay';
import { DelayedLoopLottie } from '@/components/ui/DelayedLoopLottie';
import { DeleteConfirmationModal } from '@/components/ui/DeleteConfirmationModal';
import { DynamicText } from '@/components/ui/DynamicText';
import { ModernSwitch } from '@/components/ui/ModernSwitch';
import { useAuthContext as useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { API_BASE_URL_CANDIDATES } from '@/services/apiBaseUrl';
import { databaseService } from '@/services/firebase';
import { notificationService } from '@/services/notifications';
import { openFinanceConnectionState } from '@/services/openFinanceConnectionState';
import { getConnectorLogoUrl, normalizeHexColor } from '@/utils/connectorLogo';
import * as Linking from 'expo-linking';
import LottieView from 'lottie-react-native';
import { Eye, EyeOff, Lock, Search, ShieldCheck, User, Zap } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    AppState,
    Dimensions,
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

    // ====================== REFS ======================
    const lastApiHealthCheckRef = useRef(0);
    const [apiBaseUrl, setApiBaseUrl] = useState(API_BASE_URL_FALLBACKS[0] || RAILWAY_FALLBACK_API_URL);
    const pendingItemIdRef = useRef<string | null>(null);
    const openedOAuthUrlRef = useRef(false); // Ref para evitar abrir o banco duplicado
    const isRestoringPendingRef = useRef(false);

    useEffect(() => { pendingItemIdRef.current = pendingItemId; }, [pendingItemId]);

    const clearPersistedOpenFinanceState = useCallback(async () => {
        await Promise.all([
            openFinanceConnectionState.clearPendingConnection(),
            openFinanceConnectionState.clearCallbackPayload()
        ]);
    }, []);

    const savePendingConnectionState = useCallback(async (itemId: string, connector?: any) => {
        await openFinanceConnectionState.savePendingConnection({
            itemId,
            startedAt: Date.now(),
            connector: connector
                ? {
                    id: connector.id,
                    name: connector.name ?? null,
                    primaryColor: connector.primaryColor ?? null,
                    imageUrl: connector.imageUrl ?? null,
                    type: connector.type ?? null
                }
                : null
        });
    }, []);

    const openOAuthUrlSafely = useCallback(async (url: string) => {
        if (!url) throw new Error('URL OAuth não fornecida.');

        const canOpen = await Linking.canOpenURL(url);
        const isWebUrl = /^https?:\/\//i.test(url);
        if (!canOpen && !isWebUrl) {
            throw new Error('Não foi possível abrir o link de autorização do banco.');
        }

        await Linking.openURL(url);
    }, []);

    const extractItemIdFromDeepLink = useCallback((url: string): string | null => {
        try {
            const { queryParams } = Linking.parse(url);
            const rawItemId = queryParams?.itemId;
            if (typeof rawItemId === 'string' && rawItemId.trim()) return rawItemId.trim();
            if (Array.isArray(rawItemId) && rawItemId[0]?.trim()) return rawItemId[0].trim();
        } catch {
            // Ignore parse errors and fallback below.
        }
        return null;
    }, []);

    const restorePendingConnectionIfNeeded = useCallback(async () => {
        if (!user || isRestoringPendingRef.current) return;
        isRestoringPendingRef.current = true;

        try {
            const [pendingState, callbackPayload] = await Promise.all([
                openFinanceConnectionState.getPendingConnection(),
                openFinanceConnectionState.consumeCallbackPayload(),
            ]);

            const callbackItemId = callbackPayload?.itemId?.trim() || null;
            const restoredItemId = callbackItemId || pendingState?.itemId || pendingItemIdRef.current;
            const callbackError = callbackPayload?.error || null;

            if (callbackError) {
                setIsModalVisible(true);
                setConnectionError('O banco recusou a conexão ou ocorreu um erro.');
                setConnectionStep('error');
                setPendingItemId(null);
                await clearPersistedOpenFinanceState();
                return;
            }

            if (!restoredItemId) return;

            if (!selectedConnector && pendingState?.connector) {
                setSelectedConnector(pendingState.connector);
            }

            setPendingItemId(restoredItemId);
            await savePendingConnectionState(restoredItemId, pendingState?.connector || selectedConnector);

            setIsModalVisible(true);
            setConnectionStep('oauth_pending');
            setConnectionProgress(40);
            setConnectionStatusText('Autorização recebida do banco. Finalizando conexão...');
        } finally {
            isRestoringPendingRef.current = false;
        }
    }, [clearPersistedOpenFinanceState, savePendingConnectionState, selectedConnector, user]);

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
            } catch {
                // try next candidate
            }
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
        } catch {
            queryParams = null;
        }
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
            await savePendingConnectionState(itemId, selectedConnector);
        }

        if (callbackError) {
            setConnectionError('O banco recusou a conex�o ou ocorreu um erro.');
            setConnectionStep('error');
            setIsModalVisible(true);
            await clearPersistedOpenFinanceState();
            return;
        }

        if (!itemId || !user) return;

        setIsModalVisible(true);
        setConnectionStep('oauth_pending');
        setConnectionProgress(40);
        setConnectionStatusText('Autoriza��o recebida do banco. Finalizando conex�o...');
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

    // Polling OAuth & Sync
    useEffect(() => {
        // CORREÇÃO: Fazer polling tanto no estado 'connecting' quanto no 'oauth_pending'
        if (!['oauth_pending', 'connecting'].includes(connectionStep) || !pendingItemId || !user) return;

        let pollCount = 0;
        const maxPolls = 180;
        let cancelled = false;
        let intervalId: ReturnType<typeof setInterval> | null = null;

        const checkStatus = async () => {
            if (cancelled) return;
            pollCount++;
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
                    const clientUrl = item.oauthUrl || item.parameter?.oauthUrl || item.userAction?.url;

                    // CORREÇÃO: Redireciona para o banco se a URL aparecer só depois de alguns segundos
                    if (status === 'WAITING_USER_INPUT' && clientUrl && !openedOAuthUrlRef.current) {
                        try {
                            openedOAuthUrlRef.current = true;
                            setConnectionStep('oauth_pending');
                            await openOAuthUrlSafely(clientUrl);
                        } catch (openError: any) {
                            cancelled = true;
                            if (intervalId) clearInterval(intervalId);
                            setConnectionError(openError?.message || 'N�o foi poss�vel abrir a autoriza��o do banco.');
                            setConnectionStep('error');
                            setPendingItemId(null);
                            await clearPersistedOpenFinanceState();
                            return;
                        }
                    }

                    if (status === 'UPDATED') {
                        cancelled = true;
                        if (intervalId) clearInterval(intervalId);
                        setConnectionStep('connecting');
                        setConnectionProgress(60);
                        setConnectionStatusText('Autorização confirmada! Extraindo suas contas e transações...');
                        await new Promise(resolve => setTimeout(resolve, 8000));

                        const token2 = await user.getIdToken();
                        let syncResponse = await apiFetch('/api/pluggy/sync', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token2}` },
                            body: JSON.stringify({ itemId: pendingItemId, autoRefresh: true }),
                            timeout: 240000
                        });

                        if (syncResponse.ok) {
                            let syncData = await syncResponse.json();
                            let totalTx = syncData.accounts?.reduce((acc: any, a: any) => acc + (a.transactions?.length || 0), 0) || 0;

                            if (totalTx === 0 && syncData.accounts?.length > 0) {
                                setConnectionStatusText('O banco está processando seu extrato. Aguarde mais um pouco...');
                                await new Promise(resolve => setTimeout(resolve, 10000));
                                const retryResponse = await apiFetch('/api/pluggy/sync', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token2}` },
                                    body: JSON.stringify({ itemId: pendingItemId, autoRefresh: true }),
                                    timeout: 240000
                                });
                                if (retryResponse.ok) syncData = await retryResponse.json();
                            }

                            setConnectionProgress(80);
                            if (syncData.accounts && syncData.accounts.length > 0) {
                                for (let i = 0; i < syncData.accounts.length; i++) {
                                    const account = syncData.accounts[i];
                                    setConnectionStatusText(`Organizando conta ${i + 1} de ${syncData.accounts.length}...`);
                                    await databaseService.saveAccount(user.uid, account, syncData.connector || selectedConnector);
                                }
                                setConnectionStatusText(`Salvando ${totalTx} transações...`);
                                await databaseService.saveOpenFinanceTransactions(user.uid, syncData.accounts, syncData.connector || selectedConnector);
                            }
                            setConnectionProgress(100);
                            setConnectionStatusText('Sincronização concluída com sucesso!');
                            setConnectionStep('success');
                            setPendingItemId(null);
                            await clearPersistedOpenFinanceState();
                            setTimeout(() => {
                                fetchAccounts();
                                refreshCredits();
                                setIsModalVisible(false);
                                setConnectionStep('info');
                            }, 2500);
                        } else {
                            const errPayload = await syncResponse.json().catch(() => null);
                            cancelled = true;
                            if (intervalId) clearInterval(intervalId);
                            setConnectionError(errPayload?.error || 'Falha ao baixar transa��es do banco.');
                            setConnectionStep('error');
                            setPendingItemId(null);
                            await clearPersistedOpenFinanceState();
                            return;
                        }
                        return;
                    }

                    if (status === 'UPDATING' || status === 'WAITING_USER_INPUT') {
                        if (status === 'UPDATING') {
                            setConnectionProgress((previous) => (previous < 50 ? 50 : previous));
                            setConnectionStatusText('O banco autorizou. Extraindo dados...');
                        }
                        return;
                    }

                    if (status === 'LOGIN_ERROR' || status === 'OUTDATED' || status === 'ERROR') {
                        cancelled = true;
                        if (intervalId) clearInterval(intervalId);
                        setConnectionError(status === 'LOGIN_ERROR' ? 'Acesso negado pelo banco.' : 'Erro ao conectar no banco.');
                        setConnectionStep('error');
                        setPendingItemId(null);
                        await clearPersistedOpenFinanceState();
                    }
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
                await clearPersistedOpenFinanceState();
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
        setConnectionStep('info');
        setSelectedConnector(null);
        setCredentialValues({});
        setConnectorsFetchError(null);
        setConnectionError(null);
        setConnectionStatusText('');
        openFinanceConnectionState.clearCallbackPayload().catch(() => null);
    };

    const handleCloseModal = () => {
        openedOAuthUrlRef.current = false;
        setIsModalVisible(false);
        setConnectionStep('info');
        setSelectedConnector(null);
        setCredentialValues({});
        setConnectorsFetchError(null);
        setConnectionError(null);
        setSearchQuery('');
        setUseCNPJ(false);
        setConnectionStatusText('');
        setPendingItemId(null);
        clearPersistedOpenFinanceState().catch(() => null);
    };

    const handleStartConnection = () => {
        setConnectionStep('banks');
        fetchConnectors();
    };

    const handleSelectConnector = (connector: any) => {
        setSelectedConnector(connector);
        setUseCNPJ(false);
        const initialValues: Record<string, string> = {};
        (connector.credentials || []).forEach((cred: any) => initialValues[cred.name] = '');
        setCredentialValues(initialValues);
        setConnectionStep('credentials');
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

            await apiFetch(`/api/pluggy/force-refresh/${itemId}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const syncResponse = await apiFetch('/api/pluggy/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ itemId, autoRefresh: true }),
                timeout: 240000
            });

            if (syncResponse.ok) {
                const syncData = await syncResponse.json();
                onStatusUpdate({ step: 'fetching_accounts', message: `${syncData.accounts?.length || 0} contas`, progress: 30 });

                if (syncData.accounts?.length) {
                    for (let i = 0; i < syncData.accounts.length; i++) {
                        await databaseService.saveAccount(user.uid, syncData.accounts[i], syncData.connector || group.connector);
                    }
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

    const handleConnect = async () => {
        if (!user || !selectedConnector) return;

        const connectorCredentials = selectedConnector.credentials || [];
        const { acceptsBothDocuments } = getConnectorDocumentSupport(connectorCredentials);

        if (!hasCredits) {
            const resetTime = databaseService.getTimeUntilReset();
            showWarning('Créditos esgotados', `Seus créditos renovam em ${resetTime.formatted}.`);
            return;
        }

        const missingFields = connectorCredentials.filter((cred: any) => !credentialValues[cred.name]?.trim() && (!acceptsBothDocuments || !isDocumentCredential(cred)));
        if (missingFields.length > 0) {
            showError('Campos obrigatórios', 'Preencha todos os campos.');
            return;
        }

        const creditResult = await consumeCredit('connect');
        if (!creditResult.success) {
            showError('Erro', creditResult.error || 'Erro ao consumir crédito.');
            return;
        }

        setConnecting(true);
        setConnectionStep('connecting');
        setConnectionProgress(5);
        setConnectionStatusText('Criando conexão...');

        const sanitizedCredentials = { ...credentialValues };
        connectorCredentials.filter(isDocumentCredential).forEach((cred: any) => {
            if (sanitizedCredentials[cred.name]) sanitizedCredentials[cred.name] = sanitizedCredentials[cred.name].replace(/\D/g, '');
        });

        openedOAuthUrlRef.current = false; // Reset da trava de link duplo

        try {
            const token = await user.getIdToken();
            const createResponse = await apiFetch('/api/pluggy/create-item', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    connectorId: selectedConnector.id,
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
                await clearPersistedOpenFinanceState();
                return;
            }

            const itemId = createData.item?.id;
            if (!itemId) {
                setConnectionError('O servidor n�o retornou o ID da conex�o.');
                setConnectionStep('error');
                setPendingItemId(null);
                await clearPersistedOpenFinanceState();
                return;
            }

            setPendingItemId(itemId);
            await savePendingConnectionState(itemId, selectedConnector);

            // CORREÇÃO: ABRE O APLICATIVO DO BANCO E AGUARDA (Polling)
            if (createData.oauthUrl) {
                try {
                    openedOAuthUrlRef.current = true;
                    setConnectionStep('oauth_pending');
                    setConnectionStatusText('Redirecionando para o banco...');
                    await openOAuthUrlSafely(createData.oauthUrl);
                } catch (openError: any) {
                    setConnectionError(openError?.message || 'N�o foi poss�vel abrir o app do banco.');
                    setConnectionStep('error');
                    setPendingItemId(null);
                    await clearPersistedOpenFinanceState();
                }
            } else {
                setConnectionStep('connecting');
                setConnectionStatusText('Autenticando com o banco...');
            }

        } catch (error: any) {
            setConnectionError(error?.message || 'Erro de conexão na internet');
            setConnectionStep('error');
            setPendingItemId(null);
            await clearPersistedOpenFinanceState();
        } finally {
            setConnecting(false);
        }
    };

    const filteredConnectors = connectors.filter(connector => connector.name.toLowerCase().includes(searchQuery.toLowerCase()));
    const shouldShowConnectorsNetworkError = !loadingConnectors && filteredConnectors.length === 0 && Boolean(connectorsFetchError);

    const groupedAccounts = accounts.reduce((acc, account) => {
        const connectorName = account.connector?.name || account.name || 'Outros';
        if (!acc[connectorName]) acc[connectorName] = { connector: account.connector, accounts: [] };
        acc[connectorName].accounts.push(account);
        return acc;
    }, {} as Record<string, any>);

    const renderModalContent = () => {
        switch (connectionStep) {
            case 'info':
                return (
                    <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
                        <Text style={styles.sectionHeader}>INFORMAÇÕES</Text>
                        <View style={styles.sectionCard}>
                            <View style={styles.itemContainer}>
                                <View style={styles.itemIconContainer}>
                                    <ShieldCheck size={20} color="#04D361" />
                                </View>
                                <View style={styles.itemRightContainer}>
                                    <View style={styles.itemContent}>
                                        <View>
                                            <Text style={styles.itemTitle}>Segurança Bancária</Text>
                                            <Text style={styles.itemSubtitle}>Seus dados são criptografados</Text>
                                        </View>
                                    </View>
                                </View>
                            </View>
                            <View style={styles.separator} />
                            <View style={styles.itemContainer}>
                                <View style={styles.itemIconContainer}>
                                    <Zap size={20} color="#FFD000" />
                                </View>
                                <View style={styles.itemRightContainer}>
                                    <View style={styles.itemContent}>
                                        <View>
                                            <Text style={styles.itemTitle}>Tecnologia Pluggy</Text>
                                            <Text style={styles.itemSubtitle}>Conexão oficial Open Finance</Text>
                                        </View>
                                    </View>
                                </View>
                            </View>
                            <View style={styles.separator} />
                            <View style={styles.itemContainer}>
                                <View style={styles.itemIconContainer}>
                                    <Eye size={20} color="#3B82F6" />
                                </View>
                                <View style={styles.itemRightContainer}>
                                    <View style={styles.itemContent}>
                                        <View>
                                            <Text style={styles.itemTitle}>Apenas Leitura</Text>
                                            <Text style={styles.itemSubtitle}>Sem acesso a movimentações</Text>
                                        </View>
                                    </View>
                                </View>
                            </View>
                            <View style={styles.separator} />
                            <View style={styles.itemContainer}>
                                <View style={styles.itemIconContainer}>
                                    <Lock size={20} color="#8B5CF6" />
                                </View>
                                <View style={styles.itemRightContainer}>
                                    <View style={styles.itemContent}>
                                        <View>
                                            <Text style={styles.itemTitle}>Privacidade Total</Text>
                                            <Text style={styles.itemSubtitle}>Seus dados são criptografados</Text>
                                        </View>
                                    </View>
                                </View>
                            </View>
                        </View>
                    </ScrollView>
                );
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
                return (
                    <View style={styles.banksListContainer}>
                        <View style={styles.banksListContent}>
                            {filteredConnectors.length === 0 ? (
                                <Text style={[styles.emptyText, { padding: 20 }]}>Nenhum banco encontrado</Text>
                            ) : (
                                filteredConnectors.map((item, index) => (
                                    <React.Fragment key={item.id.toString()}>
                                        {index > 0 && <View style={styles.bankListSeparator} />}
                                        <ConnectorCard item={item} onSelect={handleSelectConnector} styles={styles} />
                                    </React.Fragment>
                                ))
                            )}
                        </View>
                    </View>
                );
            case 'credentials':
                const visibleCredentials = (selectedConnector?.credentials || []).filter((cred: any) => {
                    const { acceptsBothDocuments } = getConnectorDocumentSupport(selectedConnector?.credentials);
                    if (!acceptsBothDocuments || !isDocumentCredential(cred)) return true;
                    const isCpfCredential = credentialHasCpf(cred);
                    const isCnpjCredential = credentialHasCnpj(cred);
                    if (isCpfCredential && isCnpjCredential) return true;
                    return useCNPJ ? isCnpjCredential : isCpfCredential;
                });
                const { acceptsBothDocuments } = getConnectorDocumentSupport(selectedConnector?.credentials);
                return (
                    <ScrollView style={styles.modalScroll} contentContainerStyle={styles.credentialsContent} showsVerticalScrollIndicator={false}>
                        <Text style={[styles.sectionHeader, styles.credentialsSectionHeader]}>CREDENCIAIS DE ACESSO</Text>
                        <View style={styles.sectionCard}>
                            <View style={styles.itemContainer}>
                                <View style={[styles.itemIconContainer, { backgroundColor: '#FFFFFF' }]}>
                                    <BankConnectorLogo connector={selectedConnector} size={24} borderRadius={8} iconSize={18} showBorder={false} backgroundColor="transparent" />
                                </View>
                                <View style={styles.itemRightContainer}>
                                    <View style={styles.itemContent}>
                                        <Text style={styles.itemTitle}>Banco</Text>
                                        <Text style={{ color: '#8E8E93', fontSize: 16 }}>{selectedConnector?.name}</Text>
                                    </View>
                                </View>
                            </View>
                            <View style={styles.separator} />
                            {visibleCredentials.map((cred: any, index: number) => {
                                const isCpfCredential = credentialHasCpf(cred);
                                const isCnpjCredential = credentialHasCnpj(cred);
                                const isDocumentField = isCpfCredential || isCnpjCredential;
                                const acceptsBoth = isCpfCredential && isCnpjCredential;
                                let credentialLabel = cred.label;
                                if (isDocumentField && acceptsBoth) credentialLabel = useCNPJ ? 'CNPJ' : 'CPF';
                                return (
                                    <View key={index}>
                                        <View style={[styles.itemContainer, styles.credentialItemContainer]}>
                                            <View style={styles.itemIconContainer}>
                                                {cred.type === 'password' ? <Lock size={18} color="#D97757" /> : <User size={18} color="#D97757" />}
                                            </View>
                                            <View style={styles.itemRightContainer}>
                                                <View style={styles.credentialItemContent}>
                                                    <Text style={[styles.itemTitle, styles.credentialLabel]}>{credentialLabel}</Text>
                                                    <View style={styles.credentialInputContainer}>
                                                        <TextInput
                                                            style={[styles.credentialInput, isDocumentField && styles.credentialCpfInput]}
                                                            placeholder={
                                                                isDocumentField
                                                                    ? (acceptsBoth ? (useCNPJ ? "00.000.000/0000-00" : "000.000.000-00") : (isCnpjCredential ? "00.000.000/0000-00" : "000.000.000-00"))
                                                                    : (cred.placeholder || "Digite...")
                                                            }
                                                            placeholderTextColor="#6F6F73"
                                                            value={credentialValues[cred.name]}
                                                            onChangeText={(text) => {
                                                                let formattedText = text;
                                                                if (isDocumentField) {
                                                                    if (acceptsBoth) formattedText = useCNPJ ? formatCNPJ(text) : formatCPF(text);
                                                                    else if (isCnpjCredential) formattedText = formatCNPJ(text);
                                                                    else formattedText = formatCPF(text);
                                                                }
                                                                setCredentialValues(prev => ({ ...prev, [cred.name]: formattedText }));
                                                            }}
                                                            secureTextEntry={cred.type === 'password' && !showPasswords[cred.name]}
                                                            autoCapitalize="none"
                                                            autoCorrect={false}
                                                            keyboardType={isDocumentField ? 'number-pad' : 'default'}
                                                            maxLength={isDocumentField ? (acceptsBoth ? (useCNPJ ? 18 : 14) : (isCnpjCredential ? 18 : 14)) : undefined}
                                                        />
                                                        {cred.type === 'password' && (
                                                            <TouchableOpacity onPress={() => setShowPasswords(prev => ({ ...prev, [cred.name]: !prev[cred.name] }))} style={{ marginLeft: 8 }}>
                                                                {showPasswords[cred.name] ? <EyeOff size={18} color="#666" /> : <Eye size={18} color="#666" />}
                                                            </TouchableOpacity>
                                                        )}
                                                    </View>
                                                </View>
                                            </View>
                                        </View>
                                        {index < (visibleCredentials.length - 1) && <View style={styles.separator} />}
                                    </View>
                                );
                            })}
                        </View>
                        {acceptsBothDocuments && (
                            <View style={styles.documentSwitchCard}>
                                <View style={styles.documentSwitchContainer}>
                                    <Text style={styles.documentSwitchLabel}>{useCNPJ ? 'Mudar para CPF' : 'Mudar para CNPJ'}</Text>
                                    <ModernSwitch
                                        value={useCNPJ}
                                        onValueChange={(value) => {
                                            setUseCNPJ(value);
                                            const documentFields = (selectedConnector?.credentials || []).filter(isDocumentCredential);
                                            if (documentFields.length > 0) {
                                                setCredentialValues(prev => {
                                                    const nextValues = { ...prev };
                                                    documentFields.forEach((field: any) => { nextValues[field.name] = ''; });
                                                    return nextValues;
                                                });
                                            }
                                        }}
                                        activeColor="#D97757"
                                        inactiveColor="#3f3f46"
                                        thumbColor="#FFFFFF"
                                    />
                                </View>
                            </View>
                        )}
                    </ScrollView>
                );
            case 'connecting':
                return (
                    <View style={styles.statusContainer}>
                        <View style={styles.statusIconContainer}>
                            <LottieView source={require('@/assets/carregando.json')} autoPlay loop style={{ width: 60, height: 60 }} />
                        </View>
                        <Text style={styles.statusTitle}>Sincronizando...</Text>
                        <Text style={styles.statusText}>Aguarde enquanto baixamos tudo do {selectedConnector?.name || 'seu banco'}. Não feche o aplicativo.</Text>
                        <View style={styles.stepContainer}>
                            <DynamicText
                                key={`connection-status-${connectionStatusText}`}
                                items={[{ text: connectionStatusText || 'Conectando...', id: 'status' }]}
                                loop={false}
                                initialIndex={0}
                                timing={{ interval: 2000, animationDuration: 350 }}
                                dot={{ visible: true, size: 6, color: '#D97757', style: { marginRight: 4 } }}
                                text={{ fontSize: 13, color: '#E0E0E0', fontWeight: '500' }}
                                animationPreset="fade"
                                animationDirection="up"
                            />
                        </View>
                    </View>
                );
            case 'success':
                return (
                    <View style={styles.statusContainer}>
                        <View style={styles.statusIconContainer}>
                            <LottieView source={require('@/assets/check.json')} autoPlay loop={false} style={{ width: 60, height: 60 }} />
                        </View>
                        <Text style={styles.statusTitle}>Conexão realizada!</Text>
                        <Text style={styles.statusText}>Sua conta do {selectedConnector?.name || 'banco'} foi conectada com sucesso.</Text>
                    </View>
                );
            case 'error':
                return (
                    <View style={styles.statusContainer}>
                        <View style={styles.statusIconContainer}>
                            <LottieView source={require('@/assets/erro.json')} autoPlay loop={true} style={{ width: 60, height: 60 }} />
                        </View>
                        <Text style={styles.statusTitle}>Erro na conexão</Text>
                        <Text style={styles.statusText}>{connectionError}</Text>
                        <TouchableOpacity style={styles.actionButton} onPress={() => setConnectionStep('credentials')}>
                            <Text style={styles.actionButtonText}>Tentar novamente</Text>
                        </TouchableOpacity>
                    </View>
                );
            case 'oauth_pending':
                return (
                    <View style={styles.statusContainer}>
                        <View style={styles.statusIconContainer}>
                            <LottieView source={require('@/assets/carregando.json')} autoPlay loop style={{ width: 60, height: 60 }} />
                        </View>
                        <Text style={styles.statusTitle}>Aguardando autorização</Text>
                        <Text style={styles.statusText}>Você deve autorizar o acesso no aplicativo ou site do banco.</Text>
                        <View style={styles.stepContainer}>
                            <DynamicText
                                key={`oauth-status-${connectionStatusText}`}
                                items={[{ text: connectionStatusText || 'Aguardando você finalizar no app do banco...', id: 'oauth-status' }]}
                                loop={false}
                                initialIndex={0}
                                timing={{ interval: 2000, animationDuration: 350 }}
                                dot={{ visible: true, size: 6, color: '#D97757', style: { marginRight: 4 } }}
                                text={{ fontSize: 13, color: '#E0E0E0', fontWeight: '500' }}
                                animationPreset="fade"
                                animationDirection="up"
                            />
                        </View>
                    </View>
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
                        connectionStep === 'info' ? 'Conectar Conta' :
                            connectionStep === 'banks' ? 'Selecione seu banco' :
                                connectionStep === 'credentials' ? 'Faça login' :
                                    connectionStep === 'connecting' ? 'Conectando' :
                                        connectionStep === 'oauth_pending' ? 'Autorização' :
                                            connectionStep === 'success' ? 'Sucesso!' : 'Erro'
                    }
                    warningText={
                        connectionStep === 'connecting' || connectionStep === 'oauth_pending'
                            ? 'Pode demorar alguns minutos. Não feche o app.'
                            : undefined
                    }
                    connectionStep={connectionStep}
                    banksCount={filteredConnectors.length}
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
                    rightElement={
                        connectionStep === 'info' ? (
                            <TouchableOpacity onPress={handleStartConnection} style={styles.headerConnectButton}>
                                <Text style={styles.headerConnectText}>Escolher Banco</Text>
                            </TouchableOpacity>
                        ) : connectionStep === 'credentials' ? (
                            <TouchableOpacity onPress={handleConnect} disabled={connecting} style={styles.headerConnectButton}>
                                {connecting ? <ActivityIndicator size="small" color="#D97757" /> : <Text style={styles.headerConnectText}>Conectar</Text>}
                            </TouchableOpacity>
                        ) : undefined
                    }
                >
                    {renderModalContent()}
                </ConnectAccountModal>
            </View>
        </View>
    );
}

// ====================== HELPERS OBRIGATÓRIOS ======================
const formatCPF = (value: string) => value.replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4').slice(0, 14);
const formatCNPJ = (value: string) => value.replace(/\D/g, '').replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5').slice(0, 18);

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
            <BankConnectorLogo connector={item} size={40} />
        </View>
        <Text style={styles.bankRowTitle}>{item.name}</Text>
    </TouchableOpacity>
);

const styles = StyleSheet.create({
    mainContainer: { flex: 1, backgroundColor: '#0C0C0C' },
    container: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, paddingTop: 60, paddingHorizontal: 20, zIndex: 10 },
    header: { marginBottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    title: { fontSize: 24, fontWeight: '700', color: '#FFFFFF' },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    content: { flex: 1 },
    modalScroll: {},
    modalContent: { padding: 20, paddingBottom: 20 },
    sectionHeader: { fontSize: 12, fontWeight: '600', color: '#8E8E93', marginTop: 10, marginBottom: 8, marginLeft: 4, letterSpacing: 0.5, textTransform: 'uppercase' },
    sectionCard: { backgroundColor: '#1A1A1A', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#2A2A2A', marginBottom: 10 },
    itemContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A1A', paddingVertical: 16, paddingHorizontal: 16, position: 'relative' },
    itemIconContainer: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255, 255, 255, 0.05)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    itemRightContainer: { flex: 1 },
    itemContent: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    itemTitle: { fontSize: 16, color: '#FFFFFF', fontWeight: '500' },
    itemSubtitle: { fontSize: 13, color: '#909090', marginTop: 2 },
    separator: { height: 1, backgroundColor: '#2A2A2A', width: '100%' },
    actionButton: { backgroundColor: '#D97757', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 10 },
    actionButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
    headerConnectButton: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 4, paddingHorizontal: 8 },
    headerConnectText: { color: '#D97757', fontSize: 14, fontWeight: '600' },
    banksListContainer: { margin: 20, marginTop: 10 },
    banksListContent: { backgroundColor: '#1A1A1A', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#2A2A2A' },
    connectorsErrorContainer: { backgroundColor: '#1A1A1A', borderRadius: 16, borderWidth: 1, borderColor: '#2A2A2A', padding: 16, alignItems: 'center' },
    connectorsErrorTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', textAlign: 'center' },
    connectorsErrorText: { color: '#909090', fontSize: 14, textAlign: 'center', lineHeight: 20, marginTop: 8 },
    connectorsRetryButton: { backgroundColor: '#D97757', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, marginTop: 16, alignItems: 'center', width: '100%' },
    connectorsRetryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
    bankListRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 16 },
    bankListLogoContainer: { marginRight: 12 },
    bankListSeparator: { height: 1, backgroundColor: '#2A2A2A', width: '100%' },
    bankRowTitle: { flex: 1, fontSize: 16, color: '#FFFFFF', fontWeight: '500' },
    credentialsContent: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 16 },
    credentialsSectionHeader: { marginTop: 0, marginBottom: 10, marginLeft: 2 },
    credentialInputContainer: { marginLeft: 'auto', flex: 1, minWidth: 0, paddingLeft: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
    credentialInput: { flex: 1, color: '#FFFFFF', fontSize: 15, paddingVertical: 0, paddingRight: 0, textAlign: 'left' },
    credentialCpfInput: { textAlign: 'right' },
    credentialItemContainer: { paddingVertical: 14 },
    credentialItemContent: { flex: 1, flexDirection: 'row', alignItems: 'center' },
    credentialLabel: { flexShrink: 1 },
    documentSwitchCard: { backgroundColor: '#1A1A1A', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#2A2A2A', marginTop: 16 },
    documentSwitchContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, paddingHorizontal: 16 },
    documentSwitchLabel: { fontSize: 16, color: '#FFFFFF', fontWeight: '500' },
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
});


