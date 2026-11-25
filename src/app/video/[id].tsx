import { Stack, useLocalSearchParams, router } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { VideoCard } from '../../components/Cards';
import { Section } from '../../components/Section';
import { getArtist, getVideo, videos } from '../../data/catalog';
import { formatCount, formatDate } from '../../data/format';
import { usePlayer } from '../../state/PlayerContext';
import { colors, font, spacing } from '../../theme';

export default function VideoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const video = getVideo(id);
  const { width } = useWindowDimensions();
  const audio = usePlayer();
  const player = useVideoPlayer(video?.videoUrl ?? null, (p) => {
    p.play();
  });

  // Mettre la musique en pause quand une vidéo démarre.
  useEffect(() => {
    if (audio.playing) audio.togglePlay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!video) return <Text style={{ color: colors.text, padding: spacing.lg }}>Vidéo introuvable.</Text>;
  const artist = video.artistId ? getArtist(video.artistId) : undefined;
  const more = videos.filter((v) => v.id !== video.id).slice(0, 4);
  const w = Math.min(width, 900);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
      <Stack.Screen options={{ title: video.category }} />
      <VideoView player={player} style={{ width: w, height: (w * 9) / 16, backgroundColor: '#000' }} nativeControls contentFit="contain" allowsPictureInPicture />
      <View style={{ padding: spacing.lg }}>
        <Text style={font.h2}>{video.title}</Text>
        <Text style={[font.small, { marginTop: 4 }]}>
          {formatCount(video.views)} vues • {formatDate(video.publishedAt)}
        </Text>
        {artist ? (
          <Pressable onPress={() => router.push({ pathname: '/artiste/[id]', params: { id: artist.id } })}>
            <Text style={{ color: colors.gold, fontWeight: '700', marginTop: spacing.md }}>{artist.name} ›</Text>
          </Pressable>
        ) : null}
      </View>
      <Section title="À voir aussi" horizontal>
        {more.map((v) => <VideoCard key={v.id} video={v} width={220} />)}
      </Section>
    </ScrollView>
  );
}
