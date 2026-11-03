import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, formatPrice, type Product } from '@/demo/data';

interface Props {
  product: Product;
  onOpen: () => void;
  onAdd: () => void;
}

/**
 * AFTER:
 *   ✓ the favorite button is a sibling of the card's pressable, so both are reachable
 *   ✓ labels name the item ("Add Flat white to order"), so they're unique on screen
 *   ✓ favorite is a toggle button that announces whether it's on
 */
export function ProductCard({ product, onOpen, onAdd }: Props) {
  const [favorite, setFavorite] = useState(false);
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${product.name}, ${formatPrice(product.price)}`}
        accessibilityHint="Opens details"
        onPress={onOpen}
        style={styles.main}>
        <Image source={product.image} style={styles.thumb} />
        <View style={styles.text}>
          <Text style={styles.name}>{product.name}</Text>
          <Text style={styles.price}>{formatPrice(product.price)}</Text>
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="togglebutton"
        accessibilityLabel={`Favorite ${product.name}`}
        accessibilityState={{ checked: favorite }}
        hitSlop={10}
        onPress={() => setFavorite((f) => !f)}
        style={styles.heart}>
        <Ionicons name={favorite ? 'heart' : 'heart-outline'} size={20} color={colors.text} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Add ${product.name} to order`} onPress={onAdd} style={styles.add}>
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
