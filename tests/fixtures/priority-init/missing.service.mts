import type { TServiceParams } from "./da.mts";

export function MissingDbService({ missing_app }: TServiceParams) {
  void missing_app;
}

// Reads db_svc's API at construction (top level) -> db_svc must be in priorityInit.
export function MissingApiService({ missing_app }: TServiceParams) {
  missing_app.db_svc.init();
}
