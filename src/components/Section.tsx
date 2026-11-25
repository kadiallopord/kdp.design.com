import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, font, spacing } from '../theme';

export function Section({
  title,
  subtitle,
  onSeeAll,
  horizontal,
  children,
}: {
  title: string;
  subtitle?: string;
  onSeeAll?: () => void;
  horizontal?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={font.h2}>{title}</Text>
          {subtitle ? <Text style={[font.small, { marginTop: 2 }]}>{subtitle}</Text> : null}
        </View>
        {onSeeAll ? (
          <Pressable onPress={onSeeAll} hitSlop={10}>
            <Text style={styles.seeAll}>Tout voir</Text>
          </Pressable>
        ) : null}
      </View>
      {horizontal ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {children}
        </ScrollView>
      ) : (
        <View style={{ paddingHorizontal: spacing.lg }}>{children}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.xl },
  header: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  seeAll: { color: colors.gold, fontWeight: '600', fontSize: 13 },
  row: { paddingHorizontal: spacing.lg, gap: spacing.md },
});
