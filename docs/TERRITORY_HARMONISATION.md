# Territorial source harmonisation

## Purpose

This layer complements the existing narrative periodization. It does not replace the periodization and it does not declare either DeepState or ISW to be ground truth. It adds four inspectable substrates:

1. daily source availability;
2. same-day, like-for-like geometry overlap and disagreement;
3. an international-boundary split of DeepState's overloaded `liberated` class into Ukraine and Kursk observations;
4. observation-level confidence and provenance.

## PostGIS contract

The migration is [`pipeline/sql/territory_harmonisation.sql`](../pipeline/sql/territory_harmonisation.sql). It creates the `territory_harmonisation` schema with:

- `source_observations`: one provenance-bearing row per DeepState snapshot or ISW archive;
- `daily_source_availability`: independent availability flags for DeepState, ISW cumulative Ukraine control, ISW Ukraine change layers, ISW Kursk layers, and like-for-like comparisons;
- `deepstate_russian_control_daily`: cumulative DeepState `occupied + occupied_pre_2022` geometry;
- `isw_russian_control_daily`: cumulative ISW `ukraine_control_map` geometry;
- `daily_geometry_comparison`: overlap, source-only area, intersection-over-union, disagreement share, agreement class, and comparison confidence;
- `deepstate_liberated_theatre_daily`: a resumable daily table. Each date uses an exact union of that day's `liberated` features and intersects it separately with Ukraine and Kursk Oblast. Each date commits independently, so a failed backfill resumes from its missing-date skip-set instead of rebuilding 1,510 days.

The geometry comparison is deliberately narrow. Daily ISW advance, claim, infiltration, and counteroffensive layers are not compared to cumulative control snapshots as though they represented the same quantity.

## Metadata integrity

[`pipeline/scripts/repair_isw_metadata.py`](../pipeline/scripts/repair_isw_metadata.py) audits filename-evidenced source dates, theatres, and layer types. Its default mode is read-only; `--apply` writes every mutation to `isw.metadata_correction_audit`. Dates that cannot be determined from the filename remain `legacy_unverified`. One malformed filename (`...DEC060205`) was resolved as 2025-12-06 from its authorized download-ledger subject, `ISW-CTP Daily Shapefiles (Ukraine) - December 6, 2025`, and is marked `message_subject_explicit`. Import/archive modification time is prohibited as a substitute for source observation time.

The recurring importer uses the same parser and now rejects an archive with an unparseable source date. Regression tests cover full month names without whitespace after commas, date ranges, AO `MMDDYYYY`, Palestine-versus-Ukraine infiltration, target-theatre precedence, Kursk precedence, and malformed years.

## Delivery surfaces

[`pipeline/scripts/gen_territory_harmonisation.py`](../pipeline/scripts/gen_territory_harmonisation.py) exports `public/data/territory_harmonisation.json`. The Red Lines war-datasets dashboard renders that feed in **Gains/Losses → Territory**. The Maneuver Warfare PM reads the same generated artifact and reports daily source availability, the latest comparison, Kursk split, provenance coverage, and residual interpretive boundary.

[`pipeline/scripts/refresh_territory_harmonisation.py`](../pipeline/scripts/refresh_territory_harmonisation.py) owns unattended refreshes. It uses an exclusive lock, atomic state and heartbeat documents, a measured source high-water, independently committed stages, restart-stage skipping, and final row/date validation. The VPS materialization job runs this supervisor before regenerating the JSON.

## Measured acceptance state

Measured on 2026-08-14 against the live `war_datasets` PostGIS database:

- 10,833 ISW metadata rows; 10,810 filename-explicit dates, one authorized-message-subject date, 22 visibly unverified dates, and zero dates outside 2020-01-01 through 2026-08-14;
- 1,655 calendar dates in the availability ledger, including 1,510 DeepState dates, 929 ISW control dates, 931 ISW change dates, and 421 ISW Kursk dates;
- 904 exact-date cumulative-control comparisons from 2023-11-23 through 2026-08-13;
- latest comparison: 113,020.58 km² overlap, 3,936.30 km² DeepState-only, 146.11 km² ISW-only, and 96.5138% intersection-over-union;
- peak Ukrainian-held geometry inside Kursk: 905.56 km² on 2024-09-06; latest measured value: 5.04 km² on 2026-08-13;
- VPS orchestrator state `healthy`, with all four stages at the 2026-08-13 source high-water.

The dashboard and PM were rendered from their production builds and visually inspected at 1280, 1366, 1440, and 1600 pixels. The deployed dashboard bundle and PM page were independently hash-matched to their local accepted artifacts.

## Interpretation boundary

- High spatial agreement means two source geometries substantially overlap on the same date; it does not prove either boundary is locally correct.
- Low agreement can arise from timing, editorial semantics, geometry precision, or true source disagreement. Local inspection is required before attributing it to battlefield movement.
- The Ukraine/Kursk split repairs a category conflation. It does not infer operational intent or assign a direction label.
- Source gaps remain gaps. The harmonisation layer makes them visible rather than interpolating them away.
