-- PostGIS-backed source comparison and harmonisation layer.
--
-- This complements, and does not replace, the existing substantive
-- periodization. It separates source availability from territorial change,
-- compares only like-for-like cumulative Russian-control geometries, and
-- splits DeepState's overloaded `liberated` class at the international border.

CREATE SCHEMA IF NOT EXISTS territory_harmonisation;

CREATE OR REPLACE VIEW territory_harmonisation.source_observations AS
SELECT
  'deepstate'::text AS source,
  s.snapshot_date AS observation_date,
  'ukraine_kursk_mixed'::text AS theatre,
  'snapshot'::text AS observation_type,
  s.source_id::text AS source_observation_id,
  NULL::text AS source_filename,
  s.fetched_at AS ingested_at,
  s.feature_count,
  'provider_snapshot_id'::text AS date_provenance,
  'high'::text AS provenance_confidence,
  jsonb_build_object(
    'provider', 'DeepStateMap',
    'source_id', s.source_id,
    'geometry_semantics', 'provider control-status snapshot; liberated requires border split'
  ) AS provenance
FROM deepstate_v2.snapshots s
UNION ALL
SELECT
  'isw'::text,
  sm.layer_date,
  sm.conflict::text,
  sm.layer_type,
  sm.id::text,
  sm.filename,
  sm.imported_at AT TIME ZONE 'UTC',
  sm.record_count,
  sm.date_provenance,
  CASE
    WHEN sm.date_provenance IN ('filename_explicit', 'message_subject_explicit')
         AND NOT EXISTS (
           SELECT 1 FROM isw.data_quality_flags dq
           WHERE dq.metadata_id = sm.id AND dq.exclude_from_analysis
         ) THEN 'high'
    WHEN sm.date_provenance IN ('filename_explicit', 'message_subject_explicit') THEN 'medium'
    ELSE 'low'
  END,
  jsonb_build_object(
    'provider', 'ISW/CTP',
    'metadata_id', sm.id,
    'filename', sm.filename,
    'geometry_type', sm.geometry_type,
    'date_provenance', sm.date_provenance,
    'quality_excluded', EXISTS (
      SELECT 1 FROM isw.data_quality_flags dq
      WHERE dq.metadata_id = sm.id AND dq.exclude_from_analysis
    )
  )
FROM isw.shapefile_metadata sm;

DROP MATERIALIZED VIEW IF EXISTS territory_harmonisation.daily_geometry_comparison;
DROP TABLE IF EXISTS territory_harmonisation.deepstate_liberated_theatre_daily;
DROP MATERIALIZED VIEW IF EXISTS territory_harmonisation.isw_russian_control_daily;
DROP MATERIALIZED VIEW IF EXISTS territory_harmonisation.deepstate_russian_control_daily;

CREATE MATERIALIZED VIEW territory_harmonisation.deepstate_russian_control_daily AS
SELECT
  snapshot_date AS observation_date,
  ST_Multi(ST_CollectionExtract(
    ST_UnaryUnion(ST_Collect(ST_Force2D(ST_MakeValid(geom)))), 3
  ))::geometry(MultiPolygon, 4326) AS geom,
  COUNT(*) AS source_feature_count
FROM deepstate_v2.features
WHERE control_status IN ('occupied', 'occupied_pre_2022')
GROUP BY snapshot_date;

CREATE UNIQUE INDEX deepstate_russian_control_daily_date_uq
  ON territory_harmonisation.deepstate_russian_control_daily (observation_date);
CREATE INDEX deepstate_russian_control_daily_geom_gix
  ON territory_harmonisation.deepstate_russian_control_daily USING gist (geom);

CREATE MATERIALIZED VIEW territory_harmonisation.isw_russian_control_daily AS
SELECT
  sm.layer_date AS observation_date,
  ST_Multi(ST_CollectionExtract(
    ST_UnaryUnion(ST_Collect(ST_Force2D(ST_MakeValid(cp.geometry)))), 3
  ))::geometry(MultiPolygon, 4326) AS geom,
  COUNT(*) AS source_feature_count,
  array_agg(DISTINCT sm.id ORDER BY sm.id) AS metadata_ids,
  array_agg(DISTINCT sm.filename ORDER BY sm.filename) AS source_filenames
FROM isw.control_polygons cp
JOIN isw.shapefile_metadata sm ON sm.id = cp.metadata_id
WHERE sm.conflict = 'ukraine'
  AND sm.layer_type = 'ukraine_control_map'
  AND sm.date_provenance = 'filename_explicit'
  AND NOT EXISTS (
    SELECT 1 FROM isw.data_quality_flags dq
    WHERE dq.metadata_id = sm.id AND dq.exclude_from_analysis
  )
GROUP BY sm.layer_date;

CREATE UNIQUE INDEX isw_russian_control_daily_date_uq
  ON territory_harmonisation.isw_russian_control_daily (observation_date);
