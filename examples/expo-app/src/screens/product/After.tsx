import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SIZES, colors, findProduct, formatPrice } from '@/demo/data';

/** Product detail, AFTER. Compare with ./Before.tsx. */
export default function ProductAfter() {
  const router = useRouter();
  const product = findProduct(useLocalSearchParams<{ id: string }>().id);
  const [size, setSize] = useState<(typeof SIZES)[number]>('Medium');
  const [quantity, setQuantity] = useState(1);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Image source={product.image} accessible accessibilityRole="image" accessibilityLabel={product.imageAlt} style={styles.hero} />

      <Text accessibilityRole="header" style={styles.title}>
        {product.name}
      </Text>

      <Text style={styles.price}>{formatPrice(product.price)}</Text>
      <Text style={styles.description}>{product.description}</Text>

      <Text style={styles.label}>Size</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel="Size" style={styles.sizes}>
        {SIZES.map((s) => (
          <Pressable
            key={s}
            accessibilityRole="radio"
            accessibilityState={{ checked: s === size }}
            onPress={() => setSize(s)}
            style={[styles.size, s === size && styles.sizeSelected]}>
            <Text style={[styles.sizeText, s === size && styles.sizeTextSelected]}>{s}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.stepper}>
        <Pressable accessibilityRole="button" accessibilityLabel="Decrease quantity" onPress={() => setQuantity((q) => Math.max(1, q - 1))} style={styles.step}>
          <Text style={styles.stepText}>−</Text>
        </Pressable>
        <Text style={styles.quantity} accessibilityLabel={`Quantity ${quantity}`}>
          {quantity}
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Increase quantity" onPress={() => setQuantity((q) => q + 1)} style={styles.step}>
          <Text style={styles.stepText}>+</Text>
        </Pressable>
      </View>

      {/* No explicit label: the visible text is the name, so voice-control users can say what they see. */}
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.cta}>
        <Text style={styles.ctaText}>Add to order · {formatPrice(product.price * quantity)}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  hero: { width: '100%', height: 220, borderRadius: 16 },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  price: { color: colors.text, fontSize: 20, fontWeight: '600' },
  description: { color: colors.secondaryText, fontSize: 15 },
  label: { color: colors.text, fontSize: 15, fontWeight: '600', marginTop: 8 },
  sizes: { flexDirection: 'row', gap: 8 },
  size: { flex: 1, height: 44, borderRadius: 10, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  sizeSelected: { backgroundColor: colors.text },
  sizeText: { color: colors.text, fontSize: 15 },
  sizeTextSelected: { color: '#ffffff', fontWeight: '600' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  step: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  stepText: { color: colors.text, fontSize: 20 },
  quantity: { color: colors.text, fontSize: 17, minWidth: 24, textAlign: 'center' },
  cta: { height: 52, borderRadius: 26, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  ctaText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
});
