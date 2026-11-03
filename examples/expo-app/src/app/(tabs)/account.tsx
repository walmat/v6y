import { DemoScreen } from '@/demo/FixedMode';
import AccountAfter from '@/screens/account/After';
import AccountBefore from '@/screens/account/Before';

export default function AccountRoute() {
  return <DemoScreen before={AccountBefore} after={AccountAfter} safeTop />;
}
