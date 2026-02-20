
import { getLegacyCategoryLabel } from '@/constants/categoryTranslations';
import { CategoryGroup, DEFAULT_CATEGORIES } from '@/constants/defaultCategories';
import { useAuthContext } from '@/contexts/AuthContext';
import { CategoryService } from '@/services/categoryService';
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';

interface CategoryContextType {
    categories: CategoryGroup[];
    loading: boolean;
    getCategoryName: (key?: string) => string;
}

const CategoryContext = createContext<CategoryContextType>({
    categories: DEFAULT_CATEGORIES,
    loading: true,
    getCategoryName: (key) => key || 'Outros'
});

export function CategoryProvider({ children }: { children: ReactNode }) {
    const { user } = useAuthContext();
    const [categories, setCategories] = useState<CategoryGroup[]>(DEFAULT_CATEGORIES);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        if (!user) {
            setLoading(false);
            return;
        }

        // Initialize defaults silently if needed
        CategoryService.ensureCategoryMappings(user.uid).catch(err => {
            console.error('Error ensuring category mappings:', err);
        });

        // Listen for realtime updates
        const unsubscribe = CategoryService.listenToCategoryMappings(user.uid, (mappings) => {
            if (!isMounted) return;

            // Deep clone defaults to start fresh on every update to ensure clean state
            const newCategories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)) as CategoryGroup[];
            const mappingMap = new Map(mappings.map(m => [m.originalKey, m]));

            // Track processed keys to identify new custom categories later
            const processedKeys = new Set<string>();

            // 1. Update existing default categories from mappings
            newCategories.forEach(group => {
                group.items.forEach(item => {
                    const mapping = mappingMap.get(item.key);
                    if (mapping) {
                        item.label = mapping.displayName;
                    }
                    processedKeys.add(item.key);
                });
            });

            // 2. Add custom categories
            // Iterate over mappings and add those that were not processed as defaults
            mappings.forEach(m => {
                if (!processedKeys.has(m.originalKey)) {
                    // This is a custom category or a mapped category that is not in defaults
                    const groupName = m.group || 'Outros';
                    let group = newCategories.find(g => g.title === groupName);

                    // Fallback to 'Outros' if group not found
                    if (!group) {
                        // Find 'Outros' group or create if doesn't exist (though it should)
                        group = newCategories.find(g => g.title === 'Outros');
                    }

                    if (group) {
                        // Check for duplicates in the target group to be safe
                        if (!group.items.find(i => i.key === m.originalKey)) {
                            group.items.push({
                                key: m.originalKey,
                                label: m.displayName,
                                isCustom: true
                            });
                        }
                    } else {
                        // If even 'Outros' doesn't exist, create it (edge case)
                        newCategories.push({
                            title: 'Outros',
                            items: [{
                                key: m.originalKey,
                                label: m.displayName,
                                isCustom: true
                            }]
                        });
                    }
                }
            });

            setCategories(newCategories);
            setLoading(false);
        });

        return () => {
            isMounted = false;
            unsubscribe();
        };
    }, [user]);

    const getCategoryName = useCallback((key?: string) => {
        if (!key) return 'Outros';

        const keyLower = key.toLowerCase();

        // 1. Search in current loaded categories (includes user customizations)
        for (const group of categories) {
            const item = group.items.find(i => i.key.toLowerCase() === keyLower);
            if (item) return item.label;
        }

        // 2. Fallback: Search in DEFAULT_CATEGORIES (raw static data)
        for (const group of DEFAULT_CATEGORIES) {
            const item = group.items.find(i => i.key.toLowerCase() === keyLower);
            if (item) return item.label;
        }

        // 3. Fallback: Legacy translations
        const legacyLabel = getLegacyCategoryLabel(key);
        if (legacyLabel) return legacyLabel;

        // 4. Return original key if nothing found (formatted nicely if possible)
        // Optionally capitalize first letter
        return key.charAt(0).toUpperCase() + key.slice(1);
    }, [categories]);

    return (
        <CategoryContext.Provider value={{ categories, loading, getCategoryName }}>
            {children}
        </CategoryContext.Provider>
    );
}

export function useCategoryContext() {
    const context = useContext(CategoryContext);
    if (context === undefined) {
        throw new Error('useCategoryContext must be used within a CategoryProvider');
    }
    return context;
}
