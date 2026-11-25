import { Stack, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { AlbumCard, GoldButton, VideoCard } from '../../components/Cards';
import { Cover } from '../../components/Cover';
import { Section } from '../../components/Section';
import { TrackRow } from '../../components/TrackRow';
import { albumsOfArtist, getArtist, tracksOfArtist, videosOfArtist } from '../../data/catalog';
import { formatCount } from '../../data/format';
import { artistPlays } from '../../data/stats';
import { useLibrary } from '../../state/LibraryContext';
import { usePlayer } from '../../state/PlayerContext';
import { colors, font, spacing } from '../../theme';

export default function ArtistScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const artist = getArtist(id);
  const lib = useLibrary();
  const { playTracks } = usePlayer();
  if (!artist) return <Text style={{ color: colors.text, padding: spacing.lg }}>Artiste introuvable.</Text>;

  const list = tracksOfArtist(artist.id);
  const following = lib.isFollowing(artist.id);
  const followers = artist.followers + (following ? 1 : 0);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
      <Stack.Screen options={{ title: artist.name }} />
      <LinearGradient colors={[artist.palette[0], colors.background]} style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
        <Cover palette={artist.palette} label={artist.name} size={150} round />
        <Text style={[font.title, { marginTop: spacing.md }]}>{artist.name}</Text>
        <Text style={styles.genre}>{artist.genre}</Text>
        <View style={styles.stats}>
          <Stat value={formatCount(artistPlays(artist.id, lib.playCounts))} label="écoutes" />
          <Stat value={formatCount(followers)} label="abonnés" />
          <Stat value={`${list.length}`} label="titres" />
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg }}>
          <GoldButton label="Écouter" icon="play" onPress={() => playTracks(list)} />
          <GoldButton label={following ? 'Abonné' : 'Suivre'} icon={following ? 'checkmark' : 'add'} outline onPress={() => lib.toggleFollow(artist.id)} />
        </View>
      </LinearGradient>

      <Section title="Biographie">
        <Text style={[font.body, { color: colors.textMuted, lineHeight: 22 }]}>{artist.bio}</Text>
        <View style={{ marginTop: spacing.md, gap: 4 }}>
          {artist.socials.map((s) => (
            <Text key={s.label} style={font.small}>
              <Text style={{ color: colors.gold }}>{s.label}</Text> {s.handle}
            </Text>
          ))}
        </View>
      </Section>

      <Section title="Titres populaires">
        {list.map((t, i) => <TrackRow key={t.id} track={t} queue={list} index={i} />)}
      </Section>

      <Section title="Albums" horizontal>
        {albumsOfArtist(artist.id).map((a) => <AlbumCard key={a.id} album={a} />)}
      </Section>

      {videosOfArtist(artist.id).length ? (
        <Section title="Clips vidéo" horizontal>
          {videosOfArtist(artist.id).map((v) => <VideoCard key={v.id} video={v} />)}
        </Section>
      ) : null}
    </ScrollView>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ alignItems: 'center', minWidth: 80 }}>
      <Text style={{ color: colors.white, fontWeight: '800', fontSize: 18 }}>{value}</Text>
      <Text style={font.tiny}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  genre: { color: colors.gold, fontWeight: '600', marginTop: 2 },
  stats: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.lg },
});
