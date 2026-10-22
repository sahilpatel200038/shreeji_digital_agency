import { analyticsSchema } from "@/lib/settings/schema";

export const settingsGuard = (v: unknown) => analyticsSchema.safeParse(v).success;