CREATE INDEX isw_russian_control_daily_geom_gix
  ON territory_harmonisation.isw_russian_control_daily USING gist (geom);

CREATE MATERIALIZED VIEW territory_harmonisation.daily_geometry_comparison AS
WITH paired AS (
  SELECT
    ds.observation_date,
    ds.geom AS deepstate_geom,
    iw.geom AS isw_geom,
    ST_Intersection(ds.geom, iw.geom) AS overlap_geom,
    ds.source_feature_count AS deepstate_feature_count,
    iw.source_feature_count AS isw_feature_count,
    iw.metadata_ids AS isw_metadata_ids,
    iw.source_filenames AS isw_source_filenames
  FROM territory_harmonisation.deepstate_russian_control_daily ds
  JOIN territory_harmonisation.isw_russian_control_daily iw USING (observation_date)
), measured AS (
  SELECT *,
    ST_Area(deepstate_geom::geography) / 1000000.0 AS deepstate_km2,
    ST_Area(isw_geom::geography) / 1000000.0 AS isw_km2,
    ST_Area(overlap_geom::geography) / 1000000.0 AS overlap_km2,
    ST_Area(ST_Difference(deepstate_geom, isw_geom)::geography) / 1000000.0 AS deepstate_only_km2,
    ST_Area(ST_Difference(isw_geom, deepstate_geom)::geography) / 1000000.0 AS isw_only_km2,
    ST_Area(ST_Union(deepstate_geom, isw_geom)::geography) / 1000000.0 AS union_km2
  FROM paired
)
SELECT
  observation_date,
  deepstate_km2,
  isw_km2,
  overlap_km2,
  deepstate_only_km2,
  isw_only_km2,
  overlap_km2 / NULLIF(union_km2, 0) AS intersection_over_union,
  (deepstate_only_km2 + isw_only_km2) / NULLIF(union_km2, 0) AS disagreement_share,
  CASE
    WHEN overlap_km2 / NULLIF(union_km2, 0) >= 0.95 THEN 'high_agreement'
    WHEN overlap_km2 / NULLIF(union_km2, 0) >= 0.85 THEN 'moderate_agreement'
    ELSE 'low_agreement'
  END AS agreement_class,
  'high'::text AS comparison_confidence,
  deepstate_feature_count,
  isw_feature_count,
  isw_metadata_ids,
  isw_source_filenames
FROM measured;

CREATE UNIQUE INDEX daily_geometry_comparison_date_uq
  ON territory_harmonisation.daily_geometry_comparison (observation_date);

CREATE TABLE territory_harmonisation.deepstate_liberated_theatre_daily (
  observation_date date PRIMARY KEY,
  liberated_inside_ukraine_km2 double precision NOT NULL,
  ukrainian_held_inside_kursk_km2 double precision NOT NULL,
  outside_partition_km2 double precision NOT NULL,
  source_feature_count bigint NOT NULL,
  separation_method text NOT NULL,
  boundary_confidence text NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE VIEW territory_harmonisation.daily_source_availability AS
WITH bounds AS (
  SELECT MIN(observation_date) AS min_date, MAX(observation_date) AS max_date
  FROM territory_harmonisation.source_observations
), calendar AS (
  SELECT generate_series(min_date, max_date, interval '1 day')::date AS observation_date
  FROM bounds
), availability AS (
  SELECT observation_date, source, theatre, observation_type, COUNT(*) AS observations
  FROM territory_harmonisation.source_observations
  GROUP BY 1, 2, 3, 4
)
SELECT
  c.observation_date,
  EXISTS (SELECT 1 FROM availability a WHERE a.observation_date=c.observation_date AND a.source='deepstate')
    AS deepstate_available,
  EXISTS (SELECT 1 FROM availability a WHERE a.observation_date=c.observation_date AND a.source='isw' AND a.theatre='ukraine' AND a.observation_type='ukraine_control_map')
    AS isw_ukraine_control_available,
  EXISTS (SELECT 1 FROM availability a WHERE a.observation_date=c.observation_date AND a.source='isw' AND a.theatre='ukraine' AND a.observation_type IN ('russian_advances','russian_claimed','russian_infiltration','ukrainian_counteroffensives'))
    AS isw_ukraine_change_available,
  EXISTS (SELECT 1 FROM availability a WHERE a.observation_date=c.observation_date AND a.source='isw' AND a.theatre='kursk')
    AS isw_kursk_available,
  EXISTS (SELECT 1 FROM territory_harmonisation.daily_geometry_comparison g WHERE g.observation_date=c.observation_date)
    AS like_for_like_comparison_available
FROM calendar c;

COMMENT ON SCHEMA territory_harmonisation IS
  'Source comparison layer complementing the existing periodization: availability, like-for-like geometry agreement, Ukraine/Kursk separation, confidence and provenance.';
