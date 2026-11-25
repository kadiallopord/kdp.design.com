import { Ionicons } from '@expo/vector-icons';
import { BottomTabBar, Tabs } from 'expo-router/tabs';
import { View, type ColorValue } from 'react-native';
import { MiniPlayer } from '../../components/MiniPlayer';
import { colors } from '../../theme';

type IconName = keyof typeof Ionicons.glyphMap;
const tab = (title: string, icon: IconName, iconActive: IconName) => ({
  title,
  tabBarIcon: ({ color, focused, size }: { color: ColorValue; focused: boolean; size: number }) => (
    <Ionicons name={focused ? iconActive : icon} size={size - 2} color={color as string} />
  ),
});

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => (
        <View style={{ backgroundColor: colors.background }}>
          <MiniPlayer />
          <BottomTabBar {...props} />
        </View>
      )}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 9, fontWeight: '600' },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="index" options={tab('Accueil', 'home-outline', 'home')} />
      <Tabs.Screen name="musique" options={tab('Musique', 'musical-notes-outline', 'musical-notes')} />
      <Tabs.Screen name="radio" options={tab('Radio', 'radio-outline', 'radio')} />
      <Tabs.Screen name="videos" options={tab('Vidéos', 'play-circle-outline', 'play-circle')} />
      <Tabs.Screen name="classements" options={tab('Classements', 'trophy-outline', 'trophy')} />
      <Tabs.Screen name="profil" options={tab('Profil', 'person-outline', 'person')} />
    </Tabs>
  );
}
