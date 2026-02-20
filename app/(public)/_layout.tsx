import { Stack } from 'expo-router';

export default function PublicLayout() {
    return (
        <Stack initialRouteName="welcome" screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#1D100B' }, animation: 'fade' }}>
            <Stack.Screen name="welcome" />
            <Stack.Screen name="login" />
            <Stack.Screen name="register" />
        </Stack>
    );
}
