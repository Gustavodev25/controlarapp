// Biometric Authentication Hook
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';

// Storage key generators - chaves vinculadas ao userId para segurança
const getBiometricEnabledKey = (userId: string) => `biometric_enabled_${userId}`;
const getLastAuthTimeKey = (userId: string) => `last_biometric_auth_${userId}`;

// Timeout para pedir biometria novamente (em minutos)
const BIOMETRIC_TIMEOUT_MINUTES = 5;

export interface BiometricAuthState {
    isLoading: boolean;
    isAuthenticated: boolean;
    isBiometricAvailable: boolean;
    isBiometricEnabled: boolean;
    biometricType: 'fingerprint' | 'facial' | 'iris' | 'none';
    error: string | null;
}

// userId é necessário para vincular biometria à conta correta
export function useBiometricAuth(userId?: string, autoAuthenticate = true) {
    const [state, setState] = useState<BiometricAuthState>({
        isLoading: true,
        isAuthenticated: false,
        isBiometricAvailable: false,
        isBiometricEnabled: false,
        biometricType: 'none',
        error: null,
    });

    const appState = useRef(AppState.currentState);
    const lastBackgroundTime = useRef<number | null>(null);
    const hasTriedAuth = useRef(false);

    const biometricTypeRef = useRef<BiometricAuthState['biometricType']>('none');

    // Verificar disponibilidade de biometria no dispositivo
    const checkBiometricAvailability = useCallback(async () => {
        try {
            const hasHardware = await LocalAuthentication.hasHardwareAsync();
            const isEnrolled = await LocalAuthentication.isEnrolledAsync();
            const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();

            let biometricType: BiometricAuthState['biometricType'] = 'none';

            if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
                biometricType = 'facial';
            } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
                biometricType = 'fingerprint';
            } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.IRIS)) {
                biometricType = 'iris';
            }

            return {
                hasHardware,
                isEnrolled,
                biometricType,
                isAvailable: hasHardware && isEnrolled,
            };
        } catch (error) {
            console.error('Error checking biometric availability:', error);
            return {
                hasHardware: false,
                isEnrolled: false,
                biometricType: 'none' as const,
                isAvailable: false,
            };
        }
    }, []);

    // Salvar timestamp da última autenticação
    const saveAuthTimestamp = useCallback(async () => {
        if (!userId) return; // Sem userId, não salva
        try {
            await SecureStore.setItemAsync(getLastAuthTimeKey(userId), Date.now().toString());
        } catch (error) {
            console.error('Error saving auth timestamp:', error);
        }
    }, [userId]);

    // Autenticar com biometria
    const authenticate = useCallback(async (): Promise<boolean> => {
        // Se a biometria não estiver habilitada ou disponível, não tenta
        // Mas permitimos chamada manual se for para habilitar (ex: enableBiometric chama authenticate)

        setState(prev => ({ ...prev, error: null }));

        try {
            const type = biometricTypeRef.current;
            const biometricName = type === 'facial'
                ? (Platform.OS === 'ios' ? 'Face ID' : 'Reconhecimento Facial')
                : (type === 'fingerprint' ? (Platform.OS === 'android' ? 'Digital' : 'Touch ID') : 'Biometria');

            const result = await LocalAuthentication.authenticateAsync({
                promptMessage: `Entrar com ${biometricName}`,
                cancelLabel: 'Cancelar',
                disableDeviceFallback: false, // ⚠️ NÃO bloqueie fallback (pedido do usuário)
                fallbackLabel: 'Usar senha do app', // Pedido do usuário
            });

            if (result.success) {
                saveAuthTimestamp();
                setState(prev => ({
                    ...prev,
                    isAuthenticated: true,
                    isLoading: false,
                    error: null,
                }));
                return true;
            } else {
                // Se usuário cancelou ou falhou
                console.log('Biometric auth failed or cancelled:', result);

                setState(prev => ({
                    ...prev,
                    isAuthenticated: false,
                    isLoading: false,
                    error: result.error === 'user_cancel' ? 'Cancelado pelo usuário' : 'Falha na autenticação',
                }));
                return false;
            }
        } catch (error) {
            console.error('Biometric authentication error:', error);
            setState(prev => ({
                ...prev,
                isAuthenticated: false,
                isLoading: false,
                error: 'Erro na autenticação biométrica',
            }));
            return false;
        }
    }, [saveAuthTimestamp]);

    // Habilitar biometria (para settings/opt-in)
    const enableBiometric = useCallback(async (): Promise<boolean> => {
        if (!userId) {
            console.warn('Cannot enable biometric: userId not available');
            return false;
        }
        try {
            // Tenta autenticar primeiro para confirmar que é o dono
            const success = await authenticate();
            if (success) {
                await SecureStore.setItemAsync(getBiometricEnabledKey(userId), 'true');
                setState(prev => ({
                    ...prev,
                    isBiometricEnabled: true,
                }));
            }
            return success;
        } catch (error) {
            console.error('Error enabling biometric:', error);
            return false;
        }
    }, [authenticate, userId]);

    // Desabilitar biometria
    const disableBiometric = useCallback(async (): Promise<void> => {
        if (!userId) return; // Sem userId, não pode desabilitar
        try {
            await SecureStore.setItemAsync(getBiometricEnabledKey(userId), 'false');
            setState(prev => ({
                ...prev,
                isBiometricEnabled: false,
                isAuthenticated: true, // Se desabilitou, considera "autenticado" (não bloqueado)
            }));
        } catch (error) {
            console.error('Error disabling biometric:', error);
        }
    }, [userId]);

    // Inicialização - agora depende do userId
    useEffect(() => {
        const init = async () => {
            // Se não tem userId ainda, considera como não bloqueante
            if (!userId) {
                setState({
                    isLoading: false,
                    isAuthenticated: true, // Sem userId = não bloqueia (ainda carregando auth)
                    isBiometricAvailable: false,
                    isBiometricEnabled: false,
                    biometricType: 'none',
                    error: null,
                });
                return;
            }

            const availability = await checkBiometricAvailability();

            // Update ref
            biometricTypeRef.current = availability.biometricType;

            // Verificar preferência salva no SecureStore PARA ESTE USUÁRIO
            let isEnabled = false;
            try {
                const storedEnabled = await SecureStore.getItemAsync(getBiometricEnabledKey(userId));
                isEnabled = storedEnabled === 'true';
            } catch (e) {
                console.error('Error reading biometric preference', e);
            }

            // Atualiza estado inicial
            // Se for auto-autenticar, mantemos carregando para evitar flash de tela "Bloqueada"
            const willAutoAuth = !!(availability.isAvailable && isEnabled && autoAuthenticate);

            setState({
                isLoading: willAutoAuth, // Se for autenticar, continua carregando. Se não, para.
                isAuthenticated: false,
                isBiometricAvailable: availability.isAvailable,
                isBiometricEnabled: isEnabled,
                biometricType: availability.biometricType,
                error: null,
            });

            if (willAutoAuth) {
                // Se disponível E habilitado pelo usuário, pede auth
                // Delay mínimo para garantir renderização do estado "loading" antes do prompt
                setTimeout(() => {
                    authenticate();
                }, 50);
            } else {
                // Se não disponível ou não habilitado, finaliza loading e não bloqueia
                // Mas precisamos garantir que isLoading seja falso se não caiu no bloco acima (redundante mas explícito)
                if (!willAutoAuth) {
                    setState(prev => ({
                        ...prev,
                        isLoading: false,
                        isAuthenticated: true, // Importante: se não usa biometria, está "autenticado" biometricamente (ignora bloqueio)
                    }));
                }
            }
        };

        // Reset hasTriedAuth quando userId muda (para permitir re-init ao trocar de conta)
        hasTriedAuth.current = false;
        init();
    }, [userId, checkBiometricAvailability]); // Removed authenticate from deps

    // Monitorar AppState para timeout de background
    useEffect(() => {
        const subscription = AppState.addEventListener('change', async (nextAppState: AppStateStatus) => {
            // App voltando do background
            if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
                if (state.isBiometricEnabled) { // Só verifica timer se estiver habilitado
                    let shouldReauth = false;

                    if (lastBackgroundTime.current) {
                        const backgroundDuration = (Date.now() - lastBackgroundTime.current) / (1000 * 60);
                        if (backgroundDuration >= BIOMETRIC_TIMEOUT_MINUTES) {
                            shouldReauth = true;
                        }
                    } else if (userId) {
                        // Se por acaso perdeu o timer, assume que precisa (segurança)
                        // Check last saved in secure store?
                        try {
                            const lastStr = await SecureStore.getItemAsync(getLastAuthTimeKey(userId));
                            if (lastStr) {
                                const lastTime = parseInt(lastStr, 10);
                                const diff = (Date.now() - lastTime) / (1000 * 60);
                                if (diff >= BIOMETRIC_TIMEOUT_MINUTES) shouldReauth = true;
                            }
                        } catch (e) { }
                    }

                    if (shouldReauth) {
                        setState(prev => ({
                            ...prev,
                            isAuthenticated: false,
                        }));
                        setTimeout(() => {
                            authenticate();
                        }, 300);
                    }
                }
                lastBackgroundTime.current = null;
            }

            // App indo para background
            if (nextAppState.match(/inactive|background/)) {
                lastBackgroundTime.current = Date.now();
            }

            appState.current = nextAppState;
        });

        return () => {
            subscription.remove();
        };
    }, [state.isBiometricEnabled, authenticate]);

    return {
        ...state,
        authenticate,
        enableBiometric,
        disableBiometric,
        getBiometricTypeName: () => {
            switch (state.biometricType) {
                case 'facial':
                    return Platform.OS === 'ios' ? 'Face ID' : 'Reconhecimento Facial';
                case 'fingerprint':
                    return Platform.OS === 'android' ? 'Digital' : 'Touch ID';
                case 'iris':
                    return 'Íris';
                default:
                    return 'Biometria';
            }
        },
    };
}
