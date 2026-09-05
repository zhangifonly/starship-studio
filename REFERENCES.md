# Starship Studio: Reference Register

Checked September 5-6, 2026. This is an independent visualization of the Starship
V3 / Block 3 design family, not an exact serial-number reconstruction or a
manufacturing model. SpaceX has not been established here to have released the
complete Starship design as open-source CAD.

## Current External Envelope

SpaceX, [Starship](https://www.spacex.com/vehicles/starship/), read from the rendered
official page. Values are the rounded nominal specifications SpaceX publishes:

| Parameter | Official value | Use in model |
| --- | --- | --- |
| Stack height | 124 m | Approximate vertical envelope |
| Ship height | 52 m | Upper-stage proportion |
| Booster height | 72 m | First-stage proportion |
| Diameter | 9 m | 0.45 world-unit radius; 1 unit = 10 m |
| Super Heavy engine count | 33 | 3 + 10 + 20 concentric layout |
| Fully reusable payload target | 100+ t | Overview specification only |
| Ship propellant capacity | 1,600 t | Reference only; no simulated capacity |
| Booster propellant capacity | 3,650 t | Reference only; no simulated capacity |

The model uses an approximate 124.4 m geometric tip coordinate, consistent with
the secondary Block 3 comparison, but UI dimensions use the official rounded
124/52/72 m figures. Shell seams, wall thickness, fin planforms, tank boundaries,
and accessory dimensions are illustrative. There is no claim of CAD tolerances.

## Original Internal Cross-Section Drawing

The following local reference files are excluded from the public Git repository.
A clean clone links to the FAA original instead; public availability and a
Commons listing are not treated as permission to redistribute proprietary CAD.

- [FAA original PDF](https://www.faa.gov/media/27236), downloaded locally as
  `public/references/faa-starship-reentry-2023.pdf` (122 pages).
- PDF page 39, Figure 2, "Starship internal cross section during terminal descent
  phase prior to impact", in "Methodology - Starship Orbital Test Flight Vehicle
  Impact Noise Analysis", revised March 2023, printed page 4.
- The full original page is also rendered locally in
  `public/references/faa-section-page39.png`.
- A legible figure excerpt was obtained from
  [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Starship_internal_structure.jpg)
  as `public/references/starship-internal-structure.jpg` and visually checked
  against the original PDF.
- The drawing guided the engine / LOX main tank / common dome / methane main tank /
  payload section ordering and the illustrative transfer line and header tanks.
- It depicts an early vehicle in a terminal-descent analysis, not the current V3.
  The colored areas in the source indicate residual propellants, not normal fill
  levels. The model's colored tank bodies indicate their contents, not fill level.
- Commons labels its excerpt public domain and credits FAA. However, the original
  page retains "U.S. Export Controlled. SpaceX Proprietary Information." and a
  proprietary notice. Public posting and the Commons label do not establish an
  open engineering license. The local original preserves that notice; no open
  license claim is made for the figure or underlying SpaceX design.

## V3 Design Changes

[SpaceX Starship, Block 3](https://en.wikipedia.org/wiki/SpaceX_Starship#Block_3)
is used as a secondary design summary: three grid fins, an integrated vented
interstage / forward dome, and Raptor 3 engines. The article cites NASASpaceflight's
[May 30, 2025 report](https://www.nasaspaceflight.com/2025/05/future-starship-block-3-mars/).
The linked report was not directly readable in this environment; those detailed
claims remain secondary-source references, not independently verified engineering
drawings. The model implements three grid fins and a grouped integrated
interstage; separating it in the viewer does not imply mechanical removability.

## FAA Future Design Envelope, Not Current V3 Dimensions

[April 2025 Final Tiered EA](https://www.faa.gov/media/94346), printed page 10,
Table 2. Upgraded vehicles in the environmental analysis have up to 70 m ship /
80 m booster and 9 / 35 engines. These are environmental assessment parameters,
not the dimensions of the currently shown V3 vehicle. They are deliberately not
used for this model's current exterior or engine counts.

## Model Limitations

### Launch Demonstration

The launch view reuses the same sourced exterior and illustrates the general
sequence of booster ignition, liftoff, pitch-over, hot staging, booster boostback,
descent and tower capture, plus ship coast, reentry, flip and ocean landing.
It is not a reconstruction of a named flight. The
166-second timeline, trajectory, altitude, attitude, lighting, thrust transitions,
and separation spacing are authored for visual explanation, not measured flight
data. The coastal pad, tower, support arms, tanks, clouds, and exhaust are
simplified scene context, not reference CAD. Controlled ocean landing is not
salvage or reuse, and ship tower capture is not depicted as a verified capability.
The coast is not a numerically simulated orbit. One compressed clock advances
both stages; the director camera switches subjects to show their separate paths.

Earth's surface comes from NASA Visible Earth's Blue Marble composite, resized
from 8192 to 4096 pixels. Cloud and specular textures are sourced from the Three.js
r159 examples. Exact URLs and processing are recorded in
`public/textures/README.md`. These are static composite maps, not live imagery.
The pad tangent frame is oriented to approximately 25.997 N, 97.155 W, but the
compressed path and splashdown point do not reconstruct actual flight geography.
The vehicle, Earth, flight distances and elapsed time do not share a physical
scale. Rendering detail should not be interpreted as measured flight accuracy.

### Structural Model

The model is authored in Three.js using lathed surfaces, cylinders, extruded fins,
individual engine assemblies, tank domes, and procedural heat-shield texture.
It is not an imported SpaceX CAD model. Texture hexagons do not represent a verified
tile count. Piping, internal hardware, grid geometry, nozzle wall profiles, weld
seams, payload supports, and individual fasteners are simplified or omitted.
Explosion spacing is for inspection, not a disassembly procedure.
# Raptor Detail References (2026-09-06)

- Public exterior photograph: https://commons.wikimedia.org/wiki/File:SpaceX_sea-level_Raptor_at_Hawthorne_-_2.jpg . Used for visual inspection of pump housings, flanges, plumbing and supports; an earlier engine, not Raptor 3 CAD. Photograph is not redistributed by the application.
- Cycle and version comparison: https://en.wikipedia.org/wiki/SpaceX_Raptor . Full-flow staged combustion uses fuel-rich and oxygen-rich preburners and separate pump systems.
- SpaceX Raptor 3 announcement: https://x.com/SpaceX/status/1819772716339339664 . Raptor 3 integrates components and reduces exposed ancillary hardware. The detailed viewer intentionally exposes functional systems, rather than claiming a serial-specific external reconstruction.
- `src/raptor-model.ts` is an educational reconstruction. Impeller blades, injector hole patterns, dimensions, wall thickness, actuator placement and pipe routing are illustrative. Sea-level/vacuum mode changes the nozzle expansion envelope, not a measured production variant.
