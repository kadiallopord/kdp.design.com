import { Stack, useLocalSearchParams, router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GoldButton } from '../../components/Cards';
import { Cover } from '../../components/Cover';
import { TrackRow } from '../../components/TrackRow';
import { getAlbum, getArtist, tracksOfAlbum } from '../../data/catalog';
import { formatDate, formatDuration, formatFcfa } from '../../data/format';
import { usePlayer } from '../../state/PlayerContext';
import { colors, font, radius, spacing } from '../../theme';

export default function AlbumScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const album = getAlbum(id);
  const { playTracks } = usePlayer();
  if (!album) return <Text style={{ color: colors.text, padding: spacing.lg }}>Album introuvable.</Text>;
  const artist = getArtist(album.artistId);
  const list = tracksOfAlbum(album.id);
  const total = list.reduce((s, t) => s + t.durationSec, 0);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
      <Stack.Screen options={{ title: album.title }} />
      <View style={{ alignItems: 'center', paddingTop: spacing.lg }}>
        <Cover palette={album.palette} label={album.title} size={220} />
        <Text style={[font.title, { marginTop: spacing.lg, textAlign: 'center' }]}>{album.title}</Text>
        {artist ? (
          <Pressable onPress={() => router.push({ pathname: '/artiste/[id]', params: { id: artist.id } })}>
            <Text style={styles.artist}>{artist.name}</Text>
          </Pressable>
        ) : null}
        <Text style={font.small}>
          {album.preorder ? `Sortie prévue le ${formatDate(album.releaseDate)}` : `Album • ${album.year}`} • {list.length} titre{list.length > 1 ? 's' : ''} • {formatDuration(total)}
        </Text>
      </View>

      <View style={styles.actions}>
        <GoldButton label={album.preorder ? "Écouter l'extrait" : 'Écouter'} icon="play" onPress={() => playTracks(list)} />
        <GoldButton label="Aléatoire" icon="shuffle" outline onPress={() => playTracks(list, Math.floor(Math.random() * list.length))} />
      </View>

      <View style={styles.buyBox}>
        <Text style={styles.buyTitle}>{album.preorder ? 'Précommander' : 'Acheter l’album'} • {formatFcfa(album.priceFcfa)}</Text>
        <Text style={font.small}>
          {album.preorder
            ? "Écoutez les extraits dès maintenant et recevez l'album complet le jour de sa sortie."
            : 'Paiement unique, accès permanent. 85 % reversés à l’artiste.'}
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
          <GoldButton label="Wave" disabled onPress={() => {}} />
          <GoldButton label="Orange Money" disabled onPress={() => {}} />
        </View>
        <Text style={[font.tiny, { marginTop: spacing.sm }]}>Paiement disponible dans une prochaine version.</Text>
      </View>

      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md }}>
        {list.map((t, i) => <TrackRow key={t.id} track={t} queue={list} index={i} />)}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  artist: { color: colors.gold, fontSize: 16, fontWeight: '600', marginVertical: 4 },
  actions: { flexDirection: 'row', justifyContent: 'center', gap: spacing.md, marginTop: spacing.lg },
  buyBox: { margin: spacing.lg, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.goldDark },
  buyTitle: { color: colors.goldLight, fontWeight: '800', fontSize: 15, marginBottom: 4 },
});
