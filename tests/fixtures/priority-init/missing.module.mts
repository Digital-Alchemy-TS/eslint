import { CreateApplication } from "./da.mts";
import { MissingApiService, MissingDbService } from "./missing.service.mts";

// db_svc is construction-read by api_svc but absent from priorityInit.
export const MISSING_APP = CreateApplication({
  name: "missing_app",
  priorityInit: [],
  services: {
    api_svc: MissingApiService,
    db_svc: MissingDbService,
  },
});
