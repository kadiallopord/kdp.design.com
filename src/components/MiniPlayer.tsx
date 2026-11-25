import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { getAlbum, getArtist } from '../data/catalog';
import { usePlayer } from '../state/PlayerContext';
import { colors, spacing } from '../theme';
import { Cover } from './Cover';

export function MiniPlayer() {
  const { current, playing, buffering, togglePlay, next, position, duration } = usePlayer();
  if (!current) return null;

  const isTrack = current.kind === 'track';
  const title = isTrack ? current.track.title : current.station.name;
  const subtitle = isTrack ? getArtist(current.track.artistId)?.name : 'En direct';
  const palette = isTrack ? getAlbum(current.track.albumId)?.palette ?? ['#222', '#444'] : current.station.palette;
  const progress = isTrack && duration > 0 ? Math.min(position / duration, 1) : 0;

  return (
    <Pressable style={styles.wrap} onPress={() => router.push('/lecteur')} accessibilityLabel="Ouvrir le lecteur">
      <View style={styles.row}>
        <Cover palette={palette as [string, string]} label={title} size={42} icon={isTrack ? undefined : 'radio'} />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={styles.title}>{title}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {!isTrack ? <View style={styles.liveDot} /> : null}
            <Text numberOfLines={1} style={styles.sub}>{subtitle}</Text>
          </View>
        </View>
        {buffering ? <ActivityIndicator color={colors.gold} style={{ marginRight: spacing.sm }} /> : null}
        <Pressable hitSlop={10} onPress={togglePlay} accessibilityLabel={playing ? 'Pause' : 'Lecture'}>
          <Ionicons name={playing ? 'pause' : 'play'} size={28} color={colors.white} />
        </Pressable>
        {isTrack ? (
          <Pressable hitSlop={10} onPress={next} style={{ marginLeft: spacing.md }} accessibilityLabel="Titre suivant">
            <Ionicons name="play-skip-forward" size={24} color={colors.white} />
          </Pressable>
        ) : null}
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${progress * 100}%` }]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.surfaceRaised, marginHorizontal: spacing.sm, marginBottom: spacing.xs, borderRadius: 12, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  row: { flexDirection: 'row', alignItems: 'center', padding: spacing.sm, gap: spacing.md },
  title: { color: colors.white, fontWeight: '700', fontSize: 14 },
  sub: { color: colors.textMuted, fontSize: 12 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.live },
  track: { height: 2, backgroundColor: colors.border },
  fill: { height: 2, backgroundColor: colors.gold },
});
