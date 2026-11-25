import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { colors } from '../theme';

type Props = {
  palette: [string, string];
  label?: string;
  size?: number;
  round?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: ViewStyle;
  width?: number;
  height?: number;
};

/** Pochette générée (dégradé + initiales). À remplacer par les vraies images une fois le stockage média en place. */
export function Cover({ palette, label, size = 56, round, icon, style, width, height }: Props) {
  const w = width ?? size;
  const h = height ?? size;
  const initials = (label ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
  return (
    <LinearGradient
      colors={palette}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[{ width: w, height: h, borderRadius: round ? w / 2 : Math.min(w, h) * 0.1 }, styles.base, style]}
    >
      {icon ? (
        <Ionicons name={icon} size={Math.min(w, h) * 0.38} color={colors.white} />
      ) : (
        <Text style={[styles.initials, { fontSize: Math.min(w, h) * 0.32 }]}>{initials}</Text>
      )}
      <View style={[StyleSheet.absoluteFill, styles.sheen, { borderRadius: round ? w / 2 : Math.min(w, h) * 0.1 }]} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  initials: { color: 'rgba(255,255,255,0.92)', fontWeight: '800', letterSpacing: 1 },
  sheen: { borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(212,175,55,0.35)' },
});
