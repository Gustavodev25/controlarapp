// Authentication Hook for Controlar+ App
import { authService, databaseService, User } from '@/services/firebase';
import { offlineStorage } from '@/services/offlineStorage';
import { useCallback, useEffect, useState } from 'react';

interface UserProfile {
    name?: string;
    email?: string;
    phone?: string;
    subscription?: {
        plan: string;
        status: string;
        expiresAt?: Date;
        startedAt?: Date;
        cancelledAt?: Date;
        billingCycle?: 'monthly' | 'yearly';
        price?: number;
    };
    paymentMethod?: {
        type: string;
        brand?: string;
        last4?: string;
        expiryMonth?: number;
        expiryYear?: number;
    };
    paymentMethodDetails?: any;
    createdAt?: Date;
    financial?: {
        salary: {
            base: number;
            payday: string;
            paydayDate?: number;
            isExempt: boolean;
        };
        advance: {
            enabled: boolean;
            type: string;
            value: number;
            day: number;
            isExempt: boolean;
        };
        discounts: Array<{
            id: string;
            name: string;
            value: number;
            type: string;
        }>;
    };
    preferences?: {
        balanceAccountIds?: string[];
        invoicePeriod?: 'past' | 'current' | 'next' | 'total_used' | 'none';
        invoicePeriodByCard?: Record<string, 'past' | 'current' | 'next' | 'total_used' | 'none'>;
        paymentAlertsEnabled?: boolean;
    };
    isAdmin?: boolean;
}

interface AuthState {
    user: User | null;
    profile: UserProfile | null;
    isLoading: boolean;
    isAuthenticated: boolean;
}

export function useAuth() {
    const [state, setState] = useState<AuthState>({
        user: null,
        profile: null,
        isLoading: true,
        isAuthenticated: false
    });

    // Load user profile when user changes
    const loadProfile = useCallback(async (user: User) => {
        try {
            const result = await databaseService.getUserProfile(user.uid);
            if (result.success && result.data) {
                setState(prev => ({
                    ...prev,
                    profile: result.data as UserProfile,
                    isLoading: false
                }));
            } else {
                // Profile doesn't exist yet - try offline cache
                const cached = await offlineStorage.getProfile(user.uid);
                if (cached) {
                    setState(prev => ({
                        ...prev,
                        profile: cached as UserProfile,
                        isLoading: false
                    }));
                } else {
                    setState(prev => ({ ...prev, isLoading: false }));
                }
            }
        } catch (error) {
            console.error('Error loading profile:', error);
            // OFFLINE FALLBACK: Try cached profile
            try {
                const cached = await offlineStorage.getProfile(user.uid);
                if (cached) {
                    console.log('[Auth] Using cached profile (offline)');
                    setState(prev => ({
                        ...prev,
                        profile: cached as UserProfile,
                        isLoading: false
                    }));
                    return;
                }
            } catch { /* ignore cache error */ }
            setState(prev => ({ ...prev, isLoading: false }));
        }
    }, []);

    // Subscribe to auth state changes
    useEffect(() => {
        const unsubscribe = authService.onAuthStateChange(async (user) => {
            try {
                if (user) {
                    setState(prev => ({
                        ...prev,
                        user,
                        isAuthenticated: true,
                        isLoading: true
                    }));
                    await loadProfile(user);
                } else {
                    setState({
                        user: null,
                        profile: null,
                        isLoading: false,
                        isAuthenticated: false
                    });
                }
            } catch (error) {
                console.error('Error in auth state change:', error);
                // On error, set loading to false to prevent infinite loading
                setState(prev => ({ ...prev, isLoading: false }));
            }
        });

        return () => unsubscribe();
    }, [loadProfile]);

    // Sign in
    const signIn = async (email: string, password: string) => {
        setState(prev => ({ ...prev, isLoading: true }));
        const result = await authService.signIn(email, password);

        if (!result.success) {
            setState(prev => ({ ...prev, isLoading: false }));
        }

        return result;
    };

    // Sign up
    const signUp = async (email: string, password: string, name: string, phone?: string) => {
        setState(prev => ({ ...prev, isLoading: true }));
        const result = await authService.signUp(email, password);

        if (result.success && result.user) {
            // Create user profile
            await databaseService.setUserProfile(result.user.uid, {
                name,
                email,
                phone: phone || null,
                createdAt: new Date(),
                subscription: {
                    plan: 'starter',
                    status: 'active'
                }
            });

            // Reload profile to ensure state is updated after DB write
            await loadProfile(result.user);
        } else {
            setState(prev => ({ ...prev, isLoading: false }));
        }

        return result;
    };

    // Sign out
    const signOut = async () => {
        const result = await authService.signOut();
        return result;
    };

    // Reset password
    const resetPassword = async (email: string) => {
        const result = await authService.resetPassword(email);
        return result;
    };

    // Refresh profile
    const refreshProfile = async () => {
        if (state.user) {
            await loadProfile(state.user);
        }
    };

    return {
        ...state,
        signIn,
        signUp,
        signOut,
        resetPassword,
        refreshProfile
    };
}
