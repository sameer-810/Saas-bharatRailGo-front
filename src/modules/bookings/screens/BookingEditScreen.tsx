/** Edit booking — PATCH /consignments/:id (date and party are fixed). */
import React from "react";
import { Banner, Col, ErrorState, LoadingBlock, Screen } from "@shared/ui";
import { useApiGet } from "@shared/api/query";
import { apiErrorMessage } from "@shared/api/apiClient";
import { useParams } from "@navigation/useAppNav";
import { BookingForm } from "../components/BookingForm";
import type { Consignment } from "../lib/types";

export function BookingEditScreen() {
  const { id } = useParams<{ id: string }>();
  const one = useApiGet<Consignment>(["consignments", id], id ? `/consignments/${id}` : null);
  const c = one.data;
  const invoiceLocked =
    c?.invoice && typeof c.invoice === "object" && c.invoice.status && c.invoice.status !== "draft";

  return (
    <Screen title="Edit booking" back backTo="Bookings" maxWidth={960} testID="booking-edit-screen">
      {one.isLoading ? (
        <LoadingBlock rows={8} />
      ) : one.error || !c ? (
        <ErrorState message={apiErrorMessage(one.error, "Booking not found")} onRetry={one.refetch} />
      ) : (
        <Col gap={16}>
          {invoiceLocked ? (
            <Banner
              tone="warning"
              title="This booking is on a finalised invoice"
              message="The server will refuse changes. Cancel or revert the invoice to draft first."
              testID="booking-edit-invoice-locked"
            />
          ) : null}
          <BookingForm mode="edit" initial={c} />
        </Col>
      )}
    </Screen>
  );
}
