/** New / edit party. Mirrors bharatrailgo-back/src/modules/party/party.validation.js */
import React, { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Save } from "lucide-react-native";
import {
  Banner,
  Button,
  Card,
  Col,
  Combobox,
  ErrorState,
  LoadingBlock,
  NumberField,
  Row,
  Screen,
  SectionHeader,
  SegmentedControl,
  Select,
  Text,
  TextField,
  toast,
} from "@shared/ui";
import { useLayout } from "@shared/useTheme";
import { useApiGet, useApiMutation } from "@shared/api/query";
import { apiErrorCode, apiErrorMessage } from "@shared/api/apiClient";
import { loadStationOptions } from "@shared/api/lookups";
import { useReadOnly } from "@shared/lib/permissions";
import { useAppNav, useParams } from "@navigation/useAppNav";
import { FormError, type FormErrorState } from "../components/FormError";
import { PAYMENT_MODES, PAYMENT_MODE_LABEL, type Party, type PartyInput, type PaymentMode } from "../types";

const schema = z.object({
  name: z.string().trim().min(1, "Party name is required"),
  gstin: z.string().trim(),
  pan: z.string().trim(),
  email: z.string().trim().email("Invalid email").or(z.literal("")),
  mobile: z.string().trim(),
  alternateMobile: z.string().trim(),
  defaultStation: z.string().trim(),
  address: z.string().trim(),
  city: z.string().trim(),
  state: z.string().trim(),
  defaultPaymentMode: z.enum(PAYMENT_MODES),
  openingAmount: z.number({ invalid_type_error: "Enter a number" }).min(0).optional(),
  openingSide: z.enum(["dr", "cr"]),
});
type Form = z.infer<typeof schema>;
type TextKey = "name" | "gstin" | "pan" | "email" | "mobile" | "alternateMobile" | "address" | "city" | "state";

function fromParty(p?: Party): Form {
  const ob = p?.openingBalance ?? 0;
  return {
    name: p?.name || "",
    gstin: p?.gstin || "",
    pan: p?.pan || "",
    email: p?.email || "",
    mobile: p?.mobile || "",
    alternateMobile: p?.alternateMobile || "",
    defaultStation: p?.defaultStation || "",
    address: p?.address || "",
    city: p?.city || "",
    state: p?.state || "",
    defaultPaymentMode: p?.defaultPaymentMode || "on_bill",
    openingAmount: ob ? Math.abs(ob) : undefined,
    openingSide: ob < 0 ? "cr" : "dr",
  };
}

function Grid({ children }: { children: React.ReactNode }) {
  const { isPhone } = useLayout();
  return (
    <Row gap={12} wrap align="flex-start">
      {React.Children.toArray(children).map((c, i) => (
        <Col key={i} style={{ flexGrow: 1, flexBasis: isPhone ? "100%" : "46%", minWidth: 160 }}>
          {c}
        </Col>
      ))}
    </Row>
  );
}

export function PartyNewScreen() {
  return <PartyForm mode="create" />;
}

export function PartyEditScreen() {
  const { id } = useParams<{ id: string }>();
  const one = useApiGet<Party>(["parties", id], id ? `/parties/${id}` : null);
  if (one.error) {
    return (
      <Screen title="Edit party" back backTo="Parties" testID="party-edit-screen">
        <ErrorState message={apiErrorMessage(one.error)} onRetry={() => one.refetch()} />
      </Screen>
    );
  }
  if (!one.data) {
    return (
      <Screen title="Edit party" back backTo="Parties" testID="party-edit-screen">
        <LoadingBlock rows={8} />
      </Screen>
    );
  }
  return <PartyForm mode="edit" party={one.data} />;
}

