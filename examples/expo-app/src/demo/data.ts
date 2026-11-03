import type { ImageSourcePropType } from 'react-native';

export interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  image: ImageSourcePropType;
  /** Description for screen readers (used by the fixed screens). */
  imageAlt: string;
}

export const PRODUCTS: Product[] = [
  {
    id: 'flat-white',
    name: 'Flat white',
    price: 4.5,
    description: 'Double ristretto with silky steamed milk.',
    image: require('../../assets/products/flat-white.png'),
    imageAlt: 'A flat white in a white ceramic cup',
  },
  {
    id: 'cold-brew',
    name: 'Cold brew',
    price: 5,
    description: 'Steeped for 18 hours, served over ice.',
    image: require('../../assets/products/cold-brew.png'),
    imageAlt: 'Cold brew over ice in a tall glass',
  },
  {
    id: 'matcha',
    name: 'Matcha latte',
    price: 5.5,
    description: 'Ceremonial-grade matcha whisked with oat milk.',
    image: require('../../assets/products/matcha.png'),
    imageAlt: 'A bright green matcha latte',
  },
];

export const SIZES = ['Small', 'Medium', 'Large'] as const;

export function findProduct(id: string | string[] | undefined): Product {
  return PRODUCTS.find((p) => p.id === id) ?? PRODUCTS[0]!;
}

export const formatPrice = (n: number) => `$${n.toFixed(2)}`;

/** Shared palette. Every "after" color passes WCAG AA on white. */
export const colors = {
  background: '#ffffff',
  surface: '#f2f2f7',
  text: '#1c1c1e',
  secondaryText: '#3a3a3c',
  mutedText: '#595959', // 7.0:1 on white
  brand: '#0060df', // 5.6:1 with white text
  danger: '#c62828', // 5.6:1 on white
  border: '#d1d1d6',
};
