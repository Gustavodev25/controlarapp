
import { DEFAULT_CATEGORIES } from '@/constants/defaultCategories';
import { db } from '@/services/firebase';
import { CategoryMapping } from '@/types/category';
import {
    collection,
    deleteDoc,
    doc,
    getDocs,
    onSnapshot,
    query,
    setDoc,
    updateDoc
} from 'firebase/firestore';

const CATEGORY_GROUPS_MAP: Record<string, string[]> = {};
DEFAULT_CATEGORIES.forEach(group => {
    CATEGORY_GROUPS_MAP[group.title] = group.items.map(item => item.key);
});

export const CategoryService = {
    // 1. Inicializar Categorias Padrão
    initializeCategoryMappings: async (userId: string): Promise<CategoryMapping[]> => {
        try {
            const mappingsCol = collection(db, 'users', userId, 'categoryMappings');
            const snapshot = await getDocs(mappingsCol);

            if (!snapshot.empty) {
                return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CategoryMapping));
            }

            const batch: Promise<void>[] = [];

            DEFAULT_CATEGORIES.forEach(group => {
                group.items.forEach(item => {
                    const id = item.key; // Use key as ID for default categories
                    const mapping: CategoryMapping = {
                        id,
                        originalKey: item.key,
                        displayName: item.label,
                        isDefault: true,
                        group: group.title,
                        updatedAt: new Date().toISOString()
                    };

                    batch.push(setDoc(doc(mappingsCol, id), mapping));
                });
            });

            await Promise.all(batch);

            // Return created mappings
            const newSnapshot = await getDocs(mappingsCol);
            return newSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CategoryMapping));
        } catch (error) {
            console.error('Error initializing category mappings:', error);
            throw error;
        }
    },

    // 2. Atualizar Nome de Categoria
    updateCategoryMapping: async (userId: string, categoryId: string, displayName: string): Promise<void> => {
        try {
            const docRef = doc(db, 'users', userId, 'categoryMappings', categoryId);
            await updateDoc(docRef, {
                displayName,
                updatedAt: new Date().toISOString()
            });
        } catch (error) {
            console.error('Error updating category mapping:', error);
            throw error;
        }
    },

    // 3. Resetar para Padrão
    resetCategoryMapping: async (userId: string, categoryId: string, originalDisplayName: string): Promise<void> => {
        try {
            const docRef = doc(db, 'users', userId, 'categoryMappings', categoryId);
            await updateDoc(docRef, {
                displayName: originalDisplayName,
                isDefault: true,
                updatedAt: new Date().toISOString()
            });
        } catch (error) {
            console.error('Error resetting category mapping:', error);
            throw error;
        }
    },

    // 4. Criar Categoria Customizada
    createCustomCategory: async (userId: string, displayName: string, group: string): Promise<string> => {
        try {
            const mappingsCol = collection(db, 'users', userId, 'categoryMappings');
            const newDocRef = doc(mappingsCol); // Auto-generated ID
            const id = newDocRef.id;
            const originalKey = `custom_${id}`;

            const mapping: CategoryMapping = {
                id,
                originalKey,
                displayName,
                isDefault: false,
                group,
                updatedAt: new Date().toISOString()
            };

            await setDoc(newDocRef, mapping);
            return id;
        } catch (error) {
            console.error('Error creating custom category:', error);
            throw error;
        }
    },

    // 5. Deletar Categoria Customizada
    deleteCategoryMapping: async (userId: string, categoryId: string): Promise<void> => {
        try {
            const docRef = doc(db, 'users', userId, 'categoryMappings', categoryId);
            await deleteDoc(docRef);
        } catch (error) {
            console.error('Error deleting category mapping:', error);
            throw error;
        }
    },

    // 6. Escutar Mudanças em Tempo Real
    listenToCategoryMappings: (userId: string, callback: (mappings: CategoryMapping[]) => void) => {
        const q = query(collection(db, 'users', userId, 'categoryMappings'));
        return onSnapshot(q, (snapshot) => {
            const mappings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CategoryMapping));
            callback(mappings);
        });
    },

    // Helper: Ensure categories exist
    ensureCategoryMappings: async (userId: string) => {
        const mappingsCol = collection(db, 'users', userId, 'categoryMappings');
        const snapshot = await getDocs(mappingsCol);

        if (snapshot.empty) {
            await CategoryService.initializeCategoryMappings(userId);
        }
    }
};
