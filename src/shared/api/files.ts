/**
 * Authenticated file access — PDFs (bilti, invoice) and Excel exports.
 * The API needs the bearer token, so we fetch the bytes ourselves:
 *   web    → Blob → open in a new tab (PDF) or trigger a download (xlsx)
 *   native → write to cache → system share sheet (WhatsApp, print, Drive…)
 */
import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { apiClient } from "./apiClient";

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return globalThis.btoa(binary);
}

async function fetchBytes(url: string, params?: Record<string, unknown>) {
  const res = await apiClient.get<ArrayBuffer>(url, {
    params,
    responseType: "arraybuffer",
  });
  return {
    data: res.data,
    type: String(res.headers["content-type"] || "application/octet-stream"),
  };
}

/** Open a PDF (bilti / invoice). */
export async function openPdf(url: string, filename: string) {
  const { data, type } = await fetchBytes(url);
  if (Platform.OS === "web") {
    const blobUrl = URL.createObjectURL(new Blob([data], { type }));
    const win = window.open(blobUrl, "_blank");
    if (!win) triggerDownload(blobUrl, filename);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    return;
  }
  await shareNative(data, filename, "application/pdf");
}

/** Download an export (Excel). */
export async function downloadFile(
  url: string,
  filename: string,
  params?: Record<string, unknown>,
) {
  const { data, type } = await fetchBytes(url, params);
  if (Platform.OS === "web") {
    const blobUrl = URL.createObjectURL(new Blob([data], { type }));
    triggerDownload(blobUrl, filename);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    return;
  }
  await shareNative(data, filename, type);
}

function triggerDownload(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function shareNative(
  data: ArrayBuffer,
  filename: string,
  mimeType: string,
) {
  const path = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(path, arrayBufferToBase64(data), {
    encoding: FileSystem.EncodingType.Base64,
  });
  if (await Sharing.isAvailableAsync())
    await Sharing.shareAsync(path, { mimeType });
}
