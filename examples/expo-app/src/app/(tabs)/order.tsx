import { DemoScreen } from '@/demo/FixedMode';
import OrderAfter from '@/screens/order/After';
import OrderBefore from '@/screens/order/Before';

export default function OrderRoute() {
  return <DemoScreen before={OrderBefore} after={OrderAfter} />;
}
