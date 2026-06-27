-- Migration: consolidate shared stops into canonical branch records.
-- Run once in the Supabase SQL Editor.
-- Safe to run multiple times (upsert + delete are idempotent).

-- For each shared stop we:
--   1. Merge all branch records into the canonical branch (OR visited, take most-recent restaurant).
--   2. Delete all non-canonical records.
--   3. Do the same for stop_reviews.

DO $$
DECLARE
  stops text[]  := ARRAY['park-street','downtown-crossing','state','government-center','haymarket','north-station','east-somerville'];
  canonicals text[] := ARRAY['red-trunk',  'red-trunk',         'orange-main','blue-main',        'orange-main','orange-main',   'green-b'];
  i int;
  sid text;
  cbranch text;
BEGIN
  FOR i IN 1..array_length(stops, 1) LOOP
    sid     := stops[i];
    cbranch := canonicals[i];

    -- Merge all picks records for this stop into the canonical branch
    INSERT INTO stop_picks (
      branch_id, stop_id, visited,
      restaurant_place_id, restaurant_name, restaurant_address, restaurant_rating,
      visit_photo_url, updated_at
    )
    SELECT
      cbranch, sid,
      bool_or(visited),
      (array_agg(restaurant_place_id ORDER BY updated_at DESC NULLS LAST)
         FILTER (WHERE restaurant_place_id IS NOT NULL))[1],
      (array_agg(restaurant_name       ORDER BY updated_at DESC NULLS LAST)
         FILTER (WHERE restaurant_name       IS NOT NULL))[1],
      (array_agg(restaurant_address    ORDER BY updated_at DESC NULLS LAST)
         FILTER (WHERE restaurant_address    IS NOT NULL))[1],
      (array_agg(restaurant_rating     ORDER BY updated_at DESC NULLS LAST)
         FILTER (WHERE restaurant_rating     IS NOT NULL))[1],
      (array_agg(visit_photo_url       ORDER BY updated_at DESC NULLS LAST)
         FILTER (WHERE visit_photo_url       IS NOT NULL))[1],
      now()
    FROM stop_picks
    WHERE stop_id = sid
    GROUP BY sid
    HAVING count(*) > 0
    ON CONFLICT (branch_id, stop_id) DO UPDATE SET
      visited             = EXCLUDED.visited,
      restaurant_place_id = COALESCE(EXCLUDED.restaurant_place_id, stop_picks.restaurant_place_id),
      restaurant_name     = COALESCE(EXCLUDED.restaurant_name,     stop_picks.restaurant_name),
      restaurant_address  = COALESCE(EXCLUDED.restaurant_address,  stop_picks.restaurant_address),
      restaurant_rating   = COALESCE(EXCLUDED.restaurant_rating,   stop_picks.restaurant_rating),
      visit_photo_url     = COALESCE(EXCLUDED.visit_photo_url,     stop_picks.visit_photo_url),
      updated_at          = now();

    DELETE FROM stop_picks
    WHERE stop_id = sid AND branch_id <> cbranch;

    -- Merge reviews into canonical branch (most recent per reviewer)
    INSERT INTO stop_reviews (branch_id, stop_id, reviewer, rating, review, updated_at)
    SELECT DISTINCT ON (reviewer)
      cbranch, sid, reviewer, rating, review, now()
    FROM stop_reviews
    WHERE stop_id = sid
    ORDER BY reviewer, updated_at DESC
    ON CONFLICT (branch_id, stop_id, reviewer) DO UPDATE SET
      rating     = EXCLUDED.rating,
      review     = EXCLUDED.review,
      updated_at = now();

    DELETE FROM stop_reviews
    WHERE stop_id = sid AND branch_id <> cbranch;

  END LOOP;
END $$;
