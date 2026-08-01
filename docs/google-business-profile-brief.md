# Google Business Profile — optimization brief (MAZJ)

**Why this is the priority.** MAZJ is a single-location business, and for a single location the Google Business Profile (GBP) is the highest-leverage surface in existence. It feeds the Google local pack, Google Maps, and the local-answer path of every AI engine (AI Overviews, ChatGPT search, Perplexity, Copilot) simultaneously, and it is the one surface MAZJ fully controls. An adversarially-verified market scan found MAZJ absent from all six generic English buyer queries — the marketing site does not enter that race. The GBP does.

It is also the **upstream fix for the wrong rating.** Third-party directories (coworkingspaces.me, houseofsaud.com) are publishing a stale "5.0" scraped from the Google Places API against a live 4.7. Correcting the GBP is what eventually corrects them; editing their pages one by one is whack-a-mole.

> Everything below is a task for whoever administers the GBP (a human with owner/manager access at business.google.com). None of it is a code change. Facts are pulled from `lib/contact.ts`, `lib/links.ts`, and `messages/*.json` so they match the website exactly — **NAP consistency across every property is itself a ranking factor**, so use these strings verbatim.

---

## The canonical facts (use these exact strings everywhere)

| Field | Value |
|---|---|
| Name | **MAZJ** (English) / **مزج** (Arabic) |
| Address (EN) | Life Tower, Zaid Ibn Alkhattab St, Al-Olaya, Al-Khobar |
| Address (AR) | برج الحياة، شارع زيد بن الخطاب، العليا، الخُبر |
| Region / country | Eastern Province, Saudi Arabia |
| Geo pin | 26.302126, 50.176999 (must match the Maps pin exactly) |
| Staffed hours | Sunday–Thursday, 09:00–**17:00** (corrected 2026-07-31; this brief said 21:00 and that was never right) |
| Subscriber access | 24/7 by QR code or access card, for space subscribers (state in description, **not** as opening hours) |
| Phone (WhatsApp) | +966 53 460 0488 |
| VAT (ZATCA) | 310240548700003 |
| Booking / prices | mazj.sa (live prices live there — never post a price on the GBP) |
| Instagram | @mazjorg |

⚠️ **Rating reality:** the real Google rating is **4.7** off a handful of reviews. Do NOT let any "5.0" claim stand anywhere. A hardcoded 5.0 was a real shipped bug on the site and is now propagating off-site; the GBP is where it gets corrected at the source.

---

## 1. Categories

