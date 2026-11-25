import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArtistCard } from '../../components/Cards';
import { Cover } from '../../components/Cover';
import { TabScreen } from '../../components/Screen';
import { Section } from '../../components/Section';
import { TrackRow } from '../../components/TrackRow';
import { getArtist, getTrack } from '../../data/catalog';
import type { Artist, Track } from '../../data/types';
import { useLibrary } from '../../state/LibraryContext';
import { colors, font, radius, spacing } from '../../theme';

export default function Profil() {
  const lib = useLibrary();
  const totalListens = Object.values(lib.playCounts).reduce((a, b) => a + b, 0);
  const recentIds = Array.from(new Set(lib.history.map((h) => h.trackId))).slice(0, 5);
  const recent = recentIds.map(getTrack).filter(Boolean) as Track[];
  const followed = lib.followedArtists.map(getArtist).filter(Boolean) as Artist[];

  return (
    <TabScreen title="Profil">
      <View style={styles.card}>
        <Cover palette={['#1A1405', '#D4AF37']} icon="person" size={64} round />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>Invité</Text>
          <Text style={font.small}>Compte local sur cet appareil</Text>
        </View>
      </View>

      <View style={styles.stats}>
        <Stat value={totalListens} label="Écoutes" />
        <Stat value={lib.favorites.length} label="Favoris" />
        <Stat value={lib.playlists.length} label="Playlists" />
        <Stat value={lib.followedArtists.length} label="Abonnements" />
      </View>

      <View style={styles.menu}>
        <MenuItem icon="heart" label="Mes favoris" onPress={() => router.push('/musique')} />
        <MenuItem icon="list" label="Mes playlists" onPress={() => router.push('/musique')} />
        <MenuItem icon="diamond" label="Premium" hint="Bientôt" />
        <MenuItem icon="cloud-download" label="Mode hors ligne" hint="Bientôt" />
        <MenuItem icon="card" label="Achats et précommandes" hint="Bientôt" />
        <MenuItem icon="log-in" label="Se connecter / créer un compte" hint="Bientôt" />
      </View>

      {recent.length ? (
        <Section title="Écoutés récemment">
          {recent.map((t, i) => <TrackRow key={t.id} track={t} queue={recent} index={i} />)}
        </Section>
      ) : null}

      {followed.length ? (
        <Section title="Artistes suivis" horizontal>
          {followed.map((a) => <ArtistCard key={a.id} artist={a} size={96} />)}
        </Section>
      ) : null}
    </TabScreen>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={{ color: colors.gold, fontSize: 20, fontWeight: '800' }}>{value}</Text>
      <Text style={font.tiny}>{label}</Text>
    </View>
  );
}

function MenuItem({ icon, label, hint, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; hint?: string; onPress?: () => void }) {
  return (
    <Pressable style={styles.item} onPress={onPress} disabled={!onPress}>
      <Ionicons name={icon} size={20} color={colors.gold} />
      <Text style={styles.itemLabel}>{label}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, margin: spacing.lg, padding: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  name: { color: colors.white, fontSize: 18, fontWeight: '800' },
  stats: { flexDirection: 'row', marginHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg },
  menu: { marginHorizontal: spacing.lg, marginTop: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  itemLabel: { color: colors.text, flex: 1, fontSize: 15 },
  hint: { color: colors.textFaint, fontSize: 12 },
});
