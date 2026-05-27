import { DeleteConfirmCard } from '@/components/DeleteConfirmCard';
import { UniversalBackground } from '@/components/UniversalBackground';
import { IosCoreLoader } from '@/components/ui/IosCoreLoader';
import { ModalPadrao } from '@/components/ui/ModalPadrao';
import { CategoryGroup, DEFAULT_CATEGORIES } from '@/constants/defaultCategories';
import { useAuthContext } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useCategories } from '@/hooks/use-categories';
import { CategoryService } from '@/services/categoryService';
import { safeBack } from '@/utils/navigation';
import { useRouter } from 'expo-router';
import { ChevronDown, ChevronLeft, ChevronRight, Plus, Search, Trash2 } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    LayoutAnimation,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    UIManager,
    View,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function CategoriesScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { user } = useAuthContext();
    const { showToast } = useToast();

    // Use the hook to get real-time categories from Firestore
    const { categories: serverCategories, loading: serverLoading } = useCategories();

    const [categories, setCategories] = useState<CategoryGroup[]>(DEFAULT_CATEGORIES);
    const [saving, setSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const nameInputRefs = React.useRef<Record<string, TextInput | null>>({});
    const [newCategoryModalVisible, setNewCategoryModalVisible] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newCategoryGroupIndex, setNewCategoryGroupIndex] = useState<number | null>(null);
    const [pendingDelete, setPendingDelete] = useState<{ groupIndex: number; itemIndex: number } | null>(null);

    const newCategoryGroupTitle = newCategoryGroupIndex !== null
        ? (categories[newCategoryGroupIndex]?.title ?? '')
        : '';

    // Sync local state with server state when server updates (and user is not actively editing? 
    // For simplicity, we sync always, assuming collisions are rare or user sees update)
    // Actually, to avoid overwriting user's typing, we might want to check if editing.
    // But for this implementation, let's sync.
    useEffect(() => {
        if (!serverLoading) {
            setCategories(serverCategories);
        }
    }, [serverCategories, serverLoading]);

    // Helper to extract Doc ID from key
    const getDocIdFromKey = (key: string) => {
        if (key.startsWith('custom_')) {
            return key.substring(7); // Remove 'custom_' prefix
        }
        return key;
    };

    const handleSave = async () => {
        if (!user) return;
        setSaving(true);
        try {
            // Find changed categories and update them
            // We compare current 'categories' with 'serverCategories' (or just update all distinct?)
            // Comparing deep objects is expensive. 
            // Let's just iterate and update those that are different from DEFAULT + Custom defaults?
            // Better: We really should track dirty fields.
            // But let's verify what changed against serverCategories.

            const updates = [];

            for (let g = 0; g < categories.length; g++) {
                const group = categories[g];
                const serverGroup = serverCategories.find(sg => sg.title === group.title);
                if (!serverGroup) continue;

                for (let i = 0; i < group.items.length; i++) {
                    const item = group.items[i];
                    const serverItem = serverGroup.items.find(si => si.key === item.key);

                    if (serverItem && serverItem.label !== item.label) {
                        // Found a change
                        const docId = getDocIdFromKey(item.key);
                        updates.push(CategoryService.updateCategoryMapping(user.uid, docId, item.label));
                    }
                }
            }

            if (updates.length > 0) {
                await Promise.all(updates);
                showToast('Categorias salvas com sucesso!', 'success');
            } else {
                showToast('Nenhuma alteração encontrada.', 'info');
            }
        } catch (error) {
            console.error('Error saving categories:', error);
            showToast('Erro ao salvar categorias', 'error');
        } finally {
            setSaving(false);
        }
    };

    const toggleGroup = (title: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        const newExpanded = new Set(expandedGroups);
        if (newExpanded.has(title)) {
            newExpanded.delete(title);
        } else {
            newExpanded.add(title);
        }
        setExpandedGroups(newExpanded);
    };

    const updateCategoryName = (groupIndex: number, itemIndex: number, newName: string) => {
        const newCategories = JSON.parse(JSON.stringify(categories));
        newCategories[groupIndex].items[itemIndex].label = newName;
        setCategories(newCategories);
    };

    const addNewCategory = (groupIndex: number) => {
        setNewCategoryGroupIndex(groupIndex);
        setNewCategoryName('');
        setNewCategoryModalVisible(true);
    };

    const handleCreateCategory = async () => {
        if (!user) return;
        const name = newCategoryName.trim();
        if (!name || newCategoryGroupIndex === null) {
            showToast('Digite um nome para a categoria', 'error');
            return;
        }

        const groupTitle = categories[newCategoryGroupIndex].title;
        setSaving(true);
        try {
            await CategoryService.createCustomCategory(user.uid, name, groupTitle);
            showToast('Categoria adicionada!', 'success');
            setNewCategoryModalVisible(false);
            // newCategories will automatically update via hook

            // Ensure group stays expanded
            setExpandedGroups(prev => new Set(prev).add(groupTitle));
        } catch (error) {
            console.error('Error creating category:', error);
            showToast('Erro ao criar categoria', 'error');
        } finally {
            setSaving(false);
        }
    };

    const removeCategory = (groupIndex: number, itemIndex: number) => {
        setPendingDelete({ groupIndex, itemIndex });
    };

    const handleConfirmRemoveCategory = async (groupIndex: number, itemIndex: number) => {
        if (!user) return;
        const group = categories[groupIndex];
        const item = group.items[itemIndex];
        const docId = getDocIdFromKey(item.key);

        setSaving(true); // global saving or local loading?
        try {
            await CategoryService.deleteCategoryMapping(user.uid, docId);
            showToast('Categoria removida!', 'success');
            setPendingDelete(null);
            // newCategories will automatically update via hook
        } catch (error) {
            console.error('Error deleting category:', error);
            showToast('Erro ao remover categoria', 'error');
        } finally {
            setSaving(false);
        }
    };

    const hasChanges = !serverLoading && JSON.stringify(categories) !== JSON.stringify(serverCategories);

    const totalCategories = categories.reduce((acc, group) => acc + group.items.length, 0);
    const customCategories = categories.reduce((acc, group) =>
        acc + group.items.filter((item: any) => item.isCustom).length, 0);

    const filteredCategories = categories.map(group => ({
        ...group,
        items: group.items.filter(item =>
            item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.key.toLowerCase().includes(searchQuery.toLowerCase())
        )
    })).filter(group => group.items.length > 0);

    // If searching, auto-expand all
    useEffect(() => {
        if (searchQuery) {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            const allTitles = new Set(filteredCategories.map(g => g.title));
            setExpandedGroups(allTitles);
        }
    }, [searchQuery]);

    return (
        <View style={styles.mainContainer}>
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0 }} pointerEvents="none">
                <UniversalBackground backgroundColor="#0C0C0C" glowSize={350} height={280} />
            </View>

            <View style={[styles.headerWrapper, { paddingTop: insets.top }]}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => safeBack(router)} style={styles.backButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <ChevronLeft size={24} color="#E0E0E0" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Categorias</Text>
                    <View style={styles.headerSpacer} />
                </View>
            </View>

            <View style={styles.searchSection}>
                <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>{totalCategories}</Text>
                        <Text style={styles.statLabel}>total</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>{customCategories}</Text>
                        <Text style={styles.statLabel}>customizadas</Text>
                    </View>
                </View>
                <View style={styles.searchContainer}>
                    <Search size={15} color="#555" style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Buscar categoria..."
                        placeholderTextColor="#555"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <ScrollView
                    contentContainerStyle={[styles.scrollContent, { paddingBottom: hasChanges ? 100 : 40 }]}
                    showsVerticalScrollIndicator={false}
                >
                    {serverLoading ? (
                        <IosCoreLoader style={{ minHeight: 220 }} />
                    ) : (
                        filteredCategories.map((group) => {
                            const isExpanded = expandedGroups.has(group.title);
                            const realGroupIndex = categories.findIndex(g => g.title === group.title);

                            return (
                                <View key={group.title} style={styles.groupCard}>
                                    <TouchableOpacity style={styles.groupHeader} onPress={() => toggleGroup(group.title)} activeOpacity={0.7}>
                                        <Text style={styles.groupTitle}>{group.title}</Text>
                                        <View style={styles.groupMeta}>
                                            <Text style={styles.groupCount}>{group.items.length}</Text>
                                            <ChevronDown size={16} color="#555" style={{ transform: [{ rotate: isExpanded ? '180deg' : '0deg' }] }} />
                                        </View>
                                    </TouchableOpacity>

                                    {isExpanded && (
                                        <Animated.View entering={FadeIn} exiting={FadeOut}>
                                            <View style={styles.groupContent}>
                                                {group.items.map((item, itemIndex) => {
                                                    const realItemIndex = categories[realGroupIndex].items.findIndex(i => i.key === item.key);
                                                    const isLast = itemIndex === group.items.length - 1;
                                                    const isPendingDelete = pendingDelete?.groupIndex === realGroupIndex && pendingDelete?.itemIndex === realItemIndex;

                                                    if (isPendingDelete) {
                                                        return (
                                                            <View key={item.key} style={[styles.itemContainer, !isLast && styles.itemSeparator]}>
                                                                <DeleteConfirmCard
                                                                    title="Remover categoria?"
                                                                    cancelText="Cancelar"
                                                                    confirmText="Remover"
                                                                    onCancel={() => setPendingDelete(null)}
                                                                    onConfirm={() => handleConfirmRemoveCategory(realGroupIndex, realItemIndex)}
                                                                    style={styles.deleteConfirmCard}
                                                                />
                                                            </View>
                                                        );
                                                    }

                                                    return (
                                                        <View key={item.key} style={[styles.itemContainer, !isLast && styles.itemSeparator]}>
                                                            <View style={styles.itemContent}>
                                                                <Text style={styles.keyValue}>{item.key}</Text>
                                                                <TextInput
                                                                    ref={(ref) => { nameInputRefs.current[`${realGroupIndex}-${realItemIndex}`] = ref; }}
                                                                    style={styles.nameInput}
                                                                    value={item.label}
                                                                    onChangeText={(text) => updateCategoryName(realGroupIndex, realItemIndex, text)}
                                                                    placeholder="Nome da categoria"
                                                                    placeholderTextColor="#444"
                                                                />
                                                            </View>
                                                            {(item as any).isCustom && (
                                                                <TouchableOpacity style={styles.deleteButton} onPress={() => removeCategory(realGroupIndex, realItemIndex)}>
                                                                    <Trash2 size={17} color="#555" />
                                                                </TouchableOpacity>
                                                            )}
                                                        </View>
                                                    );
                                                })}

                                                <TouchableOpacity style={styles.addCategoryButton} onPress={() => addNewCategory(realGroupIndex)}>
                                                    <Plus size={14} color="#555" />
                                                    <Text style={styles.addCategoryText}>Adicionar</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </Animated.View>
                                    )}
                                </View>
                            );
                        })
                    )}
                </ScrollView>

                {hasChanges && (
                    <View style={[styles.saveContainer, { paddingBottom: insets.bottom + 16 }]}>
                        <TouchableOpacity style={styles.saveBottomButton} onPress={handleSave} disabled={saving} activeOpacity={0.85}>
                            {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBottomButtonText}>Salvar alterações</Text>}
                        </TouchableOpacity>
                    </View>
                )}
            </KeyboardAvoidingView>

            <ModalPadrao
                visible={newCategoryModalVisible}
                onClose={() => setNewCategoryModalVisible(false)}
                title="Nova Categoria"
                footer={
                    <TouchableOpacity
                        onPress={handleCreateCategory}
                        disabled={saving || !newCategoryName.trim()}
                        style={[styles.modalSaveButton, (saving || !newCategoryName.trim()) && styles.modalSaveButtonDisabled]}
                    >
                        {saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.modalSaveButtonText}>Adicionar</Text>}
                    </TouchableOpacity>
                }
            >
                <View style={styles.sectionCard}>
                    <View style={styles.modalItemContainer}>
                        <TextInput
                            style={styles.modalInput}
                            value={newCategoryName}
                            onChangeText={setNewCategoryName}
                            placeholder={`Nova categoria em ${newCategoryGroupTitle}`}
                            placeholderTextColor="#555"
                            returnKeyType="done"
                            onSubmitEditing={handleCreateCategory}
                            autoFocus
                        />
                    </View>
                </View>
            </ModalPadrao>
        </View>
    );
}

