/**
 * Mock sites — PLACEHOLDER data for the Earth scene: a headquarters in
 * Austria and ten production sites across Europe of two kinds. The names
 * and positions are invented and generic on purpose (this repo is public);
 * a real dataset is the same shape (`SiteData`, Sites.ts) and swaps in
 * wherever this list is passed.
 */

import type { SiteData } from "./Sites"

export const MOCK_SITES: readonly SiteData[] = [
  { name: "Headquarters", lat: 48.1, lon: 14.2, kind: "hq" },
  { name: "Site R1", lat: 45.5, lon: 9.3, kind: "red" },
  { name: "Site R2", lat: 48.8, lon: 9.1, kind: "red" },
  { name: "Site R3", lat: 49.2, lon: 16.6, kind: "red" },
  { name: "Site R4", lat: 51.1, lon: 17.0, kind: "red" },
  { name: "Site R5", lat: 41.6, lon: 0.6, kind: "red" },
  { name: "Site B1", lat: 45.8, lon: 4.9, kind: "blue" },
  { name: "Site B2", lat: 47.5, lon: 19.1, kind: "blue" },
  { name: "Site B3", lat: 46.8, lon: 23.6, kind: "blue" },
  { name: "Site B4", lat: 51.4, lon: 5.5, kind: "blue" },
  { name: "Site B5", lat: 57.7, lon: 12.0, kind: "blue" },
]
