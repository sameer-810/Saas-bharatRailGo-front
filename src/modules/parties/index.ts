/**
 * parties module — public surface. Navigation imports ONLY this object.
 * Keys are route names (see src/navigation/routes.ts). Do not rename keys.
 */
import { PartyListScreen } from "./screens/PartyListScreen";
import { PartyEditScreen, PartyNewScreen } from "./screens/PartyFormScreen";
import { PartyDetailScreen } from "./screens/PartyDetailScreen";

export const partiesScreens = {
  Parties: PartyListScreen,
  PartyNew: PartyNewScreen,
  PartyDetail: PartyDetailScreen,
  PartyEdit: PartyEditScreen,
};
