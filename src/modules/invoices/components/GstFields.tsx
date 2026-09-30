/** GST mode (intra-state CGST+SGST / inter-state IGST) plus editable rates. */
import React from "react";
import { Col, NumberField, Row, SegmentedControl, Text } from "@shared/ui";
import type { GstMode, Rates } from "../lib";

export function GstFields({
  mode,
  rates,
  onMode,
  onRates,
  testID = "invoice-gst",
}: {
  mode: GstMode;
  rates: Rates;
  onMode: (m: GstMode) => void;
  onRates: (r: Rates) => void;
  testID?: string;
}) {
  return (
    <Col gap={10}>
      <Col gap={6}>
        <Text variant="label" tone="muted">
          GST
        </Text>
        <SegmentedControl<GstMode>
          value={mode}
          onChange={onMode}
          options={[
            { value: "intra", label: "Intra-state (CGST + SGST)" },
            { value: "inter", label: "Inter-state (IGST)" },
          ]}
          testID={`${testID}-mode`}
        />
      </Col>
      {mode === "intra" ? (
        <Row gap={12}>
          <Col flex={1}>
            <NumberField
              label="CGST %"
              value={rates.cgstRate}
              onChange={(v) => onRates({ ...rates, cgstRate: v ?? 0 })}
              testID={`${testID}-cgst`}
            />
          </Col>
          <Col flex={1}>
            <NumberField
              label="SGST %"
              value={rates.sgstRate}
              onChange={(v) => onRates({ ...rates, sgstRate: v ?? 0 })}
              testID={`${testID}-sgst`}
            />
          </Col>
        </Row>
      ) : (
        <NumberField
          label="IGST %"
          value={rates.igstRate}
          onChange={(v) => onRates({ ...rates, igstRate: v ?? 0 })}
          testID={`${testID}-igst`}
        />
      )}
      <Text variant="caption" tone="faint">
        Tax applies to service charges only. Railway freight reimbursement is
        not taxed (Pure Agent).
      </Text>
    </Col>
  );
}
