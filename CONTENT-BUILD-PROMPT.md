# Claude Code prompt: MAZJ site content build

> Run this inside the `mazj` repo. It upgrades the landing page content and adds
> minimal new pages, WITHOUT changing the visual design.

> 🔴 **HISTORICAL. This was a one-shot build prompt and it is no longer
> maintained. Do not treat its "Known data" block as current.** The mazj.sa store
> URLs below are the pre-2026-07-27 booking model and are still the wrong SHAPE
> today (booking moved on-site on 2026-07-27, then back out to mazj.sa on
> 2026-08-01, but as locale-prefixed URLs built by `bookingUrl()`): read
> `lib/links.ts`, never this list.
>
> **Four corrections have been made IN PLACE, each dated where it sits, so a
> future session cannot copy the old value back out:**
>
> 1. Staffed hours, and subscriber access (2026-07-31).
> 2. 🔴 The Google rating, which said **5.0** when the real one is **4.7**. That
>    was not a typo in a document, it was a live shipped bug: it reached the hero
>    trust line and the Proof section, both of which this prompt explicitly asked
>    for below (Tasks A2 and A7). Corrected 2026-08-01, and the rule that
>    replaced it is in the "Known data" block.
> 3. The socials line, which listed an **X account MAZJ does not have**
>    (2026-08-01). It had already reached `lib/schema.ts`'s `sameAs`, i.e. the
>    site was telling Google that a handle MAZJ does not control IS the business.
> 4. 🔴 Task A11, which asked for an FAQ entry on "access **and fingerprint**"
>    (2026-08-01). Access is non-biometric, and biometric copy is a PDPL
>    exposure, not a wording preference. This is the one correction here with a
>    legal edge: see the note at the task itself.
>
> ⚠️ **The word "membership" survives below in five
> places (the store-URL list and Tasks A1, A9, B) and must NOT be copied into
> copy.** Owner ruling 2026-07-31: "member" and "membership" are reserved for a
> future, unlaunched product, so the person is a **space subscriber**
> (`مشترك المساحة`) and the plan is a **subscription** (`الاشتراك الشهري`).
> Both English words now appear in zero strings in `messages/*.json`, as do
> `عضو` / `الأعضاء` / `عضوية`. **Sources of truth: `CLAUDE.md` for facts,
> `TONE.md` for voice, `messages/*.json` for the copy itself.**

---

You are working in the MAZJ coworking website (Next.js 16, next-intl, Tailwind, GSAP),
bilingual: Arabic (primary, RTL) and English. Your job is a CONTENT build, not a redesign.

## Read first
1. Read `CLAUDE.md` at the repo root and follow every convention in it, especially the
   i18n content-sync rule (the "MOST IMPORTANT" section).
2. Read `messages/ar.json` and `messages/en.json` to learn the existing namespaces, keys,
   and the Arabic register (Modern Standard Arabic / فصحى, marketing tone).
3. Skim the components in `components/` so you reuse existing patterns.

## Hard guardrails (do not violate)
1. DO NOT touch or restyle the existing visual design. Reuse the existing components,
   Tailwind tokens, colours, fonts, section patterns, `Reveal`, `CtaButton`, header, and
   footer exactly as they are. You are only adding content, new sections, new pages, and
   wiring links. No new colour system, no font change, no DESIGN.md rebuild.
2. Build NEW pages MINIMAL and from EXISTING components/patterns (header, footer,
   `CtaButton`, `Reveal`, section wrappers, the existing type + colour tokens). Minimal
   means: few sections, real content, on-brand because it reuses the brand's own
   components. Full design comes in a later pass.
3. i18n: never hardcode display text in a component. Every new string goes into BOTH
   `messages/en.json` and `messages/ar.json`, under a namespace, with identical key
   structure and equal-length arrays. Arabic is فصحى, a real marketing translation, never
   literal English. Keep the brand as MAZJ / مزج. Validate ar/en key parity, and validate
   the keys against each component's `t("...")` calls, before you finish.
4. Never use the em-dash character. Use a colon or a regular hyphen.
5. Positioning boundary (important). Public positioning is a COWORKING SPACE in Al-Khobar.
   You MAY signal that MAZJ belongs to the entrepreneurship / builders ecosystem through
   community, events, meetups, and "programs" language. You must NOT mention investing,
   funding, equity, acquisition, "accelerator", "startup studio", building products for
   clients, or AI anywhere. Keep it community and ecosystem flavoured, never
   investor/accelerator/commercial. When unsure, leave it out.
