/** Split auth layout: live departure board on the left, form on the right. */
import React from "react";
import { ScrollView, View } from "react-native";
import { useLayout, useTheme } from "@shared/useTheme";
import { Board, BoardText, Col, FlapText, Row, Text } from "@shared/ui";

const DEMO_ROWS = [
  ["12951", "NDLS", "24 PKG", "LOADED"],
  ["12137", "CSMT", "08 PKG", "ON TIME"],
  ["22691", "SBC", "15 PKG", "BOOKED"],
  ["12859", "HWH", "31 PKG", "IN TRANSIT"],
];

export function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  const { isDesktop, isPhone } = useLayout();
  return (
    <View style={{ flex: 1, flexDirection: "row", backgroundColor: t.c.bg }}>
      {isDesktop ? (
        <View
          style={{
            flex: 1.1,
            backgroundColor: t.c.board,
            padding: 48,
            justifyContent: "space-between",
          }}
        >
          <Col gap={6}>
            <Text
              style={{
                fontFamily: t.fonts.monoBold,
                color: t.c.boardText,
                letterSpacing: 3,
                fontSize: 13,
              }}
            >
              BHARATRAILGO
            </Text>
            <Text variant="display" style={{ color: "#F5F2EA", maxWidth: 460 }}>
              Every parcel, every train, every rupee — on one board.
            </Text>
          </Col>
          <Board
            title="Departures · Parcel office"
            right={<BoardText dim>LIVE</BoardText>}
          >
            {DEMO_ROWS.map((r, i) => (
              <Row key={r[0]} gap={10}>
                <FlapText
                  text={r[0]}
                  width={5}
                  size={16}
                  stagger={30 + i * 10}
                />
                <FlapText
                  text={r[1]}
                  width={4}
                  size={16}
                  stagger={40 + i * 10}
                />
                <View style={{ flex: 1 }} />
                <BoardText>{r[2]}</BoardText>
                <View style={{ width: 96 }}>
                  <BoardText dim={r[3] === "BOOKED"}>{r[3]}</BoardText>
                </View>
              </Row>
            ))}
          </Board>
          <Text variant="caption" style={{ color: "#8C8778" }}>
            Booking · Bilti · GST invoices · Collections — for railway parcel
            agents.
          </Text>
        </View>
      ) : null}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          padding: isPhone ? 20 : 48,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ width: "100%", maxWidth: 440, alignSelf: "center" }}>
          {children}
        </View>
      </ScrollView>
    </View>
  );
}
