/** Pure Agent GST totals: non-taxable reimbursement, taxable service, taxes, gross. */
import React from "react";
import { View } from "react-native";
import { Card, Col, Divider, Money, Row, Text } from "@shared/ui";
import { useTheme } from "@shared/useTheme";
import type { Totals } from "../lib";

function Line({
  label,
  hint,
  value,
  strong,
  testID,
}: {
  label: string;
  hint?: string;
  value: number;
  strong?: boolean;
  testID?: string;
}) {
  return (
    <Row
      justify="space-between"
      gap={12}
      style={{ paddingVertical: 6 }}
      testID={testID}
    >
      <Col gap={0} flex={1}>
        <Text variant={strong ? "bodyStrong" : "body"}>{label}</Text>
        {hint ? (
          <Text variant="caption" tone="faint">
            {hint}
          </Text>
        ) : null}
      </Col>
      <Money value={value} variant={strong ? "h2" : "money"} />
    </Row>
  );
}

export function TotalsBlock({
  totals,
  amountInWords,
  preview,
  testID,
}: {
  totals: Totals;
  amountInWords?: string;
  preview?: boolean;
  testID?: string;
}) {
  const t = useTheme();
  const showIntra =
    totals.cgstRate > 0 || totals.sgstRate > 0 || !(totals.igstRate > 0);
  const showInter = totals.igstRate > 0;
  return (
    <Card testID={testID}>
      <Row justify="space-between" style={{ marginBottom: 6 }}>
        <Text variant="overline" tone="muted">
          {preview ? "Tax preview" : "Totals"}
        </Text>
        {preview ? (
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 2,
              borderRadius: t.radius.pill,
              backgroundColor: t.c.surfaceAlt,
            }}
          >
            <Text variant="caption" tone="muted">
              Preview · final figures come from the server
            </Text>
          </View>
        ) : null}
      </Row>
      <Line
        label="Reimbursement"
        hint="Railway freight paid on the party's behalf · not taxable"
        value={totals.reimbursementSubtotal}
        testID={`${testID}-reimbursement`}
      />
      <Line
        label="Service charges"
        hint="Freight + hamali + other · taxable"
        value={totals.serviceSubtotal}
        testID={`${testID}-service`}
      />
      {showIntra ? (
        <>
          <Line
            label={`CGST @ ${totals.cgstRate}%`}
            value={totals.cgstAmount}
            testID={`${testID}-cgst`}
          />
          <Line
            label={`SGST @ ${totals.sgstRate}%`}
            value={totals.sgstAmount}
            testID={`${testID}-sgst`}
          />
        </>
      ) : null}
      {showInter ? (
        <Line
          label={`IGST @ ${totals.igstRate}%`}
          value={totals.igstAmount}
          testID={`${testID}-igst`}
        />
      ) : null}
      <Divider style={{ marginVertical: 8 }} />
      <Line
        label="Gross total"
        value={totals.grossTotal}
        strong
        testID={`${testID}-gross`}
      />
      {amountInWords ? (
        <Text
          variant="caption"
          tone="muted"
          style={{ marginTop: 4 }}
          testID={`${testID}-words`}
        >
          {amountInWords}
        </Text>
      ) : null}
    </Card>
  );
}
