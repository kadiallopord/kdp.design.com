import { useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { VideoCard } from '../../components/Cards';
import { TabScreen } from '../../components/Screen';
import { Segmented } from '../../components/Segmented';
import { videos } from '../../data/catalog';
import { spacing } from '../../theme';

const FILTERS = ['Tout', 'Clips', 'Exclusivités', 'Interviews', 'Événements'] as const;
const MAP: Record<(typeof FILTERS)[number], string | null> = {
  Tout: null,
  Clips: 'Clip',
  Exclusivités: 'Exclusivité',
  Interviews: 'Interview',
  Événements: 'Événement',
};

export default function Videos() {
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width, 640) - spacing.lg * 2;
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('Tout');
  const list = [...videos]
    .filter((v) => !MAP[filter] || v.category === MAP[filter])
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

  return (
    <TabScreen title="Vidéos et clips" subtitle="Clips, exclusivités, interviews et événements">
      <Segmented options={FILTERS} value={filter} onChange={setFilter} />
      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.xl, marginTop: spacing.md }}>
        {list.map((v) => <VideoCard key={v.id} video={v} width={cardWidth} />)}
      </View>
    </TabScreen>
  );
}
