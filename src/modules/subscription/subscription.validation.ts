import { z } from "zod";
import { PaymentMethods } from "../payment/payment.constant";
import {
  SubscriptionCurrency,
  SubscriptionTypes,
} from "./subscription.constant";

const subscribe = z.object({
  body: z
    .object({
      type: z.enum([...SubscriptionTypes] as [string, ...string[]], {
        error: "Subscription Type must be a string",
      }),
      currency: z.enum([...SubscriptionCurrency] as [string, ...string[]], {
        error: "Subscription Currency must be a string",
      }),
      paymentMethod: z.enum([...PaymentMethods] as [string, ...string[]], {
        error: "Payment Method must be a string",
      }),
      price: z.number({ error: "Price must be a number" }),
    })
    .strict(),
});

export const subscriptionValidationSchema = {
  subscribe,
};
