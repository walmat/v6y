import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';

import { FixedModeProvider } from '@/demo/FixedMode';

export default function RootLayout() {
  return (
    <ThemeProvider value={DefaultTheme}>
      <FixedModeProvider>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          {/* The product name in the content is the heading, so the native header stays empty. */}
          <Stack.Screen name="product/[id]" options={{ title: '', headerBackTitle: 'Menu' }} />
          <Stack.Screen name="dev-menu" options={{ presentation: 'modal', title: 'Developer menu' }} />
        </Stack>
      </FixedModeProvider>
    </ThemeProvider>
  );
}
