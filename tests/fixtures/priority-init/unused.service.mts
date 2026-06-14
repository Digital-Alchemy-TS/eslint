import type { TServiceParams } from "./da.mts";

// Neither service reads a sibling at construction.
export function UnusedLonelyService({ unused_app }: TServiceParams) {
  void unused_app;
}

export function UnusedOtherService({ unused_app }: TServiceParams) {
  void unused_app;
}
