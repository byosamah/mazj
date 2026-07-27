/**
 * Shared contact + location config for MAZJ.
 * Keep the real WhatsApp line and the Google Maps pin here so every CTA across
 * the site points at the same place (the sitewide "Book a tour on WhatsApp"
 * primary action reuses this in the next batch).
 */

/** MAZJ's WhatsApp Business line, digits only (no "+") for wa.me. */
export const WHATSAPP_NUMBER = "966534600488";

/** Click-to-chat WhatsApp link with a localized, prefilled message. */
export function waLink(message: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

/**
 * MAZJ's Google Maps listing (Life Tower, Al-Olaya, Al-Khobar). This is the
 * owner's own "Share" link, so the "Get directions" card (LocationHours) and
 * the JSON-LD `hasMap` (lib/schema.ts) both open the exact pin the owner
 * shared. A previous hand-built /maps/place URL dropped Google's place-entity
 * id (/g/11fn4f5r64), so it resolved to a bare-coordinate view instead of the
 * MAZJ listing — replaced with the share link to guarantee the right place.
 */
export const MAPS_URL = "https://maps.app.goo.gl/NmPodnzY1E8iQ9uU8";
