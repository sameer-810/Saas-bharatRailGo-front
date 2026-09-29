/** Add more of the party's un-invoiced on-bill bookings to a draft invoice. */
import React, { useEffect, useState } from "react";
import { Button, Dialog, Text, toast } from "@shared/ui";
import { useApiMutation } from "@shared/api/query";
import { apiErrorMessage } from "@shared/api/apiClient";
import { useUninvoicedConsignments } from "../lib";
import { INVOICE_INVALIDATE, type Invoice } from "../types";
import { ConsignmentPicker } from "./ConsignmentPicker";

export function AddConsignmentsDialog({
  invoiceId,
  partyId,
  visible,
  onClose,
}: {
  invoiceId: string;
  partyId: string | undefined;
  visible: boolean;
  onClose: () => void;
}) {
  const open = useUninvoicedConsignments(visible ? partyId : undefined);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (visible) setSelected(new Set());
  }, [visible]);

  const add = useApiMutation<Invoice, { consignmentIds: string[] }>("post", `/invoices/${invoiceId}/consignments`, {
    invalidate: INVOICE_INVALIDATE,
  });

  const save = async () => {
    try {
      await add.mutateAsync({ consignmentIds: [...selected] });
      toast.success(`${selected.size} booking${selected.size === 1 ? "" : "s"} added`);
      onClose();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };

  return (
    <Dialog
      visible={visible}
      onClose={onClose}
      title="Add bookings to this invoice"
      testID="invoice-add-dialog"
      width={640}
      footer={
        <>
          <Button title="Cancel" variant="secondary" onPress={onClose} testID="invoice-add-cancel" />
          <Button
            title={selected.size ? `Add ${selected.size}` : "Add"}
            onPress={save}
            disabled={selected.size === 0}
            loading={add.isPending}
            testID="invoice-add-save"
          />
        </>
      }
    >
      <Text tone="muted">{"Only this party's on-bill bookings that are not on any invoice are shown."}</Text>
      <ConsignmentPicker
        items={open.items}
        selected={selected}
        onChange={setSelected}
        loading={open.isLoading}
        error={open.error}
        onRetry={open.refetch}
        testID="invoice-add-picker"
      />
    </Dialog>
  );
}
