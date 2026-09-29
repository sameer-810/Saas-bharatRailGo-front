/**
 * dashboard module — public surface. Navigation imports ONLY this object.
 * Keys are route names (see src/navigation/routes.ts). Do not rename keys.
 */
import { HomeScreen } from "./screens/HomeScreen";

export const dashboardScreens = {
  Home: HomeScreen,
};
