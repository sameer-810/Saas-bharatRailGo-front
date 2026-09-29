/**
 * reports module — public surface. Navigation imports ONLY this object.
 * Keys are route names (see src/navigation/routes.ts). Do not rename keys.
 */
import { ReportsHubScreen } from "./screens/ReportsHubScreen";
import { DailyReportScreen } from "./screens/DailyReportScreen";
import { OutstandingReportScreen } from "./screens/OutstandingReportScreen";
import { StationReportScreen } from "./screens/StationReportScreen";
import { GstReportScreen } from "./screens/GstReportScreen";

export const reportsScreens = {
  Reports: ReportsHubScreen,
  ReportDaily: DailyReportScreen,
  ReportOutstanding: OutstandingReportScreen,
  ReportStation: StationReportScreen,
  ReportGst: GstReportScreen,
};
