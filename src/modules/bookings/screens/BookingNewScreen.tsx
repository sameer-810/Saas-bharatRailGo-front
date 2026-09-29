/** New booking — quick entry fills the form; route params (from the list's quick entry or { partyId }) pre-fill it. */
import React, { useEffect, useState } from "react";
import { Col, Screen } from "@shared/ui";
import { useParams } from "@navigation/useAppNav";
import { useReadOnly } from "@shared/lib/permissions";
import { BookingForm } from "../components/BookingForm";
import { QuickEntryBar } from "../components/QuickEntryBar";
import type { BookingPrefill, PaymentMode } from "../lib/types";

function num(v: unknown): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** Route params arrive as strings on web (URL query) — normalise them. */
function prefillFromParams(p: Record<string, unknown>): BookingPrefill | null {
  const out: BookingPrefill = {
    partyId: p.partyId ? String(p.partyId) : undefined,
    partyName: p.partyName ? String(p.partyName) : undefined,
    destinationStation: p.destinationStation ? String(p.destinationStation) : undefined,
    originStation: p.originStation ? String(p.originStation) : undefined,
    packages: num(p.packages),
    chargeableWeight: num(p.chargeableWeight),
    paymentMode: p.paymentMode ? (String(p.paymentMode) as PaymentMode) : undefined,
    freightAmount: num(p.freightAmount),
  };
  return Object.values(out).some((v) => v !== undefined) ? out : null;
}

export function BookingNewScreen() {
  const params = useParams<Record<string, unknown>>();
  const readOnly = useReadOnly();
  const paramKey = JSON.stringify(params);
  const [prefill, setPrefill] = useState<BookingPrefill | null>(() => prefillFromParams(params));

  useEffect(() => {
    const p = prefillFromParams(params);
    if (p) setPrefill(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramKey]);

  return (
    <Screen title="New booking" back backTo="Bookings" maxWidth={960} testID="booking-new-screen">
      <Col gap={16}>
        {!readOnly ? (
          <QuickEntryBar
            testID="quick-entry"
            submitLabel="Fill form"
            compact
            onSubmit={(p) => setPrefill({ ...p })}
          />
        ) : null}
        <BookingForm mode="create" prefill={prefill} />
      </Col>
    </Screen>
  );
}
