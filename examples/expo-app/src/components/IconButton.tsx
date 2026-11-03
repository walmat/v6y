import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';

import { colors } from '@/demo/data';

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  /** Required: TypeScript now refuses an icon button without a label. */
  label: string;
  onPress: () => void;
}

/**
 * AFTER: fixed once in the shared component, fixed everywhere.
 *
 *   ✓ label is a required prop → accessibilityLabel
 *   ✓ accessibilityRole="button"
 *   ✓ hitSlop grows the 32×32 visual to a 48×48 touch target (Apple asks for 44pt,
 *     Android's Material for 48dp) without changing layout
 */
export function IconButton({ icon, label, onPress }: Props) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={8} style={styles.button}>
      <Ionicons name={icon} size={20} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
