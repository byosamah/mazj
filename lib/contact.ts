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

/** MAZJ's exact Google Maps listing (Life Tower, Al-Olaya, Al-Khobar). */
export const MAPS_URL =
  "https://www.google.com/maps/place/MAZJ/@26.302126,50.1744241,17z/data=!3m1!4b1!4m6!3m5!1s0x3e49e7e96770490b:0x301a83f295e48c10!8m2!3d26.302126!4d50.176999";
