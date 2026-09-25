import { useSyncExternalStore } from "react";

const noop = () => () => {};
/** window.location.origin on the client, "" during SSR — without a hydration mismatch. */
export const useOrigin = () => useSyncExternalStore(noop, () => location.origin, () => "");
