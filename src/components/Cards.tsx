import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getArtist } from '../data/catalog';
import { formatCount, formatDuration } from '../data/format';
import type { Album, Artist, Video } from '../data/types';
import { colors, radius, spacing } from '../theme';
import { Cover } from './Cover';

export function AlbumCard({ album, width = 150 }: { album: Album; width?: number }) {
  const artist = getArtist(album.artistId);
  return (
    <Pressable style={{ width }} onPress={() => router.push({ pathname: '/album/[id]', params: { id: album.id } })}>
      <View>
        <Cover palette={album.palette} label={album.title} size={width} />
        {album.preorder ? <Badge text="Précommande" /> : album.exclusive ? <Badge text="Exclusif" /> : null}
      </View>
      <Text numberOfLines={1} style={styles.title}>{album.title}</Text>
      <Text numberOfLines={1} style={styles.sub}>{artist?.name} • {album.year}</Text>
    </Pressable>
  );
}

export function ArtistCard({ artist, size = 110 }: { artist: Artist; size?: number }) {
  return (
    <Pressable style={{ width: size, alignItems: 'center' }} onPress={() => router.push({ pathname: '/artiste/[id]', params: { id: artist.id } })}>
      <Cover palette={artist.palette} label={artist.name} size={size} round />
      <Text numberOfLines={1} style={[styles.title, { textAlign: 'center' }]}>{artist.name}</Text>
      <Text numberOfLines={1} style={[styles.sub, { textAlign: 'center' }]}>{formatCount(artist.followers)} abonnés</Text>
    </Pressable>
  );
}

export function VideoCard({ video, width = 240 }: { video: Video; width?: number }) {
  const artist = video.artistId ? getArtist(video.artistId) : undefined;
  const height = Math.round((width * 9) / 16);
  return (
    <Pressable style={{ width }} onPress={() => router.push({ pathname: '/video/[id]', params: { id: video.id } })}>
      <View>
        <Cover palette={video.palette} width={width} height={height} icon="play-circle" />
        <View style={styles.duration}><Text style={styles.durationText}>{formatDuration(video.durationSec)}</Text></View>
        <Badge text={video.category} />
      </View>
      <Text numberOfLines={2} style={styles.title}>{video.title}</Text>
      <Text numberOfLines={1} style={styles.sub}>{artist ? `${artist.name} • ` : ''}{formatCount(video.views)} vues</Text>
    </Pressable>
  );
}

export function Badge({ text }: { text: string }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{text}</Text>
    </View>
  );
}

export function GoldButton({ label, icon, onPress, outline, disabled }: { label: string; icon?: keyof typeof Ionicons.glyphMap; onPress: () => void; outline?: boolean; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.btn, outline ? styles.btnOutline : styles.btnFill, (pressed || disabled) && { opacity: 0.6 }]}
    >
      {icon ? <Ionicons name={icon} size={18} color={outline ? colors.gold : colors.background} /> : null}
      <Text style={[styles.btnText, { color: outline ? colors.gold : colors.background }]}>{label}</Text>
    </Pressable>
  );
}

export function EmptyState({ icon, title, text }: { icon: keyof typeof Ionicons.glyphMap; title: string; text?: string }) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={40} color={colors.goldDark} />
      <Text style={[styles.title, { marginTop: spacing.md, fontSize: 16 }]}>{title}</Text>
      {text ? <Text style={[styles.sub, { textAlign: 'center', marginTop: 4 }]}>{text}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontWeight: '600', fontSize: 14, marginTop: spacing.sm },
  sub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  badge: { position: 'absolute', top: 8, left: 8, backgroundColor: colors.gold, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { color: colors.background, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  duration: { position: 'absolute', right: 8, bottom: 8, backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  durationText: { color: colors.white, fontSize: 11, fontWeight: '600' },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: spacing.lg, paddingVertical: 11, borderRadius: radius.pill },
  btnFill: { backgroundColor: colors.gold },
  btnOutline: { borderWidth: 1.5, borderColor: colors.gold },
  btnText: { fontWeight: '700', fontSize: 14 },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl },
});
