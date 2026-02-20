import { UniversalBackground } from '@/components/UniversalBackground';
import { BankConnectorLogo } from '@/components/open-finance/BankConnectorLogo';
import { ConnectedBankCard, BankSyncStatus as SyncStatus } from '@/components/open-finance/ConnectedBankCard';
import { SyncCreditsDisplay, useSyncCredits } from '@/components/open-finance/SyncCreditsDisplay';
import { BottomModal } from '@/components/ui/BottomModal';
import { DeleteConfirmationModal } from '@/components/ui/DeleteConfirmationModal';
import { useAuthContext as useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { API_BASE_URL, API_BASE_URL_CANDIDATES } from '@/services/apiBaseUrl';
import { databaseService } from '@/services/firebase';
import { notificationService } from '@/services/notifications';
import { getConnectorLogoUrl, normalizeHexColor } from '@/utils/connectorLogo';
import * as Linking from 'expo-linking';
import LottieView from 'lottie-react-native';
import { CheckCircle2, ChevronRight, Eye, EyeOff, Lock, Search, ShieldCheck, User, XCircle, Zap } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
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

console.log('[OpenFinance] Initial API URL:', API_BASE_URL);
console.log('[OpenFinance] API candidates:', API_BASE_URL_CANDIDATES);

const NETWORK_TIMEOUT_REGEX = /network request timed out/i;
const NETWORK_FAILED_REGEX = /network request failed/i;
const API_HEALTH_CHECK_TIMEOUT_MS = 6000;
const API_HEALTH_CACHE_TTL_MS = 30000;
const API_DEFAULT_TIMEOUT_MS = 30000;

const isNetworkTransportError = (error: unknown): boolean => {
    if (error instanceof TypeError) return true;

    const message = error instanceof Error ? error.message : String(error ?? '');
    return NETWORK_TIMEOUT_REGEX.test(message) || NETWORK_FAILED_REGEX.test(message);
};

const getApiConnectionErrorMessage = (apiBaseUrl: string, errorMsg?: string): string =>
    `Erro de rede: ${errorMsg || 'Falha na conexao'}. Tentando acessar: ${apiBaseUrl}. Verifique se o servidor backend esta rodando e acessivel.`;

// Wrapper for fetch with configurable timeout (default 180s for sync operations)
const fetchWithTimeout = async (resource: string, options: RequestInit & { timeout?: number } = {}) => {
    const { timeout = 180000, ...fetchOptions } = options;

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
        // If aborted, match the standard RN timeout error message for consistency
        if (error.name === 'AbortError') {
            throw new TypeError('Network request timed out');
        }
        throw error;
    }
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');



// Helper for auth requirements logic
const checkAuthRequirements = (item: any) => {
    return {
        url: item.connectorUrl || item.oauthUrl || null,
        needsAction: item.status === 'WAITING_USER_INPUT' || item.status === 'LOGIN_ERROR',
        status: item.status
    };
};

// CPF Validation Helper
const validateCPF = (cpf: string): boolean => {
    // Remove non-numeric characters
    const cleanCPF = cpf.replace(/\D/g, '');

    // Must have 11 digits
    if (cleanCPF.length !== 11) return false;

    // Check for known invalid patterns (all same digits)
    if (/^(\d)\1{10}$/.test(cleanCPF)) return false;

    // Validate check digits
    let sum = 0;
    for (let i = 0; i < 9; i++) {
        sum += parseInt(cleanCPF.charAt(i)) * (10 - i);
    }
    let remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cleanCPF.charAt(9))) return false;

    sum = 0;
    for (let i = 0; i < 10; i++) {
        sum += parseInt(cleanCPF.charAt(i)) * (11 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cleanCPF.charAt(10))) return false;

    return true;
};

