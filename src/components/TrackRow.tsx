import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getAlbum, getArtist } from '../data/catalog';
import { formatCount, formatDuration } from '../data/format';
import type { Track } from '../data/types';
import { useLibrary } from '../state/LibraryContext';
import { usePlayer } from '../state/PlayerContext';
import { colors, spacing } from '../theme';
import { Cover } from './Cover';

type Props = {
  track: Track;
  queue: Track[];
  index: number;
  rank?: number;
  plays?: number;
  onRemove?: () => void;
};

export function TrackRow({ track, queue, index, rank, plays, onRemove }: Props) {
  const { playTracks, current, playing } = usePlayer();
  const { isFavorite, toggleFavorite } = useLibrary();
  const artist = getArtist(track.artistId);
  const album = getAlbum(track.albumId);
  const active = current?.kind === 'track' && current.track.id === track.id;
  const fav = isFavorite(track.id);

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
      onPress={() => playTracks(queue, index)}
      accessibilityRole="button"
      accessibilityLabel={`Écouter ${track.title} de ${artist?.name ?? ''}`}
    >
      {rank !== undefined ? (
        <Text style={[styles.rank, rank <= 3 && { color: colors.gold }]}>{rank}</Text>
      ) : null}
      <Cover palette={album?.palette ?? ['#222', '#444']} label={track.title} size={48} />
      <View style={styles.meta}>
        <Text numberOfLines={1} style={[styles.title, active && { color: colors.gold }]}>
          {active && playing ? '♪ ' : ''}
          {track.title}
        </Text>
        <Text numberOfLines={1} style={styles.sub}>
          {artist?.name}
          {plays !== undefined ? ` • ${formatCount(plays)} écoutes` : ` • ${formatDuration(track.durationSec)}`}
        </Text>
      </View>
      <Pressable hitSlop={8} onPress={() => toggleFavorite(track.id)} accessibilityLabel={fav ? 'Retirer des favoris' : 'Ajouter aux favoris'}>
        <Ionicons name={fav ? 'heart' : 'heart-outline'} size={22} color={fav ? colors.gold : colors.textMuted} />
      </Pressable>
      {onRemove ? (
        <Pressable hitSlop={8} onPress={onRemove} style={{ marginLeft: spacing.md }} accessibilityLabel="Retirer de la playlist">
          <Ionicons name="remove-circle-outline" size={22} color={colors.textMuted} />
        </Pressable>
      ) : (
        <Pressable
          hitSlop={8}
          onPress={() => router.push({ pathname: '/ajouter/[trackId]', params: { trackId: track.id } })}
          style={{ marginLeft: spacing.md }}
          accessibilityLabel="Ajouter à une playlist"
        >
          <Ionicons name="add-circle-outline" size={22} color={colors.textMuted} />
        </Pressable>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, gap: spacing.md },
  rank: { width: 22, textAlign: 'center', color: colors.textMuted, fontWeight: '800', fontSize: 16 },
  meta: { flex: 1 },
  title: { color: colors.text, fontSize: 15, fontWeight: '600' },
  sub: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
});
