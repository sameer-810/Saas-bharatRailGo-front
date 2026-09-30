/** Edit a draft invoice: date, GST rates, notes (PATCH /invoices/:id). */
import React, { useEffect, useMemo, useState } from "react";
import { Button, DateField, Dialog, Text, TextField, toast } from "@shared/ui";
import { useApiMutation } from "@shared/api/query";
import { apiErrorMessage } from "@shared/api/apiClient";
import { computeTotals, ratesFor, type GstMode, type Rates } from "../lib";
import {
  INVOICE_INVALIDATE,
  type Invoice,
  type InvoiceUpdateInput,
} from "../types";
import { GstFields } from "./GstFields";
import { TotalsBlock } from "./TotalsBlock";

function ratesOf(inv: Invoice): Rates {
  return {
    cgstRate: inv.cgstRate ?? 0,
    sgstRate: inv.sgstRate ?? 0,
    igstRate: inv.igstRate ?? 0,
  };
}

export function InvoiceEditDialog({
  invoice,
  visible,
  onClose,
  defaults,
}: {
  invoice: Invoice;
  visible: boolean;
  onClose: () => void;
  defaults: { cgst?: number; sgst?: number };
}) {
  const [date, setDate] = useState(String(invoice.date).slice(0, 10));
  const [notes, setNotes] = useState(invoice.notes || "");
  const [mode, setMode] = useState<GstMode>(
    invoice.igstRate > 0 ? "inter" : "intra",
  );
  const [rates, setRates] = useState<Rates>(ratesOf(invoice));
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setDate(String(invoice.date).slice(0, 10));
    setNotes(invoice.notes || "");
    setMode(invoice.igstRate > 0 ? "inter" : "intra");
    setRates(ratesOf(invoice));
    setErr(null);
  }, [visible, invoice]);

  const switchMode = (m: GstMode) => {
    setMode(m);
    setRates(ratesFor(m, defaults));
  };

  const totals = useMemo(
    () =>
      computeTotals(
        {
          serviceSubtotal: invoice.serviceSubtotal,
          reimbursementSubtotal: invoice.reimbursementSubtotal,
        },
        rates,
      ),
    [invoice, rates],
  );

  const update = useApiMutation<Invoice, InvoiceUpdateInput>(
    "patch",
    `/invoices/${invoice.id}`,
    {
      invalidate: INVOICE_INVALIDATE,
    },
  );

  const save = async () => {
    if (!date) return setErr("Pick a date.");
    const bad = [rates.cgstRate, rates.sgstRate, rates.igstRate].some(
      (r) => r < 0 || r > 100,
    );
    if (bad) return setErr("Rates must be between 0 and 100.");
    setErr(null);
    try {
      await update.mutateAsync({ date, notes: notes.trim(), ...rates });
      toast.success("Invoice updated");
      onClose();
    } catch (e) {
      setErr(apiErrorMessage(e));
      toast.error(apiErrorMessage(e));
    }
  };

  return (
    <Dialog
      visible={visible}
      onClose={onClose}
      title="Edit draft invoice"
      testID="invoice-edit-dialog"
      width={560}
      footer={
        <>
          <Button
            title="Cancel"
            variant="secondary"
            onPress={onClose}
            testID="invoice-edit-cancel"
          />
          <Button
            title="Save"
            onPress={save}
            loading={update.isPending}
            testID="invoice-edit-save"
          />
        </>
      }
    >
      {err ? (
        <Text tone="danger" testID="invoice-edit-error">
          {err}
        </Text>
      ) : null}
      <DateField
        label="Bill date"
        value={date}
        onChange={setDate}
        testID="invoice-edit-date"
      />
      <GstFields
        mode={mode}
        rates={rates}
        onMode={switchMode}
        onRates={setRates}
        testID="invoice-edit-gst"
      />
      <TextField
        label="Notes"
        value={notes}
        onChangeText={setNotes}
        multiline
        testID="invoice-edit-notes"
      />
      <TotalsBlock totals={totals} preview testID="invoice-edit-preview" />
    </Dialog>
  );
}