function PartyForm({ mode, party }: { mode: "create" | "edit"; party?: Party }) {
  const nav = useAppNav();
  const readOnly = useReadOnly();
  const [saveError, setSaveError] = useState<FormErrorState | null>(null);
  const { control, handleSubmit, formState } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: fromParty(party),
  });
  const inv = ["parties", "dashboard", "reports"];
  const create = useApiMutation<Party, PartyInput>("post", "/parties", { invalidate: inv });
  const update = useApiMutation<Party, PartyInput>("patch", party ? `/parties/${party.id}` : "/parties", { invalidate: inv });

  const onSubmit = handleSubmit(async (v) => {
    setSaveError(null);
    const amt = v.openingAmount ?? 0;
    // On create drop blanks; on edit send "" so a field can be cleared.
    const s = (x: string) => (mode === "edit" ? x : x === "" ? undefined : x);
    const body: PartyInput = {
      name: v.name,
      gstin: s(v.gstin.toUpperCase()),
      pan: s(v.pan.toUpperCase()),
      email: s(v.email.toLowerCase()),
      mobile: s(v.mobile),
      alternateMobile: s(v.alternateMobile),
      defaultStation: s(v.defaultStation.toUpperCase()),
      address: s(v.address),
      city: s(v.city),
      state: s(v.state),
      defaultPaymentMode: v.defaultPaymentMode,
      openingBalance: v.openingSide === "cr" ? -amt : amt,
    };
    try {
      if (mode === "create") {
        const saved = await create.mutateAsync(body);
        toast.success(`Party "${saved.name}" saved`);
        if (nav.replace) nav.replace("PartyDetail", { id: saved.id });
        else nav.navigate("PartyDetail", { id: saved.id });
      } else if (party) {
        await update.mutateAsync(body);
        toast.success("Party updated");
        if (nav.canGoBack()) nav.goBack();
        else nav.navigate("PartyDetail", { id: party.id });
      }
    } catch (err) {
      const message = apiErrorMessage(err);
      setSaveError({ code: apiErrorCode(err), message });
      toast.error(message);
    }
  });

  const txt = (name: TextKey, label: string, props: Partial<React.ComponentProps<typeof TextField>> = {}) => (
    <Controller
      control={control}
      name={name}
      render={({ field: f, fieldState }) => (
        <TextField
          testID={`party-${name}`}
          label={label}
          value={f.value}
          onChangeText={f.onChange}
          onBlur={f.onBlur}
          error={fieldState.error?.message}
          {...props}
        />
      )}
    />
  );

  return (
    <Screen
      title={mode === "create" ? "New party" : `Edit ${party?.name || "party"}`}
      back
      backTo="Parties"
      maxWidth={880}
      testID={mode === "create" ? "party-new-screen" : "party-edit-screen"}
    >
      <Col gap={16}>
        {readOnly ? (
          <Banner
            tone="warning"
            title="Read-only mode"
            message="Your subscription has expired, so parties cannot be saved."
            testID="party-form-readonly"
            action={<Button title="Plan" size="sm" variant="secondary" testID="party-form-plan" onPress={() => nav.navigate("Plan")} />}
          />
        ) : null}
        <FormError error={saveError} testID="party-form-error" />

        <Card>
          <SectionHeader title="Party" />
          <Col gap={12}>
            {txt("name", "Name", { placeholder: "Business or person name" })}
            <Grid>
              {txt("gstin", "GSTIN", { mono: true, autoCapitalize: "characters", maxLength: 15 })}
              {txt("pan", "PAN", { mono: true, autoCapitalize: "characters", maxLength: 10 })}
            </Grid>
          </Col>
        </Card>

        <Card>
          <SectionHeader title="Contact" />
          <Col gap={12}>
            <Grid>
              {txt("mobile", "Mobile", { keyboardType: "phone-pad", maxLength: 13 })}
              {txt("alternateMobile", "Alternate mobile", { keyboardType: "phone-pad", maxLength: 13 })}
            </Grid>
            {txt("email", "Email", { keyboardType: "email-address", autoCapitalize: "none" })}
            {txt("address", "Address", { multiline: true })}
            <Grid>
              {txt("city", "City")}
              {txt("state", "State")}
            </Grid>
          </Col>
        </Card>

        <Card>
          <SectionHeader title="Defaults & balance" />
          <Col gap={12}>
            <Grid>
              <Controller
                control={control}
                name="defaultStation"
                render={({ field: f }) => (
                  <Combobox
                    testID="party-defaultStation"
                    label="Default station"
                    placeholder="Search station"
                    valueLabel={f.value || undefined}
                    selectedValue={f.value || null}
                    loadOptions={loadStationOptions}
                    clearable
                    onPick={(o) => f.onChange(o ? o.value : "")}
                  />
                )}
              />
              <Controller
                control={control}
                name="defaultPaymentMode"
                render={({ field: f }) => (
                  <Select<PaymentMode>
                    testID="party-defaultPaymentMode"
                    label="Default payment mode"
                    value={f.value}
                    options={PAYMENT_MODES.map((m) => ({ value: m, label: PAYMENT_MODE_LABEL[m] }))}
                    onChange={(m) => m && f.onChange(m)}
                  />
                )}
              />
            </Grid>
            <Grid>
              <Controller
                control={control}
                name="openingAmount"
                render={({ field: f, fieldState }) => (
                  <NumberField
                    testID="party-openingBalance"
                    label="Opening balance (₹)"
                    value={f.value}
                    onChange={f.onChange}
                    error={fieldState.error?.message}
                    hint="Balance carried over from before you started using BharatRailGo"
                  />
                )}
              />
              <Controller
                control={control}
                name="openingSide"
                render={({ field: f }) => (
                  <Col gap={6}>
                    <Text variant="label" tone="muted">
                      Balance type
                    </Text>
                    <SegmentedControl<"dr" | "cr">
                      testID="party-openingSide"
                      value={f.value}
                      onChange={f.onChange}
                      options={[
                        { value: "dr", label: "They owe us (Dr)" },
                        { value: "cr", label: "Advance with us (Cr)" },
                      ]}
                    />
                  </Col>
                )}
              />
            </Grid>
          </Col>
        </Card>

        <Row justify="flex-end" gap={8}>
          <Button
            testID="party-cancel"
            title="Cancel"
            variant="secondary"
            onPress={() => (nav.canGoBack() ? nav.goBack() : nav.navigate("Parties"))}
          />
          <Button
            testID="party-save"
            title={mode === "create" ? "Save party" : "Save changes"}
            icon={Save}
            loading={formState.isSubmitting}
            disabled={readOnly}
            onPress={onSubmit}
          />
        </Row>
      </Col>
    </Screen>
  );
}
