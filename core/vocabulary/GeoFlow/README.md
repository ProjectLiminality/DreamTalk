# GeoFlow

![GeoFlow](GeoFlow.png)

An organisation where it is and as what it is, with one param between the two. Any FlowMap whose members and partners carry a lat/lon lives on the Earth at `view` 0 and is the abstract FlowMap at `view` 1.

**At the globe:**
- The group's own place is a Headquarters, each geolocated member is a Factory, and each geolocated partner is a ring on the ground.
- Every member reports home along a great-circle arc.
- The data's flows run between their places as traffic: the Earth's particle Connections, one per flow, with volume set by rate and colour by stage.

**Between, the same transition both ways:**
1. The eye pulls back.
2. The arcs morph (MorphCurves) into one circle, the group, and the map's own rim takes over from it.
3. Each member lifts off its place as a ring and glides to its seat, starting from where its site is seen on the abstract plane.
4. The planet dims, its buildings sink, and the globe's traffic hands over to the map's own flows.
5. The planet goes, and the partners appear round the group.

`?scene=geoflow` (mock data). In free play, **v** walks globe ↔ abstract.

## API

```ts
geo = new GeoFlow({ data: myFlowMapData, geo: { group, region, places }, seenBy: () => this.observer })
// a song's beats: landIn, descent (→ geo.regionZoom()), rise, relate, traffic, then view; time is the clock
this.play(geo.view.to(1, { easing: "linear" }), 6.6)
```

`geo.places` maps member and partner ids to `{ lat, lon, certainty? }`. Any id may be missing; it then has no place and simply draws in with the map. A place given `certainty < 1` is a guess, ghosted on the way to its seat until it is seated. GeoFlow flies the scene's camera (EarthView + `followEarth`, with the lens set to `fov`), so give it the observer and animate GeoFlow, not the camera. It exposes `earth`, `eye`, `map`, `sites`, `links`, `traffics`, `relations` and `travelers` for a song that wants to reach further (`geo.map.grain`, `geo.map.stage("semi").shown`, …).

**Hooks for a song's own pieces:**
- `geo.inPlane(holon)` adds anything to the abstract plane, in the map's own units (a lens on a flow, a mark round a seat).
- `geo.seat(id)` returns a member's or partner's seat in the circle.
- `viewExtras: [[param, atGlobe, atAbstract], …]` makes the **v** axis walk your params too.
- `GEOFLOW_WINDOWS` exposes the transition's windows, to time your own beats against them.
- `planeMembers: (geo) => holons` builds a song's plane pieces once GeoFlow is composed (they may read `geo.map`); the same as `inPlane` for each.
- `geo.eyeDistance()` is the eye's distance to the abstract plane in map units, which is constant because the plane is rescaled to keep the group at `fill`.

**Options for a song** (construction-time; all off by default):
- `stagger: 0.7` rises the headquarters over the first 30% of `rise` and then the sites one by one over the rest. `relateStagger: 0.5` draws the relation arcs in one after another over `relate`.
- `openFov` opens on a wider lens that narrows to `fov` as `descent` reaches `regionZoom()`, so the whole Earth fits wide and the region fits close.
- `ortho: true` hands the camera to an orthographic projection once the planet has gone, framed to match: the ortho half-height equals the perspective half-height at the plane, so the switch is invisible. Walking back to the globe restores perspective. `geo.orthoZoom()` is that matching zoom, for a lens of your own.

The technique was proved by a private DreamSong and consolidated here as a generic piece: nothing of that song's data travels with it. The mock geography (`mockGeo.ts`) places FlowMap's own mock organisation across Europe.
