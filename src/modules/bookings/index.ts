/**
 * bookings module — public surface. Navigation imports ONLY this object.
 * Keys are route names (see src/navigation/routes.ts). Do not rename keys.
 */
import { BookingsScreen } from "./screens/BookingsScreen";
import { BookingNewScreen } from "./screens/BookingNewScreen";
import { BookingDetailScreen } from "./screens/BookingDetailScreen";
import { BookingEditScreen } from "./screens/BookingEditScreen";
import { DailySummaryScreen } from "./screens/DailySummaryScreen";
import { LoadingListScreen } from "./screens/LoadingListScreen";

export const bookingsScreens = {
  Bookings: BookingsScreen,
  BookingNew: BookingNewScreen,
  BookingDetail: BookingDetailScreen,
  BookingEdit: BookingEditScreen,
  DailySummary: DailySummaryScreen,
  LoadingList: LoadingListScreen,
};
