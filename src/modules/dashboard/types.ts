/** Response shapes used by the dashboard (mirrors bharatrailgo-back dashboard.service.js). */

export interface DashboardMetrics {
  today: {
    consignmentCount: number;
    totalRevenue: number;
    totalPackages: number;
  };
  outstanding: { totalAmount: number; consignmentCount: number };
  pendingPods: number;
  activeInvoices: number;
  recentConsignments: RecentConsignment[];
  monthlyTrend: {
    month: string;
    label: string;
    revenue: number;
    consignments: number;
  }[];
  paymentModeMix: { mode: string; count: number; amount: number }[];
  topStations: {
    station: string;
    revenue: number;
    consignments: number;
    packages: number;
  }[];
  pendingByTrain: PendingTrain[];
}

export interface RecentConsignment {
  id: string;
  date: string;
  party: { id: string; name: string; city?: string } | null;
  destinationStation: string;
  packages: number;
  totalAmount: number;
  paymentMode: string;
  paymentStatus: string;
}

export interface PendingTrain {
  trainNumber: string;
  partyCount: number;
  consignmentCount: number;
  parties: {
    id: string | null;
    name: string;
    consignments: number;
    packages: number;
    amount: number;
    stations: string[];
  }[];
}

/** Subset of the consignment DTO the board needs. */
export interface BoardConsignment {
  id: string;
  destinationStation: string;
  packages: number;
  chargeableWeight?: number;
  actualWeight?: number;
  totalAmount: number;
  deliveryStatus: string;
  trainNumber?: string;
}

export interface PaymentLite {
  id: string;
  amount: number;
}

export interface DailyRow {
  date: string;
  consignmentCount: number;
  totalAmount: number;
  totalPackages: number;
}

export const PAYMENT_MODE_LABEL: Record<string, string> = {
  paid_source: "Paid",
  to_pay: "To pay",
  on_bill: "On bill",
  slip: "Slip",
};
