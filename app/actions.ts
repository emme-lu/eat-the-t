"use server";

import { revalidatePath } from "next/cache";
import { getSupabase } from "@/lib/supabase-server";

export type Restaurant = {
  place_id: string;
  name: string;
  address: string | null;
  rating: number | null;
};

export type Review = {
  reviewer: "Emme" | "John";
  rating: number;
  review: string | null;
};

export type StopData = {
  restaurant: Restaurant | null;
  visited: boolean;
  visitPhotoUrl: string | null;
  reviews: Review[];
};

type PlacesResult = {
  place_id: string;
  name: string;
  formatted_address?: string;
  rating?: number;
};

type PlacesResponse = {
  results: PlacesResult[];
  status: string;
};

async function fetchPlaces(query: string): Promise<PlacesResult[]> {
  const params = new URLSearchParams({
    query,
    type: "restaurant",
    key: process.env.GOOGLE_PLACES_API_KEY!,
  });
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`,
    { cache: "no-store" }
  );
  const data: PlacesResponse = await res.json();
  return data.results ?? [];
}

function toRestaurant(r: PlacesResult): Restaurant {
  return {
    place_id: r.place_id,
    name: r.name,
    address: r.formatted_address ?? null,
    rating: r.rating ?? null,
  };
}

export async function getAllPicks(): Promise<Map<string, StopData>> {
  const db = getSupabase();
  const [picksResult, reviewsResult] = await Promise.all([
    db
      .from("stop_picks")
      .select(
        "branch_id, stop_id, restaurant_place_id, restaurant_name, restaurant_address, restaurant_rating, visited, visit_photo_url"
      ),
    db
      .from("stop_reviews")
      .select("branch_id, stop_id, reviewer, rating, review"),
  ]);

  if (picksResult.error) {
    console.error("Supabase getAllPicks error:", picksResult.error.message);
    return new Map();
  }

  // Build reviews map keyed by "branchId:stopId"
  const reviewsMap = new Map<string, Review[]>();
  if (!reviewsResult.error) {
    for (const row of reviewsResult.data ?? []) {
      const key = `${row.branch_id}:${row.stop_id}`;
      const arr = reviewsMap.get(key) ?? [];
      arr.push({
        reviewer: row.reviewer as "Emme" | "John",
        rating: row.rating,
        review: row.review ?? null,
      });
      reviewsMap.set(key, arr);
    }
  } else {
    // Table may not exist yet — reviews just show empty
    console.error("Supabase getReviews error:", reviewsResult.error.message);
  }

  const map = new Map<string, StopData>();
  for (const row of picksResult.data ?? []) {
    const key = `${row.branch_id}:${row.stop_id}`;
    const restaurant =
      row.restaurant_name != null
        ? {
            place_id: row.restaurant_place_id,
            name: row.restaurant_name,
            address: row.restaurant_address,
            rating: row.restaurant_rating,
          }
        : null;
    map.set(key, {
      restaurant,
      visited: row.visited,
      visitPhotoUrl: row.visit_photo_url ?? null,
      reviews: reviewsMap.get(key) ?? [],
    });
  }
  return map;
}

export async function getSuggestion(
  stopName: string,
  lineName: string
): Promise<Restaurant | null> {
  const results = await fetchPlaces(
    `restaurants near ${stopName} ${lineName} MBTA Boston MA`
  );
  return results[0] ? toRestaurant(results[0]) : null;
}

export async function searchRestaurants(
  query: string,
  stopName: string
): Promise<Restaurant[]> {
  const results = await fetchPlaces(
    `${query} near ${stopName} MBTA Boston MA`
  );
  return results.slice(0, 5).map(toRestaurant);
}

export async function savePick(
  branchId: string,
  stopId: string,
  restaurant: Restaurant
): Promise<void> {
  const { error } = await getSupabase().from("stop_picks").upsert(
    {
      branch_id: branchId,
      stop_id: stopId,
      restaurant_place_id: restaurant.place_id,
      restaurant_name: restaurant.name,
      restaurant_address: restaurant.address,
      restaurant_rating: restaurant.rating,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "branch_id,stop_id" }
  );
  if (error) throw error;
  revalidatePath("/");
}

export async function toggleVisited(
  branchId: string,
  stopId: string,
  currentVisited: boolean
): Promise<void> {
  const newVisited = !currentVisited;
  const { error } = await getSupabase().from("stop_picks").upsert(
    {
      branch_id: branchId,
      stop_id: stopId,
      visited: newVisited,
      visited_at: newVisited ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "branch_id,stop_id" }
  );
  if (error) throw error;
  revalidatePath("/");
}

export async function savePhotoUrl(
  branchId: string,
  stopId: string,
  photoUrl: string
): Promise<void> {
  const { error } = await getSupabase().from("stop_picks").upsert(
    {
      branch_id: branchId,
      stop_id: stopId,
      visit_photo_url: photoUrl,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "branch_id,stop_id" }
  );
  if (error) throw error;
  revalidatePath("/");
}

export async function saveReview(
  branchId: string,
  stopId: string,
  reviewer: "Emme" | "John",
  rating: number,
  reviewText: string | null
): Promise<void> {
  const { error } = await getSupabase().from("stop_reviews").upsert(
    {
      branch_id: branchId,
      stop_id: stopId,
      reviewer,
      rating,
      review: reviewText,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "branch_id,stop_id,reviewer" }
  );
  if (error) throw error;
  revalidatePath("/");
}
