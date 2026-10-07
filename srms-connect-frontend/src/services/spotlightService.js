import authApi from "./api";
import { createSpotlightClient } from "./spotlightClient";

export const { listSpotlights, manageList, createSpotlight, updateSpotlight, setSpotlightStatus, deleteSpotlight } = createSpotlightClient(authApi);
