import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Cover } from '../../components/Cover';
import { TabScreen } from '../../components/Screen';
import { Segmented } from '../../components/Segmented';
import { TrackRow } from '../../components/TrackRow';
import { getArtist } from '../../data/catalog';
import { formatCount } from '../../data/format';
import { artistPlays, bestSellingAlbums, risingArtists, topArtists, topTracks, totalPlays, weeklyTrends } from '../../data/stats';
import type { Artist } from '../../data/types';
import { useLibrary } from '../../state/LibraryContext';
import { colors, font, spacing } from '../../theme';

const VIEWS = ['Top 10 titres', 'Top 10 artistes', 'En progression', 'Albums vendus', 'Semaine'] as const;

export default function Classements() {
  const [view, setView] = useState<(typeof VIEWS)[number]>('Top 10 titres');
  const { playCounts } = useLibrary();

  const tops = topTracks(playCounts, 10);
  const trends = weeklyTrends(playCounts, 10);

  return (
    <TabScreen title="Classements" subtitle="Calculés à partir des écoutes et des ventes">
      <Segmented options={VIEWS} value={view} onChange={setView} />
      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.sm }}>
        {view === 'Top 10 titres' &&
          tops.map((t, i) => <TrackRow key={t.id} track={t} queue={tops} index={i} rank={i + 1} plays={totalPlays(t, playCounts)} />)}

        {view === 'Semaine' &&
          trends.map((t, i) => <TrackRow key={t.id} track={t} queue={trends} index={i} rank={i + 1} plays={totalPlays(t, playCounts)} />)}

        {view === 'Top 10 artistes' &&
          topArtists(playCounts, 10).map((a, i) => (
            <ArtistRow key={a.id} artist={a} rank={i + 1} detail={`${formatCount(artistPlays(a.id, playCounts))} écoutes`} />
          ))}

        {view === 'En progression' &&
          risingArtists(playCounts, 10).map((a, i) => (
            <ArtistRow key={a.id} artist={a} rank={i + 1} detail="Sorties récentes très écoutées" />
          ))}

        {view === 'Albums vendus' &&
          bestSellingAlbums(10).map((al, i) => (
            <Pressable key={al.id} style={styles.row} onPress={() => router.push({ pathname: '/album/[id]', params: { id: al.id } })}>
              <Text style={[styles.rank, i < 3 && { color: colors.gold }]}>{i + 1}</Text>
              <Cover palette={al.palette} label={al.title} size={48} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{al.title}</Text>
                <Text style={font.small}>{getArtist(al.artistId)?.name} • {formatCount(al.salesCount)} ventes</Text>
              </View>
            </Pressable>
          ))}
      </View>
      <Text style={[font.tiny, { textAlign: 'center', marginTop: spacing.xl, paddingHorizontal: spacing.xl }]}>
        Version de démonstration : chiffres du catalogue de test + vos écoutes sur cet appareil. Les statistiques globales viendront du serveur.
      </Text>
    </TabScreen>
  );
}

function ArtistRow({ artist, rank, detail }: { artist: Artist; rank: number; detail: string }) {
  return (
    <Pressable style={styles.row} onPress={() => router.push({ pathname: '/artiste/[id]', params: { id: artist.id } })}>
      <Text style={[styles.rank, rank <= 3 && { color: colors.gold }]}>{rank}</Text>
      <Cover palette={artist.palette} label={artist.name} size={48} round />
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{artist.name}</Text>
        <Text style={font.small}>{artist.genre} • {detail}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  rank: { width: 22, textAlign: 'center', color: colors.textMuted, fontWeight: '800', fontSize: 16 },
  name: { color: colors.white, fontWeight: '700', fontSize: 15 },
});