6. RTL correctness: prefer logical Tailwind utilities (ps/pe, start/end, text-start/end).
   For physical directional utilities that do not mirror, branch on locale with BOTH class
   names written literally (see CLAUDE.md).

## Pricing and booking
- Put NO SAR prices on the site for now. Every "Book" / "See price" / plan CTA links OUT
  to the matching mazj.sa page (new tab), which shows the live price and runs the booking.
  Use these exact URLs:
  - Open desk / day pass: https://mazj.sa/reservation/3a14ba78-df07-bba7-7c23-0c9f637ce6e1
  - Meeting room (Al-Malqa): https://mazj.sa/reservation/ghrfh-alajtmaaat-almlqa
  - Event hall (Al-Ma'arij): https://mazj.sa/reservation/qaah-alfaalyat-almaarj
  - Private office, daily: https://mazj.sa/subscription/private-office
  - Private office, monthly (Hayz): https://mazj.sa/subscription/mktb-khas-hyz
  - Shared-space membership: https://mazj.sa/subscription/adwyh-almsahh-almshtrkh

## Known data (use verbatim; do not invent what is missing)
- Location: Life Tower (برج الحياة), Zaid Ibn Alkhattab St, Al-Olaya, Al-Khobar.
- Hours: staffed Sun to Thu, 9am to 5pm. Space subscribers enter 24/7 by QR code or access card.
- Socials: Instagram https://www.instagram.com/mazjorg ·
  LinkedIn https://www.linkedin.com/company/mazj-مزج
  (corrected 2026-08-01: this line also listed `X https://twitter.com/mazjorg`.
  🔴 **MAZJ has no X account.** Do not add one back from any other document.)
- ZATCA tax number: 310240548700003.
- Google rating: **4.7**, off a handful of reviews (corrected 2026-08-01; this
  line said 5.0). 🔴 **And do NOT put a rating claim on the site at all**, which
  is why Tasks A2 and A7 below no longer ask for one: lead with legitimacy
  signals instead (address, staffed hours, 24/7 subscriber access, VAT).
- UNKNOWN, so use a clearly labelled placeholder string + a `// TODO` code comment and do
  NOT fabricate: phone/WhatsApp number, Google Maps embed/link, CR number, testimonial
  quotes, exact review count. Collect every placeholder into a final report for the owner.

## Wire everything
- No CTA may point at "#". Wire nav, footer, buttons, and socials to real routes/URLs.
  Internal links use the locale-aware `Link` from `i18n/navigation`. External links
  (mazj.sa, socials) open in a new tab with rel="noopener noreferrer".

## Task A: landing page (`app/[locale]/page.tsx`), section by section
Keep every existing section and its design. Adjust CONTENT and add the NEW sections below,
all built from existing components/patterns:
1. Header/nav (existing): wire links to the new routes (Spaces, Pricing, Events, About,
   Contact); primary button to the membership or day-pass mazj.sa URL.
2. Hero (keep headline + SpaceFinder, both work): add a small trust line under the pill,
   "Life Tower, Al-Khobar · 24/7 access" (AR mirror). No price.
   🔴 Corrected 2026-08-01. This asked for `"5.0 on Google · ..."` and the site
   shipped it. Two separate rulings kill it: the rating is 4.7, and no rating
   claim belongs in the hero at all. ⚠️ The Life Tower half is ALSO wrong now
   (owner 2026-07-26: the tower is not a landmark, so it appears only in
   address, directions and legal copy, never as a marketing locator, see
   `TONE.md` §4). And the trust line no longer exists: `Hero.trustLine` has zero
   code references, the hero renders the three `SpaceFinder` chips instead.
3. Spaces (upgrade the USP section or add one new section): four product cards (Open desk,
   Private office, Meeting room, Event hall), each with name, capacity, a one-line
   "includes", and a Book button to its mazj.sa URL. No price shown.
4. Builders community (NEW, honour guardrail 5): position MAZJ as a home for the Eastern
   Province's founders, freelancers, and builders, with community, events, and programs.
   No investing/accelerator/AI words. Example heading "A community of builders" /
   "مجتمع من صُنّاع المنتجات"; body about gathering, events, and programs. CTA to About or
   Community.
5. How it works (keep Steps copy). OPTIONAL content-only fix: Step 3 renders a leftover
   energy-dashboard mock ("0.0 hrs", tabs Bookings/Activity). Only if you can do it WITHOUT
   restyling, reuse an existing card pattern (e.g. the `ReserveCard` photo) in its place;
   otherwise leave it and add a `// TODO`. Do not create new design.
6. Why MAZJ (keep as-is).
7. The space + proof (NEW): reuse an existing image/section pattern for a small gallery +
   2 to 3 testimonial slots (placeholder quotes + TODO).
   🔴 Corrected 2026-08-01: this asked for "the 5.0 rating" here too. No rating
   claim in Proof either. ⚠️ `components/Proof.tsx` was built from this task and
   is now mounted on NO route, so its strings are dead keys: editing them ships
   nothing.
8. Host your event (NEW): a block for the event hall (seats 30, screens, sound). CTA
   "Enquire" to Contact, plus "Book the hall" to the mazj.sa event URL.
9. Community / Network (keep): ensure its CTA routes to Community or membership.
10. Location & hours (NEW): address, hours, a map placeholder (TODO embed), phone/WhatsApp
    placeholders. Use existing type/section styling.
11. FAQ (NEW): 6 to 8 Q&As (access, what is included, cancellation and the
    no-refund policy, payment via Tamara/Tabby, VAT invoice, guests, parking). Reuse simple
    existing text styling.
    🔴 Corrected 2026-08-01: this asked for a Q&A on "access **and fingerprint**".
    Access is QR code or access card via Rekaz and is deliberately
    **non-biometric**. Every fingerprint and biometric string was stripped
    site-wide on 2026-07-23, because biometric data is PDPL-sensitive and implies
    a controller registration MAZJ avoids. **Never write it back in.**
12. Final CTA (keep StepInto): wire both buttons (Book a tour to Contact; Book a day pass
    to mazj.sa).
13. Footer (keep design): wire nav links to routes, socials to the real URLs, add
    Terms/Privacy links, add a ZATCA line.

## Task B: new pages (all, minimal, existing components only)
Create locale routes under `app/[locale]/...`. Each page is the existing Navigation + a few
content sections built from existing patterns + the existing Footer. All copy via i18n in
both languages. Minimal but complete:
- `/spaces` : overview linking to the four detail pages.
- `/spaces/coworking` (open desk: membership + day pass), `/spaces/private-office`,
  `/spaces/meeting-room`, `/spaces/event-hall` : one per product with what it is, capacity,
  what is included, photos (reuse existing images), Book to its mazj.sa URL. No price.
- `/pricing` : plans overview (day / membership / private office / rooms), what each
  includes, "See price and book on mazj.sa" buttons. No SAR on the page.
- `/events` (Host an Event) : the hall as a venue for workshops, offsites, and meetups;
  enquiry CTA to Contact; Book to mazj.sa.
- `/about` : the story, the space, the "urban community", and the builders-ecosystem
  community framing (guardrail 5), with photos. No investing/accelerator/AI.
- `/community` : the network, events, meetups, and programs (ecosystem framing,
  guardrail 5). Include a newsletter signup slot.
- `/contact` : address, hours, map placeholder, phone/WhatsApp placeholders, and a simple
  tour-request/contact action. Do NOT build a backend; use a mailto or WhatsApp link
  placeholder.
- `/faq` : the FAQ content.
- `/terms` and `/privacy` : real legal skeletons (headings + placeholder body + a TODO for
  legal review), the ZATCA number, and a CR placeholder.
Add each page to the nav and/or footer where it belongs. Keep all pages bilingual and
RTL-correct.

## Conventions and done criteria
- Follow the repo `CLAUDE.md`. Keep `en.json` and `ar.json` in perfect key parity, and
  validate keys against each component's `t("...")` calls before finishing.
- No em-dash anywhere. No hardcoded display strings. No "#" hrefs left (except intentional
  non-links).
- `npm run build` succeeds; `node_modules/.bin/tsc --noEmit` is clean; ESLint is no worse
  than the pre-existing baseline.
- Both `/en` and `/ar` render every new page fully in their own language; RTL is correct on
  `/ar`.
- Do not restyle existing sections. New work is visually consistent because it reuses the
  existing components and tokens.
- Work section by section and page by page; after each, verify it builds and both locales
  render. End with a short report listing every placeholder/TODO left for the owner to fill
  (phone, WhatsApp, map, CR, testimonials, review count).