- **Primary:** `Coworking space` — this is the category the head query resolves against.
- **Secondary (add all that apply):**
  - `Meeting room` / `Conference center` (for Al-Malqa hourly-room intent)
  - `Event venue` (for Al-Ma'arij, the 30-person hall)
  - `Office space rental agency` (for the private-office intent)

Secondary categories are how one listing shows up for four different intents. Add them.

## 2. Name and description

- **Name:** `MAZJ` only. Do **not** keyword-stuff it to `MAZJ Coworking Space Al-Khobar` — that violates Google's naming guidelines and risks suspension. The category carries the keyword, not the name.
- **Description (750 chars, bilingual):** write the Arabic **natively**, not as a translation of the English. Lead with what + where, name the four spaces and the two rooms, state staffed hours and 24/7 subscriber access. Draft:

  > **EN:** MAZJ is a coworking space in Al-Khobar's Life Tower (Al-Olaya), for the Eastern Province's founders, freelancers and teams. Open desks in the shared space, private offices, the Al-Malqa meeting room (up to 6, by the hour) and the Al-Ma'arij events hall (up to 30). Free drinks, fast Wi-Fi, staffed Sunday–Thursday 9am–5pm, with 24/7 access for space subscribers. Book any space on mazj.sa.

  > **AR:** مزج مساحة عمل مشتركة في برج الحياة بالخُبر (حي العليا)، لروّاد الأعمال والمستقلّين والفرق في المنطقة الشرقية. مكاتب مرنة في المساحة المشتركة، ومكاتب خاصة، وغرفة اجتماعات الملقى (حتى 6، بالساعة)، وقاعة فعاليات المعارج (حتى 30). مشروبات مجانية وإنترنت سريع، بحضور من الأحد إلى الخميس 9 صباحاً–5 مساءً، ودخول على مدار الساعة لمشتركي المساحة. احجز أي مساحة عبر mazj.sa.

## 3. Hours

- Set regular hours to **Sunday–Thursday, 09:00–17:00**. Leave Friday/Saturday as set by ops.
- 🔴 **This brief said 21:00 until 2026-07-31 and the site said the same thing.** The team is in the space 9 to 5. If the listing was already published with the old figure, fixing it here is not enough: change it on the live profile too, because a wrong closing time on Google sends a walk-in to a locked door.
- Put "24/7 access for space subscribers" in the **description**, never as opening hours: marking the listing "Open 24 hours" would mislead a walk-in during unstaffed hours and is factually wrong for a day-pass visitor.
- ⚠️ **Never write "fingerprint" or "biometric" here.** Access is a QR code or an access card. This brief said fingerprint until 2026-07-31, three months after the word was stripped site-wide, because biometric data is PDPL-sensitive and implies a controller registration MAZJ avoids.

## 4. Products (link each to its real booking URL)

Add all four as GBP Products. No prices on the GBP; the button/link goes to the live store where the price and checkout are:

| Product | Link (`lib/links.ts` → `BOOKING`) |
|---|---|
| Open desk (shared seat) | https://mazj.sa/subscription/adwyh-almsahh-almshtrkh |
| Private office | https://mazj.sa/subscription/private-office |
| Meeting room — Al-Malqa (hourly, up to 6) | https://mazj.sa/reservation/ghrfh-alajtmaaat-almlqa |
| Events hall — Al-Ma'arij (2–5 hr, up to 30) | https://mazj.sa/reservation/qaah-alfaalyat-almaarj |

> Re-verify each URL resolves before posting — the store restructured from 6 products to 4, and at least one old URL (`mktb-khas-hyz`) already 404s.

## 5. Photos

Generic interiors underperform. Upload **named, room-specific** sets:

- **Al-Malqa** (the meeting room) — screen, writable wall, seated-for-6 angle
- **Al-Ma'arij** (the events hall) — full-room from the back, screen + sound visible, a workshop in progress if possible
- The shared coworking floor, an open desk, the coffee corner
- The **Life Tower exterior** from the main road (this is how walk-ins find you)
- Add captions naming the room and the city, in Arabic and English

## 6. Q&A (seed it yourself)

Post the real questions from the site's FAQ as owner-answered Q&A. These are the exact things buyers ask an AI, so seeding them here puts the answer in Google's local layer. Start with:

- "Is there a day pass for coworking in Al-Khobar?"
- "Is there an hourly meeting room here?" (→ Al-Malqa, by the hour)
- "Can I run a 30-person workshop here?" (→ Al-Ma'arij)
- "Do space subscribers get 24/7 access?"
- "Where exactly is MAZJ / which floor?"

Seed each in **both** Arabic and English.

## 7. Posts

Post weekly, tied to real events from the @mazjorg calendar. Even a light cadence signals an active, staffed business to both Google and anyone reading the profile. Name the room (المعارج) and the city in each.

---

## The review engine (this is half the battle)

Verified competitor review counts in the Eastern Province: **Servcorp 70, Jovia 58, Regus Al-Rashed 43, Beehive 33, Sharik 32.** MAZJ is at a handful. Review volume is both a direct local-pack ranking factor and the raw material AI answers quote when comparing options — so the single most valuable ongoing action is getting to **50+ genuine reviews.**

- QR code at reception linking straight to the Google review form
- A verbal ask at the end of every day pass
- A WhatsApp follow-up on the existing line (+966 53 460 0488) after a first booking
- **Prompt, never script.** Ask reviewers to mention what they actually used — الملقى, المعارج, the day pass, Life Tower. Real specifics are what AI answers quote; identical templated reviews get filtered and can trip Google's spam detection.

Do **not** buy reviews or post fake ones. It is against Google policy, it is detectable, and for a small business a review purge is worse than a low count.

---

## Off-GBP companions (same NAP, listed here so nothing drifts)

These aren't GBP but they share the canonical facts above and reinforce the same entity. Priority order:

1. **Get listed on the aggregators that own the English SERP** — MAZJ is absent from **coworker.com** (the #1–2 result for the head English term; a free listing), coworkbooking.com, and unclaimed on thecoworkingspaces.com. These are exactly the pages AI engines summarize for "where can I cowork in Al-Khobar." Being listed there matters far more than trying to outrank them.
2. **Correct the listings that already carry MAZJ wrongly** — the "5.0" on coworkingspaces.me and houseofsaud.com; the address-without-a-link on workin.space (it carries the most accurate third-party address on record — Office 201, Life Tower — but links nowhere).
3. **Saudi + map citations, identical NAP** — Monshaat مزايا provider listing (a .gov.sa citation ranks directly in the Arabic SERP), chamber.org.sa, Apple Maps Connect, Bing Places, Foursquare.
4. **Instagram @mazjorg** — already the #1 result on the Arabic brand query, above both mazj.org and mazj.sa. Put the full address, the room names, and the mazj.sa link in the bio; name the room + city + format in event captions.

---

*All facts sourced from the repo (`lib/contact.ts`, `lib/links.ts`, `messages/*.json`) so the GBP and the website agree. Market/competitor figures are from an adversarially-verified scan (15/74 claims confirmed); the ranking observations came from location-parameter search proxies, not a real Saudi-IP session, so confirm live local-pack presence from a Saudi device before treating any single position as settled.*
