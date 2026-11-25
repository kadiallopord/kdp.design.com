export const colors = {
  background: '#0A0A0A',
  surface: '#151515',
  surfaceRaised: '#1F1F1F',
  border: '#2A2A2A',
  gold: '#D4AF37',
  goldLight: '#F1D27A',
  goldDark: '#9C7A1C',
  white: '#FFFFFF',
  text: '#F5F5F5',
  textMuted: '#A3A3A3',
  textFaint: '#6B6B6B',
  danger: '#E5484D',
  live: '#E5484D',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 6, md: 10, lg: 16, pill: 999 };

export const font = {
  title: { fontSize: 26, fontWeight: '800' as const, color: colors.white },
  h2: { fontSize: 19, fontWeight: '700' as const, color: colors.white },
  body: { fontSize: 15, color: colors.text },
  small: { fontSize: 13, color: colors.textMuted },
  tiny: { fontSize: 11, color: colors.textFaint },
};

export const SLOGAN = 'Écoutez • Regardez • Découvrez';
