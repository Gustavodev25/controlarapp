// Toast Context and Component for Controlar+ App
// Sonner-style stacked toast animation
import { AlertCircle, CheckCircle, Info, XCircle } from 'lucide-react-native';
import React, { createContext, ReactNode, useCallback, useContext, useState } from 'react';
import { Animated, Dimensions, StyleSheet, Text, View } from 'react-native';

const { width } = Dimensions.get('window');

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
    id: string;
    message: string;
    description?: string;
    type: ToastType;
    duration?: number;
}

interface ToastContextType {
    showToast: (message: string, type?: ToastType, duration?: number) => void;
    showError: (message: string, description?: string) => void;
    showSuccess: (message: string, description?: string) => void;
    showInfo: (message: string, description?: string) => void;
    showWarning: (message: string, description?: string) => void;
    dismiss: (id?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const TOAST_DURATION = 4000;
const MAX_VISIBLE_TOASTS = 3;

const toastConfig = {
    success: {
        icon: CheckCircle,
        iconColor: '#22c55e',
    },
    error: {
        icon: XCircle,
        iconColor: '#ef4444',
    },
    warning: {
        icon: AlertCircle,
        iconColor: '#f59e0b',
    },
    info: {
        icon: Info,
        iconColor: '#3b82f6',
    },
};

interface ToastItemProps {
    toast: Toast;
    onHide: () => void;
    index: number;
    totalToasts: number;
}

function ToastItem({ toast, onHide, index, totalToasts }: ToastItemProps) {
    const [fadeAnim] = useState(new Animated.Value(0));
    const [scaleAnim] = useState(new Animated.Value(0.9));
    const [translateYAnim] = useState(new Animated.Value(-20));

    // Sonner-style stacking: newest on top, older ones behind with smaller scale
    const reverseIndex = totalToasts - 1 - index;
    const stackScale = Math.max(0.9, 1 - reverseIndex * 0.05);
    const stackOpacity = Math.max(0.6, 1 - reverseIndex * 0.2);
    const stackTranslateY = reverseIndex * 8; // Small offset for depth effect

    React.useEffect(() => {
        // Animate in
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: stackOpacity,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
                toValue: stackScale,
                tension: 100,
                friction: 10,
                useNativeDriver: true,
            }),
            Animated.spring(translateYAnim, {
                toValue: stackTranslateY,
                tension: 100,
                friction: 10,
                useNativeDriver: true,
            }),
        ]).start();

        // Auto hide
        const timer = setTimeout(() => {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 0,
                    duration: 150,
                    useNativeDriver: true,
                }),
                Animated.timing(scaleAnim, {
                    toValue: 0.9,
                    duration: 150,
                    useNativeDriver: true,
                }),
                Animated.timing(translateYAnim, {
                    toValue: -20,
                    duration: 150,
                    useNativeDriver: true,
                }),
            ]).start(() => onHide());
        }, toast.duration || TOAST_DURATION);

        return () => clearTimeout(timer);
    }, [reverseIndex, stackScale, stackOpacity, stackTranslateY]);

    // Update animations when stack position changes
    React.useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: stackOpacity,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
                toValue: stackScale,
                tension: 100,
                friction: 10,
                useNativeDriver: true,
            }),
            Animated.spring(translateYAnim, {
                toValue: stackTranslateY,
                tension: 100,
                friction: 10,
                useNativeDriver: true,
            }),
        ]).start();
    }, [reverseIndex]);

    const config = toastConfig[toast.type];
    const Icon = config.icon;

    return (
        <Animated.View
            style={[
                styles.toastContainer,
                {
                    opacity: fadeAnim,
                    transform: [
                        { scale: scaleAnim },
                        { translateY: translateYAnim },
                    ],
                    zIndex: totalToasts - reverseIndex,
                },
            ]}
        >
            <View style={styles.iconContainer}>
                <Icon size={18} color={config.iconColor} />
            </View>
            <View style={styles.textContainer}>
                <Text style={styles.toastMessage} numberOfLines={2}>
                    {toast.message}
                </Text>
                {toast.description && (
                    <Text style={styles.toastDescription} numberOfLines={2}>
                        {toast.description}
                    </Text>
                )}
            </View>
        </Animated.View>
    );
}

interface ToastProviderProps {
    children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = useCallback((message: string, type: ToastType = 'info', duration?: number) => {
        const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
        setToasts((prev) => {
            const newToasts = [...prev, { id, message, type, duration }];
            // Limit visible toasts
            if (newToasts.length > MAX_VISIBLE_TOASTS) {
                return newToasts.slice(-MAX_VISIBLE_TOASTS);
            }
            return newToasts;
        });
    }, []);

    const showError = useCallback((message: string, description?: string) => {
        const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
        setToasts((prev) => {
            const newToasts = [...prev, { id, message, description, type: 'error' as ToastType }];
            if (newToasts.length > MAX_VISIBLE_TOASTS) {
                return newToasts.slice(-MAX_VISIBLE_TOASTS);
            }
            return newToasts;
        });
    }, []);

    const showSuccess = useCallback((message: string, description?: string) => {
        const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
        setToasts((prev) => {
            const newToasts = [...prev, { id, message, description, type: 'success' as ToastType }];
            if (newToasts.length > MAX_VISIBLE_TOASTS) {
                return newToasts.slice(-MAX_VISIBLE_TOASTS);
            }
            return newToasts;
        });
    }, []);

    const showInfo = useCallback((message: string, description?: string) => {
        const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
        setToasts((prev) => {
            const newToasts = [...prev, { id, message, description, type: 'info' as ToastType }];
            if (newToasts.length > MAX_VISIBLE_TOASTS) {
                return newToasts.slice(-MAX_VISIBLE_TOASTS);
            }
            return newToasts;
        });
    }, []);

    const showWarning = useCallback((message: string, description?: string) => {
        const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
        setToasts((prev) => {
            const newToasts = [...prev, { id, message, description, type: 'warning' as ToastType }];
            if (newToasts.length > MAX_VISIBLE_TOASTS) {
                return newToasts.slice(-MAX_VISIBLE_TOASTS);
            }
            return newToasts;
        });
    }, []);

    const dismiss = useCallback((id?: string) => {
        if (id) {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        } else {
            setToasts([]);
        }
    }, []);

    const hideToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ showToast, showError, showSuccess, showInfo, showWarning, dismiss }}>
            {children}
            <View style={styles.toastWrapper} pointerEvents="box-none">
                {toasts.map((toast, index) => (
                    <ToastItem
                        key={toast.id}
                        toast={toast}
                        onHide={() => hideToast(toast.id)}
                        index={index}
                        totalToasts={toasts.length}
                    />
                ))}
            </View>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);

    if (context === undefined) {
        throw new Error('useToast must be used within a ToastProvider');
    }

    return context;
}

const styles = StyleSheet.create({
    toastWrapper: {
        position: 'absolute',
        top: 60,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 9999,
        elevation: 9999,
    },
    toastContainer: {
        position: 'absolute',
        top: 0,
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 20,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 16,
        borderWidth: 1,
        backgroundColor: '#151515',
        borderColor: 'rgba(255, 255, 255, 0.08)',
        width: width - 40,
        maxWidth: 400,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
        elevation: 12,
    },
    iconContainer: {
        marginRight: 12,
    },
    textContainer: {
        flex: 1,
    },
    toastMessage: {
        color: '#f4f4f4',
        fontSize: 14,
        fontWeight: '500',
        lineHeight: 20,
    },
    toastDescription: {
        color: '#cfcfcf',
        fontSize: 13,
        marginTop: 2,
        lineHeight: 18,
    },
});
