import { Stack } from 'expo-router';
import React from 'react';

export default function LegalLayout() {
    return (
        <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
            <Stack.Screen name="privacy" />
            <Stack.Screen name="terms" />
        </Stack>
    );
}