const styles = StyleSheet.create({
    mainContainer: { flex: 1, backgroundColor: '#0C0C0C' },

    // Header
    headerWrapper: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255,255,255,0.08)',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 52,
        paddingHorizontal: 20,
    },
    backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
    headerTitle: { flex: 1, fontSize: 18, fontWeight: '600', color: '#E8E8EA', textAlign: 'center' },
    headerSpacer: { width: 40, height: 40 },

    // Stats + Search
    searchSection: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 12,
    },
    statsRow: {
        flexDirection: 'row',
        gap: 24,
        marginBottom: 14,
    },
    statItem: { alignItems: 'flex-start' },
    statValue: { fontSize: 22, fontWeight: '600', color: '#E8E8EA' },
    statLabel: { fontSize: 11, color: '#555', marginTop: 1 },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#111111',
        borderRadius: 10,
        paddingHorizontal: 12,
        height: 42,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#1A1A1A',
    },
    searchIcon: { marginRight: 8 },
    searchInput: { flex: 1, color: '#E8E8EA', fontSize: 14 },

    // List
    scrollContent: { paddingHorizontal: 20 },
    groupCard: { marginBottom: 8 },
    groupHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
    },
    groupTitle: { fontSize: 15, fontWeight: '500', color: '#E8E8EA' },
    groupMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    groupCount: { fontSize: 13, color: '#555' },
    groupContent: {
        backgroundColor: '#111111',
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#1A1A1A',
        overflow: 'hidden',
        marginBottom: 8,
    },
    itemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 12,
        minHeight: 52,
    },
    itemSeparator: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#1A1A1A',
    },
    deleteConfirmCard: {
        backgroundColor: '#141414',
        borderRadius: 0,
        borderWidth: 0,
        paddingVertical: 12,
        paddingHorizontal: 14,
        width: '100%',
    },
    itemContent: { flex: 1 },
    keyValue: {
        fontSize: 11,
        color: '#444',
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        marginBottom: 3,
    },
    nameInput: {
        fontSize: 15,
        color: '#E8E8EA',
        fontWeight: '400',
        padding: 0,
    },
    deleteButton: { padding: 6, marginLeft: 8 },
    addCategoryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 11,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: '#1A1A1A',
    },
    addCategoryText: { fontSize: 13, color: '#555' },

    // Save bottom button
    saveContainer: {
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        paddingHorizontal: 20,
        paddingTop: 12,
        backgroundColor: 'rgba(12,12,12,0.85)',
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(255,255,255,0.08)',
    },
    saveBottomButton: {
        backgroundColor: '#d97757',
        borderRadius: 12,
        height: 50,
        alignItems: 'center',
        justifyContent: 'center',
    },
    saveBottomButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },

    // Modal
    sectionCard: {
        backgroundColor: '#111111',
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#1A1A1A',
    },
    modalItemContainer: {
        paddingHorizontal: 16,
        paddingVertical: 14,
        minHeight: 52,
        justifyContent: 'center',
    },
    modalInput: {
        color: '#E8E8EA',
        fontSize: 16,
        padding: 0,
    },
    modalSaveButton: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#D97757',
        borderRadius: 12,
        minHeight: 50,
    },
    modalSaveButtonDisabled: { opacity: 0.4 },
    modalSaveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
