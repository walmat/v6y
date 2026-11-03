/**
 * How you'd use v6y in your own tests: `import 'v6y/jest'` once in a Jest setup
 * file (see package.json "setupFilesAfterEnv"), then assert on any screen.
 * Uses v6y.config.ts, so the same rules as the app and CI.
 */
import AccountAfter from '@/screens/account/After';
import AccountBefore from '@/screens/account/Before';
import ProductAfter from '@/screens/product/After';
import ProductBefore from '@/screens/product/Before';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ id: 'flat-white' }),
}));
// Ionicons loads a font file in Jest; render what it renders on device (an unspeakable glyph).
jest.mock('@expo/vector-icons', () => {
  const { createElement } = require('react');
  const { Text } = require('react-native');
  const Ionicons = () => createElement(Text, { allowFontScaling: false }, '');
  Ionicons.glyphMap = {};
  return { Ionicons };
});

test('the fixed product screen is accessible', async () => {
  await expect(<ProductAfter />).toBeAccessible();
});

test('the fixed account screen is accessible', async () => {
  await expect(<AccountAfter />).toBeAccessible();
});

test('the original screens are not', async () => {
  await expect(<ProductBefore />).not.toBeAccessible();
  await expect(<AccountBefore />).not.toBeAccessible();
});
