import { CategoryGroup } from '@/constants/defaultCategories';
import { BlurView } from 'expo-blur';
import { Search } from 'lucide-react-native';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { ModalPadrao } from './ui/ModalPadrao';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface CategorySelectorModalProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (categoryKey: string) => void;
    categories: CategoryGroup[];
    loading?: boolean;
}

export function CategorySelectorModal({
    visible,
    onClose,
    onSelect,
    categories,
    loading
}: CategorySelectorModalProps) {
    const [search, setSearch] = useState('');

    const filteredCategories = categories.map(group => ({
        ...group,
        items: group.items.filter(item =>
            item.label.toLowerCase().includes(search.toLowerCase()) ||
            group.title.toLowerCase().includes(search.toLowerCase())
        )
    })).filter(group => group.items.length > 0);

    return (
        <ModalPadrao
            visible={visible}
            onClose={onClose}
            title="Selecionar Categoria"
        >
            <View style={styles.container}>
                <View style={styles.searchContainer}>
                    <View style={styles.searchBar}>
                        <Search size={18} color="#666" style={styles.searchIcon} />
                        <TextInput
                            style={styles.searchInput}
                            value={search}
                            onChangeText={setSearch}
                            placeholder="Buscar categoria..."
                            placeholderTextColor="#666"
                            autoCorrect={false}
                        />
                    </View>
                </View>

                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {filteredCategories.map((group, groupIdx) => (
                        <View key={`group-${groupIdx}`} style={styles.groupContainer}>
                            <Text style={styles.groupTitle}>{group.title}</Text>
                            <View style={styles.itemsGrid}>
                                {group.items.map((item) => (
                                    <TouchableOpacity
                                        key={item.key}
                                        style={styles.categoryItem}
                                        onPress={() => {
                                            onSelect(item.key);
                                        }}
                                    >
                                        <Text style={styles.categoryLabel}>{item.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    ))}
                    {filteredCategories.length === 0 && (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>Nenhuma categoria encontrada</Text>
                        </View>
                    )}
                </ScrollView>
            </View>

            {loading && (
                <View style={styles.loadingOverlay}>
                    <BlurView
                        intensity={40}
                        tint="dark"
                        style={StyleSheet.absoluteFill}
                    />
                    <View style={styles.loaderContainer}>
                        <ActivityIndicator size="large" color="#D97757" />
                        <Text style={styles.loadingText}>Processando...</Text>
                    </View>
                </View>
            )}
        </ModalPadrao>
    );
}

const styles = StyleSheet.create({
    container: {
        maxHeight: SCREEN_HEIGHT * 0.75,
    },
    searchContainer: {
        marginBottom: 16,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#111',
        borderRadius: 14,
        paddingHorizontal: 12,
        height: 48,
        borderWidth: 1,
        borderColor: '#252525',
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        color: '#FFFFFF',
        fontSize: 15,
        height: '100%',
    },
    scrollView: {
        flexGrow: 0,
    },
    scrollContent: {
        paddingBottom: 20,
    },
    groupContainer: {
        marginBottom: 24,
    },
    groupTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: '#666',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 12,
        marginLeft: 4,
    },
    itemsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    categoryItem: {
        backgroundColor: '#1A1A1A',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#2A2A2A',
        minWidth: '30%',
        alignItems: 'center',
    },
    categoryLabel: {
        color: '#E0E0E0',
        fontSize: 14,
        fontWeight: '500',
    },
    emptyState: {
        paddingVertical: 40,
        alignItems: 'center',
    },
    emptyText: {
        color: '#666',
        fontSize: 15,
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 28,
        overflow: 'hidden',
        zIndex: 999
    },
    loaderContainer: {
        alignItems: 'center',
        gap: 12,
        backgroundColor: 'rgba(26, 26, 26, 0.8)',
        padding: 24,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#2A2A2A',
    },
    loadingText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
});
