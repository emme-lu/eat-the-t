"use client";

import { useState, useTransition } from "react";
import {
  getSuggestion,
  searchRestaurants,
  savePick,
  toggleVisited,
  savePhotoUrl,
  saveReview,
  type Restaurant,
  type StopData,
  type Review,
} from "@/app/actions";
import { supabase } from "@/lib/supabase";

type Reviewer = "Emme" | "John";

function Stars({ rating }: { rating: number }) {
  return (
    <span className="leading-none text-sm">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < rating ? "text-yellow-400" : "text-gray-200"}>
          ★
        </span>
      ))}
    </span>
  );
}

function StarPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          className={`text-xl leading-none transition-colors ${
            n <= (hovered || value) ? "text-yellow-400" : "text-gray-200"
          }`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

type Props = {
  branchId: string;
  stopId: string;
  stopName: string;
  lineName: string;
  initialData: StopData | null;
  onVisitedChange?: (visited: boolean) => void;
};

export function StopCard({
  branchId,
  stopId,
  stopName,
  lineName,
  initialData,
  onVisitedChange,
}: Props) {
  const [data, setData] = useState<StopData>(
    initialData ?? {
      restaurant: null,
      visited: false,
      visitPhotoUrl: null,
      reviews: [],
    }
  );
  const [mode, setMode] = useState<"idle" | "searching">("idle");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Restaurant[]>([]);
  const [isPending, startTransition] = useTransition();
  const [isUploading, setIsUploading] = useState(false);

  // Review state
  const [currentUser, setCurrentUser] = useState<Reviewer>("Emme");
  const [reviewFormOpen, setReviewFormOpen] = useState(false);
  const [draftRating, setDraftRating] = useState(0);
  const [draftText, setDraftText] = useState("");

  function handleSuggest() {
    startTransition(async () => {
      const suggestion = await getSuggestion(stopName, lineName);
      if (!suggestion) return;
      await savePick(branchId, stopId, suggestion);
      setData((d) => ({ ...d, restaurant: suggestion }));
    });
  }

  function handleSearch() {
    if (!searchQuery.trim()) return;
    startTransition(async () => {
      const results = await searchRestaurants(searchQuery, stopName);
      setSearchResults(results);
    });
  }

  function handleSelectRestaurant(restaurant: Restaurant) {
    startTransition(async () => {
      await savePick(branchId, stopId, restaurant);
      setData((d) => ({ ...d, restaurant }));
      setMode("idle");
      setSearchQuery("");
      setSearchResults([]);
    });
  }

  function handleToggleVisited() {
    const current = data.visited;
    setData((d) => ({ ...d, visited: !d.visited }));
    onVisitedChange?.(!current);
    startTransition(async () => {
      await toggleVisited(branchId, stopId, current);
    });
  }

  async function handlePhotoUpload(file: File) {
    setIsUploading(true);
    try {
      const path = `${branchId}/${stopId}`;
      const { error: uploadError } = await supabase.storage
        .from("visit-photos")
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("visit-photos").getPublicUrl(path);

      await savePhotoUrl(branchId, stopId, publicUrl);
      // Append cache-bust param so re-uploads display immediately
      setData((d) => ({ ...d, visitPhotoUrl: `${publicUrl}?t=${Date.now()}` }));
    } catch (err) {
      console.error("Photo upload failed:", err);
    } finally {
      setIsUploading(false);
    }
  }

  function openSearch() {
    setMode("searching");
    setSearchResults([]);
    setSearchQuery("");
  }

  function closeSearch() {
    setMode("idle");
    setSearchQuery("");
    setSearchResults([]);
  }

  function openReviewForm() {
    const existing = data.reviews.find((r) => r.reviewer === currentUser);
    setDraftRating(existing?.rating ?? 0);
    setDraftText(existing?.review ?? "");
    setReviewFormOpen(true);
  }

  function closeReviewForm() {
    setReviewFormOpen(false);
    setDraftRating(0);
    setDraftText("");
  }

  function handleSaveReview() {
    if (draftRating === 0) return;
    const reviewer = currentUser;
    const rating = draftRating;
    const reviewText = draftText.trim() || null;
    startTransition(async () => {
      await saveReview(branchId, stopId, reviewer, rating, reviewText);
      const newReview: Review = { reviewer, rating, review: reviewText };
      setData((d) => ({
        ...d,
        reviews: [
          ...d.reviews.filter((r) => r.reviewer !== reviewer),
          newReview,
        ].sort((a, b) => (a.reviewer < b.reviewer ? -1 : 1)),
      }));
      closeReviewForm();
    });
  }

  const { restaurant, visited, visitPhotoUrl, reviews } = data;
  const currentUserReview = reviews.find((r) => r.reviewer === currentUser);

  return (
    <div
      className={`rounded-lg border p-3 text-sm transition-colors ${
        visited ? "bg-green-50 border-green-200" : "bg-white border-gray-200"
      }`}
    >
      {/* Stop header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="font-medium text-gray-900 leading-snug">
          {stopName}
        </span>
        <button
          onClick={handleToggleVisited}
          className={`shrink-0 text-xs px-2 py-0.5 rounded-full border font-medium transition-colors ${
            visited
              ? "bg-green-100 border-green-300 text-green-700"
              : "bg-white border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600"
          }`}
        >
          {visited ? "Visited" : "Not visited"}
        </button>
      </div>

      {/* Restaurant display */}
      {restaurant && mode === "idle" && (
        <div>
          <p className="font-medium text-gray-800 text-xs">{restaurant.name}</p>
          <p className="text-gray-400 text-xs mt-0.5 leading-snug">
            {restaurant.address}
            {restaurant.rating != null ? ` · ★ ${restaurant.rating}` : ""}
          </p>
          <button
            onClick={openSearch}
            className="mt-1 text-xs text-blue-500 hover:text-blue-700"
          >
            Change
          </button>
        </div>
      )}

      {/* Suggest button (no pick yet) */}
      {!restaurant && mode === "idle" && (
        <div className="flex gap-2">
          <button
            onClick={handleSuggest}
            disabled={isPending}
            className="text-xs px-2.5 py-1 rounded border border-dashed border-gray-300 text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            {isPending ? "Finding…" : "Suggest"}
          </button>
          <button
            onClick={openSearch}
            className="text-xs px-2.5 py-1 rounded border border-dashed border-gray-300 text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors"
          >
            Search
          </button>
        </div>
      )}

      {/* Search mode */}
      {mode === "searching" && (
        <div className="space-y-1.5">
          <div className="flex gap-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder={`Search near ${stopName}…`}
              className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 outline-none focus:border-blue-400 min-w-0"
              autoFocus
            />
            <button
              onClick={handleSearch}
              disabled={isPending}
              className="text-xs px-2.5 py-1.5 bg-gray-900 text-white rounded hover:bg-gray-700 transition-colors disabled:opacity-50 shrink-0"
            >
              Go
            </button>
            <button
              onClick={closeSearch}
              className="text-xs px-2 py-1.5 text-gray-400 hover:text-gray-600 shrink-0"
            >
              ✕
            </button>
          </div>
          {isPending && searchResults.length === 0 && (
            <p className="text-xs text-gray-400">Searching…</p>
          )}
          {searchResults.length > 0 && (
            <ul className="space-y-0.5">
              {searchResults.map((r) => (
                <li key={r.place_id}>
                  <button
                    onClick={() => handleSelectRestaurant(r)}
                    className="w-full text-left px-2 py-1.5 rounded hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-colors"
                  >
                    <span className="text-xs font-medium text-gray-800">
                      {r.name}
                    </span>
                    {r.rating != null && (
                      <span className="text-xs text-gray-400 ml-1">
                        · ★ {r.rating}
                      </span>
                    )}
                    {r.address && (
                      <>
                        <br />
                        <span className="text-xs text-gray-400">
                          {r.address}
                        </span>
                      </>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Visited extras: photo + reviews */}
      {visited && mode === "idle" && (
        <div className="mt-2 pt-2 border-t border-green-100 space-y-3">
          {/* Photo */}
          <div>
            {visitPhotoUrl ? (
              <>
                <img
                  src={visitPhotoUrl}
                  alt={`Visit photo at ${stopName}`}
                  className="w-full h-32 object-cover rounded-md mb-1.5"
                />
                <label
                  className={`text-xs cursor-pointer ${
                    isUploading
                      ? "text-gray-300 pointer-events-none"
                      : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  {isUploading ? "Uploading…" : "Change photo"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={isUploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handlePhotoUpload(file);
                      e.target.value = "";
                    }}
                  />
                </label>
              </>
            ) : (
              <label
                className={`text-xs cursor-pointer ${
                  isUploading
                    ? "text-gray-300 pointer-events-none"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                {isUploading ? "Uploading…" : "+ Add photo"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={isUploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handlePhotoUpload(file);
                    e.target.value = "";
                  }}
                />
              </label>
            )}
          </div>

          {/* Reviews */}
          <div className="space-y-2">
            {/* Reviewer identity toggle */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400">You are:</span>
              {(["Emme", "John"] as Reviewer[]).map((name) => (
                <button
                  key={name}
                  onClick={() => {
                    setCurrentUser(name);
                    setReviewFormOpen(false);
                  }}
                  className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                    currentUser === name
                      ? "bg-gray-800 border-gray-800 text-white"
                      : "border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600"
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>

            {/* Submitted reviews */}
            {reviews.map((r) => (
              <div key={r.reviewer}>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-gray-700">
                    {r.reviewer}
                  </span>
                  <Stars rating={r.rating} />
                  {r.reviewer === currentUser && !reviewFormOpen && (
                    <button
                      onClick={openReviewForm}
                      className="ml-auto text-xs text-blue-500 hover:text-blue-700"
                    >
                      Edit
                    </button>
                  )}
                </div>
                {r.review && (
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                    "{r.review}"
                  </p>
                )}
              </div>
            ))}

            {/* Add review prompt */}
            {!reviewFormOpen && !currentUserReview && (
              <button
                onClick={openReviewForm}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                + Add your review as {currentUser}
              </button>
            )}

            {/* Review form */}
            {reviewFormOpen && (
              <div className="space-y-2 pt-0.5">
                <p className="text-xs font-medium text-gray-600">
                  {currentUser}'s review
                </p>
                <StarPicker value={draftRating} onChange={setDraftRating} />
                <textarea
                  value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
                  placeholder="Write a review (optional)…"
                  rows={2}
                  className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 outline-none focus:border-blue-400 resize-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveReview}
                    disabled={draftRating === 0 || isPending}
                    className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-40 transition-colors"
                  >
                    {isPending ? "Saving…" : "Save"}
                  </button>
                  <button
                    onClick={closeReviewForm}
                    className="text-xs px-2 py-1.5 text-gray-400 hover:text-gray-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
