/**
 * admin module — public surface. Navigation imports ONLY this object.
 * Keys are route names (see src/navigation/routes.ts). Do not rename keys.
 */
import { AdminDashboardScreen } from "./screens/AdminDashboardScreen";
import { AdminOrgsScreen } from "./screens/AdminOrgsScreen";
import { AdminOrgDetailScreen } from "./screens/AdminOrgDetailScreen";
import { AdminPlansScreen } from "./screens/AdminPlansScreen";
import { AdminAuditScreen } from "./screens/AdminAuditScreen";
import { AdminBackupsScreen } from "./screens/AdminBackupsScreen";

export const adminScreens = {
  AdminDashboard: AdminDashboardScreen,
  AdminOrgs: AdminOrgsScreen,
  AdminOrgDetail: AdminOrgDetailScreen,
  AdminPlans: AdminPlansScreen,
  AdminAudit: AdminAuditScreen,
  AdminBackups: AdminBackupsScreen,
};
