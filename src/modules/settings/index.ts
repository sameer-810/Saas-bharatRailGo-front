/**
 * settings module — public surface. Navigation imports ONLY this object.
 * Keys are route names (see src/navigation/routes.ts). Do not rename keys.
 */
import { SettingsScreen } from "./screens/SettingsScreen";
import { SettingsBusinessScreen } from "./screens/SettingsBusinessScreen";
import { SettingsBrandingScreen } from "./screens/SettingsBrandingScreen";
import { TeamScreen } from "./screens/TeamScreen";
import { BranchesScreen } from "./screens/BranchesScreen";
import { StationsScreen } from "./screens/StationsScreen";
import { RatesScreen } from "./screens/RatesScreen";
import { PlanScreen } from "./screens/PlanScreen";
import { ActivityScreen } from "./screens/ActivityScreen";
import { PrivacyScreen } from "./screens/PrivacyScreen";

export const settingsScreens = {
  Settings: SettingsScreen,
  SettingsBusiness: SettingsBusinessScreen,
  SettingsBranding: SettingsBrandingScreen,
  Team: TeamScreen,
  Branches: BranchesScreen,
  Stations: StationsScreen,
  Rates: RatesScreen,
  Plan: PlanScreen,
  Activity: ActivityScreen,
  Privacy: PrivacyScreen,
};
