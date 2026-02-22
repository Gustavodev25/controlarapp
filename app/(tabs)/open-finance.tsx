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
import { API_BASE_URL, API_BASE_URL_CANDIDATES } from '@/services/apiBaseUrl';
import { databaseService } from '@/services/firebase';
import { notificationService } from '@/services/notifications';
import { getConnectorLogoUrl, normalizeHexColor } from '@/utils/connectorLogo';
import * as Linking from 'expo-linking';
import LottieView from 'lottie-react-native';
import { ChevronRight, Eye, EyeOff, Lock, Search, ShieldCheck, User, Zap } from 'lucide-react-native';
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
        if (error.name === 'AbortError') {
            throw new TypeError('Network request timed out');
        }
        throw error;
    }
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const checkAuthRequirements = (item: any) => {
    return {
        url: item.connectorUrl || item.oauthUrl || null,
        needsAction: item.status === 'WAITING_USER_INPUT' || item.status === 'LOGIN_ERROR',
        status: item.status
    };
};

const validateCPF = (cpf: string): boolean => {
    const cleanCPF = cpf.replace(/\D/g, '');
    if (cleanCPF.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(cleanCPF)) return false;

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

const formatCPF = (value: string): string => {
    const numbers = value.replace(/\D/g, '').slice(0, 11);
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
    if (numbers.length <= 9) return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
    return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9)}`;
};

const formatCNPJ = (value: string): string => {
    const numbers = value.replace(/\D/g, '').slice(0, 14);
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 5) return `${numbers.slice(0, 2)}.${numbers.slice(2)}`;
    if (numbers.length <= 8) return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5)}`;
    if (numbers.length <= 12) return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5, 8)}/${numbers.slice(8)}`;
    return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5, 8)}/${numbers.slice(8, 12)}-${numbers.slice(12)}`;
};

const validateCNPJ = (cnpj: string): boolean => {
    const cleanCNPJ = cnpj.replace(/\D/g, '');

    if (cleanCNPJ.length !== 14) return false;
    if (/^(\d)\1{13}$/.test(cleanCNPJ)) return false;

    let length = cleanCNPJ.length - 2;
    let numbers = cleanCNPJ.substring(0, length);
    const digits = cnpj.substring(length);
    let sum = 0;
    let pos = length - 7;

    for (let i = length; i >= 1; i--) {
        sum += parseInt(numbers.charAt(length - i)) * pos--;
        if (pos < 2) pos = 9;
    }

    let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(digits.charAt(0))) return false;

    length = length + 1;
    numbers = cleanCNPJ.substring(0, length);
    sum = 0;
    pos = length - 7;

    for (let i = length; i >= 1; i--) {
        sum += parseInt(numbers.charAt(length - i)) * pos--;
        if (pos < 2) pos = 9;
    }

    result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(digits.charAt(1))) return false;

    return true;
};

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
type ConnectorCredential = Connector['credentials'][number];

const getCredentialSearchText = (credential: ConnectorCredential): string => (
    `${credential.label || ''} ${credential.placeholder || ''} ${credential.validation || ''} ${credential.validationMessage || ''}`
).toLowerCase();

const credentialHasCpf = (credential: ConnectorCredential): boolean => (
    getCredentialSearchText(credential).includes('cpf')
);

const credentialHasCnpj = (credential: ConnectorCredential): boolean => (
    getCredentialSearchText(credential).includes('cnpj')
);

const isDocumentCredential = (credential: ConnectorCredential): boolean => {
    return credentialHasCpf(credential) || credentialHasCnpj(credential);
};

const getConnectorDocumentSupport = (credentials: ConnectorCredential[] = []) => {
    const hasCpfCredential = credentials.some(credentialHasCpf);
    const hasCnpjCredential = credentials.some(credentialHasCnpj);

    return {
        hasCpfCredential,
        hasCnpjCredential,
        acceptsBothDocuments: hasCpfCredential && hasCnpjCredential,
    };
};

