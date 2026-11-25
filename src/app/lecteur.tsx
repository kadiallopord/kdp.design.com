import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Cover } from '../components/Cover';
import { getAlbum, getArtist } from '../data/catalog';
import { formatDuration } from '../data/format';
import { useLibrary } from '../state/LibraryContext';
import { usePlayer } from '../state/PlayerContext';
import { colors, spacing } from '../theme';

export default function Lecteur() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const p = usePlayer();
  const lib = useLibrary();
  const [barWidth, setBarWidth] = useState(1);

  if (!p.current) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: colors.textMuted }}>Rien en lecture</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: spacing.lg }}>
          <Text style={{ color: colors.gold }}>Fermer</Text>
        </Pressable>
      </View>
    );
  }

  const now = p.current;
  const isTrack = now.kind === 'track';
  const track = now.kind === 'track' ? now.track : null;
  const station = now.kind === 'radio' ? now.station : null;
  const album = track ? getAlbum(track.albumId) : undefined;
  const artist = track ? getArtist(track.artistId) : undefined;
  const palette = (album?.palette ?? station?.palette ?? ['#222', '#444']) as [string, string];
  const coverSize = Math.min(width - spacing.xl * 2, 360);
  const progress = p.duration > 0 ? Math.min(p.position / p.duration, 1) : 0;
  const fav = track ? lib.isFavorite(track.id) : false;

  return (
    <LinearGradient colors={[palette[0], colors.background]} style={[styles.root, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.lg }]}>
      <View style={styles.top}>
        <Pressable hitSlop={12} onPress={() => router.back()} accessibilityLabel="Réduire le lecteur">
          <Ionicons name="chevron-down" size={28} color={colors.white} />
        </Pressable>
        <Text style={styles.topLabel}>{isTrack ? `Lecture • ${album?.title ?? ''}` : 'Radio en direct'}</Text>
        <Pressable
          hitSlop={12}
          onPress={() => {
            p.stop();
            router.back();
          }}
          accessibilityLabel="Arrêter la lecture"
        >
          <Ionicons name="close" size={24} color={colors.textMuted} />
        </Pressable>
      </View>

      <View style={{ alignItems: 'center', marginTop: spacing.xl }}>
        <Cover palette={palette} label={track?.title ?? station?.name} size={coverSize} icon={isTrack ? undefined : 'radio'} />
      </View>

      <View style={styles.infoRow}>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={styles.title}>{track?.title ?? station?.name}</Text>
          {artist ? (
            <Pressable
              onPress={() => {
                router.back();
                router.push({ pathname: '/artiste/[id]', params: { id: artist.id } });
              }}
            >
              <Text style={styles.artist}>{artist.name}</Text>
            </Pressable>
          ) : (
            <Text style={styles.artist}>{station?.tagline}</Text>
          )}
        </View>
        {track ? (
          <>
            <Pressable hitSlop={10} onPress={() => router.push({ pathname: '/ajouter/[trackId]', params: { trackId: track.id } })} accessibilityLabel="Ajouter à une playlist">
              <Ionicons name="add-circle-outline" size={28} color={colors.textMuted} />
            </Pressable>
            <Pressable hitSlop={10} onPress={() => lib.toggleFavorite(track.id)} style={{ marginLeft: spacing.lg }} accessibilityLabel="Favori">
              <Ionicons name={fav ? 'heart' : 'heart-outline'} size={28} color={fav ? colors.gold : colors.textMuted} />
            </Pressable>
          </>
        ) : null}
      </View>

      {isTrack ? (
        <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.lg }}>
          <Pressable
            onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
            onPress={(e) => p.seekTo((e.nativeEvent.locationX / barWidth) * p.duration)}
            style={styles.barHit}
            accessibilityLabel="Barre de progression"
          >
            <View style={styles.bar}>
              <View style={[styles.barFill, { width: `${progress * 100}%` }]} />
            </View>
            <View style={[styles.knob, { left: progress * barWidth - 7 }]} />
          </Pressable>
          <View style={styles.times}>
            <Text style={styles.time}>{formatDuration(p.position)}</Text>
            <Text style={styles.time}>{formatDuration(p.duration)}</Text>
          </View>
        </View>
      ) : (
        <View style={styles.liveRow}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>EN DIRECT</Text>
        </View>
      )}

      <View style={styles.controls}>
        {isTrack ? (
          <Pressable hitSlop={10} onPress={p.toggleShuffle} accessibilityLabel="Lecture aléatoire">
            <Ionicons name="shuffle" size={24} color={p.shuffle ? colors.gold : colors.textMuted} />
          </Pressable>
        ) : <View style={{ width: 24 }} />}
        {isTrack ? (
          <Pressable hitSlop={10} onPress={p.previous} accessibilityLabel="Précédent">
            <Ionicons name="play-skip-back" size={34} color={colors.white} />
          </Pressable>
        ) : <View style={{ width: 34 }} />}
        <Pressable onPress={p.togglePlay} style={styles.playBtn} accessibilityLabel={p.playing ? 'Pause' : 'Lecture'}>
          {p.buffering && !p.playing ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Ionicons name={p.playing ? 'pause' : 'play'} size={34} color={colors.background} style={!p.playing ? { marginLeft: 4 } : undefined} />
          )}
        </Pressable>
        {isTrack ? (
          <Pressable hitSlop={10} onPress={p.next} accessibilityLabel="Suivant">
            <Ionicons name="play-skip-forward" size={34} color={colors.white} />
          </Pressable>
        ) : <View style={{ width: 34 }} />}
        {isTrack ? (
          <Pressable hitSlop={10} onPress={p.cycleRepeat} accessibilityLabel="Répétition">
            <View>
              <Ionicons name="repeat" size={24} color={p.repeat !== 'off' ? colors.gold : colors.textMuted} />
              {p.repeat === 'one' ? <Text style={styles.repeatOne}>1</Text> : null}
            </View>
          </Pressable>
        ) : <View style={{ width: 24 }} />}
      </View>

      {isTrack && p.queue.length > 1 ? (
        <Text style={styles.queue}>
          Titre {p.index + 1} sur {p.queue.length}
          {p.queue[(p.index + 1) % p.queue.length] ? ` • Ensuite : ${p.queue[(p.index + 1) % p.queue.length].title}` : ''}
        </Text>
      ) : null}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg },
  topLabel: { color: colors.text, fontSize: 13, fontWeight: '600' },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xl, marginTop: spacing.xl },
  title: { color: colors.white, fontSize: 24, fontWeight: '800' },
  artist: { color: colors.goldLight, fontSize: 16, marginTop: 4 },
  barHit: { height: 24, justifyContent: 'center' },
  bar: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', overflow: 'hidden' },
  barFill: { height: 4, backgroundColor: colors.gold },
  knob: { position: 'absolute', width: 14, height: 14, borderRadius: 7, backgroundColor: colors.gold, top: 5 },
  times: { flexDirection: 'row', justifyContent: 'space-between' },
  time: { color: colors.textMuted, fontSize: 12 },
  liveRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: spacing.xl },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.live, marginRight: 6 },
  liveText: { color: colors.live, fontWeight: '800', letterSpacing: 1 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xxl, marginTop: spacing.xl },
  playBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  repeatOne: { position: 'absolute', right: -6, top: -6, color: colors.gold, fontSize: 10, fontWeight: '900' },
  queue: { color: colors.textFaint, fontSize: 12, textAlign: 'center', marginTop: spacing.xl, paddingHorizontal: spacing.xl },
});
