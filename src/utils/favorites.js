/**
 * My Locations & Favorites Persistence Utility for BreatheWise
 *
 * Manages user's saved favorite stations using localStorage with defensive
 * validation to protect against corrupted or out-of-date station records.
 */

import { SUPPORTED_STATIONS, getStationById } from '../config/stations.js';

export const FAVORITES_STORAGE_KEY = 'breathewise_favourite_stations';

/**
 * Loads and validates saved station IDs from localStorage.
 * Filters out invalid IDs or non-existent stations.
 *
 * @returns {Array<number>} List of validated favorite station IDs
 */
export function loadFavourites() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // Filter and sanitize: must be numbers and exist in SUPPORTED_STATIONS
    const validIds = parsed
      .map(id => Number(id))
      .filter(id => Number.isInteger(id) && id > 0)
      .filter(id => SUPPORTED_STATIONS.some(s => s.id === id));

    // Deduplicate
    return Array.from(new Set(validIds));
  } catch {
    return [];
  }
}

/**
 * Persists a list of station IDs to localStorage.
 *
 * @param {Array<number>} stationIds
 * @returns {boolean} Success status
 */
export function saveFavourites(stationIds) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false;
  }

  try {
    const sanitized = (Array.isArray(stationIds) ? stationIds : [])
      .map(id => Number(id))
      .filter(id => SUPPORTED_STATIONS.some(s => s.id === id));

    const unique = Array.from(new Set(sanitized));
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(unique));
    return true;
  } catch {
    return false;
  }
}

/**
 * Toggles a station ID into or out of the favorites list.
 *
 * @param {number} stationId
 * @param {Array<number>} currentList
 * @returns {Array<number>} New updated list
 */
export function toggleFavourite(stationId, currentList = []) {
  const numId = Number(stationId);
  const exists = currentList.includes(numId);
  let updated;

  if (exists) {
    updated = currentList.filter(id => id !== numId);
  } else {
    // Verify station exists before adding
    const station = getStationById(numId);
    if (station && station.id === numId) {
      updated = [...currentList, numId];
    } else {
      updated = [...currentList];
    }
  }

  saveFavourites(updated);
  return updated;
}

/**
 * Checks whether a station is currently saved in favorites.
 *
 * @param {number} stationId
 * @param {Array<number>} currentList
 * @returns {boolean}
 */
export function isFavourite(stationId, currentList = []) {
  return currentList.includes(Number(stationId));
}