const OAUTH_REDIRECT_URI = Linking.createURL('open-finance/callback');

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
    const [dataRefreshKey, setDataRefreshKey] = useState(0);

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
    const { credits: syncCredits, refresh: refreshCredits, consumeCredit, hasCredits, canSyncItem } = useSyncCredits(user?.uid);

    useEffect(() => {
        notificationService.scheduleDailySyncResetNotification();
    }, []);

    const [connectionStep, setConnectionStep] = useState<ConnectionStep>('info');
    const [connectors, setConnectors] = useState<Connector[]>([]);
    const [loadingConnectors, setLoadingConnectors] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [connectorsFetchError, setConnectorsFetchError] = useState<string | null>(null);
    const [selectedConnector, setSelectedConnector] = useState<Connector | null>(null);
    const [credentialValues, setCredentialValues] = useState<CredentialValues>({});
    const [showPasswords, setShowPasswords] = useState<{ [key: string]: boolean }>({});
    const [useCNPJ, setUseCNPJ] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [connectionError, setConnectionError] = useState<string | null>(null);
    const [connectionProgress, setConnectionProgress] = useState(0);
    const [connectionStatusText, setConnectionStatusText] = useState('Iniciando conexão...');
    const [apiBaseUrl, setApiBaseUrl] = useState(API_BASE_URL);

    // Novo estado para o Link caso o Android não abra automaticamente
    const [currentOauthUrl, setCurrentOauthUrl] = useState<string | null>(null);

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
            newIds = hiddenIds.filter(id => id !== accountId);
        } else {
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

    const [pendingItemId, setPendingItemId] = useState<string | null>(null);
    const pendingItemIdRef = useRef<string | null>(null);
    const [oauthPolling, setOauthPolling] = useState(false);
    const oauthPollingRef = useRef(false);

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
                setDataRefreshKey(prev => prev + 1);
            }
        } catch (error) {
            console.error('Error fetching accounts:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleOAuthCallback = useCallback(async (url: string) => {
        console.log('[OAuth] Callback received:', url);

        let itemId = pendingItemIdRef.current;

        try {
            const { queryParams } = Linking.parse(url);

            if (queryParams?.error) {
                console.error('[OAuth] Error in callback:', queryParams.error);
                setConnectionError('O banco recusou a conexão ou ocorreu um erro.');
                setConnectionStep('error');
                setIsModalVisible(true);
                return;
            }
        } catch (e) {
            console.error('[OAuth] Failed to parse callback URL', e);
        }

        if (!itemId || !user) {
            console.log('[OAuth] No pending item or user to sync.');
            return;
        }

        console.log('[OAuth] Processando callback para o item:', itemId);

        setIsModalVisible(true);
        setConnectionStep('oauth_pending');
        setConnectionProgress(40);
        setConnectionStatusText('Autorização recebida do app! Aguardando o banco finalizar o envio (isso pode levar alguns minutos)...');

    }, [user]);

    useEffect(() => {
        const subscription = Linking.addEventListener('url', (event) => {
            if (event.url.includes('open-finance') || event.url.includes('pluggy')) {
                handleOAuthCallback(event.url);
            }
        });

        Linking.getInitialURL().then((url) => {
            if (url && (url.includes('open-finance') || url.includes('pluggy'))) {
                handleOAuthCallback(url);
            }
        });

        return () => {
            subscription.remove();
        };
    }, [handleOAuthCallback]);

    // Polling effect for OAuth flow
    useEffect(() => {
        if (connectionStep !== 'oauth_pending' || !pendingItemId || !user) {
            return;
        }

        let pollCount = 0;
        const maxPolls = 180; // AUMENTADO: 9 minutos de tolerância máxima para processamento do banco
        let cancelled = false;
        let intervalId: ReturnType<typeof setInterval> | null = null;

        const checkStatus = async () => {
            if (cancelled) return;

            pollCount++;

            try {
                const token = await user.getIdToken();
                const response = await apiFetch(`/api/pluggy/items/${pendingItemId}?userId=${user.uid}`, {
                    headers: { 'Authorization': `Bearer ${token}` },
                    timeout: 15000
                });

                if (response.ok) {
                    const data = await response.json();
                    const item = data.item || data;
                    const status = item.status;

                    if (status === 'UPDATED') {
                        cancelled = true;
                        if (intervalId) clearInterval(intervalId);

                        setOauthPolling(false);
                        setConnectionStep('connecting');
                        setConnectionProgress(60);
                        setConnectionStatusText('Autorização confirmada! Preparando extração de dados (Isso pode levar alguns minutos)...');

                        await new Promise(resolve => setTimeout(resolve, 8000));

                        try {
                            const token = await user.getIdToken();

                            let syncResponse = await apiFetch('/api/pluggy/sync', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${token}`
                                },
                                body: JSON.stringify({
                                    userId: user.uid,
                                    itemId: pendingItemId,
                                }),
                                timeout: 240000 // AUMENTADO PARA 4 MINUTOS (Bancos podem demorar no 1º sync)
                            });

                            if (syncResponse.ok) {
                                let syncData = await syncResponse.json();
                                let totalTx = syncData.accounts?.reduce((acc: any, a: any) => acc + (a.transactions?.length || 0), 0) || 0;

                                if (totalTx === 0 && syncData.accounts && syncData.accounts.length > 0) {
                                    setConnectionStatusText('O banco está processando seu extrato. Por favor, aguarde mais um pouco...');
                                    await new Promise(resolve => setTimeout(resolve, 10000));

                                    const retryResponse = await apiFetch('/api/pluggy/sync', {
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

                                    if (retryResponse.ok) {
                                        syncData = await retryResponse.json();
                                        totalTx = syncData.accounts?.reduce((acc: any, a: any) => acc + (a.transactions?.length || 0), 0) || 0;
                                    }
                                }

                                setConnectionProgress(80);

                                if (syncData.accounts && syncData.accounts.length > 0) {
                                    for (let i = 0; i < syncData.accounts.length; i++) {
                                        const account = syncData.accounts[i];
                                        setConnectionStatusText(`Organizando conta ${i + 1} de ${syncData.accounts.length}...`);
                                        await databaseService.saveAccount(
                                            user.uid,
                                            account,
                                            syncData.connector || selectedConnector
                                        );
                                    }

                                    setConnectionStatusText(`Salvando ${totalTx} transações no banco de dados...`);
                                    const txResult = await databaseService.saveOpenFinanceTransactions(
                                        user.uid,
                                        syncData.accounts,
                                        syncData.connector || selectedConnector
                                    );

                                    if (!txResult.success) {
                                        console.warn('[OAuth Polling] Erro ao salvar transações:', txResult.error);
                                    } else {
                                        console.log(`[OAuth Polling] ${txResult.savedCount} transações salvas com sucesso.`);
                                    }
                                }

                                setConnectionProgress(100);
                                setConnectionStatusText('Sincronização concluída com sucesso!');
                                setConnectionStep('success');
                                setPendingItemId(null);
                                setCurrentOauthUrl(null);

                                setTimeout(() => {
                                    fetchAccounts();
                                    refreshCredits();
                                    setTimeout(() => {
                                        setIsModalVisible(false);
                                        setConnectionStep('info');
                                    }, 1500);
                                }, 1000);
                            } else {
                                throw new Error('Falha de sincronização com o servidor');
                            }
                        } catch (syncError) {
                            console.error('[OAuth Polling] Sync error:', syncError);
                            setConnectionError('O servidor levou muito tempo para baixar as transações e o tempo esgotou. Tente novamente.');
                            setConnectionStep('error');
                            setCurrentOauthUrl(null);
                        }
                        return;
                    }

                    if (status === 'UPDATING' || status === 'WAITING_USER_INPUT') {
                        if (status === 'UPDATING' && connectionProgress < 50) {
                            setConnectionProgress(50);
                            setConnectionStatusText('O banco autorizou. Extraindo dados (Isso leva de 1 a 3 minutos)...');
                        }
                        return;
                    }

                    if (status === 'LOGIN_ERROR' || status === 'OUTDATED' || status === 'ERROR') {
                        cancelled = true;
                        if (intervalId) clearInterval(intervalId);

                        setOauthPolling(false);

                        let errorMessage = 'Erro ao conectar com o banco.';

                        if (status === 'LOGIN_ERROR') {
                            errorMessage = 'Credenciais inválidas ou banco temporariamente indisponível. Verifique seus dados e tente novamente.';
                        } else if (status === 'OUTDATED') {
                            errorMessage = 'A conexão expirou. Por favor, reconecte sua conta bancária.';
                        } else if (status === 'ERROR') {
                            const errorDetails = item.error || item.executionErrorResult;
                            if (errorDetails?.message?.toLowerCase().includes('mfa') ||
                                errorDetails?.message?.toLowerCase().includes('autenticação') ||
                                errorDetails?.message?.toLowerCase().includes('token')) {
                                errorMessage = 'O banco exige dupla validação (MFA) que ainda não é suportada. Tente usar outro método de conexão.';
                            } else {
                                errorMessage = 'Erro ao processar a conexão. Tente novamente mais tarde.';
                            }
                        }

                        setConnectionError(errorMessage);
                        setConnectionStep('error');
                        setPendingItemId(null);
                        setCurrentOauthUrl(null);
                        return;
                    }
                }
            } catch (error) {
                console.warn('[OAuth Polling] Error:', error);
            }

            if (pollCount >= maxPolls && !cancelled) {
                cancelled = true;
                if (intervalId) clearInterval(intervalId);

                setOauthPolling(false);
                setConnectionError('Tempo expirado. O banco demorou muito para processar sua autorização.');
                setConnectionStep('error');
                setPendingItemId(null);
                setCurrentOauthUrl(null);
            }
        };

        setOauthPolling(true);
        checkStatus();

        intervalId = setInterval(checkStatus, 3000);

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
        setConnectionStatusText('');
        setCurrentOauthUrl(null);
    };

    const handleCloseModal = () => {
        setIsModalVisible(false);
        setConnectionStep('info');
        setSelectedConnector(null);
        setCredentialValues({});
        setConnectorsFetchError(null);
        setConnectionError(null);
        setSearchQuery('');
        setUseCNPJ(false);
        setConnectionStatusText('');
        setCurrentOauthUrl(null);
    };

    const handleStartConnection = () => {
        setConnectionStep('banks');
        fetchConnectors();
    };

    const handleSelectConnector = (connector: Connector) => {
        setSelectedConnector(connector);
        setUseCNPJ(false);
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
        setLoading(true);
        setDeleteModalVisible(false);

        try {
            const accountIds = (itemToDelete.accounts || [])
                .map((acc: any) => acc?.id)
                .filter(Boolean);

            const deleteResult = await databaseService.deleteOpenFinanceConnection(user.uid, accountIds);
            if (!deleteResult.success) {
                throw new Error(deleteResult.error || 'Falha ao remover dados da conexao');
            }

            await fetchAccounts();
            setItemToDelete(null);
        } catch (error) {
            Alert.alert('Erro', 'Não foi possível desconectar a instituição.');
        } finally {
            setLoading(false);
        }
    };

    const handleSyncBank = async (
        group: any,
        onStatusUpdate: (status: SyncStatus) => void
    ): Promise<void> => {
        if (!user) return;

        const firstAccount = group.accounts[0];
        const itemId = firstAccount?.pluggyItemId ||
            firstAccount?.itemId ||
            firstAccount?.connector?.itemId ||
            null;

        if (!itemId) {
            onStatusUpdate({ step: 'error', message: 'Conexão não identificada - itemId ausente', progress: 0 });
            setTimeout(() => {
                onStatusUpdate({ step: 'idle', message: '', progress: 0 });
            }, 3000);
            return;
        }

        try {
            onStatusUpdate({
                step: 'fetching_accounts',
                message: 'Obtendo dados do banco...',
                progress: 10
            });

            let fromDate: string | null = null;
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
            }

            const syncPayload: { userId: string; itemId: string; from?: string } = {
                userId: user.uid,
                itemId: itemId
            };

            if (fromDate) {
                syncPayload.from = fromDate;
            }

            const token = await user.getIdToken();
            const syncResponse = await apiFetch('/api/pluggy/sync', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(syncPayload),
                timeout: 240000
            });

            if (syncResponse.ok) {
                const syncData = await syncResponse.json();

                onStatusUpdate({
                    step: 'fetching_accounts',
                    message: `${syncData.accounts?.length || 0} contas encontradas`,
                    progress: 30
                });

                if (syncData.accounts && syncData.accounts.length > 0) {
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

                    let totalTransactions = 0;
                    syncData.accounts.forEach((acc: any) => {
                        totalTransactions += (acc.transactions?.length || 0);
                    });

                    onStatusUpdate({
                        step: 'fetching_transactions',
                        message: `${totalTransactions} transações encontradas`,
                        progress: 65
                    });

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

                await fetchAccounts();
            } else {
                throw new Error(`API Error: ${syncResponse.status}`);
            }
        } catch (error: any) {
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
        const connectorCredentials = selectedConnector.credentials || [];
        const { acceptsBothDocuments } = getConnectorDocumentSupport(connectorCredentials);

        if (!hasCredits) {
            const resetTime = databaseService.getTimeUntilReset();
            showWarning(
                'Creditos esgotados',
                `Voce nao tem mais creditos de sincronizacao hoje. Seus creditos serao renovados em ${resetTime.formatted}.`
            );
            return;
        }

        const missingFields = connectorCredentials.filter(cred => {
            if (credentialValues[cred.name]?.trim()) return false;
            if (!acceptsBothDocuments || !isDocumentCredential(cred)) return true;

            const isCpfCredential = credentialHasCpf(cred);
            const isCnpjCredential = credentialHasCnpj(cred);
            const acceptsBothInSameField = isCpfCredential && isCnpjCredential;

            if (acceptsBothInSameField) return true;
            return useCNPJ ? isCnpjCredential : isCpfCredential;
        });

        if (missingFields.length > 0) {
            showError('Campos obrigatorios', 'Por favor, preencha todos os campos obrigatorios.');
            return;
        }

        const documentCredential = connectorCredentials.find(cred => {
            if (!isDocumentCredential(cred)) return false;
            if (!acceptsBothDocuments) return true;

            const isCpfCredential = credentialHasCpf(cred);
            const isCnpjCredential = credentialHasCnpj(cred);
            const acceptsBothInSameField = isCpfCredential && isCnpjCredential;

            if (acceptsBothInSameField) return true;
            return useCNPJ ? isCnpjCredential : isCpfCredential;
        });
        const documentCredentialValue = documentCredential ? credentialValues[documentCredential.name] : '';

        if (documentCredential && documentCredentialValue) {
            const supportsCPF = credentialHasCpf(documentCredential);
            const supportsCNPJ = credentialHasCnpj(documentCredential);
            const shouldValidateAsCNPJ = supportsCNPJ && (!supportsCPF || useCNPJ);
            const cleanDoc = documentCredentialValue.replace(/\D/g, '');

            if (shouldValidateAsCNPJ) {
                if (cleanDoc.length !== 14 || !validateCNPJ(cleanDoc)) {
                    showError('CNPJ invalido', 'O CNPJ informado nao e valido.');
                    return;
                }
            } else {
                if (cleanDoc.length !== 11 || !validateCPF(cleanDoc)) {
                    showError('CPF invalido', 'O CPF informado nao e valido.');
                    return;
                }
            }
        }

        const creditResult = await consumeCredit('connect');
        if (!creditResult.success) {
            showError('Erro', creditResult.error || 'Erro ao consumir credito.');
            return;
        }

        setConnecting(true);
        setConnectionStep('connecting');
        setConnectionProgress(5);
        setConnectionStatusText('Autenticando com a instituição...');

        const isOAuthConnector = Boolean(selectedConnector.oauth || selectedConnector.isOpenFinance);
        let progressInterval: ReturnType<typeof setInterval> | null = null;

        try {
            progressInterval = setInterval(() => {
                setConnectionProgress(prev => Math.min(prev + 40, 40));
            }, 500);

            // Use a URL do backend Railway para o Pluggy OAuth callback
            // O backend irá redirecionar de volta para o app via deep link
            const redirectUri = 'https://backendcontrolarapp-production.up.railway.app/api/pluggy/oauth-callback';
            console.log('[Connect] Using Railway OAuth Redirect URI:', redirectUri);

            const sanitizedCredentials = { ...credentialValues };
            connectorCredentials
                .filter(isDocumentCredential)
                .forEach((credential) => {
                    if (sanitizedCredentials[credential.name]) {
                        sanitizedCredentials[credential.name] = sanitizedCredentials[credential.name].replace(/\D/g, '');
                    }
                });

            const token = await user.getIdToken();
            setConnectionProgress(15);
            setConnectionStatusText('Criando conexão segura com a Pluggy...');

            // AUMENTADO O TIMEOUT DA CHAMADA DE CRIAÇÃO PARA 90 SEG (MUITO IMPORTANTE)
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
                timeout: 90000
            });

            const createData = await createResponse.json();

            if (!createResponse.ok) {
                let errorMessage = 'Falha ao conectar. Verifique suas credenciais.';

                if (createData.details) {
                    if (Array.isArray(createData.details)) {
                        errorMessage = `Erro de validação nos dados enviados ao banco.`;
                    } else if (createData.details.code === 'INVALID_CREDENTIALS') {
                        errorMessage = 'Credenciais inválidas. Verifique seu usuário e senha.';
                    } else if (createData.details.code === 'INSTITUTION_UNAVAILABLE') {
                        errorMessage = 'O banco está temporariamente indisponível. Tente novamente em alguns minutos.';
                    } else if (createData.details.code === 'MFA_REQUIRED') {
                        errorMessage = 'Este banco exige autenticação de dois fatores (MFA) que ainda não é suportada.';
                    } else if (createData.details.codeDescription === 'ITEM_IS_ALREADY_UPDATING') {
                        errorMessage = 'Uma conexão com este banco já está em andamento. Aguarde alguns segundos e tente novamente.';
                    }
                } else if (createData.error) {
                    errorMessage = createData.error;
                }

                console.error('[Connect] Create item failed:', {
                    status: createResponse.status,
                    error: errorMessage,
                    details: createData.details
                });

                setConnectionError(errorMessage);
                setConnectionStep('error');
                return;
            }

            const item = createData.item;
            const itemId = item?.id;

            if (!itemId) {
                throw new Error('Item ID nao retornado pelo servidor');
            }

            setConnectionProgress(25);
            setConnectionStatusText('Analisando requisitos de acesso do banco...');

            // ATUALIZADO PARA INCLUIR CLIENT_URL NA BUSCA DO LINK DE AUTORIZAÇÃO
            const resolveAuthRequirements = (currentItem: any) => {
                const url =
                    currentItem.oauthUrl ||
                    currentItem.clientUrl ||
                    currentItem.redirectUrl ||
                    currentItem.parameter?.data ||
                    currentItem.parameter?.oauthUrl ||
                    currentItem.parameter?.authorizationUrl ||
                    currentItem.parameter?.url ||
                    currentItem.userAction?.url ||
                    currentItem.userAction?.oauthUrl ||
                    currentItem.authorizationUrl ||
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
                // AUMENTADO DE 20 PARA 60 (Tempo de espera do polling elevado de 40s para 120s)
                const maxAttempts = 60;

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
                        const pollResponse = await apiFetch(`/api/pluggy/items/${itemId}?userId=${user.uid}`, {
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
                if (!oauthUrl && status !== 'UPDATED') {
                    showError('Erro', 'O banco não retornou o link de autorização. Tente novamente mais tarde.');
                    setConnectionError('O servidor do banco demorou muito para responder (Tempo limite excedido). Tente novamente em alguns minutos.');
                    setConnectionStep('error');
                    setPendingItemId(null);
                    return;
                }

                if (status !== 'UPDATED') {
                    setConnectionProgress(30);
                    setConnectionStatusText('Aguardando autorização no app do banco...');
                    setPendingItemId(itemId);
                    setCurrentOauthUrl(oauthUrl);
                    setConnectionStep('oauth_pending');

                    try {
                        await Linking.openURL(oauthUrl);
                    } catch (openError) {
                        console.warn('[Connect] Failed automatic redirect, user must click manual button.');
                    }
                    return;
                }
            }

            setConnectionProgress(50);
            setConnectionStatusText('Conexão autorizada. Preparando extração de dados (Aguarde alguns segundos)...');

            await new Promise(resolve => setTimeout(resolve, 8000));

            let syncResponse = await apiFetch('/api/pluggy/sync', {
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
                throw new Error(`O servidor demorou muito para responder ou houve uma falha. Tente novamente.`);
            }

            let syncData = await syncResponse.json();
            let totalTx = syncData.accounts?.reduce((acc: any, a: any) => acc + (a.transactions?.length || 0), 0) || 0;

            if (totalTx === 0 && syncData.accounts && syncData.accounts.length > 0) {
                setConnectionStatusText('O banco está processando seu extrato. Por favor, aguarde mais um pouco...');
                await new Promise(resolve => setTimeout(resolve, 10000));

                const retryResponse = await apiFetch('/api/pluggy/sync', {
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

                if (retryResponse.ok) {
                    syncData = await retryResponse.json();
                    totalTx = syncData.accounts?.reduce((acc: any, a: any) => acc + (a.transactions?.length || 0), 0) || 0;
                }
            }

            setConnectionProgress(80);

            if (syncData.accounts && syncData.accounts.length > 0) {
                for (let i = 0; i < syncData.accounts.length; i++) {
                    const account = syncData.accounts[i];
                    setConnectionStatusText(`Organizando dados da conta ${i + 1} de ${syncData.accounts.length}...`);
                    await databaseService.saveAccount(
                        user.uid,
                        account,
                        syncData.connector || selectedConnector
                    );
                }

                setConnectionStatusText(`Protegendo e salvando ${totalTx} transações...`);
                const txResult = await databaseService.saveOpenFinanceTransactions(
                    user.uid,
                    syncData.accounts,
                    syncData.connector || selectedConnector
                );

                if (!txResult.success) {
                    console.warn('[Connect] Erro ao salvar transações:', txResult.error);
                } else {
                    console.log(`[Connect] ${txResult.savedCount} transações salvas com sucesso.`);
                }
            }

            setConnectionProgress(100);
            setConnectionStatusText('Tudo pronto! Sincronização concluída.');
            setConnectionStep('success');

            setTimeout(() => {
                fetchAccounts();
                handleCloseModal();
            }, 2000);
        } catch (error: any) {
            setConnectionError(error?.message || 'Erro de conexao com o servidor ou limite de tempo excedido. Suas transações podem não ter salvo por completo.');
            setConnectionStep('error');
        } finally {
            if (progressInterval) clearInterval(progressInterval);
            setConnecting(false);
        }
    };

    const filteredConnectors = connectors.filter(connector =>
        connector.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    const shouldShowConnectorsNetworkError =
        !loadingConnectors && filteredConnectors.length === 0 && Boolean(connectorsFetchError);

    const groupedAccounts = accounts.reduce((acc, account) => {
        const connectorData = account.connector || null;
        const connectorName = connectorData?.name || account.name || 'Outros';

        if (!acc[connectorName]) {
            acc[connectorName] = { connector: connectorData, accounts: [] };
        }
        acc[connectorName].accounts.push(account);
        return acc;
    }, {} as Record<string, any>);

    const renderConnectorCard = ({ item }: { item: Connector }) => (
        <ConnectorCard item={item} onSelect={handleSelectConnector} styles={styles} />
    );

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
                            <Text style={styles.connectorsErrorTitle}>Falha ao conectar com o backend</Text>
                            <Text style={styles.connectorsErrorText}>{connectorsFetchError}</Text>
                            <TouchableOpacity style={styles.connectorsRetryButton} onPress={fetchConnectors} activeOpacity={0.8}>
                                <Text style={styles.connectorsRetryButtonText}>Tentar novamente</Text>
                            </TouchableOpacity>
                        </View>
                    );
                }

                return (
                    <FlatList
                        key="bank-list-1"
                        style={styles.banksListContainer}
                        data={filteredConnectors}
                        renderItem={renderConnectorCard}
                        keyExtractor={(item) => item.id.toString()}
                        contentContainerStyle={[styles.banksList, styles.banksListContent]}
                        ItemSeparatorComponent={() => <View style={styles.bankListSeparator} />}
                        showsVerticalScrollIndicator={false}
                        ListEmptyComponent={<Text style={styles.emptyText}>Nenhum banco encontrado</Text>}
                    />
                );

            case 'credentials':
                const visibleCredentials = (selectedConnector?.credentials || []).filter((cred) => {
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

                            {visibleCredentials.map((cred, index) => {
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
                                                                setCredentialValues(prev => ({ ...prev, [cred.name]: formattedText }))
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
                                                    documentFields.forEach(field => { nextValues[field.name] = ''; });
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
                                dot={{
                                    visible: true,
                                    size: 6,
                                    color: '#D97757',
                                    style: { marginRight: 4 },
                                }}
                                text={{
                                    fontSize: 13,
                                    color: '#E0E0E0',
                                    fontWeight: '500',
                                }}
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
                        <Text style={styles.statusText}>Sua conta do {selectedConnector?.name || 'banco'} foi conectada com sucesso. Os dados estão sendo atualizados no painel.</Text>
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
                                items={[{ text: connectionStatusText || (oauthPolling ? 'Aguardando você finalizar no app do banco...' : 'Aguardando...'), id: 'oauth-status' }]}
                                loop={false}
                                initialIndex={0}
                                timing={{ interval: 2000, animationDuration: 350 }}
                                dot={{
                                    visible: true,
                                    size: 6,
                                    color: '#D97757',
                                    style: { marginRight: 4 },
                                }}
                                text={{
                                    fontSize: 13,
                                    color: '#E0E0E0',
                                    fontWeight: '500',
                                }}
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

const styles = StyleSheet.create({
    mainContainer: { flex: 1, backgroundColor: '#0C0C0C' },
    container: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, paddingTop: 60, paddingHorizontal: 20, zIndex: 10 },
    header: { marginBottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    title: { fontSize: 24, fontWeight: '700', color: '#FFFFFF' },
    connectButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#D97757', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, gap: 6 },
    connectButtonDisabled: { backgroundColor: '#444', opacity: 0.6 },
    connectButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
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
    fullSeparator: { height: 1, backgroundColor: '#2A2A2A', width: '100%' },
    helpContainer: { backgroundColor: '#1A1A1A', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#2A2A2A', marginTop: 4, marginBottom: 20 },
    helpHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    helpTitle: { fontSize: 14, color: '#D97757', fontWeight: '600' },
    helpText: { fontSize: 13, color: '#CCC', lineHeight: 20 },
    actionButton: { backgroundColor: '#D97757', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 10 },
    actionButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
    actionButtonDisabled: { opacity: 0.7 },
    headerConnectButton: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 4, paddingHorizontal: 8 },
    headerConnectText: { color: '#D97757', fontSize: 14, fontWeight: '600' },
    banksContainer: { flex: 1 },
    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A1A', borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: '#2A2A2A', height: 48, width: '100%' },
    searchInput: { flex: 1, color: '#FFFFFF', fontSize: 16, paddingVertical: 12, marginLeft: 8 },
    banksList: { flexGrow: 1, paddingBottom: 8 },
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
    backButton: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 8 },
    backButtonText: { color: '#FFFFFF', fontSize: 16 },
    selectedBankInfo: { alignItems: 'center', marginBottom: 24 },
    selectedBankLogo: { width: 64, height: 64, borderRadius: 32, marginBottom: 12, backgroundColor: '#fff' },
    selectedBankName: { color: '#FFFFFF', fontSize: 20, fontWeight: '600' },
    credentialInputContainer: { marginLeft: 'auto', flex: 1, minWidth: 0, paddingLeft: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
    credentialInput: { flex: 1, color: '#FFFFFF', fontSize: 15, paddingVertical: 0, paddingRight: 0, textAlign: 'left' },
    credentialCpfInput: { textAlign: 'right' },
    credentialItemContainer: { paddingVertical: 14 },
    credentialItemContent: { flex: 1, flexDirection: 'row', alignItems: 'center' },
    credentialLabel: { flexShrink: 1 },
    documentSwitchCard: { backgroundColor: '#1A1A1A', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#2A2A2A', marginTop: 16 },
    documentSwitchContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, paddingHorizontal: 16 },
    documentSwitchLabel: { fontSize: 16, color: '#FFFFFF', fontWeight: '500' },
    eyeButton: { padding: 14 },
    securityNote: { color: '#666', fontSize: 12, textAlign: 'center', marginTop: 16 },
    statusContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, minHeight: 400 },
    statusIconContainer: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
    successIcon: { backgroundColor: 'rgba(4, 211, 97, 0.1)' },
    errorIcon: { backgroundColor: 'rgba(239, 68, 68, 0.1)' },
    statusTitle: { color: '#FFFFFF', fontSize: 24, fontWeight: '600', marginBottom: 12, textAlign: 'center' },
    statusSubtitle: { color: '#EF4444', fontSize: 14, fontWeight: '500', marginBottom: 12, textAlign: 'center' },
    statusText: { color: '#909090', fontSize: 16, textAlign: 'center', lineHeight: 24, marginBottom: 24 },
    progressBarContainer: { width: '100%', height: 6, backgroundColor: '#2A2A2A', borderRadius: 3, marginTop: 20, overflow: 'hidden' },
    progressBar: { height: '100%', backgroundColor: '#D97757', borderRadius: 3 },
    progressText: { color: '#909090', fontSize: 14, marginTop: 8 },
    stepContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A1A', padding: 14, borderRadius: 12, marginTop: 24, width: '100%', borderWidth: 1, borderColor: '#2A2A2A' },
    stepText: { color: '#E0E0E0', fontSize: 14, fontWeight: '500', flex: 1 },
    sseText: { color: '#909090', fontSize: 12, marginTop: 16, textAlign: 'center' },
    warningTextSimple: { color: '#FF9F0A', fontSize: 13, marginTop: 8, marginBottom: 4, textAlign: 'center' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
    loadingText: { color: '#909090', fontSize: 14 },
    emptyText: { color: '#888', textAlign: 'center', fontSize: 14, lineHeight: 20, maxWidth: 280 },
    accountsScroll: { flex: 1 },
    accountsScrollContent: { paddingBottom: 20 },
    emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 80, paddingHorizontal: 40 },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', marginTop: 20, marginBottom: 8, textAlign: 'center' },
    emptyButton: { backgroundColor: '#D97757', paddingVertical: 10, paddingHorizontal: 24, borderRadius: 20, marginTop: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    emptyButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
    connectedBankCard: { backgroundColor: '#111111', borderRadius: 22, marginBottom: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#262626' },
    connectedBankHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18, backgroundColor: '#111111' },
    bankHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    bankHeaderRight: { flexDirection: 'row', alignItems: 'center' },
    statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(4, 211, 97, 0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    statusBadgeText: { fontSize: 12, color: '#04D361', fontWeight: '600' },
    connectorName: { fontSize: 16, fontWeight: '600', color: '#FAFAFA', letterSpacing: -0.3 },
    connectedBankBody: { padding: 0, backgroundColor: '#0F0F0F' },
    innerAccountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 18, borderTopWidth: 1, borderTopColor: '#1A1A1A' },
    accountRowDivider: {},
    accountRowInfo: { flex: 1 },
    accountName: { fontSize: 14, color: '#E0E0E0', fontWeight: '500', marginBottom: 3 },
    accountNumber: { fontSize: 12, color: '#606060', letterSpacing: 0.5 },
    statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#04D361' },
    syncButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A1A', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 100, marginRight: 10, gap: 6, minWidth: 100, justifyContent: 'center', borderWidth: 1, borderColor: '#262626' },
    syncButtonDisabled: { opacity: 0.8 },
    syncButtonSuccess: { backgroundColor: 'rgba(4, 211, 97, 0.15)' },
    syncButtonError: { backgroundColor: 'rgba(239, 68, 68, 0.15)' },
    syncButtonText: { color: '#D97757', fontSize: 12, fontWeight: '600' },
    syncProgressContainer: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#1A1A1A', borderTopWidth: 1, borderTopColor: '#2A2A2A' },
    syncProgressBar: { height: 4, backgroundColor: '#2A2A2A', borderRadius: 2, overflow: 'hidden', marginBottom: 8 },
    syncProgressFill: { height: '100%', backgroundColor: '#D97757', borderRadius: 2 },
    syncProgressText: { color: '#909090', fontSize: 12, textAlign: 'center' },
});