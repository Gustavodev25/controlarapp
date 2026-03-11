// Authentication Context for Controlar+ App
import { useAuth } from '@/hooks/use-auth';
import { User } from '@/services/firebase';
import React, { createContext, ReactNode, useContext } from 'react';

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

interface AuthContextType {
    user: User | null;
    profile: UserProfile | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
    signUp: (email: string, password: string, name: string, phone?: string) => Promise<{ success: boolean; error?: string }>;
    signOut: () => Promise<{ success: boolean; error?: string }>;
    deleteAccount: () => Promise<{ success: boolean; error?: string }>;
    resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
    refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
    children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
    const auth = useAuth();

    return (
        <AuthContext.Provider value={auth}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuthContext() {
    const context = useContext(AuthContext);

    if (context === undefined) {
        throw new Error('useAuthContext must be used within an AuthProvider');
    }

    return context;
}

// Export a hook that can be used for protected routes
export function useRequireAuth() {
    const auth = useAuthContext();

    return {
        ...auth,
        isReady: !auth.isLoading
    };
}
