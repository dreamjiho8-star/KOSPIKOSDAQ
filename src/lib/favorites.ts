const STORAGE_KEY = "krx-favorites";

export interface Favorites {
  sectors: string[]; // sector codes
  stocks: string[];  // stock codes
}

export function getFavorites(): Favorites {
  if (typeof window === "undefined") return { sectors: [], stocks: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { sectors: [], stocks: [] };
    return JSON.parse(raw);
  } catch {
    return { sectors: [], stocks: [] };
  }
}

function saveFavorites(fav: Favorites) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(fav));
}

export function toggleFavoriteSector(code: string): Favorites {
  const fav = getFavorites();
  const idx = fav.sectors.indexOf(code);
  if (idx >= 0) fav.sectors.splice(idx, 1);
  else fav.sectors.push(code);
  saveFavorites(fav);
  return fav;
}

export function toggleFavoriteStock(code: string): Favorites {
  const fav = getFavorites();
  const idx = fav.stocks.indexOf(code);
  if (idx >= 0) fav.stocks.splice(idx, 1);
  else fav.stocks.push(code);
  saveFavorites(fav);
  return fav;
}

export function isFavoriteSector(code: string): boolean {
  return getFavorites().sectors.includes(code);
}

export function isFavoriteStock(code: string): boolean {
  return getFavorites().stocks.includes(code);
}
