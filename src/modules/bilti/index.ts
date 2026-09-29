/**
 * bilti module — public surface. Navigation imports ONLY this object.
 * Keys are route names (see src/navigation/routes.ts). Do not rename keys.
 */
import { BiltiListScreen } from "./screens/BiltiListScreen";
import { BiltiEditScreen, BiltiNewScreen } from "./screens/BiltiFormScreen";
import { BiltiDetailScreen } from "./screens/BiltiDetailScreen";

export const biltiScreens = {
  Bilti: BiltiListScreen,
  BiltiNew: BiltiNewScreen,
  BiltiDetail: BiltiDetailScreen,
  BiltiEdit: BiltiEditScreen,
};