// CPF Mask Helper
const formatCPF = (value: string): string => {
    const numbers = value.replace(/\D/g, '').slice(0, 11);
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
    if (numbers.length <= 9) return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
    return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9)}`;
};

// Types
interface Connector {
    id: number;
    name: string;
    imageUrl: string;
    primaryColor: string;
    type: string;
    oauth?: boolean;
    isOpenFinance?: boolean;
    credentials: Array<{
        name: string;
        label: string;
        type: string;
        placeholder?: string;
        validation?: string;
        validationMessage?: string;
    }>;
}

interface CredentialValues {
    [key: string]: string;
}

type ConnectionStep = 'info' | 'banks' | 'credentials' | 'connecting' | 'oauth_pending' | 'success' | 'error';

// Deep link URI for OAuth callback
const OAUTH_REDIRECT_URI = Linking.createURL('open-finance/callback');

// Componente separado para o card do banco (necessário para usar hooks)
const ConnectorCard = ({
    item,
    onSelect,
    styles
}: {
    item: Connector;
    onSelect: (connector: Connector) => void;
    styles: any;
}) => {
    const color = normalizeHexColor(item.primaryColor, '#30302E');

    return (
        <TouchableOpacity
            style={styles.bankListRow}
            onPress={() => onSelect(item)}
            activeOpacity={0.7}
        >
            <View style={[styles.bankColorStrip, { backgroundColor: color }]} />
            <BankConnectorLogo
                connector={item}
                size={36}
                borderRadius={10}
                iconSize={18}
                borderColor={`${color}33`}
                containerStyle={styles.bankListLogoContainer}
            />
            <Text style={styles.bankRowTitle} numberOfLines={1}>{item.name}</Text>
            <ChevronRight size={20} color="#666" />
        </TouchableOpacity>
    );
};



export default function OpenFinanceScreen() {
    const { user, profile, refreshProfile } = useAuth();
    const { showError, showWarning } = useToast();
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<any>(null);
    const [accounts, setAccounts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingDots, setLoadingDots] = useState('');

    useEffect(() => {
        if (!loading) return;
        const interval = setInterval(() => {
            setLoadingDots(prev => {
                if (prev === '...') return '';
                return prev + '.';
            });
        }, 500);
        return () => clearInterval(interval);
    }, [loading]);

    const [refreshing, setRefreshing] = useState(false);

    // Sync Credits System
    const { credits: syncCredits, refresh: refreshCredits, consumeCredit, hasCredits, canSync, canSyncItem } = useSyncCredits(user?.uid);

    // Schedule daily reset notification once
    useEffect(() => {
        notificationService.scheduleDailySyncResetNotification();
    }, []);

    // Connection flow states
    const [connectionStep, setConnectionStep] = useState<ConnectionStep>('info');
    const [connectors, setConnectors] = useState<Connector[]>([]);
    const [loadingConnectors, setLoadingConnectors] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [connectorsFetchError, setConnectorsFetchError] = useState<string | null>(null);
    const [selectedConnector, setSelectedConnector] = useState<Connector | null>(null);
    const [credentialValues, setCredentialValues] = useState<CredentialValues>({});
    const [showPasswords, setShowPasswords] = useState<{ [key: string]: boolean }>({});
    const [connecting, setConnecting] = useState(false);
    const [connectionError, setConnectionError] = useState<string | null>(null);
    const [connectionProgress, setConnectionProgress] = useState(0);
    const [apiBaseUrl, setApiBaseUrl] = useState(API_BASE_URL);
    const lastApiHealthCheckRef = useRef(0);

    useEffect(() => {
        console.log('[OpenFinance] Active API URL:', apiBaseUrl);
    }, [apiBaseUrl]);

    const resolveReachableApiBaseUrl = useCallback(async (): Promise<string> => {
        const now = Date.now();
        if ((now - lastApiHealthCheckRef.current) < API_HEALTH_CACHE_TTL_MS) {
            return apiBaseUrl;
        }

        const candidates = [apiBaseUrl, ...API_BASE_URL_CANDIDATES.filter(candidate => candidate !== apiBaseUrl)];
        let lastTransportError: unknown = null;

        for (const candidate of candidates) {
            try {
                const response = await fetchWithTimeout(`${candidate}/health`, {
                    method: 'GET',
                    timeout: API_HEALTH_CHECK_TIMEOUT_MS
                });

                if (!response.ok) {
                    continue;
                }

                lastApiHealthCheckRef.current = Date.now();
                if (candidate !== apiBaseUrl) {
                    console.log('[OpenFinance] Switching API URL to reachable host:', candidate);
                    setApiBaseUrl(candidate);
                }
                return candidate;
            } catch (error) {
                if (isNetworkTransportError(error)) {
                    lastTransportError = error;
                    continue;
                }

                console.warn('[OpenFinance] Unexpected API health check error:', error);
            }
        }

        if (lastTransportError) {
            throw lastTransportError;
        }

        return apiBaseUrl;
    }, [apiBaseUrl]);

    const apiFetch = useCallback(async (
        path: string,
        options: RequestInit & { timeout?: number } = {}
    ) => {
        const resolvedBaseUrl = await resolveReachableApiBaseUrl();
        const timeout = options.timeout ?? API_DEFAULT_TIMEOUT_MS;
        return fetchWithTimeout(`${resolvedBaseUrl}${path}`, { ...options, timeout });
    }, [resolveReachableApiBaseUrl]);

    const getConnectionErrorMessage = useCallback((errorMsg?: string): string => (
        getApiConnectionErrorMessage(apiBaseUrl, errorMsg)
    ), [apiBaseUrl]);

    const handleToggleVisibility = async (accountId: string) => {
        if (!user || !profile) return;
        const prefs = (profile.preferences as any) || {};
        const hiddenIds = (prefs.hiddenAccountIds as string[]) || [];

        let newIds: string[];

        if (hiddenIds.includes(accountId)) {
            // If currently hidden, remove from list to make visible
            newIds = hiddenIds.filter(id => id !== accountId);
        } else {
            // If visible, add to list to hide
            newIds = [...hiddenIds, accountId];
        }

        try {
            await databaseService.updatePreference(user.uid, {
                hiddenAccountIds: newIds
            });
            refreshProfile();
        } catch (error) {
            console.error('Error toggling account visibility:', error);
            Alert.alert('Erro', 'Não foi possível alterar a visibilidade da conta.');
        }
    };



    // OAuth states
    const [pendingItemId, setPendingItemId] = useState<string | null>(null);
    const pendingItemIdRef = useRef<string | null>(null);
    const [oauthPolling, setOauthPolling] = useState(false);
    const oauthPollingRef = useRef(false);

    // Update refs when state changes
    useEffect(() => {
        pendingItemIdRef.current = pendingItemId;
    }, [pendingItemId]);

    useEffect(() => {
        oauthPollingRef.current = oauthPolling;
    }, [oauthPolling]);

    const fetchAccounts = async () => {
        if (!user) return;
        try {
            const result = await databaseService.getAccounts(user.uid);
            if (result.success && result.data) {
                setAccounts(result.data);
            }
        } catch (error) {
            console.error('Error fetching accounts:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // Handle OAuth callback from deep link
    const handleOAuthCallback = useCallback(async (url: string) => {
        console.log('[OAuth] Callback received:', url);

        // Extract itemId from URL parameters if present (some banks return it)
        // Or default to the pending one
        let itemId = pendingItemIdRef.current;

        // Parse URL to check for status or errors
        try {
            const { queryParams } = Linking.parse(url);

            if (queryParams?.error) {
                console.error('[OAuth] Error in callback:', queryParams.error);
                setConnectionError('O banco recusou a conexão ou ocorreu um erro.');
                setConnectionStep('error');
                setIsModalVisible(true);
                return;
            }

            // If we don't have a pending item ID, we might be recovering from a completely closed app state
            // Ideally we should store this pending ID in AsyncStorage to survive app restarts
            if (!itemId) {
                console.log('[OAuth] No pending item found in memory. Checking URL params...');
                // Checking if the backend passed it back in the redirect (if you implemented that)
                // For now, we rely on memory or storage mechanisms you might add later.
                // If it's lost, we can prompt user or try to find "WAITING_USER_INPUT" items from Pluggy API
            }
        } catch (e) {
            console.error('[OAuth] Failed to parse callback URL', e);
        }

        if (!itemId || !user) {
            console.log('[OAuth] No pending item or user to sync.');
            // Even without item, we should show the modal so user knows something happened
            setIsModalVisible(true);
            if (!itemId) setConnectionError('Não foi possível identificar a conexão pendente.');
            setConnectionStep('error');
            return;
        }

        console.log('[OAuth] Processing callback for item:', itemId);

        // Show modal and set state
        setIsModalVisible(true);
        setConnectionStep('connecting');
        setConnectionProgress(60);

        try {
            console.log('[OAuth] Syncing item to Firebase...');
            const token = await user.getIdToken();
            const syncResponse = await apiFetch('/api/pluggy/sync', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    userId: user.uid,
                    itemId: itemId,
                }),
                timeout: 240000
            });

            if (syncResponse.ok) {
                const syncData = await syncResponse.json();
                console.log('[OAuth] Sync response:', syncData);

                setConnectionProgress(80);

                if (syncData.accounts && syncData.accounts.length > 0) {
                    console.log(`[OAuth] Saving ${syncData.accounts.length} accounts to Firebase...`);

                    for (const account of syncData.accounts) {
                        const result = await databaseService.saveAccount(
                            user.uid,
                            account,
                            syncData.connector
                        );

                        if (result.success) {
                            console.log(`[OAuth] Account ${account.id} saved successfully`);
                        } else {
                            console.error(`[OAuth] Failed to save account ${account.id}:`, result.error);
                        }
                    }

                    console.log('[OAuth] Saving transactions to Firebase...');
                    const txResult = await databaseService.saveOpenFinanceTransactions(
                        user.uid,
                        syncData.accounts,
                        syncData.connector
                    );

                    if (txResult.success) {
                        console.log(`[OAuth] Transactions saved: ${txResult.savedCount} total (${txResult.details?.checkingTransactions} checking, ${txResult.details?.creditCardTransactions} credit card)`);
                    } else {
                        console.error('[OAuth] Failed to save transactions:', txResult.error);
                    }
                }
            } else {
                throw new Error('Falha na sincronização com o servidor.');
            }

            setConnectionProgress(100);
            setConnectionStep('success');

            // Clear pending item
            setPendingItemId(null);

            // Refresh accounts and credits
            setTimeout(() => {
                fetchAccounts();
                refreshCredits(); // Update credits display
                // Don't close immediately, let user see success
                setTimeout(() => {
                    setIsModalVisible(false);
                    setConnectionStep('info');
                }, 1500);
            }, 1000);

        } catch (error: any) {
            console.error('[OAuth] Sync error:', error);
            setConnectionError('Erro ao sincronizar. Tente novamente.');
            setConnectionStep('error');
        }
    }, [apiFetch, user, refreshCredits]);

    // Listen for deep link callbacks
    useEffect(() => {
        // Handle URL when app is opened from background
        const subscription = Linking.addEventListener('url', (event) => {
            if (event.url.includes('open-finance') || event.url.includes('pluggy')) {
                handleOAuthCallback(event.url);
            }
        });

        // Check if app was opened with a URL (Cold start)
        Linking.getInitialURL().then((url) => {
            if (url && (url.includes('open-finance') || url.includes('pluggy'))) {
                handleOAuthCallback(url);
            }
        });

        return () => {
            subscription.remove();
        };
    }, [handleOAuthCallback]);

    // Polling effect for OAuth flow - runs while user is in the bank app
    useEffect(() => {
        if (connectionStep !== 'oauth_pending' || !pendingItemId || !user) {
            return;
        }

        console.log('[OAuth Polling] Starting polling for item:', pendingItemId);

        let pollCount = 0;
        const maxPolls = 90; // 3 minutes max (2s intervals)
        let cancelled = false;
        let intervalId: ReturnType<typeof setInterval> | null = null;

        const checkStatus = async () => {
            if (cancelled) return;

            pollCount++;
            console.log(`[OAuth Polling] Attempt ${pollCount}/${maxPolls}`);

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

                    console.log(`[OAuth Polling] Status: ${status}`);

                    if (status === 'UPDATED') {
                        console.log('[OAuth Polling] Connection completed!');
                        cancelled = true;
                        if (intervalId) clearInterval(intervalId);

                        setOauthPolling(false);
                        setConnectionStep('connecting');
                        setConnectionProgress(60);

                        // Sync accounts
                        try {
                            const token = await user.getIdToken();
                            const syncResponse = await apiFetch('/api/pluggy/sync', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${token}`
                                },
                                body: JSON.stringify({
                                    userId: user.uid,
                                    itemId: pendingItemId,
                                }),
                                timeout: 240000
                            });

                            if (syncResponse.ok) {
                                const syncData = await syncResponse.json();
                                console.log('[OAuth Polling] Sync data received:', syncData);

                                setConnectionProgress(80);

                                // Save accounts to Firebase
                                if (syncData.accounts && syncData.accounts.length > 0) {
                                    console.log(`[OAuth Polling] Saving ${syncData.accounts.length} accounts to Firebase...`);

                                    for (const account of syncData.accounts) {
                                        const result = await databaseService.saveAccount(
                                            user.uid,
                                            account,
                                            syncData.connector || selectedConnector
                                        );

                                        if (result.success) {
                                            console.log(`[OAuth Polling] Account ${account.id} saved successfully`);
                                        } else {
                                            console.error(`[OAuth Polling] Failed to save account ${account.id}:`, result.error);
                                        }
                                    }

                                    // Save transactions to Firebase
                                    console.log('[OAuth Polling] Saving transactions to Firebase...');
                                    const txResult = await databaseService.saveOpenFinanceTransactions(
                                        user.uid,
                                        syncData.accounts,
                                        syncData.connector || selectedConnector
                                    );

                                    if (txResult.success) {
                                        console.log(`[OAuth Polling] Transactions saved: ${txResult.savedCount} total (${txResult.details?.checkingTransactions} checking, ${txResult.details?.creditCardTransactions} credit card)`);
                                    } else {
                                        console.error('[OAuth Polling] Failed to save transactions:', txResult.error);
                                    }
                                }

                                setConnectionProgress(100);
                                setConnectionStep('success');
                                setPendingItemId(null);

                                setTimeout(() => {
                                    fetchAccounts();
                                    refreshCredits(); // Update credits display
                                    setTimeout(() => {
                                        setIsModalVisible(false);
                                        setConnectionStep('info');
                                    }, 1500);
                                }, 1000);
                            } else {
                                throw new Error('Sync failed');
                            }
                        } catch (syncError) {
                            console.error('[OAuth Polling] Sync error:', syncError);
                            setConnectionError('Erro ao sincronizar contas. Tente novamente.');
                            setConnectionStep('error');
                        }
                        return;
                    }

                    if (status === 'LOGIN_ERROR' || status === 'OUTDATED' || status === 'ERROR') {
                        console.log('[OAuth Polling] Connection failed with status:', status);
                        cancelled = true;
                        if (intervalId) clearInterval(intervalId);

                        setOauthPolling(false);
                        setConnectionError('O banco recusou a conexão ou ocorreu um erro. Tente novamente.');
                        setConnectionStep('error');
                        setPendingItemId(null);
                        return;
                    }
                }
            } catch (error) {
                console.warn('[OAuth Polling] Error:', error);
            }

            // Check if max polls reached
            if (pollCount >= maxPolls && !cancelled) {
                console.log('[OAuth Polling] Timeout reached');
                cancelled = true;
                if (intervalId) clearInterval(intervalId);

                setOauthPolling(false);
                setConnectionError('Tempo expirado. Por favor, tente conectar novamente.');
                setConnectionStep('error');
                setPendingItemId(null);
            }
        };

        // Start polling immediately
        setOauthPolling(true);
        checkStatus(); // First check immediately

        // Then continue polling every 2 seconds
        intervalId = setInterval(checkStatus, 2000);

        return () => {
            cancelled = true;
            setOauthPolling(false);
            if (intervalId) clearInterval(intervalId);
        };
    }, [connectionStep, pendingItemId, user]);

    useEffect(() => {
        if (user) {
            fetchAccounts();
            fetchConnectors();
        }
    }, [user]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchAccounts();
    };

    const fetchConnectors = async () => {
        setLoadingConnectors(true);
        setConnectorsFetchError(null);
        setConnectionError(null);
        try {
            if (!user) return;
            const token = await user.getIdToken();
            const response = await apiFetch('/api/pluggy/connectors', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                timeout: 20000
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

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
                setConnectorsFetchError(null);
            } else {
                setConnectors([]);
            }
        } catch (error) {
            console.error('Error fetching connectors:', error);
            if (isNetworkTransportError(error)) {
                const connectionMessage = getConnectionErrorMessage(error instanceof Error ? error.message : undefined);
                setConnectorsFetchError(connectionMessage);
                setConnectionError(connectionMessage);
            } else {
                const fetchMessage = 'Nao foi possivel carregar os bancos agora. Tente novamente.';
                setConnectorsFetchError(fetchMessage);
                setConnectionError(fetchMessage);
            }

            setConnectors([]);
        } finally {
            setLoadingConnectors(false);
        }
    };

    const handleOpenModal = () => {
        setIsModalVisible(true);
        setConnectionStep('info');
        setSelectedConnector(null);
        setCredentialValues({});
        setConnectorsFetchError(null);
        setConnectionError(null);
    };

    const handleCloseModal = () => {
        setIsModalVisible(false);
        setConnectionStep('info');
        setSelectedConnector(null);
        setCredentialValues({});
        setConnectorsFetchError(null);
        setConnectionError(null);
        setSearchQuery('');
    };

    const handleStartConnection = () => {
        setConnectionStep('banks');
        fetchConnectors();
    };

    const handleSelectConnector = (connector: Connector) => {
        setSelectedConnector(connector);
        const initialValues: CredentialValues = {};
        (connector.credentials || []).forEach(cred => {
            initialValues[cred.name] = '';
        });
        setCredentialValues(initialValues);
        setConnectionStep('credentials');
    };

    const handleRequestDelete = (group: any) => {
        setItemToDelete(group);
        setDeleteModalVisible(true);
    };

    const handleConfirmDelete = async () => {
        if (!user || !itemToDelete) return;

        console.log('handleConfirmDelete called for group:', itemToDelete.connector?.name);
        setLoading(true);
        setDeleteModalVisible(false); // Close modal immediately

        try {
            const promises = itemToDelete.accounts.map((acc: any) =>
                databaseService.deleteAccount(user.uid, acc.id)
            );
            await Promise.all(promises);
            await fetchAccounts();
            setItemToDelete(null);
        } catch (error) {
            console.error('Error deleting bank:', error);
            Alert.alert('Erro', 'Não foi possível desconectar a instituição.');
        } finally {
            setLoading(false);
        }
    };

    // Handle sync for an already connected bank
    const handleSyncBank = async (
        group: any,
        onStatusUpdate: (status: SyncStatus) => void
    ): Promise<void> => {
        if (!user) return;

        console.log('[Sync] Starting sync for', group.connector?.name);
        console.log('[Sync] Group data:', JSON.stringify(group, null, 2));

        // Get the itemId from first account - check multiple possible field names
        // Web app may save it as 'pluggyItemId', 'itemId', or it may be nested
        const firstAccount = group.accounts[0];
        console.log('[Sync] First account full data:', JSON.stringify(firstAccount, null, 2));

        const itemId = firstAccount?.pluggyItemId ||
            firstAccount?.itemId ||
            firstAccount?.connector?.itemId ||
            null;

        console.log('[Sync] Found itemId:', itemId);
        console.log('[Sync] pluggyItemId:', firstAccount?.pluggyItemId);
        console.log('[Sync] itemId:', firstAccount?.itemId);

        if (!itemId) {
            console.error('[Sync] No itemId found! Account fields:', Object.keys(firstAccount || {}));
            onStatusUpdate({ step: 'error', message: 'Conexão não identificada - itemId ausente', progress: 0 });
            setTimeout(() => {
                onStatusUpdate({ step: 'idle', message: '', progress: 0 });
            }, 3000);
            return;
        }

        try {
            // Step 1: Fetching data from bank
            onStatusUpdate({
                step: 'fetching_accounts',
                message: 'Obtendo dados do banco...',
                progress: 10
            });

            // Determine synchronization start date (Incremental Sync)
            let fromDate: string;
            let latestSyncDate: string | null = null;
            if (group.accounts && group.accounts.length > 0) {
                group.accounts.forEach((acc: any) => {
                    if (acc.lastSyncedAt) {
                        const d = new Date(acc.lastSyncedAt);
                        if (!isNaN(d.getTime())) {
                            if (!latestSyncDate || d > new Date(latestSyncDate)) {
                                latestSyncDate = acc.lastSyncedAt;
                            }
                        }
                    }
                });
            }
            if (latestSyncDate) {
                fromDate = new Date(latestSyncDate).toISOString().split('T')[0];
            } else {
                const d = new Date();
                d.setDate(d.getDate() - 30);
                fromDate = d.toISOString().split('T')[0];
            }
            console.log('[Sync] Incremental sync from:', fromDate);

            console.log('[Sync] Calling API:', `${apiBaseUrl}/api/pluggy/sync`);
            console.log('[Sync] Request body:', { userId: user.uid, itemId: itemId });

            // Call the sync endpoint
            const token = await user.getIdToken();
            // Increased timeout to 4 minutes (240000ms) for sync operations which can be heavy
            const syncResponse = await apiFetch('/api/pluggy/sync', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    userId: user.uid,
                    itemId: itemId,
                    from: fromDate
                }),
                timeout: 240000
            });

            console.log('[Sync] Response status:', syncResponse.status);

            if (syncResponse.ok) {
                const syncData = await syncResponse.json();
                console.log('[Sync] Response received:', syncData);

                onStatusUpdate({
                    step: 'fetching_accounts',
                    message: `${syncData.accounts?.length || 0} contas encontradas`,
                    progress: 30
                });

                // Save/update accounts
                if (syncData.accounts && syncData.accounts.length > 0) {
                    // Step 2: Saving accounts
                    onStatusUpdate({
                        step: 'saving_accounts',
                        message: 'Salvando contas...',
                        progress: 40
                    });

                    for (let i = 0; i < syncData.accounts.length; i++) {
                        const account = syncData.accounts[i];
                        await databaseService.saveAccount(
                            user.uid,
                            account,
                            syncData.connector || group.connector
                        );

                        const accountProgress = 40 + ((i + 1) / syncData.accounts.length) * 20;
                        onStatusUpdate({
                            step: 'saving_accounts',
                            message: `Salvando conta ${i + 1}/${syncData.accounts.length}...`,
                            progress: accountProgress
                        });
                    }

                    // Step 3: Count total transactions
                    let totalTransactions = 0;
                    syncData.accounts.forEach((acc: any) => {
                        totalTransactions += (acc.transactions?.length || 0);
                    });

                    onStatusUpdate({
                        step: 'fetching_transactions',
                        message: `${totalTransactions} transações encontradas`,
                        progress: 65
                    });

                    // Step 4: Save transactions
                    onStatusUpdate({
                        step: 'saving_transactions',
                        message: 'Salvando transações...',
                        progress: 70
                    });

                    const txResult = await databaseService.saveOpenFinanceTransactions(
                        user.uid,
                        syncData.accounts,
                        syncData.connector || group.connector
                    );

                    if (txResult.success) {
                        const total = txResult.savedCount || 0;
                        const checking = txResult.details?.checkingTransactions || 0;
                        const credit = txResult.details?.creditCardTransactions || 0;

                        onStatusUpdate({
                            step: 'done',
                            message: `${total} transações salvas!`,
                            progress: 100,
                            details: { checking, credit }
                        });

                        // Reset after showing success
                        setTimeout(() => {
                            onStatusUpdate({ step: 'idle', message: '', progress: 0 });
                        }, 3000);
                    } else {
                        throw new Error('Falha ao salvar transações');
                    }
                } else {
                    onStatusUpdate({
                        step: 'done',
                        message: 'Nenhuma transação nova',
                        progress: 100
                    });

                    setTimeout(() => {
                        onStatusUpdate({ step: 'idle', message: '', progress: 0 });
                    }, 3000);
                }

                // Refresh accounts list
                await fetchAccounts();
            } else {
                // Log the error response
                const errorText = await syncResponse.text();
                console.error('[Sync] API Error Response:', errorText);
                console.error('[Sync] API Error Status:', syncResponse.status);
                throw new Error(`API Error: ${syncResponse.status} - ${errorText}`);
            }
        } catch (error: any) {
            console.error('[Sync] Error:', error);
            console.error('[Sync] Error message:', error.message);
            const errorMessage = isNetworkTransportError(error)
                ? getConnectionErrorMessage(error.message)
                : error.message || 'Erro na sincronização';

            onStatusUpdate({ step: 'error', message: errorMessage, progress: 0 });

            setTimeout(() => {
                onStatusUpdate({ step: 'idle', message: '', progress: 0 });
            }, 3000);
        }
    };


    const handleConnect = async () => {
        if (!user || !selectedConnector) return;

        if (!hasCredits) {
            const resetTime = databaseService.getTimeUntilReset();
            showWarning(
                'Creditos esgotados',
                `Voce nao tem mais creditos de sincronizacao hoje. Seus creditos serao renovados em ${resetTime.formatted}.`
            );
            return;
        }

        const missingFields = (selectedConnector.credentials || []).filter(
            cred => !credentialValues[cred.name]?.trim()
        );

        if (missingFields.length > 0) {
            showError('Campos obrigatorios', 'Por favor, preencha todos os campos obrigatorios.');
            return;
        }

        if (credentialValues.cpf) {
            const cleanCPF = credentialValues.cpf.replace(/\D/g, '');
            if (cleanCPF.length !== 11) {
                showError('CPF invalido', 'O CPF deve conter 11 digitos.');
                return;
            }
            if (!validateCPF(cleanCPF)) {
                showError('CPF invalido', 'O CPF informado nao e valido. Verifique os digitos e tente novamente.');
                return;
            }
        }

        const creditResult = await consumeCredit('connect');
        if (!creditResult.success) {
            showError('Erro', creditResult.error || 'Erro ao consumir credito.');
            return;
        }

        setConnecting(true);
        setConnectionStep('connecting');
        setConnectionProgress(0);

        const isOAuthConnector = Boolean(selectedConnector.oauth || selectedConnector.isOpenFinance);
        let progressInterval: ReturnType<typeof setInterval> | null = null;

        try {
            progressInterval = setInterval(() => {
                setConnectionProgress(prev => Math.min(prev + 5, 40));
            }, 500);

            const redirectUri = Linking.createURL('open-finance');
            console.log('[Connect] Generated Redirect URI:', redirectUri);

            const sanitizedCredentials = { ...credentialValues };
            if (sanitizedCredentials.cpf) {
                sanitizedCredentials.cpf = sanitizedCredentials.cpf.replace(/\D/g, '');
            }

            const token = await user.getIdToken();
            const createResponse = await apiFetch('/api/pluggy/create-item', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    userId: user.uid,
                    connectorId: selectedConnector.id,
                    credentials: sanitizedCredentials,
                    oauthRedirectUri: redirectUri,
                }),
            });

            const createData = await createResponse.json();

            if (!createResponse.ok) {
                let errorMessage = 'Falha ao conectar. Verifique suas credenciais.';
                if (createData.details && Array.isArray(createData.details)) {
                    const errorDetails = createData.details
                        .map((d: any) => `- ${d.message} (${d.parameter})`)
                        .join('\n');
                    errorMessage = `Erro de validacao:\n${errorDetails}`;
                } else if (createData.error) {
                    errorMessage = createData.error;
                }

                setConnectionError(errorMessage);
                setConnectionStep('error');
                return;
            }

            if (!createData.success && !createData.item) {
                setConnectionError(createData.error || 'Falha ao conectar. Verifique suas credenciais.');
                setConnectionStep('error');
                return;
            }

            const item = createData.item;
            const itemId = item?.id;

            if (!itemId) {
                throw new Error('Item ID nao retornado pelo servidor');
            }

            const resolveAuthRequirements = (currentItem: any) => {
                const url =
                    currentItem.oauthUrl ||
                    currentItem.parameter?.data ||
                    currentItem.parameter?.oauthUrl ||
                    currentItem.parameter?.authorizationUrl ||
                    currentItem.parameter?.url ||
                    currentItem.userAction?.url ||
                    currentItem.userAction?.oauthUrl ||
                    currentItem.authorizationUrl ||
                    currentItem.redirectUrl ||
                    currentItem.executionResult?.oauthUrl ||
                    currentItem.executionResult?.authorizationUrl;

                const needsAction =
                    currentItem.status === 'WAITING_USER_INPUT' ||
                    currentItem.status === 'WAITING_USER_ACTION' ||
                    currentItem.status === 'LOGIN_ERROR';

                return { url, needsAction, status: currentItem.status };
            };

            let { url: oauthUrl, needsAction, status } = resolveAuthRequirements(item);

            if (isOAuthConnector && !oauthUrl) {
                let attempts = 0;
                const maxAttempts = 20;

                const shouldContinuePolling = () => {
                    if (oauthUrl) return false;
                    if (status === 'LOGIN_ERROR' || status === 'OUTDATED' || status === 'ERROR') return false;
                    if (status === 'UPDATED') return false;
                    if (attempts >= maxAttempts) return false;
                    return true;
                };

                while (shouldContinuePolling()) {
                    attempts++;
                    await new Promise(resolve => setTimeout(resolve, 2000));

                    try {
                        const pollingToken = await user.getIdToken();
                        const pollResponse = await apiFetch(`/api/pluggy/items/${itemId}`, {
                            headers: { 'Authorization': `Bearer ${pollingToken}` },
                            timeout: 15000
                        });

                        if (!pollResponse.ok) continue;

                        const pollData = await pollResponse.json();
                        const updatedItem = pollData.item || pollData;
                        if (!updatedItem || updatedItem.id !== itemId) continue;

                        const check = resolveAuthRequirements(updatedItem);
                        oauthUrl = check.url;
                        needsAction = check.needsAction;
                        status = check.status;
                    } catch (pollError) {
                        console.warn('[Connect] Polling error:', pollError);
                    }
                }
            }

            const shouldHandleOAuth = Boolean(
                oauthUrl || (isOAuthConnector && (needsAction || status === 'UPDATING'))
            );

            if (shouldHandleOAuth) {
                setConnectionProgress(30);
                setPendingItemId(itemId);
                setConnectionStep('oauth_pending');

                if (!oauthUrl) {
                    showError('Erro', 'O banco nao retornou o link de autorizacao. Tente novamente.');
                    return;
                }

                try {
                    await Linking.openURL(oauthUrl);
                } catch (openError) {
                    console.error('[Connect] Failed to open OAuth URL:', openError);
                    showError(
                        'Autorizacao necessaria',
                        'Nao foi possivel abrir o app do banco automaticamente. Tente novamente.'
                    );
                }

                return;
            }

            setConnectionProgress(50);

            const syncResponse = await apiFetch('/api/pluggy/sync', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    userId: user.uid,
                    itemId,
                }),
                timeout: 240000
            });

            if (!syncResponse.ok) {
                const syncText = await syncResponse.text();
                throw new Error(`API Error: ${syncResponse.status} - ${syncText}`);
            }

            const syncData = await syncResponse.json();
            setConnectionProgress(80);

            if (syncData.accounts && syncData.accounts.length > 0) {
                for (const account of syncData.accounts) {
                    await databaseService.saveAccount(
                        user.uid,
                        account,
                        syncData.connector || selectedConnector
                    );
                }

                await databaseService.saveOpenFinanceTransactions(
                    user.uid,
                    syncData.accounts,
                    syncData.connector || selectedConnector
                );
            }

            setConnectionProgress(100);
            setConnectionStep('success');

            setTimeout(() => {
                fetchAccounts();
                handleCloseModal();
            }, 2000);
        } catch (error: any) {
            console.error('Connection error:', error);
            const connectionMessage = isNetworkTransportError(error)
                ? getConnectionErrorMessage(error?.message)
                : error?.message || 'Erro de conexao com o servidor.';

            setConnectionError(connectionMessage);
            setConnectionStep('error');
        } finally {
            if (progressInterval) {
                clearInterval(progressInterval);
            }
            setConnecting(false);
        }
    };

    const filteredConnectors = connectors.filter(connector =>
        connector.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    const shouldShowConnectorsNetworkError =
        !loadingConnectors && filteredConnectors.length === 0 && Boolean(connectorsFetchError);

    // Group accounts by connector
    const groupedAccounts = accounts.reduce((acc, account) => {
        const connectorData = account.connector || null;
        const connectorName = connectorData?.name || account.name || 'Outros';

        if (!acc[connectorName]) {
            acc[connectorName] = {
                connector: connectorData,
                accounts: []
            };
        }
        acc[connectorName].accounts.push(account);
        return acc;
    }, {} as Record<string, any>);

    // Render bank card usando o componente separado
    const renderConnectorCard = ({ item }: { item: Connector }) => (
        <ConnectorCard
            item={item}
            onSelect={handleSelectConnector}
            styles={styles}
        />
    );

    // Render modal content based on step
    const renderModalContent = () => {
        switch (connectionStep) {
            case 'info':
                return (
                    <ScrollView
                        style={styles.modalScroll}
                        contentContainerStyle={styles.modalContent}
                        showsVerticalScrollIndicator={false}
                    >
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



                        <TouchableOpacity
                            style={styles.actionButton}
                            activeOpacity={0.8}
                            onPress={handleStartConnection}
                        >
                            <Text style={styles.actionButtonText}>Escolher Banco</Text>
                        </TouchableOpacity>
                    </ScrollView>
                );

            case 'banks':
                return (
                    <View style={styles.banksContainer}>
                        {/* Search Bar */}
                        <View style={styles.searchContainer}>
                            <Search size={18} color="#666" />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Buscar banco..."
                                placeholderTextColor="#666"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                        </View>

                        {loadingConnectors ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color="#D97757" />
                                <Text style={styles.loadingText}>Carregando bancos...</Text>
                            </View>
                        ) : shouldShowConnectorsNetworkError ? (
                            <View style={styles.connectorsErrorContainer}>
                                <Text style={styles.connectorsErrorTitle}>Falha ao conectar com o backend</Text>
                                <Text style={styles.connectorsErrorText}>{connectorsFetchError}</Text>
                                <TouchableOpacity
                                    style={styles.connectorsRetryButton}
                                    onPress={fetchConnectors}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.connectorsRetryButtonText}>Tentar novamente</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <FlatList
                                key="bank-list-1" // Force fresh render when switching layouts
                                data={filteredConnectors}
                                renderItem={renderConnectorCard}
                                keyExtractor={(item) => item.id.toString()}
                                contentContainerStyle={styles.banksList}
                                ItemSeparatorComponent={() => <View style={styles.bankListSeparator} />}
                                showsVerticalScrollIndicator={false}
                                ListEmptyComponent={
                                    <Text style={styles.emptyText}>Nenhum banco encontrado</Text>
                                }
                            />
                        )}
                    </View>
                );

            case 'credentials':
                return (
                    <ScrollView
                        style={styles.modalScroll}
                        contentContainerStyle={styles.credentialsContent}
                        showsVerticalScrollIndicator={false}
                    >
                        <View style={{ height: 20 }} />

                        <Text style={styles.sectionHeader}>CREDENCIAIS DE ACESSO</Text>
                        <View style={styles.sectionCard}>
                            {/* Bank Name Row */}
                            <View style={styles.itemContainer}>
                                <View style={[styles.itemIconContainer, { backgroundColor: '#FFFFFF' }]}>
                                    <BankConnectorLogo
                                        connector={selectedConnector}
                                        size={24}
                                        borderRadius={8}
                                        iconSize={18}
                                        showBorder={false}
                                        backgroundColor="transparent"
                                    />
                                </View>
                                <View style={styles.itemRightContainer}>
                                    <View style={styles.itemContent}>
                                        <Text style={styles.itemTitle}>Banco</Text>
                                        <Text style={{ color: '#8E8E93', fontSize: 16 }}>{selectedConnector?.name}</Text>
                                    </View>
                                </View>
                            </View>
                            <View style={styles.separator} />

                            {selectedConnector?.credentials?.map((cred, index) => (
                                <View key={index}>
                                    <View style={styles.itemContainer}>
                                        <View style={styles.itemIconContainer}>
                                            {cred.type === 'password' ? (
                                                <Lock size={18} color="#D97757" />
                                            ) : (
                                                <User size={18} color="#D97757" />
                                            )}
                                        </View>
                                        <View style={styles.itemRightContainer}>
                                            <View style={styles.itemContent}>
                                                <Text style={styles.itemTitle}>{cred.label}</Text>
                                                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }}>
                                                    <TextInput
                                                        style={styles.credentialInput}
                                                        placeholder={cred.placeholder || "Digite..."}
                                                        placeholderTextColor="#505050"
                                                        value={credentialValues[cred.name]}
                                                        onChangeText={(text) => {
                                                            let formattedText = text;
                                                            // Simple mask for CPF
                                                            if (cred.label?.toLowerCase().includes('cpf')) {
                                                                // Remove non-digits
                                                                const code = text.replace(/\D/g, '');
                                                                // Apply mask
                                                                formattedText = code
                                                                    .replace(/(\d{3})(\d)/, '$1.$2')
                                                                    .replace(/(\d{3})(\d)/, '$1.$2')
                                                                    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
                                                            }
                                                            setCredentialValues(prev => ({
                                                                ...prev,
                                                                [cred.name]: formattedText
                                                            }))
                                                        }}
                                                        secureTextEntry={cred.type === 'password' && !showPasswords[cred.name]}
                                                        autoCapitalize="none"
                                                        autoCorrect={false}
                                                        keyboardType={cred.label?.toLowerCase().includes('cpf') ? 'numeric' : 'default'}
                                                        maxLength={cred.label?.toLowerCase().includes('cpf') ? 14 : undefined}
                                                    />
                                                    {cred.type === 'password' && (
                                                        <TouchableOpacity
                                                            onPress={() => setShowPasswords(prev => ({
                                                                ...prev,
                                                                [cred.name]: !prev[cred.name]
                                                            }))}
                                                            style={{ marginLeft: 8 }}
                                                        >
                                                            {showPasswords[cred.name] ? (
                                                                <EyeOff size={18} color="#666" />
                                                            ) : (
                                                                <Eye size={18} color="#666" />
                                                            )}
                                                        </TouchableOpacity>
                                                    )}
                                                </View>
                                            </View>
                                        </View>
                                    </View>
                                    {index < ((selectedConnector?.credentials?.length || 0) - 1) && (
                                        <View style={styles.separator} />
                                    )}
                                </View>
                            ))}
                            <View style={{ height: 20 }} />
                        </View>
                    </ScrollView>
                );

            case 'connecting':
                return (
                    <View style={styles.statusContainer}>
                        <View style={styles.statusIconContainer}>
                            <ActivityIndicator size="large" color="#D97757" />
                        </View>
                        <Text style={styles.statusTitle}>Conectando...</Text>
                        <Text style={styles.statusText}>
                            Aguarde enquanto estabelecemos uma conexão segura com {selectedConnector?.name}
                        </Text>

                        {/* Progress bar */}
                        <View style={styles.progressBarContainer}>
                            <View style={[styles.progressBar, { width: `${connectionProgress}%` }]} />
                        </View>
                        <Text style={styles.progressText}>{connectionProgress}%</Text>
                    </View>
                );

            case 'success':
                return (
                    <View style={styles.statusContainer}>
                        <View style={[styles.statusIconContainer, styles.successIcon]}>
                            <CheckCircle2 size={48} color="#04D361" />
                        </View>
                        <Text style={styles.statusTitle}>Conexão realizada!</Text>
                        <Text style={styles.statusText}>
                            Sua conta do {selectedConnector?.name} foi conectada com sucesso. Os dados serão sincronizados em breve.
                        </Text>
                    </View>
                );

            case 'error':
                return (
                    <View style={styles.statusContainer}>
                        <View style={[styles.statusIconContainer, styles.errorIcon]}>
                            <XCircle size={48} color="#EF4444" />
                        </View>
                        <Text style={styles.statusTitle}>Erro na conexão</Text>
                        <Text style={styles.statusText}>{connectionError}</Text>

                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => setConnectionStep('credentials')}
                        >
                            <Text style={styles.actionButtonText}>Tentar novamente</Text>
                        </TouchableOpacity>
                    </View>
                );

            case 'oauth_pending':
                return (
                    <View style={styles.statusContainer}>
                        <View style={styles.statusIconContainer}>
                            <ActivityIndicator size="large" color="#D97757" />
                        </View>
                        <Text style={styles.statusTitle}>Aguardando autorização</Text>
                        <Text style={styles.statusText}>
                            Conclua a autorização no app do seu banco. Quando terminar, volte para este aplicativo.
                        </Text>

                        {/* Progress indicator */}
                        <View style={styles.progressBarContainer}>
                            <View style={[styles.progressBar, { width: `${connectionProgress}%` }]} />
                        </View>
                        <Text style={styles.progressText}>
                            {oauthPolling ? 'Verificando autorização...' : 'Aguardando...'}
                        </Text>

                        <TouchableOpacity
                            style={[styles.actionButton, { marginTop: 20, backgroundColor: '#333' }]}
                            onPress={() => {
                                setOauthPolling(false);
                                setPendingItemId(null);
                                setConnectionStep('credentials');
                            }}
                        >
                            <Text style={styles.actionButtonText}>Cancelar</Text>
                        </TouchableOpacity>
                    </View>
                );
        }
    };

    return (
        <View style={styles.mainContainer}>
            <UniversalBackground
                backgroundColor="#0C0C0C"
                glowSize={350}
                height={320}
                showParticles={true}
                particleCount={15}
            />

            <View style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.title}>Contas Bancárias</Text>

                    <View style={styles.headerRight}>
                        {/* Credits Badge & Connect Button Merged */}
                        {user && (
                            <SyncCreditsDisplay
                                userId={user.uid}
                                compact
                                onConnect={handleOpenModal}
                                connectDisabled={!hasCredits}
                            />
                        )}
                    </View>
                </View>

                <View style={styles.content}>
                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <LottieView
                                source={require('@/assets/carregando.json')}
                                autoPlay
                                loop
                                style={{ width: 50, height: 50 }}
                            />
                            <Text style={styles.loadingText}>Carregando contas{loadingDots}</Text>
                        </View>
                    ) : (
                        <ScrollView
                            style={styles.accountsScroll}
                            contentContainerStyle={styles.accountsScrollContent}
                            refreshControl={
                                <RefreshControl
                                    refreshing={refreshing}
                                    onRefresh={onRefresh}
                                    tintColor="#D97757"
                                />
                            }
                        >
                            {accounts.length === 0 ? (
                                <View style={styles.emptyState}>
                                    <View style={styles.emptyIconContainer}>
                                        <Zap size={32} color="#D97757" />
                                    </View>
                                    <Text style={styles.emptyTitle}>Nenhuma conta conectada</Text>
                                    <Text style={styles.emptyText}>
                                        Conecte suas contas bancárias para usar o poder do Open Finance.
                                    </Text>
                                    <TouchableOpacity
                                        style={styles.emptyButton}
                                        onPress={handleOpenModal}
                                    >
                                        <Text style={styles.emptyButtonText}>Conectar agora</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                Object.values(groupedAccounts).map((group: any, index) => {
                                    const groupItemId =
                                        group.accounts?.[0]?.pluggyItemId ||
                                        group.accounts?.[0]?.itemId ||
                                        group.connector?.id ||
                                        `bank-${index}`;

                                    return (
                                        <ConnectedBankCard
                                            key={groupItemId}
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

                <BottomModal
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
                    height={connectionStep === 'banks' ? '85%' : 'auto'}
                    onBack={connectionStep === 'credentials' ? () => setConnectionStep('banks') : undefined}
                    rightElement={connectionStep === 'credentials' ? (
                        <TouchableOpacity
                            onPress={handleConnect}
                            disabled={connecting}
                            style={styles.headerConnectButton}
                        >
                            {connecting ? (
                                <ActivityIndicator size="small" color="#D97757" />
                            ) : (
                                <Text style={styles.headerConnectText}>Conectar</Text>
                            )}
                        </TouchableOpacity>
                    ) : undefined}
                >
                    {renderModalContent()}
                </BottomModal>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    mainContainer: {
        flex: 1,
        backgroundColor: '#0C0C0C',
    },
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        paddingTop: 60,
        paddingHorizontal: 20,
        zIndex: 10,
    },
    header: {
        marginBottom: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    connectButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#D97757',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        gap: 6,
    },
    connectButtonDisabled: {
        backgroundColor: '#444',
        opacity: 0.6,
    },
    connectButtonText: {
        color: '#FFFFFF',
        fontWeight: '700',
        fontSize: 14,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    content: {
        flex: 1,
    },
    // Modal styles
    modalScroll: {
        // flex: 1, removed for auto-height compatibility
    },
    modalContent: {
        paddingBottom: 20,
    },
    sectionHeader: {
        fontSize: 12,
        fontWeight: '600',
        color: '#8E8E93',
        marginTop: 10,
        marginBottom: 8,
        marginLeft: 4,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    sectionCard: {
        backgroundColor: '#1A1A1A',
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#2A2A2A',
        marginBottom: 10
    },
    itemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1A1A1A',
        paddingVertical: 16,
        paddingHorizontal: 16,
        position: 'relative',
    },
    itemIconContainer: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    itemRightContainer: {
        flex: 1,
    },
    itemContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    itemTitle: {
        fontSize: 16,
        color: '#FFFFFF',
        fontWeight: '500',
    },
    itemSubtitle: {
        fontSize: 13,
        color: '#909090',
        marginTop: 2,
    },
    separator: {
        height: 1,
        backgroundColor: '#2A2A2A',
        width: '100%',
    },
    fullSeparator: {
        height: 1,
        backgroundColor: '#2A2A2A',
        width: '100%',
    },

    // Help Container Style matching Settings
    helpContainer: {
        backgroundColor: '#1A1A1A',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#2A2A2A',
        marginTop: 4,
        marginBottom: 20
    },
    helpHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8
    },
    helpTitle: {
        fontSize: 14,
        color: '#D97757',
        fontWeight: '600'
    },
    helpText: {
        fontSize: 13,
        color: '#CCC',
        lineHeight: 20
    },

    actionButton: {
        backgroundColor: '#D97757',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 10,
    },
    actionButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    actionButtonDisabled: {
        opacity: 0.7,
    },
    headerConnectButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        padding: 4,
        paddingHorizontal: 8,
    },
    headerConnectText: {
        color: '#D97757',
        fontSize: 14,
        fontWeight: '600',
    },

    // Banks list styles
    banksContainer: {
        flex: 1,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1A1A1A',
        borderRadius: 12,
        paddingHorizontal: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#2A2A2A',
        height: 50,
    },
    searchInput: {
        flex: 1,
        color: '#FFFFFF',
        fontSize: 16,
        paddingVertical: 12,
        marginLeft: 8,
    },
    banksList: {
        backgroundColor: '#1A1A1A',
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#2A2A2A',
    },
    connectorsErrorContainer: {
        backgroundColor: '#1A1A1A',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#2A2A2A',
        padding: 16,
        alignItems: 'center',
    },
    connectorsErrorTitle: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
        textAlign: 'center',
    },
    connectorsErrorText: {
        color: '#909090',
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
        marginTop: 8,
    },
    connectorsRetryButton: {
        backgroundColor: '#D97757',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 10,
        marginTop: 16,
        alignItems: 'center',
        width: '100%',
    },
    connectorsRetryButtonText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '600',
    },
    bankListRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 16,
        backgroundColor: '#1A1A1A',
    },
    bankListLogoContainer: {
        marginRight: 12,
    },
    bankListSeparator: {
        height: 1,
        backgroundColor: '#2A2A2A',
        width: '100%',
    },
    bankColorStrip: {
        width: 4,
        height: 24,
        borderRadius: 4,
        marginRight: 16,
    },
    bankRowTitle: {
        flex: 1,
        fontSize: 16,
        color: '#FFFFFF',
        fontWeight: '500',
    },

    // Credentials styles
    credentialsContent: {
        // paddingBottom: 40, removed
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
        gap: 8,
    },
    backButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
    },
    selectedBankInfo: {
        alignItems: 'center',
        marginBottom: 24,
    },
    selectedBankLogo: {
        width: 64,
        height: 64,
        borderRadius: 32,
        marginBottom: 12,
        backgroundColor: '#fff',
    },
    selectedBankName: {
        color: '#FFFFFF',
        fontSize: 20,
        fontWeight: '600',
    },
    credentialInput: {
        flex: 1,
        color: '#FFFFFF',
        fontSize: 16,
        paddingVertical: 14,
        paddingRight: 16,
        textAlign: 'right',
    },
    eyeButton: {
        padding: 14,
    },
    securityNote: {
        color: '#666',
        fontSize: 12,
        textAlign: 'center',
        marginTop: 16,
    },
    // Status styles
    statusContainer: {
        // flex: 1, removed for auto-height compatibility
        // justifyContent: 'center', removed
        alignItems: 'center',
        padding: 20,
    },
    statusIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(217, 119, 87, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    successIcon: {
        backgroundColor: 'rgba(4, 211, 97, 0.1)',
    },
    errorIcon: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
    },
    statusTitle: {
        color: '#FFFFFF',
        fontSize: 24,
        fontWeight: '600',
        marginBottom: 12,
        textAlign: 'center',
    },
    statusText: {
        color: '#909090',
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 24,
    },
    progressBarContainer: {
        width: '100%',
        height: 6,
        backgroundColor: '#2A2A2A',
        borderRadius: 3,
        marginTop: 20,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        backgroundColor: '#D97757',
        borderRadius: 3,
    },
    progressText: {
        color: '#909090',
        fontSize: 14,
        marginTop: 8,
    },
    // Loading & empty states
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
    },
    loadingText: {
        color: '#909090',
        fontSize: 14,
    },
    emptyText: {
        color: '#909090',
        textAlign: 'center',
        marginTop: 40,
    },
    // Account list styles
    accountsScroll: {
        flex: 1,
    },
    accountsScrollContent: {
        paddingBottom: 20,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 60,
        padding: 20,
    },
    emptyIconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(217, 119, 87, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 8,
    },
    emptyButton: {
        backgroundColor: '#30302E',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#40403E',
    },
    emptyButtonText: {
        color: '#FFFFFF',
        fontWeight: '600',
    },
    connectedBankCard: {
        backgroundColor: '#111111',
        borderRadius: 22,
        marginBottom: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#262626',
    },
    connectedBankHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 18,
        backgroundColor: '#111111',
    },
    bankHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
    },
    bankHeaderRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(4, 211, 97, 0.1)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusBadgeText: {
        fontSize: 12,
        color: '#04D361',
        fontWeight: '600',
    },
    connectorName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FAFAFA',
        letterSpacing: -0.3,
    },
    connectedBankBody: {
        padding: 0,
        backgroundColor: '#0F0F0F',
    },
    innerAccountRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 18,
        borderTopWidth: 1,
        borderTopColor: '#1A1A1A',
    },
    accountRowDivider: {
        // Handled by borderTop in innerAccountRow
    },
    accountRowInfo: {
        flex: 1,
    },
    accountName: {
        fontSize: 14,
        color: '#E0E0E0',
        fontWeight: '500',
        marginBottom: 3,
    },
    accountNumber: {
        fontSize: 12,
        color: '#606060',
        letterSpacing: 0.5,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#04D361',
    },
    syncButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1A1A1A',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 100,
        marginRight: 10,
        gap: 6,
        minWidth: 100,
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#262626',
    },
    syncButtonDisabled: {
        opacity: 0.8,
    },
    syncButtonSuccess: {
        backgroundColor: 'rgba(4, 211, 97, 0.15)',
    },
    syncButtonError: {
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
    },
    syncButtonText: {
        color: '#D97757',
        fontSize: 12,
        fontWeight: '600',
    },
    syncProgressContainer: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#1A1A1A',
        borderTopWidth: 1,
        borderTopColor: '#2A2A2A',
    },
    syncProgressBar: {
        height: 4,
        backgroundColor: '#2A2A2A',
        borderRadius: 2,
        overflow: 'hidden',
        marginBottom: 8,
    },
    syncProgressFill: {
        height: '100%',
        backgroundColor: '#D97757',
        borderRadius: 2,
    },
    syncProgressText: {
        color: '#909090',
        fontSize: 12,
        textAlign: 'center',
    },
});



