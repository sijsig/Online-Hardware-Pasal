import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '@/src/theme';

export function Screen({ children, scroll = true, style, refreshControl }: { children: ReactNode; scroll?: boolean; style?: ViewStyle; refreshControl?: React.ReactElement<import('react-native').RefreshControlProps> }) {
  return <SafeAreaView style={styles.safe} edges={['top']}>
    {scroll ? <ScrollView contentContainerStyle={[styles.content, style]} keyboardShouldPersistTaps="handled" refreshControl={refreshControl}>{children}</ScrollView> : <View style={[styles.content, style]}>{children}</View>}
  </SafeAreaView>;
}

export function PageHeader({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  return <View style={styles.pageHeader}>{eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}<Text style={styles.pageTitle}>{title}</Text>{subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}</View>;
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return <View style={styles.sectionTitle}><Text style={styles.sectionHeading}>{title}</Text>{action}</View>;
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function AppButton({ title, onPress, variant = 'primary', disabled, loading }: { title: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'quiet' | 'danger'; disabled?: boolean; loading?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled || loading} onPress={onPress} style={({ pressed }) => [styles.button, styles[`button_${variant}`], (pressed || disabled || loading) && styles.buttonDim]}>
    {loading ? <ActivityIndicator color={variant === 'primary' ? colors.white : colors.green} /> : <Text style={[styles.buttonText, styles[`buttonText_${variant}`]]}>{title}</Text>}
  </Pressable>;
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput placeholderTextColor={colors.muted} {...props} style={[styles.input, props.multiline && styles.multiline, props.style]} /></View>;
}

export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'error' | 'success' }) {
  return <View style={[styles.notice, tone === 'error' ? styles.noticeError : tone === 'success' ? styles.noticeSuccess : null]}><Text style={styles.noticeText}>{children}</Text></View>;
}

export function EmptyState({ title, detail, action }: { title: string; detail: string; action?: ReactNode }) {
  return <Card style={styles.empty}><Text style={styles.emptyIcon}>⌕</Text><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.subtitle}>{detail}</Text>{action}</Card>;
}

export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  pageHeader: { gap: spacing.xs, paddingVertical: spacing.xs },
  eyebrow: { color: colors.green, fontSize: 11, fontWeight: '800', letterSpacing: 1.3, textTransform: 'uppercase' },
  pageTitle: { color: colors.ink, fontSize: 30, lineHeight: 35, fontWeight: '800', letterSpacing: -0.7 },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginTop: spacing.xs },
  sectionHeading: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  card: { padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, gap: spacing.sm },
  button: { minHeight: 46, borderRadius: radius.sm, paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center' },
  button_primary: { backgroundColor: colors.green },
  button_secondary: { backgroundColor: colors.greenSoft },
  button_quiet: { backgroundColor: colors.white, borderColor: colors.line, borderWidth: 1 },
  button_danger: { backgroundColor: colors.redSoft },
  buttonDim: { opacity: 0.62 },
  buttonText: { fontSize: 14, fontWeight: '800' },
  buttonText_primary: { color: colors.white },
  buttonText_secondary: { color: colors.green },
  buttonText_quiet: { color: colors.ink },
  buttonText_danger: { color: colors.red },
  field: { gap: 6 },
  fieldLabel: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  input: { minHeight: 46, paddingHorizontal: 12, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, color: colors.ink, fontSize: 14 },
  multiline: { minHeight: 88, paddingVertical: 10, textAlignVertical: 'top' },
  notice: { padding: 12, borderRadius: radius.sm, backgroundColor: colors.amberSoft },
  noticeError: { backgroundColor: colors.redSoft },
  noticeSuccess: { backgroundColor: colors.greenSoft },
  noticeText: { color: colors.ink, fontSize: 12, lineHeight: 17 },
  empty: { alignItems: 'center', paddingVertical: 28, textAlign: 'center' },
  emptyIcon: { color: colors.green, fontSize: 30, fontWeight: '800' },
  emptyTitle: { color: colors.ink, fontSize: 16, fontWeight: '800', textAlign: 'center' },
});
