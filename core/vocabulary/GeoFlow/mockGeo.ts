/**
 * Mock geography for FlowMap's own mock organisation (MOCK_FLOWMAP): its
 * eleven sites, suppliers, partners and customers set at invented places
 * across Europe, the group's own place in the middle. PLACEHOLDER — generic
 * on purpose (the repo is public); two places are marked as guesses
 * (certainty < 1) to show how an uncertain location is ghosted. A real
 * organisation's geography is the same shape and swaps in.
 */

import type { GeoFlowGeo } from "./GeoFlow"

export const MOCK_GEO: GeoFlowGeo = {
  group: { lat: 49.6, lon: 10.4 },
  region: { lat: 50, lon: 11, span: 15 },
  places: {
    A: { lat: 51.3, lon: 6.8 },
    B: { lat: 48.6, lon: 4.1 },
    C: { lat: 45.6, lon: 9.4 },
    D: { lat: 52.3, lon: 13.1 },
    E: { lat: 50.2, lon: 18.8 },
    F: { lat: 47.3, lon: 15.2 },
    G: { lat: 53.4, lon: 9.9, certainty: 0.2 },
    H: { lat: 46.4, lon: 13.0 },
    I: { lat: 43.7, lon: 4.6 },
    J: { lat: 48.9, lon: 21.5 },
    K: { lat: 55.6, lon: 12.4, certainty: 0.3 },
    S1: { lat: 41.6, lon: -0.9 },
    S2: { lat: 44.2, lon: 26.1 },
    P1: { lat: 52.1, lon: 4.4 },
    K1: { lat: 59.4, lon: 17.9 },
    K2: { lat: 51.6, lon: -0.2 },
  },
}
