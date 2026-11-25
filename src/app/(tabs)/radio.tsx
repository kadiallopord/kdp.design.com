import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Cover } from '../../components/Cover';
import { TabScreen } from '../../components/Screen';
import { radios } from '../../data/catalog';
import type { RadioStation } from '../../data/types';
import { usePlayer } from '../../state/PlayerContext';
import { colors, radius, spacing } from '../../theme';

/** Émission en cours d'après l'heure locale et la grille de la station. */
const currentShow = (s: RadioStation) => {
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const slots = s.schedule.map((x) => {
    const [h, m] = x.time.split(':').map(Number);
    return { ...x, at: h * 60 + m };
  });
  const past = slots.filter((x) => x.at <= minutes);
  return (past[past.length - 1] ?? slots[slots.length - 1]).show;
};

export default function Radio() {
  const { current, playing, playRadio, togglePlay } = usePlayer();

  return (
    <TabScreen title="Sammeere Jime Radio" subtitle="Six stations en direct, 24 h/24">
      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg, gap: spacing.md }}>
        {radios.map((s) => {
          const active = current?.kind === 'radio' && current.station.id === s.id;
          return (
            <View key={s.id} style={[styles.card, active && { borderColor: colors.gold }]}>
              <Pressable
                style={styles.row}
                onPress={() => (active ? togglePlay() : playRadio(s))}
                accessibilityLabel={`${active && playing ? 'Mettre en pause' : 'Écouter'} ${s.name}`}
              >
                <Cover palette={s.palette} icon="radio" size={60} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{s.name}</Text>
                  <Text style={styles.tagline}>{s.tagline}</Text>
                  <View style={styles.liveRow}>
                    <View style={styles.liveDot} />
                    <Text style={styles.live}>EN DIRECT</Text>
                    <Text numberOfLines={1} style={styles.show}> • {currentShow(s)}</Text>
                  </View>
                </View>
                <Ionicons name={active && playing ? 'pause-circle' : 'play-circle'} size={44} color={colors.gold} />
              </Pressable>
              {active ? (
                <View style={styles.schedule}>
                  <Text style={styles.scheduleTitle}>Programmation du jour</Text>
                  {s.schedule.map((x) => (
                    <View key={x.time} style={styles.slot}>
                      <Text style={styles.slotTime}>{x.time}</Text>
                      <Text style={styles.slotShow}>{x.show}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  name: { color: colors.white, fontWeight: '800', fontSize: 16 },
  tagline: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  liveRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.live, marginRight: 5 },
  live: { color: colors.live, fontSize: 11, fontWeight: '800' },
  show: { color: colors.textMuted, fontSize: 12, flex: 1 },
  schedule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, padding: spacing.md },
  scheduleTitle: { color: colors.gold, fontWeight: '700', fontSize: 13, marginBottom: spacing.sm },
  slot: { flexDirection: 'row', paddingVertical: 4 },
  slotTime: { color: colors.goldLight, width: 56, fontWeight: '700', fontSize: 13 },
  slotShow: { color: colors.text, fontSize: 13 },
});
