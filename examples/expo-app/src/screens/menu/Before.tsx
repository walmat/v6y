import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { IconButton } from '@/components/before/IconButton';
import { ProductCard } from '@/components/before/ProductCard';
import { PRODUCTS, colors } from '@/demo/data';
import { LegacyPromoBanner } from '@/legacy/LegacyPromoBanner';

/** Menu, BEFORE. Issues are annotated where they happen. */
export default function MenuBefore() {
  const router = useRouter();
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.toolbar}>
        <Text style={styles.greeting}>Good morning, Sam</Text>
        {/* ✖ ×2: missing-label, missing-role, touch-target-size; reported in IconButton.tsx, "used at" these lines */}
        <IconButton icon="search" onPress={() => {}} />
        <IconButton icon="bag-outline" onPress={() => router.push('/order')} />
      </View>

      {/* Suppressed by `ignore: ['src/legacy/**']` in v6y.config.ts */}
      <LegacyPromoBanner />

      {/* ✖ text-contrast: #9a9a9a on white is 2.8:1 (needs 4.5:1) */}
      <Text style={styles.note}>Free delivery on orders over $20</Text>

      {PRODUCTS.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          onOpen={() => router.push(`/product/${product.id}`)}
          onAdd={() => {}}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  greeting: { flex: 1, color: colors.text, fontSize: 20, fontWeight: '700' },
  note: { color: '#9a9a9a', fontSize: 13 },
});
