/**
 * Customer privacy (DPDP Act 2023) — answer a customer who asks for a copy of
 * their data, or asks for it to be erased. Owner + manager.
 *
 * Erasure keeps what the law requires: if the customer has bookings, bilti,
 * bills or payments, only contact details are removed (the server decides).
 */
import React, { useState } from "react";
import { Download, ShieldCheck, UserX } from "lucide-react-native";
import { useQueryClient } from "@tanstack/react-query";
import {
  Banner,
  Button,
  Card,
  Col,
  Dialog,
  Row,
  Text,
  TextField,
  toast,
} from "@shared/ui";
import { useTheme } from "@shared/useTheme";
import { apiClient, apiErrorMessage } from "@shared/api/apiClient";
import { downloadFile } from "@shared/api/files";
import { formatDate } from "@shared/lib/format";
import type { Party } from "../types";

const slug = (s: string) =>
  s
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "customer";

export function PartyPrivacyCard({
  party,
  readOnly,
}: {
  party: Party;
  readOnly?: boolean;
}) {
  const t = useTheme();
  const qc = useQueryClient();
  const [exporting, setExporting] = useState(false);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [erasing, setErasing] = useState(false);

  const onExport = async () => {
    setExporting(true);
    try {
      await downloadFile(
        `/privacy/parties/${party.id}/export`,
        `customer-data-${slug(party.name)}.json`,
      );
      toast.success("Customer data downloaded");
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  const onErase = async () => {
    setErasing(true);
    try {
      const res = await apiClient.post(`/privacy/parties/${party.id}/erase`, {
        confirm: "ERASE",
      });
      toast.success(res.data.message || "Done");
      setOpen(false);
      setTyped("");
      qc.invalidateQueries({ queryKey: ["parties"] });
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setErasing(false);
    }
  };

  return (
    <Card testID="party-privacy">
      <Row gap={14} align="flex-start" wrap>
        <ShieldCheck size={22} color={t.c.accent} />
        <Col gap={10} flex={1} style={{ minWidth: 240 }}>
          <Col gap={4}>
            <Text variant="h3">Customer privacy</Text>
            <Text variant="caption" tone="muted">
              If this customer asks what data you hold about them, or asks you
              to delete it (Digital Personal Data Protection Act, 2023), you can
              do it here. Both actions are recorded in the activity log.
            </Text>
          </Col>
          {party.erasedAt ? (
            <Banner
              testID="party-erased-banner"
              tone="info"
              title={
                party.erasureMode === "anonymised"
                  ? "Personal data erased"
                  : "Contact details erased"
              }
              message={`On ${formatDate(party.erasedAt)}.${
                party.erasureMode === "redacted"
                  ? " The name and GSTIN stay on past bookings and GST bills, which must be kept by law."
                  : ""
              }`}
            />
          ) : null}
          <Row gap={8} wrap>
            <Button
              testID="party-privacy-export"
              title="Download customer data"
              icon={Download}
              variant="secondary"
              size="sm"
              loading={exporting}
              onPress={onExport}
            />
            {party.erasureMode !== "anonymised" ? (
              <Button
                testID="party-privacy-erase"
                title="Erase personal data"
                icon={UserX}
                variant="secondary"
                size="sm"
                disabled={readOnly}
                onPress={() => setOpen(true)}
              />
            ) : null}
          </Row>
        </Col>
      </Row>

      <Dialog
        visible={open}
        onClose={() => setOpen(false)}
        title={`Erase ${party.name}'s personal data?`}
        testID="party-erase-dialog"
        footer={
          <Row gap={8} justify="flex-end">
            <Button
              title="Cancel"
              variant="secondary"
              onPress={() => setOpen(false)}
            />
            <Button
              testID="party-erase-confirm"
              title="Erase"
              variant="danger"
              loading={erasing}
              disabled={typed.trim().toUpperCase() !== "ERASE"}
              onPress={onErase}
            />
          </Row>
        }
      >
        <Col gap={12}>
          <Text tone="muted">
            Mobile numbers, email, address and PAN are removed. If this customer
            has bookings, bilti, GST bills or payments, their name and GSTIN
            stay on those records — GST law requires you to keep bills for 6
            years. A customer with no records is erased completely. This cannot
            be undone.
          </Text>
          <TextField
            testID="party-erase-type"
            label='Type "ERASE" to confirm'
            value={typed}
            onChangeText={setTyped}
            autoCapitalize="characters"
            mono
          />
        </Col>
      </Dialog>
    </Card>
  );
}
