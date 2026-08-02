<!-- Generated 2026-08-02 by a 15-agent audit workflow: 4 external measurement
agents, 5 repo-audit dimensions, one adversarial refute pass per dimension, one
synthesist. 50 findings survived, 21 were refuted, 25 more were found by the
adversaries. Measurements and the shipped work are recorded in
`ai-search-visibility-audit.md`; this file is the backlog.

🔴 Items marked ⚖️ need an owner decision and must not be actioned without one.
🔴 Bucket D records what was DELIBERATELY refused. Read it before filing a
finding in this area: every item there will be proposed again by a future audit.
-->

# MAZJ AI-Search Build Plan
**Synthesised 2026-08-02 from 4 external measurement reports + 5 repo audit dimensions (post-refute) + 20 adversary findings. 121 raw findings deduplicated to 58 items.**

**Verified live at synthesis time (not taken on report authority):** `app/llms.txt/route.ts`, `app/pricing.md/route.ts`, `lib/machine-text.ts`, `test/machine-text.test.ts`, `test/schema-facts.test.ts` and `docs/ai-search-visibility-audit.md` are all still **untracked** (`git ls-files` returns nothing for any of them). `app/robots.ts` already carries AI allow groups naming GPTBot and ClaudeBot. `faqPageSchema` is now imported by `components/SpaceDetail.tsx`, so space-page FAQ markup **shipped**. `alternateLinks` appears **nowhere** in `i18n/` or `proxy.ts`, so the hreflang header conflict is real and unfixed.

**Reading key:** 🌐 = touches `messages/*.json`, must land in EN and AR in the same edit. ⚖️ = needs an owner ruling before the string moves. Ratio line = impact on being cited by an AI, divided by effort.

---

## A. SHIP NOW
*Takes effect before launch, or is inert-but-correct today. Ordered by impact/effort.*

### A0. Protect the work that does not exist in git yet
**Plain:** Six files written in the last two days, including the entire machine-readable brief for AI assistants and the two test files that guard the structured data, exist only on this laptop. A cleanup, a bad `rm`, or a fresh clone deletes them permanently and nothing reports the loss. Six of the findings below are arguments about the wording of files that can currently evaporate.
**Detail:** Commit `app/llms.txt/route.ts`, `app/pricing.md/route.ts`, `lib/machine-text.ts`, `test/machine-text.test.ts`, `test/schema-facts.test.ts`, `docs/ai-search-visibility-audit.md`. The tree carries another session's in-flight work across 28 modified files, so build the commit in a separate worktree per root `CLAUDE.md` rather than staging in the shared tree. Verify after deploy with `curl -s -o /dev/null -w '%{http_code}' https://<origin>/llms.txt` expecting 200 (it is 404 today).
**Effort:** trivial.
**Ratio:** Infinite. Every other item in bucket A is worth zero if the files it edits stop existing.

### A1. Turn off the hreflang HTTP header
**Plain:** The site tells search engines the same page's language map three different ways, and one of the three disagrees. Google's documented response to conflicting annotations is to discard the whole set, which means Arabic searchers get sent to the English page and back. It gets structurally worse the day both domains go live: the header names whichever domain served the request while the page names the single canonical one, on every page.
**Detail:** Add `alternateLinks: false` to the `defineRouting` call in `i18n/routing.ts`. Nothing is lost: the HTML `<link rel="alternate">` tags and the 22 sitemap `<xhtml:link>` clusters already agree exactly, key for key. Do not confuse this with `localeDetection`, which is a separate field and must keep working. No test asserts this; verify by hand with `curl -sI` per locale, and again after any next-intl upgrade.
**Effort:** trivial, one line.
**Ratio:** Highest in the bucket. One line closes the only defect that can misroute an entire language at launch.

### A2. Name the four products in Arabic inside the Arabic pages' structured data 🌐
**Plain:** On all 13 Arabic routes the hidden data AI assistants read calls the products "Open desk", "Private office", "Meeting room (Al-Malqa)" and "Events hall (Al-Ma'arij)" in English. Arabic search is the only place MAZJ has ranking strength, and the two room names never register as MAZJ's.
**Detail:** `lib/schema.ts` `makesOffer[].itemOffered.name` at lines 227 to 238 hardcodes four English literals. Source all eight strings from `Spaces.cards.<id>.name` per locale, the way `Location.address` is already passed in. The English literals do not even match the site's own English: schema says `Meeting room (Al-Malqa)` while every visible surface says `Meeting room · Al-Malqa`. Measured: 4 English names × 13 Arabic routes = 52 occurrences.
**Effort:** trivial.
**Ratio:** Very high. One read change fixes the machine-readable half of the Arabic product vocabulary.

### A3. Delete the "24/7 access" amenity claim
**Plain:** The structured data now lists round-the-clock access as a facility MAZJ has. The label says it is for subscribers, but the field it sits in is read as a plain yes/no list of what the building offers. This is the same mistake caught on 2026-07-31, when the opening hours claimed 9pm and would have sent walk-ins to a locked door for four hours a day.
**Detail:** Remove `{"@type": "LocationFeatureSpecification", name: "24/7 access for space subscribers", value: true}` and its Arabic twin `دخول على مدار الساعة لمشتركي المساحة` from `lib/schema.ts` (around lines 110 to 165). `LocationFeatureSpecification` has no field for a condition, and eight lines above, the `openingHoursSpecification` comment already states the opposite policy in bold. Leave the reason in the array so a later pass does not "complete" the list. The fact survives in `Faq` "When can I get in?" in both languages, with the count that proves it.
**Effort:** trivial.
**Ratio:** High. Deleting two lines removes a published claim that contradicts the site's own hours policy.

### A4. Fix the event location lie 🌐(no, code only)
**Plain:** The admin lets you type where an event is held and the page prints it. The machine-readable copy ignores what you typed and always says the event is at MAZJ in Al Hayat Tower. Host one event at a partner venue, a university or a hotel, and Google, Apple Maps and every assistant send people to the wrong building while the page shows the right one.
**Detail:** `lib/schema.ts` `eventSchema` hardcodes `location: {"@id": BUSINESS_ID}` and `app/[locale]/events/[slug]/page.tsx` (lines 120 to 141) passes no location. The fields exist end to end: `EventForm.tsx` 336 to 348, `server/db/events.ts` 42 to 43 and 90 to 91, resolved at `app/[locale]/events/_lib/events.ts:143`. Pass `event.location`; when null keep the `BUSINESS_ID` reference, when set emit a bare `Place` with that name and **no address**, since MAZJ cannot verify a third party's postal address. This is the exact manual-action risk `lib/schema.ts`'s own header names.
**Effort:** small.
**Ratio:** High. Dormant today (no upcoming events) but it is a wrong-address bug that ships silently the first time an off-site event is published.

### A5. Restore the category noun the English body copy lost 🌐
**Plain:** The paragraph that appears on six pages says in Arabic "مزج مساحة عمل مشتركة" and in English only "MAZJ is in Al-Khobar's Al-Olaya district". The English lost the words "a coworking space" in translation. The same edit puts the country on the site, which currently appears in visible text on zero indexable pages.
**Detail:** Rewrite `Location.blurb` in both files. It renders on `/`, `/contact` and all four `/spaces/*` detail pages via `components/LocationHours.tsx`, so one string carries six routes. EN: "MAZJ is a coworking space in Al-Khobar, in Saudi Arabia's Eastern Province: the Al-Olaya district, inside Life Tower on Zaid Ibn Alkhattab St. The open desks, the private offices, the Al-Malqa meeting room and the Al-Ma'arij events hall all sit at this one address." AR: mirror using settled terms only. **Do not touch `Hero.eyebrow` or any h1**: the adversary proved the homepage already states the category in `Meta.metaTitle`, `Meta.description` and the eyebrow, which is the sanctioned slot per `TONE.md` §7. The tower stays in address function.
**Effort:** trivial.
**Ratio:** High. One string, six routes, closes both the English-only category drift and the zero-country gap.

### A6. Write the ten missing meta descriptions 🌐
**Plain:** The single sentence Google and every AI assistant lift as a page's summary is written for only two pages on the whole site. On the four pages that sell the actual rooms it falls back to the page's opening line, which is 41 to 80 characters of mood that names neither MAZJ nor Al-Khobar nor a category. Someone asking an assistant about MAZJ's meeting room gets handed "Up to six around the table, booked by the hour" with no way to tell which company or city that is.
**Detail:** `lib/metadata.ts` computes `t.has("metaDescription") ? t("metaDescription") : t("intro")`. `metaDescription` exists in exactly **one of eleven** namespaces (`EventsPage`) in both files. **This is the same defect as the "space-page intros evoke rather than define" finding, seen from the other end**, and the two were filed separately by two dimensions: the `intro` IS the meta description, the og:description and the AI snippet. Two shapes are available and this is a real choice: (a) rewrite the four `intro` strings so they define and stay inside 120 to 160 characters, which changes what is on screen, or (b) add a written `metaDescription` per namespace on the `/events` precedent and leave the on-page opener evocative. **Recommend (b) for the four space pages plus `Startups`**, because it wins the snippet without touching page copy an owner has approved. Arabic current lengths: coworking 55, meeting 41, event hall 70, office 48.
**Effort:** small.
**Ratio:** Very high. Ten strings per language and it changes the exact text an answer engine quotes for the four money pages.

