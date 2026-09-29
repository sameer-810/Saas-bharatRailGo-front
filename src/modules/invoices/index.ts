/**
 * invoices module — public surface. Navigation imports ONLY this object.
 * Keys are route names (see src/navigation/routes.ts). Do not rename keys.
 */
import { InvoicesListScreen } from "./screens/InvoicesListScreen";
import { InvoiceNewScreen } from "./screens/InvoiceNewScreen";
import { InvoiceDetailScreen } from "./screens/InvoiceDetailScreen";

export const invoicesScreens = {
  Invoices: InvoicesListScreen,
  InvoiceNew: InvoiceNewScreen,
  InvoiceDetail: InvoiceDetailScreen,
};
