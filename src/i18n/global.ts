import { routing } from "@/i18n/routing";
import type messages from "../../messages/ru.json";

declare module "use-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
  }
}
