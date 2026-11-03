import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';

import { colors } from '@/demo/data';

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}

/**
 * BEFORE: the icon button most codebases start with. One component, three bugs,
 * reported once per use with "used at" pointing to each call site:
 *
 *   ✖ missing-label      the only content is an icon-font glyph, which screen readers can't speak
 *   ✖ missing-role       not announced as a button
 *   ⚠ touch-target-size  32×32, below Apple's 44pt / Material's 48dp
 *
 * Fixed in ../IconButton.tsx.
 */
export function IconButton({ icon, onPress }: Props) {
  return (
    <Pressable onPress={onPress} style={styles.button}>
      <Ionicons name={icon} size={20} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
