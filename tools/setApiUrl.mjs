/**
 * CI helper: writes the API address into every eas.json build profile, so the
 * built app talks to the right server. EXPO_PUBLIC_* values are baked into the
 * JS bundle at build time, and `eas build --local` reads them from eas.json.
 *
 *   EXPO_PUBLIC_API_URL=https://api.example.com/api node tools/setApiUrl.mjs
 *
 * Fails loudly when the address is missing or not https — an app built against
 * localhost installs fine and then cannot sign anyone in.
 */
import { readFileSync, writeFileSync } from "node:fs";

const url = (process.env.EXPO_PUBLIC_API_URL || "").trim().replace(/\/+$/, "");
if (!/^https:\/\/.+\/api$/.test(url)) {
  console.error(
    `EXPO_PUBLIC_API_URL must look like https://your-api-host/api (got "${url || "nothing"}").\n` +
      "Set it in GitHub → repo → Settings → Secrets and variables → Actions → Variables.",
  );
  process.exit(1);
}
const eas = JSON.parse(readFileSync("eas.json", "utf8"));
for (const profile of Object.values(eas.build)) {
  profile.env = { ...(profile.env || {}), EXPO_PUBLIC_API_URL: url };
}
writeFileSync("eas.json", JSON.stringify(eas, null, 2) + "\n");
console.log(`API address set to ${url}`);
