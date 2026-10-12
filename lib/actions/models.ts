"use server";
import { enabledProviders } from "@/lib/ai/gateway";

/** Which providers have a key on this deployment (the picker greys out the rest). */
export async function modelProviders() {
  return enabledProviders();
}
