import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        animation: 'none',
      }}
    >
      <Stack.Screen name="index" options={{ title: 'aco AUT' }} />
      <Stack.Screen name="elements" options={{ title: 'Elements' }} />
      <Stack.Screen name="keyboard" options={{ title: 'Keyboard' }} />
      <Stack.Screen name="gestures" options={{ title: 'Gestures' }} />
      <Stack.Screen name="webview" options={{ title: 'WebView' }} />
    </Stack>
  );
}
