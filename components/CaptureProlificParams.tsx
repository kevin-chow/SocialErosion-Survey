"use client";

import { useEffect } from "react";
import {
  persistProlificParams,
  readProlificParamsFromSearch,
} from "@/lib/prolific";

/**
 * Captures Prolific URL query params on first load and stores them in
 * sessionStorage so later pages (consent → participant) can use them.
 */
export function CaptureProlificParams() {
  useEffect(() => {
    const params = readProlificParamsFromSearch(window.location.search);
    persistProlificParams(params);
  }, []);

  return null;
}
