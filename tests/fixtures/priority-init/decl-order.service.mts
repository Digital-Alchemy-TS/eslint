import type { TServiceParams } from "./da.mts";

export function DeclOrderDbService({ declorder_app }: TServiceParams) {
  void declorder_app;
}

// Reads db at construction, but db is declared BEFORE api in services, so it
// already wires first by declaration order -> no priorityInit entry needed.
export function DeclOrderApiService({ declorder_app }: TServiceParams) {
  declorder_app.db.connect();
}
