import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LibraryProvider } from '../state/LibraryContext';
import { PlayerProvider } from '../state/PlayerContext';
import { colors } from '../theme';

const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.gold,
    background: colors.background,
    card: colors.background,
    text: colors.white,
    border: colors.border,
  },
};

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider value={theme}>
        <LibraryProvider>
          <PlayerProvider>
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: colors.background },
                headerTintColor: colors.gold,
                headerTitleStyle: { color: colors.white, fontWeight: '700' },
                contentStyle: { backgroundColor: colors.background },
                headerBackButtonDisplayMode: 'minimal',
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="lecteur" options={{ presentation: 'modal', headerShown: false }} />
              <Stack.Screen name="recherche" options={{ title: 'Recherche' }} />
              <Stack.Screen name="album/[id]" options={{ title: '' }} />
              <Stack.Screen name="artiste/[id]" options={{ title: '' }} />
              <Stack.Screen name="playlist/[id]" options={{ title: 'Playlist' }} />
              <Stack.Screen name="video/[id]" options={{ title: 'Vidéo' }} />
              <Stack.Screen name="ajouter/[trackId]" options={{ presentation: 'modal', title: 'Ajouter à une playlist' }} />
            </Stack>
          </PlayerProvider>
        </LibraryProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
