import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlbumCard, ArtistCard, GoldButton, VideoCard } from '../../components/Cards';
import { Section } from '../../components/Section';
import { TrackRow } from '../../components/TrackRow';
import { albums, artists, getArtist, tracksOfAlbum, videos } from '../../data/catalog';
import { formatDate } from '../../data/format';
import { newReleases, recommendTracks, topArtists, weeklyTrends } from '../../data/stats';
import { useLibrary } from '../../state/LibraryContext';
import { usePlayer } from '../../state/PlayerContext';
import { SLOGAN, colors, font, spacing } from '../../theme';

export default function Accueil() {
  const insets = useSafeAreaInsets();
  const lib = useLibrary();
  const { playTracks } = usePlayer();

  const fresh = newReleases(5);
  const popularAlbums = [...albums].filter((a) => !a.preorder).sort((a, b) => b.salesCount - a.salesCount);
  const recommendedArtists = topArtists(lib.playCounts, 6);
  const recentVideos = [...videos].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, 5);
  const trends = weeklyTrends(lib.playCounts, 5);
  const exclusives = albums.filter((a) => a.exclusive);
  const forYou = recommendTracks({ counts: lib.playCounts, favorites: lib.favorites, followed: lib.followedArtists }, 5);
  const featured = albums.find((a) => a.preorder) ?? albums[0];
  const featuredArtist = getArtist(featured.artistId);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
      <LinearGradient colors={['#2A2005', colors.background]} style={{ paddingTop: insets.top + spacing.md, paddingBottom: spacing.lg }}>
        <View style={styles.brandRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.brand}>SAMMEERE <Text style={{ color: colors.gold }}>JIME</Text></Text>
            <Text style={styles.slogan}>{SLOGAN}</Text>
          </View>
          <Pressable hitSlop={10} onPress={() => router.push('/profil')} accessibilityLabel="Profil">
            <Ionicons name="person-circle-outline" size={32} color={colors.gold} />
          </Pressable>
        </View>

        <Pressable style={styles.search} onPress={() => router.push('/recherche')} accessibilityRole="search">
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <Text style={styles.searchText}>Titres, artistes, albums, vidéos…</Text>
        </Pressable>

        <Pressable style={styles.hero} onPress={() => router.push({ pathname: '/album/[id]', params: { id: featured.id } })}>
          <LinearGradient colors={featured.palette} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroInner}>
            <Text style={styles.heroKicker}>{featured.preorder ? 'SORTIE EXCLUSIVE • PRÉCOMMANDE' : 'À LA UNE'}</Text>
            <Text style={styles.heroTitle}>{featured.title}</Text>
            <Text style={styles.heroSub}>{featuredArtist?.name} • sortie le {formatDate(featured.releaseDate)}</Text>
            <View style={{ flexDirection: 'row', marginTop: spacing.md }}>
              <GoldButton
                label="Écouter l'extrait"
                icon="play"
                onPress={() => playTracks(tracksOfAlbum(featured.id))}
              />
            </View>
          </LinearGradient>
        </Pressable>
      </LinearGradient>

      <Section title="Recommandé pour vous" subtitle={lib.history.length ? 'D’après vos écoutes et vos favoris' : 'Écoutez quelques titres pour personnaliser'}>
        {forYou.map((t, i) => <TrackRow key={t.id} track={t} queue={forYou} index={i} />)}
      </Section>

      <Section title="Nouveautés">
        {fresh.map((t, i) => <TrackRow key={t.id} track={t} queue={fresh} index={i} />)}
      </Section>

      <Section title="Albums populaires" horizontal onSeeAll={() => router.push('/musique')}>
        {popularAlbums.map((a) => <AlbumCard key={a.id} album={a} />)}
      </Section>

      <Section title="Artistes recommandés" horizontal>
        {recommendedArtists.map((a) => <ArtistCard key={a.id} artist={a} />)}
      </Section>

      <Section title="Clips récents" horizontal onSeeAll={() => router.push('/videos')}>
        {recentVideos.map((v) => <VideoCard key={v.id} video={v} />)}
      </Section>

      <Section title="Tendances" subtitle="Les titres qui montent cette semaine" onSeeAll={() => router.push('/classements')}>
        {trends.map((t, i) => <TrackRow key={t.id} track={t} queue={trends} index={i} rank={i + 1} />)}
      </Section>

      <Section title="Sorties exclusives" horizontal>
        {exclusives.map((a) => <AlbumCard key={a.id} album={a} />)}
      </Section>

      <Text style={styles.footer}>{artists.length} artistes • catalogue de démonstration</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  brandRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg },
  brand: { color: colors.white, fontSize: 24, fontWeight: '900', letterSpacing: 2 },
  slogan: { color: colors.goldLight, fontSize: 12, marginTop: 2, letterSpacing: 1 },
  search: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginHorizontal: spacing.lg, marginTop: spacing.lg, backgroundColor: colors.surfaceRaised, borderRadius: 12, paddingHorizontal: spacing.md, paddingVertical: 12, borderWidth: 1, borderColor: colors.border },
  searchText: { color: colors.textMuted, fontSize: 14 },
  hero: { marginHorizontal: spacing.lg, marginTop: spacing.lg, borderRadius: 18, overflow: 'hidden' },
  heroInner: { padding: spacing.xl, minHeight: 170, justifyContent: 'flex-end' },
  heroKicker: { color: colors.goldLight, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  heroTitle: { color: colors.white, fontSize: 30, fontWeight: '900', marginTop: 4 },
  heroSub: { ...font.small, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  footer: { ...font.tiny, textAlign: 'center', marginTop: spacing.xxl },
});
