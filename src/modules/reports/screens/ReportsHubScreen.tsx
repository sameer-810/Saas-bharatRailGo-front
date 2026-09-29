/** Reports hub: one card per report. */
import React from "react";
import { View } from "react-native";
import { CalendarDays, ChevronRight, Hourglass, MapPin, ReceiptIndianRupee, type LucideIcon } from "lucide-react-native";
import { Card, Col, Row, Screen, Text } from "@shared/ui";
import { useLayout, useTheme } from "@shared/useTheme";
import { useAppNav } from "@navigation/useAppNav";

type ReportRoute = "ReportDaily" | "ReportOutstanding" | "ReportStation" | "ReportGst";

const REPORTS: { route: ReportRoute; id: string; title: string; description: string; icon: LucideIcon; tag: string }[] = [
  {
    route: "ReportDaily",
    id: "daily",
    title: "Daily bookings",
    description: "Bookings, packages, weight and charges for each day in a date range.",
    icon: CalendarDays,
    tag: "DATE RANGE",
  },
  {
    route: "ReportOutstanding",
    id: "outstanding",
    title: "Party outstanding",
    description: "What each party still owes on to-pay and on-bill parcels, split by age.",
    icon: Hourglass,
    tag: "AGING",
  },
  {
    route: "ReportStation",
    id: "station",
    title: "Station-wise revenue",
    description: "Which destinations carried the most parcels and brought in the most revenue.",
    icon: MapPin,
    tag: "DATE RANGE",
  },
  {
    route: "ReportGst",
    id: "gst",
    title: "Monthly GST",
    description: "CGST, SGST and IGST on every bill in a month, ready for your return.",
    icon: ReceiptIndianRupee,
    tag: "MONTH",
  },
];

export function ReportsHubScreen() {
  const t = useTheme();
  const nav = useAppNav();
  const { isPhone } = useLayout();
  return (
    <Screen title="Reports" subtitle="Summaries you can check on screen or export to Excel" testID="reports-hub">
      <Row wrap gap={16} align="stretch">
        {REPORTS.map((r) => {
          const Icon = r.icon;
          return (
            <Card
              key={r.id}
              testID={`report-card-${r.id}`}
              onPress={() => nav.navigate(r.route)}
              padding={18}
              style={{ flexGrow: 1, flexBasis: isPhone ? "100%" : 420 }}
            >
              <Row gap={14} align="flex-start">
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: t.radius.md,
                    backgroundColor: t.c.accentSoft,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon size={20} color={t.c.accent} />
                </View>
                <Col gap={4} flex={1}>
                  <Text variant="overline" tone="faint">
                    {r.tag}
                  </Text>
                  <Text variant="h3">{r.title}</Text>
                  <Text tone="muted">{r.description}</Text>
                </Col>
                <ChevronRight size={18} color={t.c.textFaint} />
              </Row>
            </Card>
          );
        })}
      </Row>
    </Screen>
  );
}
