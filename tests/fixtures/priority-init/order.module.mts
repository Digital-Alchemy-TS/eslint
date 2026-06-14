import { CreateApplication } from "./da.mts";
import { OrderConsumerService, OrderProducerService } from "./order.service.mts";

// consumer construction-reads prod, but prod wires AFTER consumer in priorityInit.
export const ORDER_APP = CreateApplication({
  name: "order_app",
  priorityInit: ["consumer", "prod"],
  services: {
    consumer: OrderConsumerService,
    prod: OrderProducerService,
  },
});
