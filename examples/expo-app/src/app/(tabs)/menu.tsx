import { DemoScreen } from '@/demo/FixedMode';
import MenuAfter from '@/screens/menu/After';
import MenuBefore from '@/screens/menu/Before';

export default function MenuRoute() {
  return <DemoScreen before={MenuBefore} after={MenuAfter} />;
}
