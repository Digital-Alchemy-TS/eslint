import type { TServiceParams } from "./da.mts";

// Reads prod's API at construction.
export function OrderConsumerService({ order_app }: TServiceParams) {
  order_app.prod.value();
}

export function OrderProducerService({ order_app }: TServiceParams) {
  void order_app;
}
