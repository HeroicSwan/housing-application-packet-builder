import "server-only";
import { parseEnvironment } from "@/lib/env-schema";

export const env = parseEnvironment(process.env);
