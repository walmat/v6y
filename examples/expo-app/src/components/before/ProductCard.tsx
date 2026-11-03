import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, formatPrice, type Product } from '@/demo/data';

interface Props {
  product: Product;
  onOpen: () => void;
  onAdd: () => void;
}

/**
 * BEFORE: a typical list item. Rendered three times on the menu, so each bug
 * shows up three times. One component, one fix (see ../ProductCard.tsx).
 */
export function ProductCard({ product, onOpen, onAdd }: Props) {
  return (
    <View style={styles.card}>
      <Pressable accessibilityRole="button" onPress={onOpen} style={styles.main}>
        <Image source={product.image} style={styles.thumb} />
        <View style={styles.text}>
          <Text style={styles.name}>{product.name}</Text>
          <Text style={styles.price}>{formatPrice(product.price)}</Text>
        </View>
        {/* ✖ nested-interactive: a button inside the card's own pressable. VoiceOver merges the
              card into one element, so "Favorite" can never be reached.
            (Every card's button is also just "Favorite". Repeats from one list aren't flagged
             by default since the row gives context; `duplicate-label: { includeRepeated: true }` flags them.) */}
        <Pressable accessibilityRole="button" accessibilityLabel="Favorite" hitSlop={12} onPress={() => {}} style={styles.heart}>
          <Ionicons name="heart-outline" size={20} color={colors.text} />
        </Pressable>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={onAdd} style={styles.add}>
        <Text style={styles.addText}>Add</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 56, height: 56, borderRadius: 12 },
  text: { flex: 1 },
  name: { color: colors.text, fontSize: 17, fontWeight: '600' },
  price: { color: colors.secondaryText, fontSize: 15, marginTop: 2 },
  heart: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  add: { minWidth: 64, height: 44, borderRadius: 22, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center' },
  addText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
});
