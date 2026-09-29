/**
 * payments module — public surface. Navigation imports ONLY this object.
 * Keys are route names (see src/navigation/routes.ts). Do not rename keys.
 */
import { PaymentsListScreen } from "./screens/PaymentsListScreen";
import { PaymentNewScreen } from "./screens/PaymentNewScreen";
import { PaymentDetailScreen } from "./screens/PaymentDetailScreen";

export const paymentsScreens = {
  Payments: PaymentsListScreen,
  PaymentNew: PaymentNewScreen,
  PaymentDetail: PaymentDetailScreen,
};