### A7. Rewrite the buyer-facing question strings 🌐
**Plain:** The FAQ is the content an AI is most likely to quote word for word, because each pair is already clean. Twenty-six of the thirty-four questions throw that away. "Can I see it before I commit?" starts with "it", so quoted alone it refers to nothing. "When can I get in?" is the opening-hours question with the words "opening hours" removed. Rewording costs nothing and changes no fact.
**Detail:** **Scope is 34 questions, not 18.** Ten of the 18 in `Faq.groups[*]` plus the 16 on the four space pages (`Space{Coworking,Office,Meeting,EventHall}.faq`, 4 each), which sit on the money pages and are already emitted as `FAQPage` JSON-LD by `SpaceDetail.tsx`. Name the subject inside each question (MAZJ, Al-Malqa, Al-Ma'arij, Al-Khobar) and use the noun people type (`refund`, `opening hours`, `payment methods`, `rent`). Answers unchanged throughout: the one "add a word" proposal was self-cancelling on inspection. No kashida on FAQ strings per `TONE.md` §8.1.
**Effort:** small.
**Ratio:** High. Zero new facts, zero risk, and it lands in structured data on five routes per locale automatically.

### A8. Deduplicate the six colliding question pairs 🌐
**Plain:** Six questions a customer might ask now have two different answers on two different pages, and an assistant picking one page to quote has to choose. Worse, the code carries a comment claiming this was checked.
**Detail:** `SpaceDetail.tsx` asserts "zero overlap (verified 2026-08-02: 16 space questions, 18 on /faq, zero overlap)". Zero overlap is true only for exact string equality. By meaning, at least six collide: day pass (`/faq` vs SpaceCoworking), hall capacity, taking calls, booking the meeting room, how to pay, and when you can get in. Reword or drop one side of each pair in both files, and **rewrite the comment to state the method (string equality) rather than implying semantic distinctness**. A false "this was verified" sentence is the exact failure root `CLAUDE.md` legislates against.
**Effort:** small.
**Ratio:** High. Ships with A7, same files, same edit window.

### A9. Add "What is MAZJ?" as the first FAQ item 🌐
**Plain:** An AI reaches for a question-and-answer pair before it reaches for a paragraph. There are 34 pairs and not one is the question every first-time reader asks. Adding it hands every assistant a ready-made, quotable, 68-word description MAZJ wrote itself.
**Detail:** Insert at `Faq.groups[0].items[0]` in both files. The landing page renders `<FaqSection limit={6} />`, so it also lands on the homepage body, which is where the definitional sentence is currently absent. **Accept the consequence deliberately:** the teaser is a flat slice of 6, so "Is there parking?" gets pushed off the homepage. Content: category, city, country, four products with capacities, staffed hours, subscriber 24/7. No price, no event count, `مشترك المساحة` not `عضو`.
**Effort:** trivial.
**Ratio:** Very high. One pair, and it is the single most liftable sentence the site could own.

### A10. Answer the price question without publishing a price 🌐
**Plain:** Price is the first thing anyone asks about a workspace and the questions page never mentions it. Every ranking competitor puts a figure in the search snippet (Servcorp ٩٦٠ ريال شهرياً, Regus SAR 43 per person per day, theoffice-int 300/450/1500 per hall, spacesksa 35 for three hours). MAZJ does not have to publish a number, but "we say nothing" reads as "undisclosed" rather than "shown at booking".
**Detail:** **The stronger version of this finding was refuted:** all four space pages already say the live price is shown as you book (`SpaceCoworking.about[2]`, `SpaceOffice.about[2]`, `SpaceEventHall.about[2]` says "rate", `SpaceMeeting` twice). What is missing is a question in either language. Insert one pair at `Faq.groups[3].items[0]`. **Do not include "VAT included"**: nothing in this repo establishes that the Rekaz storefront's displayed figures are VAT-inclusive, and asserting a third party's tax treatment is a claim MAZJ cannot verify. Keep it to the shipped `about[2]` register plus the invitation to message the team; `TONE.md` §6 says say it is shown as you book and stop there.
**Effort:** trivial.
**Ratio:** High. One pair per language against a measured competitor advantage.

### A11. Merge the four cheap schema corrections into one change
**Plain:** Four small vocabulary fixes in the business record. None changes how the site looks in search; together they make the record correct rather than approximately correct, which is what an assistant reads to decide what kind of business this is.
**Detail:** All in `lib/schema.ts`. (1) Drop `inLanguage` from `LocalBusiness` (schema.org's "used on these types" list does not include it) and replace with `knowsLanguage: ["ar","en"]`, which is true in both locales and needs no branch. (2) Add a bare `WebSite` node, `@id` `<origin>/#website`, with `url`, `name`, `alternateName`, `inLanguage` (valid here) and `publisher: {"@id": BUSINESS_ID}`, and **no `potentialAction`/SearchAction**, the site has no search and declaring one is invented markup; write that refusal into the docblock. (3) Add `additionalType: "https://www.wikidata.org/wiki/Q97307779"` (coworking space) and record in the comment that no better schema.org type exists so the next audit does not spend the hour. (4) Add `foundingDate: "2022"`, because "since 2022" already ships in five strings across four indexable routes and `TONE.md` §6 protects it, so this repeats an on-screen fact rather than inventing one. **Do not add a separate `Organization` node** (LocalBusiness already is one; a second is a duplicate entity).
**Effort:** trivial as one change.
**Ratio:** Moderate. Zero SERP effect by construction; value is entity disambiguation for answer engines, and the cost is four lines.

### A12. Replace the business photograph
**Plain:** Every page tells Google and every AI engine that one specific photograph is the picture of this business. It is the back of a man's head in a shemagh, out of focus, in a dark corridor. No desk, no room, no sign, no logo. It is the image most likely to be pulled into a map card or an AI answer, and twenty real interior photographs sit unused.
**Detail:** `lib/schema.ts` sets `image: absoluteUrl("/images/hero-bg.jpg")`, which `components/CLAUDE.md` documents as frame 0 of `mazj-hero.mp4`, kept as the video poster. `schema.org/image` accepts an array; Google asks for 16x9, 4x3 and 1x1. Cut three from the ten measured 1200x800 interiors (`spaces/day-desk`, `spaces/meeting`, `spaces/event`) with the ffmpeg crop recipe already in `components/CLAUDE.md`. Leave `hero-bg.jpg` as the poster.
**Effort:** small.
**Ratio:** Moderate to high. One field, and it is the picture of the business.

### A13. Make a cancelled event say "cancelled" instead of 404
**Plain:** The day MAZJ calls off an event, everyone holding the link and everyone who found it in Google or an assistant gets a broken page instead of the word "cancelled". The last thing recorded about that event still says it is going ahead. People turn up.
**Detail:** `app/[locale]/events/_lib/events.ts:221` returns null for any `status !== "published"`, and `cancelled` is one of three statuses (`server/db/events.ts:26`). Let a **previously published** cancelled event still render (keep draft returning null: a draft was never public), pass an `eventStatus` argument into `eventSchema` so it emits `EventCancelled`, **close registration and suppress the ticket offer** rather than only relabelling, and decide whether `listIndexableEventSlugs` keeps it in the sitemap. Do the event-page breadcrumb (`BreadcrumbList`, MAZJ > Events > title) in the same change, since it is the only route three levels deep without one and its payoff today is zero pages.
**Effort:** medium.
**Ratio:** Moderate. Dormant until the first cancellation, but the failure mode is a person driving to Al Khobar.

### A14. Two more event-schema corrections
**Plain:** A free event and an event whose price nobody knows look identical to a machine, and every event MAZJ can currently run is free. Separately, when a company or a university hosts an event, the record files them as a human being.
**Detail:** (1) When there is no ticket but registration is open, emit `{"@type":"Offer", price: 0, priceCurrency:"SAR", availability: from event.seats.kind, url: the event page}`. Zero is the absence of a price, not a price MAZJ charges, so this does not breach `TONE.md` §6, and it is already stated in the visible registration panel. Verify the "every event is free" framing against Rekaz before quoting it to the owner: it rests on the recorded 2026-08-01 measurement that no ticketable product exists. (2) `performer: {"@type":"Person"}` is wrong for the community and company hosts in the archive; use `Organization` or drop `performer` unless a named speaker exists.
**Effort:** small.
**Ratio:** Moderate. Both are dormant today and both are wrong the day an event publishes.

### A15. Correct the stale safety comment on the JSON-LD component
**Plain:** The note explaining why this code is safe is out of date. The protection still works, so nothing is broken. The problem is the sentence: it tells the next person there is nothing to check, on the one file where a bad string could break a page's machine-readable block.
**Detail:** `components/JsonLd.tsx` says "No user input, no request data, no CMS reaches it." Since events moved into the database on 2026-07-28, `eventSchema` carries `event.title`, `event.summary`, `event.host` and (after A4) `event.location`, all admin-authored. The `.replace(/</g,"\\u003c")` escape holds, so amend the sentence to name the admin-authored fields and say the escape is what makes them safe, rather than their absence.
**Effort:** trivial.
**Ratio:** Moderate. Cheap, and it is the class of false-reassurance comment this repo has already paid for.

### A16. Fix the two coined Arabic amenity phrases and the numeral comment 🌐(no, code only)
**Plain:** Two Arabic facility labels use wordings the site does not use anywhere, which is the habit that has produced rejected Arabic copy here before. Separately, a comment says the Arabic copy uses Arabic-Indic digits and it does not, in any of 705 strings.
**Detail:** `lib/schema.ts` contains `مساحات مشتركة وركن قهوة` (`ركن قهوة` scores 0; the copy says `ركن القهوة`) and `مكاتب خاصة تُغلق بمفتاح` (`بمفتاح` scores 0; the copy says `غرفة مغلقة تخصّك`). Reuse the shipped wording and extend the docblock's verification list to all eleven entries, not the three that were interesting. Separately the `containsPlace` comment quotes `"حتى ٦ · بالساعة"` with an Arabic-Indic six; the real value is `حتى 6 · بالساعة` with a Western 6 (`app/CLAUDE.md` already carries the corrected pair). **The comment's string shapes and middle dot are otherwise correct** and `app/pricing.md/route.ts:74` depends on that dot, so change only the numeral.
**Effort:** trivial.
**Ratio:** Moderate. Two Arabic strings a native reviewer would flag, plus a rationale that is measurably false.

### A17. Link the two duplicated room entities
**Plain:** Al-Malqa is described twice: once as a room seating six, once as a product called "Meeting room (Al-Malqa)". Nothing connects them, so an assistant listing what MAZJ has can read four rooms where there are two, and neither entry carries the other's information.
**Detail:** `lib/schema.ts:190-217` (`containsPlace`) emits `MeetingRoom` / `EventVenue` with capacities; `:227-238` (`makesOffer`) emits `Service` nodes with the same names. Give the `containsPlace` nodes stable `@id` fragments (`#al-malqa`, `#al-maarij`) and reference them from the matching offers, or at minimum make the names byte-identical so a naive extractor matches on the string. Introduced by the same uncommitted rewrite that added `containsPlace`, so it post-dates the audit.
**Effort:** small.
**Ratio:** Moderate. Ships inside A2, same block.

### A18. Fix the machine files: Arabic depth, homepage blurb, em dash, and a `/faq.md` sibling
**Plain:** The file written for AI assistants gives Arabic a quarter of the content and no Arabic prose, lists the homepage with no description at all in either language, and opens the product sheet with a long dash. It also links to the FAQ without carrying a single question, while 36 approved question-and-answer pairs sit one read away.
**Detail:** Four sub-items in `app/llms.txt/route.ts` and `app/pricing.md/route.ts`. **(a) Derived Arabic, safe, ship it:** add `- السعة ووحدة البيع:` and `- يشمل:` from the AR namespaces to the product block; measured Arabic share is 25.6% (819 chars across 24 strings vs 2,382 across 37). **(b) Homepage blurb:** `routeLines()` reads `metaDescription || intro` and `Meta` has neither (`['title','description','siteName','city','metaTitle']`), so the root row renders with no description while the other ten get 47 to 182 characters. One token: `|| str(e?.description)`, mirrored on the Arabic side. **(c) Em dash** in `app/pricing.md/route.ts` line ~100, `# Products and pricing, MAZJ`; replace with a comma. House style, no crawler effect, do not use it to justify a sweep. **(d) `/faq.md`:** build a sibling route handler on the exact `pricing.md` pattern (derived from `messages/*.json`, every Arabic string through `normalizeArabicForMachines`, force-static plus revalidate), carrying both languages, and add one line to the existing Files section of `/llms.txt`. **Do not inline 36 pairs into llms.txt**: the convention is a short index that links out. **Correction to the source finding:** `pricing.md:94` already emits both `/en` and `/ar` product URLs, so that sub-item is done. The hand-written Arabic mirror of the "Answering questions" block is deferred to bucket C as a decision, because nothing would report it going stale against its English twin.
**Effort:** small.
**Ratio:** Moderate, and honestly bounded. **Report disagreement:** one dimension filed the Arabic gap at high severity; another argued in its own findings that `/llms.txt` is unlinked and no major AI crawler retrieves from it. **I believe the second.** Do the cheap derived half because it costs almost nothing and cannot go stale; do not spend hand-written prose here until a crawler is measured fetching it.

### A19. Turn `/spaces` into a real comparison 🌐
**Plain:** MAZJ sells four things and a buyer's whole decision is which one. The site never puts them side by side. There is no table anywhere on the site. This is the single format most cited in AI answers, and MAZJ is the only possible authority on its own four rooms.
**Detail:** `/en/spaces` is 428 visible words with 0 tables and no decision rule. `SpacesPage.offers` already holds name, capacity, durations, includes and photoAlt per product, which is the table's columns sitting in JSON as prose cards. Add four rows, columns: who it is for, capacity, unit of sale, what is included, when you can get in. Plus a short "choose this if" line per product. Price-free, which is what makes the unit-of-sale column carry the weight. **Two cautions:** do not reuse `أي مساحة تناسبك؟` as the Arabic h1, it is the locked `SpaceFinder` line already rendering in the homepage hero and duplicating it gives two indexable URLs the same primary heading; and decide where the outbound Book control sits before laying out rows, since the page already renders four mazj.sa exits. Table must scroll inside its own `overflow-x` container.
**Effort:** small.
**Ratio:** High. Every fact is already written; this is presentation plus one paragraph.

### A20. Add the Arabic category words a Saudi buyer actually types 🌐
**Plain:** Someone searching in Arabic for a training room, a lecture hall or a furnished office will not match these pages, because those exact words appear nowhere on the site. MAZJ has all three things. The pages use MAZJ's house words instead of the words in the search box.
**Detail:** Measured with `str.count` over `ar.json` (705 leaves, kashidas stripped, never shell grep): `قاعة تدريب` 0, `قاعة محاضرات` 0, `قاعة مؤتمرات` 0, `مكتب مفروش` 0, `مكاتب مفروشة` 0, `مؤثث` 3 (all `photoAlt`), `مجهز` 14. **Ship two of the three proposed pairs.** (1) `SpaceEventHall.faq` append a training-room/lecture-hall pair: every underlying fact ships (`تدريب` 3 and `محاضر` 2 inside that namespace, and `SpaceEventHall.facts[1].value` is literally `فترات 2-5 ساعات`), so nothing is coined. (2) `SpaceOffice.faq[0]` reword to `مفروش`; EN `Spaces.cards.privateOffice.photoAlt` already says "furnished", so this is the buyer's register for a shipped fact. **(3) DROP the `قاعة اجتماعات` pair for Al-Malqa:** `قاعة` means hall, the room seats six, the settled term is `غرفة الاجتماعات` at 36 occurrences, and publishing a question that calls it a hall while the answer calls it a room is synonym capture that mildly misdescribes the room. English siblings required or `test/i18n-parity.test.ts` fails on array length.
**Effort:** small.
**Ratio:** High. Two pairs per language against measured zero-coverage query families.

### A21. Give `/events` a place, a subject and its four series names 🌐
**Plain:** The events page is the one thing MAZJ has that no competitor in the Eastern Province can copy: four years of real, dated, Arabic-titled community events. As published it is unusable. It never says the events happen in Al-Khobar. It says four became recurring series and names none. The headline claims the page is only an archive while a "Coming up" section sits above it.
**Detail:** `/en/events` is 549 words of which 65 are prose (12%); `khobar` scores 0 in `<main>`. **Correction to the source finding:** in Arabic the two `الخُبر` hits are `metaTitle` and `metaDescription`, not the intro, so **visible body geography on `/ar/events` is zero occurrences across the whole namespace**. Three edits in both files: name the city and the four series in `EventsPage.intro` (Coffee & Sketch, Loqma w Fayda, Women Who Design, The Brand Factory / قهوة وسكتش، لقمة وفايدة، نساء يصمّمن، مصنع العلامات); give `archiveNote` a subject; change `EventsPage.title` from "Everything that's happened here" to a subject-naming h1, keeping the 5-tatweel run on a forward-joining letter and **updating `test/arabic-kashida.test.ts` in the same commit or the suite fails**, which is the point of it. "Four of them" is a count of **series**, not events, and already ships, so it stays inside the no-event-count ruling. **Do not assert the archive ran in Al-Ma'arij** (see D6). Consider mounting `<LocationHours />` above the footer, which adds the full address for free, but screenshot both locales before calling it done: it is a layout change on the strongest-content route.
**Effort:** small.
**Ratio:** High. Three strings per language on the one page nobody else can compete with.

### A22. Put MAZJ's legal identity on an indexable page 🌐
**Plain:** The registered company name and the commercial registration number, the two things that prove MAZJ is a licensed business rather than a landing page, appear only on Terms and Privacy, which are the two pages the site explicitly asks search engines to ignore. The VAT number, the weaker of the pair, is on every page.
**Detail:** `MAZJ Al-Omrania One Person Company` and `2051222684` occur in exactly 5 English and 5 Arabic leaves, all inside `TermsPage` and `PrivacyPage`, both in `NOINDEX_ROUTES`. Zero occurrences in any indexable namespace. Add `Footer.entity` to both files, rendered beside the existing `zatca` line in `components/Footer.tsx`, and add `legalName` plus a `PropertyValue` identifier for the CR to the `LocalBusiness` node so the markup follows the new visible copy. **Do not append a founding-year sentence to `AboutPage.storyBody`:** "since 2022" already ships in five strings across four indexable routes including the homepage, so the tenure half of the source finding is refuted.
**Effort:** small.
**Ratio:** Moderate to high. Legitimacy is what an assistant weighs for an unknown operator, and this is one string plus one field.

### A23. Qualify the two unconditional 24/7 strings, one of which is on the homepage 🌐
**Plain:** The site is careful everywhere that round-the-clock access belongs to people on a monthly plan, except in two lines, one of which renders on the home page. Those read as "the doors are open 24/7" full stop. An assistant can quote them and send a walk-in to a locked door at 11pm.
**Detail:** 32 strings in `messages/en.json` contain "24/7"; 30 qualify themselves in the same string. The two that do not: `Founding.perks[1]` ("24/7 access for the long hours"), rendered on the landing page by `components/FoundingBand.tsx`, and `Startups.offerPoints[1].title` ("Doors open 24/7"). One qualifying word each, mirrored. `LocationHours` on the same homepage does carry the staffed hours nearby, so this is 2 of 32 and reported as a measurement, not an alarm. It matters because a perk bullet is exactly the shape of string an answer engine lifts alone.
**Effort:** trivial.
**Ratio:** Moderate. Two words against a hard product fact.

### A24. Fix `/startups`, the indexable route nobody opened 🌐
**Plain:** The startups page is deliberately listed for search because "coworking for startups in Khobar" is a real query, and it is the only page of the eleven where the words describing the business never appear in anything a reader sees. Its search summary names neither MAZJ nor the city, and its one mention of the neighbourhood is spelled differently from the twelve other places on the site.
**Detail:** "coworking" appears in exactly 1 `Startups` string, `metaTitle`, i.e. in the title tag and nowhere in the body. Its resolved description is `Startups.intro` (171 chars, no MAZJ, no Khobar). `Startups.offerPoints[0].body` carries the site's only unhyphenated `Al Olaya` against 12 `Al-Olaya`. One clause into `intro` naming category and city, the spelling corrected, and a written `metaDescription` (folded into A6). The closed-envelope rule bans the offer **terms**, not the category, city or address, which the page's own `offerPoints` already treat as facts.
**Effort:** trivial.
**Ratio:** Moderate. Three small edits on a route already flagged as intent-bearing.

### A25. Resolve `حيّز`'s three meanings and rescue the glossary from the noindex page 🌐 ⚖️
**Plain:** The private office page defines its own product name three different ways in three paragraphs: covering days-weeks-months, then the monthly option only, then the product in general. Asked "ما هو حيّز في مزج؟", an assistant picks one and can quote the wrong booking terms. Separately, the one Arabic sentence anywhere that explains all four in-house names at once is buried on the Terms page, which the site tells Google not to list.
**Detail:** `SpaceOffice.intro`, `.body` and `.about[0]` disagree; `body` is the most specific and says monthly, so standardise on that, and stop opening the page on the codename. **Correction to the source finding:** `TermsPage.sections[2].body` was dismissed as an unrelated legal false positive and it is not: it contains the site's only complete mapping, `المكتب المرن، المكتب الخاص (حيّز)، غرفة الاجتماعات (الملقى)، قاعة الفعاليات (المعارج)، الدخول اليومي`, on a route in `NOINDEX_ROUTES`. Move that mapping to an indexable surface: a `Faq.groups[0]` pair is cheapest and lands in the `/ar/faq` FAQPage markup automatically. ⚖️ Confirm the monthly reading against how the product is actually named in Rekaz first; MAZJ does not control the storefront's product names.
**Effort:** small.
**Ratio:** Moderate. Fixes an internal contradiction and publishes a glossary that is already written.

### A26. Settle one English transliteration per room
**Plain:** The site says Al-Malqa and Al-Ma'arij; the storefront says Al-Mulqa and Al-Maarej. These are the only uncontested English words MAZJ owns, measured across roughly 170 English result slots where no competitor used either. Spelling them two ways splits a signal that would rank on its own.
**Detail:** Site spelling wins by default (it is the one in `messages/*.json`, `lib/schema.ts` and the metaTitles). Record the decision, then it becomes a Rekaz ask in bucket C.
**Effort:** trivial (the decision); the enforcement is C4.
**Ratio:** High. A single-word decision protecting the site's only zero-competition tokens.

### A27. Drop `/events` from weekly to monthly in the sitemap
**Plain:** The sitemap tells search engines the events page changes weekly. The newest event on it is 547 days old and the page currently says nothing is scheduled. Asserting a frequency the content contradicts is a small credibility cost paid on every crawl.
**Detail:** `lib/routes.ts`, the only `weekly` value in the table. Restore it when a cadence exists (C11). Measured: 41 published rows, 0 with a future start date, max `starts_at` 2025-02-01, which is **547 days** before today, not 546 as filed.
**Effort:** trivial.
**Ratio:** Low but free.

### A28. Alt text polish 🌐
**Plain:** Every image on the site has an alt attribute and none is missing, which is better than most sites manage. Six blanks are arguable rather than clearly right, including the map that shows where MAZJ is.
**Detail:** Measured across 26 routes: 370 `<img>`, 266 descriptive (71.9%), 104 empty, **0 missing**. The `/en` arguable set is six, not five: `usp-save.jpg`, `usp-protect.jpg`, `usp-control.jpg`, `location-map.png`, `payments/vat-badge.svg` and `spaces/day-desk.jpg` (the sixth was missed in the original enumeration; `/en` serves 28 images with 15 blanks). Add `photoAlt` keys describing the photograph, never repeating the heading. Leave the eight video posters and backgrounds at `alt=""`.
**Effort:** small.
**Ratio:** Low. Polish, not a defect. Do it when the message files are open anyway.

---

## B. SHIP AT LAUNCH
*Requires the real domain to be connected first.*

### B1. Verify the mazj.org 301 map against the live 14-page sitemap before pointing anything
**Plain:** The project record says mazj.org is noindexed and coasting on residual ranking. It is not. It is currently earning position 2 to 3 in Arabic for the head coworking terms. That changes launch day from "recover lost equity" to "do not drop live equity", and a redirect map written against the wrong assumption is the one artefact that can turn a #2 Arabic position into nothing in a single deploy.
**Detail:** ⚠️ **DISAGREEMENT, and I believe the live fetch.** Firecrawl's cached scrape reported `robots: ["max-image-preview:large","noindex"]`; four independent live `curl` runs (Chrome, two Googlebot variants, GPTBot) all returned 191,085 bytes with `noindex count: 0`, no `X-Robots-Tag` header, an allow-all robots.txt and a working `wp-sitemap.xml` listing 14 pages. A second dimension independently found both mazj.org URLs indexed and ranking. Firecrawl's robots metadata was also wrong about houseofsaud.com in the same session. **Treat the live HTML as authoritative and the stored memory note as stale.** Re-read `docs/mazj-org-301-redirect-map.md` against the real 14 URLs: it may not anticipate `/bk/` and `/booking/`, and `/contactus/` already 301s off-site to `wa.me/966534600488`, so a Tier-1 row points at a page serving no content.
**Effort:** small.
**Ratio:** Highest in this bucket. It is the difference between inheriting a top-3 Arabic position and deleting it.

### B2. Swap `NEXT_PUBLIC_SITE_URL` and choose the primary domain
**Plain:** One setting controls every canonical address on the site and also whether the site is allowed to be indexed at all. Today it names a temporary Vercel address, which is why the whole origin is blocked from search. Changing it lifts the block automatically; nobody needs to remember to switch anything off.
**Detail:** Set on Production **and** Preview, then redeploy. `IS_PRELAUNCH_ORIGIN` in `lib/site.ts` goes false, `app/robots.ts` stops serving `Disallow: /` and starts emitting the sitemap line **and the AI allow groups already written into that file** (verified present: GPTBot, ClaudeBot and the rest). Add both domains in Vercel, mark one primary, let Vercel 301 the other. That redirect is what carries mazj.org's Arabic equity, so `docs/mazj-org-301-redirect-map.md` must be re-read against whichever name wins. Duplicate content is structurally closed already: one `SITE_URL`, no per-host branch, and **nobody may ever make that origin host-dependent**.
**Effort:** trivial as a setting, blocked by C1.
**Ratio:** Everything. Nothing in this report reaches a crawler until this happens.

### B3. Ship `Vary: Accept-Language` on the language-picking redirect
**Plain:** Typing the bare domain sends an English speaker to the English site and an Arabic speaker to the Arabic site. The response that does that picking is labelled shareable between visitors and never says the answer depends on the visitor's language. A shared cache can hand one visitor's answer to another.
**Detail:** `GET /` returns 307 with `cache-control: public, max-age=0, must-revalidate`, `location: /en` (or `/ar` under an Arabic Accept-Language) and **zero** `vary:` lines. Risk is bounded (`must-revalidate` forces a conforming shared cache to revalidate, and Vercel is not caching it today, no `x-vercel-cache` on the 307). Set the header on the redirect produced by next-intl's middleware in `proxy.ts`. Half the problem disappears with A1, since `/` is the URL the header names as x-default; this closes the rest.
**Effort:** small.
**Ratio:** Moderate. Cheap, and it is the front door.

### B4. Reconcile the domain named in the Terms with the domain in the address bar 🌐
**Plain:** MAZJ's own legal document tells the reader that MAZJ's website is mazj.org. The site currently builds every canonical address as mazj.sa. Whichever name wins, one of those two strings will be wrong, and anything trying to work out which website belongs to which business reads a contradiction MAZJ wrote itself.
**Detail:** `TermsPage.sections[0].body` in both files: "your use of our website (mazj.org)". The built sitemap emits 22 `<loc>` all under `https://mazj.sa/`. Either derive the domain from `lib/site.ts` or resolve the primary-domain question and update both language files in the same edit. It sits on a noindex page, which limits Google exposure but **not** AI exposure: noindex is not nofetch.
**Effort:** trivial once B2 is decided.
**Ratio:** Moderate. Low visibility, but it is a self-authored contradiction about identity.

### B5. Re-run the 20-query English set and the 21-query Arabic set as a before/after
**Plain:** The baseline is now recorded with real numbers: zero MAZJ-owned results in roughly 170 English slots, zero of fifteen non-brand English queries, and position 2 to 3 on two Arabic head terms. A repeat run is the only way to tell whether any of this moved anything.
**Detail:** Same queries, same `location: "Saudi Arabia"`. **Apply the repo's own rule: assert the new value is PRESENT, not only that the old absence is gone**, and print both counts per query, because a stale-only assertion cannot tell success from an empty result set. Earliest useful re-run is roughly 8 weeks after B2, since nothing has been crawlable.
**Effort:** small.
**Ratio:** Moderate. It is the only measurement that closes the loop.

---

## C. OWNER ACTION
*Off-site work only a human with the accounts can do. Ordered by impact/effort.*

### C1. 🔴 Move the Rekaz storefront off `mazj.sa`
**Plain:** This is the real launch blocker and it is not an SEO question. `mazj.sa` today **is** the Rekaz shop. Point it at Vercel and every paid-event ticket button hits a page that does not exist and dies on day one. Rekaz accepts exactly one custom domain, so there is no overlap window: it is a hard cutover.
**Detail:** `REKAZ_STORE_ORIGIN` in `server/rekaz/store.ts` is `https://mazj.sa`, and paid-event buttons plus the JSON-LD `Offer` url are built from `rekazStoreUrl()`. Blast radius is one constant and, probably, zero live sales: the tenant's only merchandise product is `فعالية تجريبية` (a 50 SAR test item). Verify that before assuming it. Probed 2026-07-30: `mazj.rekaz.io`, `mazj.rekaz.sa`, `store.mazj.sa` and `shop.mazj.sa` all fail to resolve, so ask Rekaz for something like `store.mazj.sa`. **Sequence this before B2.** The cutover also hands MAZJ the cleanup tool: a `/:locale/merchandise/:slug` 301 to the new store origin, which is impossible while Rekaz holds the domain.
**Effort:** medium (a vendor request plus a constant).
**Ratio:** Blocking. Nothing in bucket B can happen first.

### C2. 🔴 Remove the fingerprint claim from the storefront today
**Plain:** MAZJ's live, indexed, Arabic shop tells Saudi buyers that access works by fingerprint. That is the exact biometric claim stripped from this site on 2026-07-23 because biometric data is PDPL-sensitive and implies a controller registration MAZJ has spent effort avoiding. The rule was enforced on the site nobody can see and not on the one Google and every AI crawler can.
**Detail:** `mazj.sa/ar`, product `مقعد في المساحة المشتركة`: "دخول لا محدود للمساحة المشتركة خلال فترة الإشتراك باستخدام **البصمة الشخصية**". The page is `robots: index, follow`. On the English-declared URL `mazj.sa/en/subscription/adwyh-almsahh-almshtrkh` the string `بصمة` occurs **13** times and `البصمة` 7, plus 2 more on `mazj.sa/en`, 15 across the English surface. Replace with QR code or card. One field edit in the Rekaz dashboard. **Note the same slug transliterates `عضوية`**, the word retired sitewide, so the banned term also sits in a live URL.
**Effort:** trivial.
**Ratio:** Highest risk-to-effort ratio in the entire report. One field, and it closes a regulatory exposure that was never actually closed.

### C3. 🔴 Fix the four wrong pages on mazj.org
**Plain:** MAZJ's own live site currently tells anyone reading it that the company sells Google Ads, is an accelerator, has three spaces, and is open until 9pm. Every AI answer about MAZJ can quote this, and it is the only wrong source MAZJ can fix today with a WordPress login and no negotiation.
**Detail:** Four edits, all measured live.
- **Hours:** the homepage and at least two more indexed pages state `الأحد إلى الخميس ٩ صباحاً حتى الـ ٩ مساءً`. The truth is 9 to 5. The Instagram bio already says 9 AM to 5 PM, so MAZJ's two loudest surfaces publicly disagree, and Google reads the website. One footer widget.
- **`/services/`:** 407 words of Latin lorem ipsum under the title "Services – مزج | مساحة عمل مشتركة", with headings "Digital Marketing", "Google Ads", "Social Media Marketing", "Wireframes". Indexed, 200, no noindex. Unpublish or replace.
- **`/terms/`:** names the entity `شركة مزج العمرانية لحاضنات ومسرعات الأعمال` under CR 2051222684, i.e. an incubators-and-accelerators company, against the repo's `MAZJ Al-Omrania One Person Company` at the identical CR. It puts the forbidden positioning on a live indexable page.
- **`/عن-مزج/`:** sells three spaces (no private office at all) and caps the hall at `يتسع لأكثر من 20 شخص` against the real 30.
- **`/home-2/`:** 200, self-canonicalising, zero noindex, identical `<title>` to the homepage, and **ranking 4th on MAZJ's own brand name**. `docs/mazj-org-301-redirect-map.md` has said "do this NOW, before launch" and it has not been done: measured noindex count across `/`, `/home-2/`, `/services/`, `/terms/`, `/عن-مزج/` and `/faq/` is **0**.
**Effort:** small (WordPress).
**Ratio:** Very high. Five edits on the property that holds MAZJ's only ranking equity, all currently publishing something false.

### C4. Claim and correct the directories that already list MAZJ
**Plain:** These are the only English pages a customer can currently find MAZJ on, and they publish a closing time four hours late and a star rating MAZJ is barred from claiming. Someone who trusts the listing arrives to a locked door. It costs an email or a form.
**Detail:** `thecoworkingspaces.com/space/mazj-al-khobar` publishes `09:00 - 21:00 (Mon, Tue, Wed, Thu, Sat, Sun)` and renders a "Claim This Space" control, so it is unclaimed. It correctly shows 4.7 (3 reviews). `coworkingspaces.me/al-khobar/` ranks MAZJ **#2 of 11** and publishes "5.0 of 5 (14 reviews)" (corrections to hello@coworkingspaces.me). `houseofsaud.com` (published 2026-04-24) publishes "a perfect 5.0 rating", "Pricing: Contact for rates", "Hours: Standard business hours", and names none of the rooms while giving Servcorp a price and Beehive exact hours. `workin.space` carries the best address on record (`Office 201, Life Tower`) but files MAZJ in an unlinked text block while its FAQ says "We currently list 3 coworking spaces in Al Khobar" and names three others. `zoominfo.com/c/mazj/556922471` points at the stale 2021 site. Ask each to match the site's transliteration (A26).
**Effort:** small.
**Ratio:** Very high. Free, and it is where every English discovery currently lands.

### C5. Get listed on the directories that rank and the ones with a Book button
**Plain:** The pages that come up first when someone asks for a coworking space in Al Khobar do not mention MAZJ at all, while four rival spaces are on both. AI assistants read those pages. Being listed there matters far more than trying to outrank them.
**Detail:** Measured on stripped HTML: `coworker.com/saudi-arabia/al-khobar` (7,455 words, 55,801 chars) contains **mazj 0, Mazj 0, mazj 0, مزج 0**, while Sharik 2, Jovia 1, Regus 2, BURO 2; it claims 13 Al Khobar spaces and MAZJ is not one. `coworkingradar.com/coworking-space-al-khobar/` (1,926 words): mazj 0, beehive 15, servcorp 8, regus 7. MAZJ is absent from **all ten** transactional directories: coworker, liquidspace, instantoffices, coworkingcafe, office-hub, easyoffices, coworkbooking, hotdesk, offices.co, venuewise (open form at `venuewise.com/join/venue`). Coworker emits `Service` and `BreadcrumbList` JSON-LD per venue, so a listing is machine-readable the day it goes live. Arabic side: `ecosystemsa.com/ar/modules/coworking` is `index, follow`, ranks on the head terms, lists 93 spaces including three Khobar rivals (وايت سبايس, شاريك هب, جوفيا) and no MAZJ in the first 12 rendered (caveat: only the first page was read, so absence from all 93 is unconfirmed). Also check `mazaya.monshaat.gov.sa/mazaya/14696`, which appeared in 6 of 21 Arabic searches and is a government surface answer engines weight heavily.
**Effort:** small, roughly a dozen forms.
**Ratio:** Very high. Free placement inside the results MAZJ cannot win directly.

### C6. Claim the Google Business Profile, verify the real rating, and start a standing review ask
**Plain:** For a single-location business this is the one listing that feeds Maps, the local pack and the local-answer path of every AI engine at once, and it is what the directories scrape. Fixing it upstream is what eventually fixes the 5.0 appearing elsewhere.
**Detail:** ⚠️ **DISAGREEMENT, and nobody resolved it.** The brief and repo say 4.7. `thecoworkingspaces.com` says 4.7 (3 reviews). `coworkingspaces.me` says 5.0 (14 reviews). `houseofsaud.com` says "a perfect 5.0". Direct verification failed twice: Google Maps returned a 204,650-byte JavaScript shell whose 7 "MAZJ" hits were the query echoed back, and Bing carried no rating token. **I believe none of the three without a check** and would not quote a rating anywhere until someone opens the profile from a Saudi device. Note the plausible reconciliation: different review counts mean different scrape dates, so 5.0/14 may simply be older than 4.7/3, or the reverse. Review **volume** is the weakest measured signal either way: MAZJ 14 against Servcorp 70, Regus 66, Jovia 58. All canonical field values are already drafted in `docs/google-business-profile-brief.md`, so this is execution, not authoring. Self-serving `aggregateRating` markup stays out of `lib/schema.ts` permanently (see D1).
**Effort:** medium.
**Ratio:** High. It is the upstream source for most of C4.

### C7. Ask Rekaz to stop blocking ClaudeBot and GPTBot on the store
**Plain:** MAZJ's own shop tells Claude and Gemini not to read it. Meanwhile every Book button on this site, and both machine-readable files, walk an assistant to that shop to find the price. So an assistant asked "how much is a desk at MAZJ" is sent to a door locked against it, and MAZJ publishes no price anywhere else by decision.
**Detail:** `https://mazj.sa/robots.txt` is headed `# Rekaz crawler policy` and issues `Disallow: /` to GPTBot, Google-Extended, Applebot-Extended, CCBot, ClaudeBot, Bytespider and meta-externalagent, allowing only OAI-SearchBot explicitly (PerplexityBot inherits the wildcard). It also sets `Content-Signal: search=yes, ai-input=yes, ai-train=no`. **Consequence for reporting:** mazj.sa **is** citable by ChatGPT-search, Perplexity and AI Overviews but not Claude or Gemini; do not describe it as "AI-blocked". Sequence with C1. **If Rekaz refuses**, change the wording in `llms.txt` and `pricing.md` from "follow the link for a price" to "prices are quoted at booking and are not machine-readable", so an agent stops promising a lookup it cannot complete.
**Effort:** small (vendor ask).
**Ratio:** High. One email, and it unblocks the price question for two of the three big assistants.

### C8. Clean up linktr.ee/mazj
**Plain:** This is where every Instagram click lands, and it still uses the word the owner retired sitewide and still advertises last September's promotion.
**Detail:** Linktree's own "About this account" block enumerates `عضوية المساحة المشتركة - عرض اليوم الوطني`, `مكتب خاص (حيّز) - عرض اليوم الوطني`, `غرفة الاجتماعات (الملقى) - عرض اليوم الوطني`, `قاعة الفعاليات (المعارج) - عرض اليوم الوطني`. `عضوية` is zero strings in either message file since 2026-07-31. The National Day offers are roughly eleven months stale. The store link resolves as plain `http://www.mazj.sa/`. Add the address and room names.
**Effort:** trivial.
**Ratio:** High. Highest-traffic off-site page after Instagram itself.

### C9. Correct the Monsha'at profile that publishes MAZJ as an accelerator
**Plain:** `TONE.md` forbids MAZJ from presenting itself as an incubator or accelerator, and a government directory publishes exactly that under MAZJ's name with info@mazj.org attached. Answer engines weight government sources heavily. Enforcing a positioning rule only on pages MAZJ controls means the rule does not hold where it is read.
**Detail:** `sian.monshaat.gov.sa/ar/members/234/شركة-مزج-العمرانية-لحاضنات-ومسرعات-الأعمال`. Note this is the **same wrong entity name** as on mazj.org `/terms/` (C3), so they probably share a source: fix the CR record's trade name once and both follow. Only the listing title was fetched, not the page body.
**Effort:** small.
**Ratio:** Moderate to high. Government surface, forbidden positioning, one correction request.

### C10. Create a Wikidata item
**Plain:** Wikipedia and Reddit are among the richest sources AI assistants cite, and MAZJ exists on neither. A Wikipedia article is not realistic on current coverage. Wikidata is self-serve, needs no notability case, and is the structured entity graph assistants and knowledge panels read.
**Detail:** Measured absent. `en.wikipedia.org` search returned `[]`. Wikidata search for MAZJ returned only Q108058479 (a Belarusian family name), two Iranian villages, the Shirvanshahs and the Kazakh Majilis; the Arabic `مزج` search returned audio mixing and three classical poems. Seed with `instance of: coworking space (Q97307779)`, coordinates 26.302126 / 50.176999, address, inception, official website, the canonical facts from `docs/google-business-profile-brief.md`. Pairs with A11's `additionalType`.
**Effort:** small.
**Ratio:** Moderate. Cheap, durable, and it is the entity record everything else can point at.

### C11. Publish one future event per month, in both languages
**Plain:** The newest thing on the site happened 547 days ago and the page currently says, in both languages, that nothing is scheduled. A search engine or an assistant reading it concludes the programme stopped. No code change creates freshness here.
**Detail:** Live read 2026-08-02: 41 rows, all published, **zero with a future start date**. Max `starts_at` 2025-02-01. Year distribution: 2022 one, 2023 twenty-nine, 2024 eight, 2025 three. Zero rows in `event_registrations`, consistent with nothing to register for. Everything downstream is already built and automatic: `Event` JSON-LD on the event's page, a sitemap entry with `lastModified`, an `/ics` child, and the read-time move into the archive when it ends. **Blocker to be aware of:** paid tickets are currently impossible (measured 2026-08-01, zero ticketable products in Rekaz, so `/admin`'s ticket price dropdown is empty). Free sign-up is unaffected.
**Effort:** medium, ongoing.
**Ratio:** High. Freshness is the one authority signal that cannot be bought or written once.

### C12. ⚖️ Decide: does `المكتب المرن` survive contact with the Arabic market?
**Plain:** MAZJ's own Arabic word for its flagship product retrieves Syrian company-formation law and the Saudi Ministry of HR's employment programme, and zero Saudi coworking results. A buyer typing MAZJ's word for its main product lands on employment law.
**Detail:** Measured retrieval failure, not taste. `"المكتب المرن" مساحة عمل` (Saudi geo) returned taghouse.global, emkan.sy ("أول شركة لخدمات المكتب المرن في محافظة حلب"), syrianmemory.org quoting a Syrian ministerial decree defining المكتب المرن as a licensed registered office, forsa.sy, tas-heel.sy, shuraa.com. `مكتب مرن الدمام الخبر` returned marn.io at 1, 3 and 4, hrsd.gov.sa "العمل المرن", monshaat.gov.sa. **Zero Saudi coworking results in either run.** MAZJ's own storefront already uses the market-correct wording, `مقعد في المساحة المشتركة`, so this is also an internal inconsistency. `الدخول اليومي` by contrast is **correct and well attested** (spacesksa, unboxinc, regus.com/ar, bayut, أثر+) and must not be touched. ⚖️ `المكتب المرن` is named as settled in root `CLAUDE.md`, so no string moves without a ruling. If the answer is yes, the follow-on work is A-shaped and needs the value-sharing check first: `المكتب المرن` is one string serving **six** keys.
**Companion problem, same decision:** the open-desk page already calls the product three things in its three highest-weight slots. Eyebrow `المكتب المرن`, h1 `العمل المشترك`, intro (which is also the meta description) `المساحة المشتركة`, while `/pricing.md` publishes a fourth pick, `Spaces.cards.openDesk.name`. Whatever the ruling, one name must win.
**Effort:** small (the decision); medium (the sweep).
**Ratio:** High if the answer is yes. This is the largest single Arabic retrieval defect measured.

### C13. ⚖️ Decide: does any price appear on marketing pages?
**Plain:** Every competitor that ranks in Arabic puts a figure straight into the search snippet, which is what both a buyer and an answer engine read. MAZJ shows a price on exactly one surface, and that surface is the one about to move off the domain. After the move, MAZJ will have no public price anywhere in Arabic.
**Detail:** This is a positioning decision, not an engineering one, and it should be taken deliberately rather than inherited. Measured snippets: Servcorp `٩٦٠ ريال شهرياً` and `قاعات الإجتماعات ٢-٦ أشخاص SAR 210 / للساعة`; Regus `الأسعار من SAR 43 لكل شخص في اليوم`; theoffice-int `الخبر - السيف (١٠-١٤ شخص), 300 SAR, 450 SAR, 1500 SAR`; spacesksa `الدخول اليومي. 3 ساعات. 35 ريال سعودي`. Note the guardrail was already relaxed once (2026-07-27, live Rekaz prices inside the booking flow) and that relaxation is currently moot because the flow is suspended.
**Effort:** small (the decision).
**Ratio:** High. It is the filter buyers and assistants both apply first.

### C14. ⚖️ Supply the nine facts nobody on the site can invent
**Plain:** If an AI compares MAZJ with another Khobar workspace, it can fill about half the table. The blanks are the reasons it recommends someone else. A claimed prayer room that does not exist is worse than a blank cell, so none of this can be written without the owner.
**Detail:** (1) How many open desks (was "25", removed with the `/about` stat block; `TONE.md` §6 says its home is the product page and it is the owner's call). (2) How many private offices (was "3"). (3) Is a monthly open desk **your** desk or free seating each day, the single most-asked coworking question the site does not address. (4) Parking: free or paid, on-site or street, roughly how many (`Faq.groups[0].items[5]` currently says only "available around the tower", 24 words). (5) Prayer room, in the space or the building. (6) Printing and scanning, included or paid. (7) Lockers or storage for monthly subscribers. (8) Pantry or kitchen, and may people bring food in. (9) Step-free access and lift. Measured absent from every string: `locker` 0, `kitchen` 0, `prayer` 0, `musalla` 0, `phone booth` 0, `monitor` 0, `socket` 0, `lift` 0, `wheelchair` 0, `step-free` 0, `printing` 0 (the four raw `print` hits are inside "sprint"). **Landing place:** the 16 existing space-page `faq` arrays, not a new fifth `facts` row per page. **Nothing may ship with a placeholder in it.**
**Effort:** small for the owner; small for the copy afterwards. 🌐
**Ratio:** High. Nine answers unlock the comparison table an assistant needs.

### C15. ⚖️ Three more questions the copy cannot settle
**Plain:** Three small decisions, each currently blocking a page.
**Detail:** (a) **The floor number.** ⚠️ Corrected: it is not an oversight. `Faq.groups[0].items[2].a` deliberately says "reception will point you to the right floor on your first visit". Third parties publish `Office 201, Life Tower`. Ask whether to publish it. If yes, note that `Location.address` feeds `lib/schema.ts` `streetAddress`, so it must change **in step with the Google Business Profile** or MAZJ ends up with two machine-readable addresses for one door. (b) **A published email.** `info@mazj.org` appears only on the two noindex legal pages. Publishing an inbox is an owner call. ⚠️ Do **not** propose a phone row: `LocationHours`' docblock records that as a deliberate omission until a verified number exists, and the WhatsApp number already ships twice in the `/contact` DOM and as `telephone` in the sitewide JSON-LD. (c) **May a named human sign the About page**, with a role and a photograph. Measured: zero person names across all 705 leaves in either language. The only named humans reachable are event hosts rendered as card subtitles.
**Effort:** trivial for the owner.
**Ratio:** Moderate. Small answers, each unblocking a page.

### C16. ⚖️ May past hosts and partner organisations be named on a dedicated page?
**Plain:** The strongest proof MAZJ has is not its in-house series, it is the events it ran with named outside institutions, because those are the only ones a stranger can go and verify.
**Detail:** Six organisations appear once each in the archive (Asharqia Chamber, Mada Cultural Club, Studio Acumen, Karkam, Vena, Al-Asala University) and **none appears in any string in either message file**, so none is currently claimed anywhere. Nineteen of the 41 rows belong to no series, and that is where the institutions sit. A one-line archive entry does not distinguish a partner from an attendee, so the owner must say which of the six may be named as a partner. Roughly eleven people are also named in archive subtitles. They are already public on `/events`, so this is a confirmation rather than a new disclosure, but it involves real people.
**Effort:** trivial for the owner; blocks D6's replacement.
**Ratio:** High. It is the difference between an unverifiable claim and a citable one.

### C17. Read the Reddit threads before posting anything
**Plain:** People in Khobar are asking in public, in both languages, exactly the question MAZJ answers, and the answers they get today name cafes and competitors. Astroturfing would be worse than silence, so the honest route is real customers and disclosed operator replies.
**Detail:** Threads on point: r/Khobar "Internet Cafe with Private/Meeting Rooms" (snippet mentions "24/7 Co-working Space with Private Room and Generator"), "Cafes for Remote Work", "افضل كافيه للإنترنت السريع في الخبر", plus r/saudiarabia "Best work/study coffee shop in Khobar?". **Comment bodies could not be read** (firecrawl returns "we do not support this site", WebFetch is blocked for reddit.com), so whether MAZJ is ever named there is unverified and needs a manual browser check first.
**Effort:** medium.
**Ratio:** Moderate. Real demand signal, real reputational downside if done wrong.

### C18. ⚖️ Decide whether the Arabic prose block in `/llms.txt` is hand-written
**Plain:** The English "answering questions about MAZJ" section is the part an assistant quotes verbatim, and it has no Arabic twin. Writing one is 55 lines of prose that nothing would keep in sync.
**Detail:** The i18n both-file rule and `test/i18n-parity.test.ts` govern `messages/*.json` only, not a route handler, so an Arabic block would drift against its English twin with no alarm. That is the exact failure the file's own docblock says it was built to avoid ("Everything below is DERIVED"). Options: hand-write it and accept the drift risk, or restructure so both languages derive from one source. The derived Arabic (A18a) ships regardless.
**Effort:** small decision.
**Ratio:** Low. See A18's honesty note on how much anyone reads this file.

### C19. Keep Instagram synchronised as a launch checklist item
**Plain:** Instagram is position 1 or 2 on the brand query, ahead of the storefront, holds 6,762 followers and 115 posts, and is currently the only MAZJ surface anywhere stating the correct hours.
**Detail:** Bio verbatim: `SUN الأحد - THU الخميس / 9 AM - 5 PM / الخبر | العليـا | برج الحياة`. It is also where the Khobar day-rate and study intents are actually being served, since no Khobar website ranks for them (measured: the only Khobar-specific answers were a TikTok for "Muse space" and @wandco_sa). Keep bio, hours, address and product vocabulary matched to the site. Facebook (`facebook.com/mazjorg`, 4 likes) is dormant; there is no LinkedIn company page, and a similarly-named Riyadh marketing consultancy (`linkedin.com/company/mazeej-مزيج`) occupies that search space.
**Effort:** trivial, recurring.
**Ratio:** Moderate. Free, and it is the highest-ranking MAZJ surface on the brand query.

---

## C-DEFERRED: the three large content builds
*Real work, real return, but each is weeks not hours, and each has a prerequisite. Listed after C so nothing above waits on them.*

### CD1. `/programme`: the four series as original data 🌐 ⚖️(C16)
**Plain:** One page telling the story of what has actually happened at MAZJ since 2022, organised by the four recurring series with real names and real dates. Nobody else can write this page, which is exactly why an assistant would quote it.
**Detail:** 22 of 41 rows carry a series key: Coffee & Sketch 9 editions (Feb 2023 to Jan 2025), Loqma w Fayda 6 (2023), Women Who Design 4 (Jun to Sep 2023), The Brand Factory 3 (Feb 2024 to Jan 2025), with `V1` to `V9` edition markers stored. `TONE.md` §6 bans the **tally**, not the series, and `AboutPage.communityBody` already ships "a sketching series that came back nine times", so edition counts are established as permitted. 🔴 **Two claims the source plan made that must not be written.** (1) **Host is not a stored fact.** `host_en`, `host_ar`, `location_en`, `location_ar` are NULL on all 41 rows; "Asma Habib" is a `summary_en` value, and the import's own header says the split was not made "because that split would have been a guess, and a guess written into a database is indistinguishable afterwards from a recorded fact". Some summaries are plainly not hosts ("AIA Middle East award winner"). Either get the owner to confirm each host and write it into `host_en`/`host_ar` first, or publish the series with no host attribution. (2) **"The hall is named in 41 archived events" is false**: `المعارج` and "Al-Ma'arij" appear **zero** times in the archive migration. The site has never recorded which room any archived event used. Also: this would re-list the same 41 rows `/events` already renders, so write the series narrative first and let dates follow it, never a second date-ordered list; and link it from `EventsPage.intro`, which already says "Four of them became recurring series". Emit no `Event` markup for past events.
**Effort:** medium.
**Ratio:** High per unit of effort, gated on C16.

### CD2. The bilingual definitive guide to coworking in Al-Khobar 🌐
**Plain:** The one page that answers the head question fully. In Arabic nobody owns it: the top-ranking Arabic guide names **zero** actual spaces, and its entire Eastern Province section is one sentence of adjectives with no name, address, price or link, while every outbound link goes to its own Riyadh property inventory.
**Detail:** `reinvest.sa`'s guide ranked #2 on "مساحة عمل للشركات الناشئة السعودية" and is `index, follow`. Being the only named, structured Arabic source makes MAZJ the default citation **even in answers about competitors**. ⚖️ Requires an owner decision on naming competitors (Jovia, White Space, Servcorp, Regus/Spaces at Ajdan Walk, Aziz, Sharik Hub). Cite at least three outside sources with real figures fetched from GASTAT or Monsha'at, never written from memory. **Do not state a price. Do not publish a self-authored "best of" ranking (see D3).** 🔴 **Do not point the mazj.org head-term 301s at this URL on day one:** that sends four years of Arabic ranking equity to a page with zero history. Land them on `/ar` and `/ar/spaces`, the nearest existing equivalents and the targets `docs/mazj-org-301-redirect-map.md` was written against; move them later once the guide has ranked on its own.
**Effort:** large.
**Ratio:** Highest ceiling on the list, lowest certainty. Ranked here because the effort is real and the credibility depends entirely on doing the citation work properly.

### CD3. The three unowned intent pages: events hall, commercial registration, and getting here 🌐 ⚖️(C14, C15)
**Plain:** Three questions with real money behind them that nobody in Al Khobar answers.
**Detail:**
- **Events hall / 30-person workshop.** Measured vacancy: "event venue hire Al Khobar" returned **10 of 10 hotels**, zero coworking spaces, quoting 1,400-guest ballrooms at 1,500 to 8,000 SAR per day. In Arabic, four separate event and meeting queries returned zero MAZJ while theoffice-int, Servcorp, wspace and hivebusiness.sa all rank with bookable capacity-stated pages (hivebusiness lists "تتسع القاعة لعدد 30 شخص", directly comparable). The English metaTitle and the FAQ string "Where can I run a 30-person workshop in Al-Khobar?" already exist. ⚖️ Three owner facts first: catering arranged or brought in, the actual screen and sound spec, and **whether the hall can be booked outside staffed hours** (a weekday-evening framing contradicts 9 to 5, so answer this before writing it, not after).
- **Commercial registration.** "Can I register my سجل تجاري or عنوان وطني at your address?" is a legal prerequisite for trading, so it is a money question. Searched in Arabic against Khobar, **not one Khobar coworking space answers it**: the page is held by Saudi Post and my.gov.sa, with Servcorp and Executive Centre monetising the gap through virtual-office products. A truthful, specific answer wins a high-intent query with almost no competition, **and an honest "no" still earns the citation.**
- **Getting here.** `/contact` is 203 words, the thinnest route on the site, and gives no directions beyond the street name. Depends on C15(a).
**Effort:** medium each.
**Ratio:** High for the events hall (measured empty result page, product already exists), high for the CR question (zero competition, one honest paragraph), moderate for directions.

---

## D. DELIBERATELY NOT DOING
*Reasons recorded so these are never re-litigated. Each will be proposed again by a future audit; close it by pointing here.*

**D1. Self-serving `aggregateRating` markup.** A business rating itself on its own site violates Google's structured data policy and is ineligible for rich results anyway. Measured: `aggregateRating` count across the built output is 0, and the reasoning already lives in `lib/schema.ts`. The real 4.7 belongs on the Google Business Profile; the correct move is to link to it. Owner-brief constraint, and it stays.

**D2. An Open Knowledge Format bundle.** Designed for large catalogues; MAZJ has 11 indexable routes, 4 products, no published prices, one address and one set of hours. Everything OKF would express is already emitted three ways. A fourth channel multiplies the places a fact like the 9-to-5 hours must be corrected, which is the failure this repo has already paid for. Revisit only on prices published, a second location, or roughly fifty pages. ⚠️ Note the original argument for this cited a structured-data inventory that was **partly invented** (it claimed FAQPage on the four space pages before that shipped); the corrected, smaller inventory is a **weaker** case for a fourth channel, not a stronger one.

**D3. A self-authored "best coworking spaces in Al-Khobar" listicle.** This is the default advice in every AI SEO guide and it is wrong here. MAZJ is an emerging brand in this category, so a self-authored ranking would likely earn the citation while handing the recommendation to whoever the model already trusts, and MAZJ would be publishing judgements about competitors it cannot fairly assess. Weight instead toward formats where MAZJ is the primary source about itself (A19, CD1). Naming competitors **inside** a genuine guide (CD2) is a different question and is open.

**D4. Backfilling all 41 archive rows into individual pages to add URLs.** The existing gate in `app/[locale]/events/_lib/events.ts` is **correct and must not be lowered**: 0 of 41 rows have a description in either language and 0 have a poster, so this would ship 82 thin URLs in two languages pointed at from the one good page on that route. Consolidate upward (CD1) instead. Any single archived event that gets a proper bilingual write-up earns its page automatically with no code change.

**D5. Programmatic page generation** (one page per Al-Khobar district, per query variant, per duration). MAZJ has **one** address, 4 products and 22 indexable URLs. Twenty near-identical pages about one room is scaled content generation, and that triggers a **site-wide** action, not a page-level one.

**D6. Any claim about which room an archived event ran in, or who hosted it, that is not confirmed by a human.** `host_en`, `host_ar`, `location_en`, `location_ar` are NULL on all 41 rows, and `المعارج` / "Al-Ma'arij" appear zero times in the archive migration. The permitted claim is the one already shipping in `SpaceEventHall.about[1]`: the hall has been hosting community events since 2022. Unblocked only by C16.

**D7. A separate content layer written for AI that differs from what people see.** Google's guidance forbids it. `/llms.txt` and `/pricing.md` are legitimate **precisely because** every fact in them is derived from the same `messages/*.json` the pages render, so they cannot say anything the site does not. Hand-writing a divergent version turns a compliant file into cloaking. (This is the constraint that makes C18 a real decision rather than an obvious yes.)

**D8. Narrowing `NextIntlClientProvider` to per-route namespaces.** Measured: `/en/contact` is 116.8 KB of HTML carrying a 53.5 KB message payload against 1.1 KB of visible text, 48.6x. That is a **payload** fact, not a readability one: no measurement anywhere in this report shows a crawler truncating a 117 to 192 KB document, and every mainstream extraction pipeline strips `<script>` before chunking, so the text an AI indexes is already the 1.1 to 4.7 KB. The fix has a real risk the finding did not state: once the provider is given an explicit narrowed object, a client component reading an unpicked namespace **throws at runtime**, and `vitest.config.ts` is `environment: "node"` with no jsdom, happy-dom or testing-library, so **no test in this repo can catch it**. Revisit only as a performance task, verified route by route in a browser in both locales, and say in the report that it was not machine-verified.

**D9. A separate `Organization` node, and a `SearchAction`.** `LocalBusiness` already descends from `Organization`, so a second node is a duplicate entity claiming to be the same company, which is worse than nothing. The site has **no search of any kind**, so declaring a `SearchAction` is invented structured data, the exact site-wide penalty risk `lib/schema.ts`'s own header warns about. The `WebSite` node in A11 ships **without** one, and the refusal goes in its docblock.

**D10. Targeting the transliteration `كوروركينج سبيس`.** Dead vocabulary. Searched with Saudi geo it returns a children's play centre (`@myspace.ksa`, "ألعاب أطفال بالخبر"), a VIP venue brand and an Alexandria coworking Facebook page. Buyers use `مساحة عمل مشتركة` or the Latin "coworking space".

**D11. Contesting the English head terms** ("coworking space Al Khobar", "private office rental Al Khobar", "hot desk Khobar"). Held by Regus, Servcorp and Spaces plus **16+ aggregators counted across 20 queries**, from a domain with no English backlinks. Point the English effort at the 43 question-shaped strings already in `en.json` and the four gaps they match. Note the structural opening this creates: Regus and Spaces both serve a 1,163-byte Imperva interstitial carrying `META ROBOTS NOINDEX, NOFOLLOW` to a full Chrome UA, with robots.txt unreachable behind the same wall, so **they cannot be read by AI engines at all** and English answers fall back to directory listicles. Being the one readable, well-marked-up, bilingual operator is how MAZJ takes the operator slot without fighting for the head term.

**D12. Changing `الدخول اليومي`.** Correct and well attested across spacesksa, unboxinc, regus.com/ar, bayut and أثر+. It is the one piece of settled Arabic product vocabulary the market research **confirms**. Do not touch it while C12 is open.

**D13. Adding a phone row to `/contact`.** `components/LocationHours.tsx`'s docblock records the omission as deliberate until a verified number exists, and `966534600488` already ships twice in the `/contact` DOM inside the `wa.me` hrefs and as `telephone: "+966534600488"` in the sitewide `LocalBusiness` node. Proposing a phone row is re-opening a decision, not fixing an oversight. The email and the floor (C15) are the genuine gaps.

**D14. "Fixing" the blocked robots.txt by editing `app/robots.ts`.** `IS_PRELAUNCH_ORIGIN` in `lib/site.ts` is true for any `*.vercel.app` host and lifts itself the moment the origin becomes real. Set the domain (B2). ⚠️ Note one divergence from the owner ruling worth a glance rather than a change: the ruling said blocking CCBot is acceptable, and the file as written deliberately **allows** it, with the reasoning in the comment. That is defensible under "maximum citation reach"; flagging it so it reads as a choice, not an oversight.

---

## Disagreements between reports, and which side I believe

| Question | Sides | Verdict |
|---|---|---|
| Is mazj.org noindexed? | Project memory and Firecrawl cache say yes; four live `curl` runs across four user agents and a second dimension's independent search say no | **Not noindexed.** Live HTML over cached metadata, and Firecrawl's robots metadata was independently wrong about houseofsaud.com in the same session. Changes launch from "recover" to "do not drop" (B1). |
| Google rating: 4.7 or 5.0? | Repo and thecoworkingspaces say 4.7 (3 reviews); coworkingspaces.me says 5.0 (14 reviews); houseofsaud says 5.0 | **Unresolved and nobody could measure it.** Maps returned a JS shell, Bing carried no rating. Do not quote any figure until C6. Plausible reconciliation: different scrape dates, since the review counts differ too. |
| "The homepage never says MAZJ is a coworking space" | Auditor: critical; adversary: false | **Adversary.** `Meta.metaTitle`, `Meta.description` and `Hero.eyebrow` all state it, and `TONE.md` §7 names the eyebrow as the sanctioned slot. The real defect is narrow: one shared body string lost the category **in English only** (A5). |
| "No page tells a reader where the price lives" | Auditor: high; adversary: false | **Adversary.** All four space pages say it; the auditor's 3-of-11 count missed every instance of the word "rate". The genuine gap is the questions page in both languages (A10). |
| "Saudi Arabia appears nowhere" | Auditor: high; adversary: low | **Adversary.** `addressCountry: "SA"` and `areaServed: "Eastern Province, Saudi Arabia"` ship in the sitewide JSON-LD on all 11 routes, and "Eastern Province" appears 4 times in `en.json` including the homepage title and meta description. Visible-prose only, folded into A5. |
| Arabic h1 kashida on head terms | Auditor: high, with eight ready-to-ship replacements; adversary: owner design call | **Adversary.** The clean undecorated term appears in the same namespace's body copy on every affected page (`المشترك` 10, `الاجتماعات` 5 plus `غرفة` 13, `الفعاليات` 5 plus `قاعة` 15), **zero decorative kashidas ship in any `<title>`, metaDescription, FAQ, photoAlt or JSON-LD string**, and it is already escalated in `docs/ai-search-visibility-audit.md`. Do not ship the proposed strings: one puts a 5-tatweel run on a two-letter word, and the font draws only 1 to 5 per letter shape with a silent degrade. Any relocation must be proven by glyph name. |
| `/llms.txt` Arabic parity severity | One dimension: high; the same set elsewhere: "unlinked, no major AI crawler retrieves from it" | **The sceptical reading.** Ship the derived half because it is nearly free; do not spend hand-written prose there (A18, C18). |
| `/llms.txt` FAQ: inline or sibling file? | Auditor: inline 36 pairs, ~16 KB; adversary: `/faq.md` sibling | **Sibling.** The convention is a short index that links out, and it gives the Arabic its own room. |
| External anchor count | "22 external anchors" vs its own per-host list summing to 55 | **55.** The finding contradicted itself; 22 is not any quantity on this site. |
| Events staleness | 546 days | **547.** 2025-02-01 to 2026-08-02. |
| Sitemap has 22 URLs and zero events: code defect or data state? | Auditor: the `[slug]` route renders for nothing; adversary: `app/sitemap.ts` already appends per event | **Adversary**, with a caveat: 22 is exactly 11 indexable routes × 2 locales, so it means no event has a detail page. But root `CLAUDE.md` documents a 22-entry sitemap as the known symptom of a **missing `IP_TRUST_PROXY` at build time**, so this measurement cannot distinguish "no events published" from "local env degraded". Re-measure with the variable set before drawing either conclusion. |
| ZATCA and CR outbound citations | Auditor: link to the entity records | **Not as written.** Both are form-driven lookup tools with no per-entity permalink. Link the public lookup tool once, on one page, with the number beside it. Sitewide in the footer would be 22 outbound links to a government form, which is a footer pattern, not a citation. |

---

## What nobody measured
*Named so the gap is visible rather than implied. Each of these is a claim this plan cannot make.*

1. **Whether any AI assistant cites MAZJ today.** Zero queries were run through ChatGPT, Claude, Perplexity or Gemini. Firecrawl's search API returned only `data.web[]` across all 21 Arabic runs, with no `aiOverview`, `answerBox`, `peopleAlsoAsk` or `localPack` field, and no rendered Google session was used. The English dimension's "AI summaries" are the search tool's own summaries, not a production answer engine. **Every "an assistant would answer X" statement in all nine reports is inference.** This is the single largest hole in the evidence base, and it is measurable: run the twenty English and twenty-one Arabic queries through the four assistants and record what each names.
2. **The live Google rating and review count.** See the disagreement table. Needs a Saudi device.
3. **Whether MAZJ appears anywhere in ecosystemsa.com's 93 entries.** Only the first 12 rendered were read.
4. **What r/Khobar's comment bodies actually say**, including whether MAZJ is already named there. Both fetch routes are blocked.
5. **Whether the Rekaz storefront's displayed prices are VAT-inclusive.** Asserted in one proposed FAQ answer and stripped from it here.
6. **Whether any crawler truncates or degrades on a 117 to 192 KB page.** The whole payload argument (D8) rests on an unmeasured premise in both directions.
7. **Any before-and-after anything.** The entire origin has served `Disallow: /` throughout, so none of the nine dimensions measured a crawlable MAZJ. Every projected gain is a model, not an observation.
8. **Whether a relocated kashida actually draws.** The font draws 1 to 5 per letter shape and a miss degrades silently to flat tatweels. No proposal was verified by glyph name.
9. **The Arabic `Startups` namespace**, which was audited in English only.
10. **Performance and Core Web Vitals**, entirely out of scope for this audit set (a separate 2026-07-31 pass exists: 38.4 MB to 8.6 MB across 12 routes, perf 77 to 83, median of 3).
11. **Whether MAZJ appears in any Saudi chamber, Monsha'at or ecosystem registry.** Searched and not found, but those are largely PDF and portal content that search indexes poorly, so this is absence of evidence, not evidence of absence.
12. **The `sian.monshaat.gov.sa` page body.** Only the listing title was fetched, so the wider page contents are unknown.
13. **Whether `حيّز` is distinctive.** One Jeddah workspace trading as "مساحة حيز" surfaced in a single brand-adjacent query. One observation, no dedicated brand search.
14. **Whether Jovia publishes structured data.** No owned domain was located for it, the closest single competitor to MAZJ's startups angle.