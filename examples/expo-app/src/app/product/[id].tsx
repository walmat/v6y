import { DemoScreen } from '@/demo/FixedMode';
import ProductAfter from '@/screens/product/After';
import ProductBefore from '@/screens/product/Before';

export default function ProductRoute() {
  return <DemoScreen before={ProductBefore} after={ProductAfter} />;
}
