import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AlbumCard, ArtistCard, EmptyState, VideoCard } from '../components/Cards';
import { Section } from '../components/Section';
import { TrackRow } from '../components/TrackRow';
import { albums, artists, getArtist, tracks, videos } from '../data/catalog';
import { normalize } from '../data/format';
import { colors, radius, spacing } from '../theme';

/** Recherche « intelligente » : insensible aux accents et à la casse, cherche dans titre, artiste, album et genre. */
export default function Recherche() {
  const [q, setQ] = useState('');
  const n = normalize(q.trim());

  const results = useMemo(() => {
    if (!n) return null;
    const has = (...fields: (string | undefined)[]) => fields.some((f) => f && normalize(f).includes(n));
    return {
      tracks: tracks.filter((t) => has(t.title, getArtist(t.artistId)?.name, albums.find((a) => a.id === t.albumId)?.title)),
      artists: artists.filter((a) => has(a.name, a.genre)),
      albums: albums.filter((a) => has(a.title, getArtist(a.artistId)?.name)),
      videos: videos.filter((v) => has(v.title, v.category, v.artistId ? getArtist(v.artistId)?.name : undefined)),
    };
  }, [n]);

  const empty = results && !results.tracks.length && !results.artists.length && !results.albums.length && !results.videos.length;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: spacing.xxl }}>
      <View style={{ padding: spacing.lg }}>
        <TextInput
          autoFocus
          value={q}
          onChangeText={setQ}
          placeholder="Titres, artistes, albums, vidéos…"
          placeholderTextColor={colors.textFaint}
          style={styles.input}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>
      {!results ? (
        <Section title="Genres">
          <Text style={styles.genres}>Rap Pulaar • Pulaar traditionnel • Afrobeat • Mbalax • Afro-pop</Text>
        </Section>
      ) : empty ? (
        <EmptyState icon="search" title="Aucun résultat" text={`Rien ne correspond à « ${q} ».`} />
      ) : (
        <>
          {results.tracks.length ? (
            <Section title="Titres">
              {results.tracks.map((t, i) => <TrackRow key={t.id} track={t} queue={results.tracks} index={i} />)}
            </Section>
          ) : null}
          {results.artists.length ? (
            <Section title="Artistes" horizontal>
              {results.artists.map((a) => <ArtistCard key={a.id} artist={a} />)}
            </Section>
          ) : null}
          {results.albums.length ? (
            <Section title="Albums" horizontal>
              {results.albums.map((a) => <AlbumCard key={a.id} album={a} />)}
            </Section>
          ) : null}
          {results.videos.length ? (
            <Section title="Vidéos" horizontal>
              {results.videos.map((v) => <VideoCard key={v.id} video={v} />)}
            </Section>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  input: { backgroundColor: colors.surfaceRaised, color: colors.white, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: 15, borderWidth: 1, borderColor: colors.border },
  genres: { color: colors.textMuted, lineHeight: 22 },
});
