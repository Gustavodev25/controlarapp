import { RecurrenceView } from '@/components/RecurrenceView';
import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

export default function RecurrenceScreen() {
    const { tab } = useLocalSearchParams<{ tab: string }>();
    const initialTab = (tab === 'subscriptions' || tab === 'reminders') ? tab : 'subscriptions';

    return (
        <View style={styles.container}>
            <RecurrenceView initialTab={initialTab} key={initialTab} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0C0C0C',
    },
});
