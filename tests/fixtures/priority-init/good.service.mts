import type { TServiceParams } from "./da.mts";

export function GoodDbService({ good_app }: TServiceParams) {
  void good_app;
}

// Reads db at construction; db is listed first in priorityInit -> correct.
export function GoodApiService({ good_app }: TServiceParams) {
  good_app.db.connect();
}
