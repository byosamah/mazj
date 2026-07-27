# TONE.md: MAZJ Copywriting Standards

The single source of truth for how MAZJ copy sounds and what it may or may not say. Follow it for **every** piece of user-facing text: site copy, `Meta` (titles/descriptions), image `alt` text, CTA labels, and WhatsApp prefilled messages. It is written for you, for any future copywriter, and for Claude.

> **The one rule that governs the rest:** read this file before writing or editing any copy, and treat it as a **living document** (see §10). File mechanics (how the two JSON files stay in sync) live in `CLAUDE.md`; voice and content rules live here.

---

## 1. Who we are, who we write for

- **Brand:** MAZJ / مزج. مزج means *to blend / mix*. One coworking space in **الخُبر** (Al-Khobar), حي العليا, inside **برج الحياة** (Life Tower). Community-driven; it has hosted 40+ community events since 2022.
- **Audience:** founders and startups, designers, architects, builders, students. Creative, ambitious people building things.
- **The promise:** we are a space that feels like a community. Copy sells belonging and momentum, not square meters.

---

## 2. The voice

- **Arabic-first, always.** Think and write the **Arabic first**, then derive the English to match its meaning and warmth. Never a literal back-translation; the English must read like a native wrote it.
- **Register:** فصحى بيضاء حديثة (modern white MSA) warmed with a direct, human Saudi touch. **Between formal and casual.** Address the reader as **أنت**.
- **Feel:** warm, confident, inviting, a little conversational. Never corporate-stiff, never slangy or heavy dialect, never a markety cliché.

> Example (hero): `هنا تجد مكانك، وناسك.` / "Find your place. And your people." (belonging and warmth, not the old "Work in good company.")

---

## 3. The three mandates

### 3.1 Positivity: the #1 rule
Zero negativity. No pain-framing, no "the old way", no listing what is wrong with home, cafés, leases, or working alone. Lead with aspiration, belonging, possibility, community, momentum. **Every line should make the reader want to come.**

- ✗ `البيت مليء بالمشتّتات. والمقاهي صاخبة` → ✓ `لأعمالك طاقةٌ خاصة، تتّقد حين تكون بين من يشاركونك الشغف.` ("Your best work has an energy, and it kindles among people who share your drive.")
- ✗ "Be the first to fill Al-Ma'arij" (implies an empty room) → ✓ `المعارج جمعت الناس لسنوات، والآن دورك` ("Al-Ma'arij has gathered people for years. Yours is next.")
- The `/about` opener shipped as the ✗ above almost verbatim and survived until 2026-07-26: ✗ `البيت مليء بالمشتّتات، والمقاهي لا تمنحك مكاناً يخصّك. كان روّاد الأعمال والمستقلون والفرق... بحاجة إلى مكان لهم` → ✓ `يزدهر العمل حين يلتقي التركيز بالصحبة. من هذا جاءت مزج: طاولةٌ تجلس إليها لتنجز، ومن حولك من يعملون مثلك.` Note the fix also drops the deficit verb (`كان... بحاجة إلى`) and the flagged audience list, not just the two negative clauses.
- **"instead of X" is pain-framing wearing a coat.** ✗ `بعقد مرن بدلاً من عقود الإيجار الطويلة` / "on a flexible term instead of a long lease" → ✓ `بعقدٍ مرن يمتدّ بمقدار ما تحتاج` / "on a flexible term that runs as long as you need". State the good thing; never name the bad alternative.
- **Sweep for this, don't trust a read-through.** Both violations above were found by grepping for the banned frames (`مشتّتات`, `المقاهي`, `بحاجة إلى`, `instead of a long lease`, `distraction`), not by reading the copy. Careful: `لا تمنحك` also matches the Terms licence clause (`ولا تمنحك أي ملكية`), which is required legal language and must stay.
- Even hard facts stay warm and honest (see §5, refund example). Positivity is not dishonesty; it is framing.

### 3.2 Uniqueness
No hook, verb, metaphor, sentence-opening, or phrase repeated across sections. Each section earns its place with a distinct idea; vary how sentences open.

- Do not reuse the same `روّاد الأعمال والمستقلين والفرق` list in two adjacent sections.
- Watch section seams: "grows" in one heading bumping "ideas grow" in the next; "people building" echoing the startups band. Re-word the weaker instance.
- **`مساحة` is spent. Never build a display line on it.** It runs 65× in `ar.json` (`Nav.getStarted` `احجز مساحة`, `Steps.qualifyCta` `احجز مساحتك`, `Steps.step2Heading`, `Steps.step1Cta` `شاهد المساحات`, the locked finder prompt `أي مساحة تناسبك؟`). Same for the hero's `تجد` (7×). The footer sign-off `اعثر على مساحتك` broke both at once and was the **third** "find your ___" on one page (hero `تجد مكانك` → StepInto `التقِ بناسك` → footer), so it was the weaker instance and was re-worded: ✗ `اعثر على مساحتك` → ✓ `نراك قريباً.` ("See you soon.").
- **A closing line closes; it does not issue another CTA.** The footer `<h2>` sits below five booking CTAs, so an imperative there is the sixth. Prefer a positive-presumptive sign-off (assume the visit) over an instruction.
- 🔴 **The hero viewport is a shared word budget; the subtitle gets what's left.** In one screen the eyebrow owns the category + `الخُبر`, the locked h1 owns `مكانك` / `ناسك` / `تجد`, the finder owns `مساحة` + `احجز`, the chips own the amenities (`DRINKS + WI-FI`), and the trustline owns the hours. The subtitle may not respend any of them. The old one spent four at once: it repeated `الخُبر`, listed four products the finder beside it already lists, opened its second sentence with a third on-screen `احجز`, and closed on `مساحةٍ تشبهك`, which just restates the h1.
  - ✗ `مكاتب مرنة، ومكاتب خاصة، وغرفة اجتماعات، وقاعة فعاليات في الخُبر. احجز على راحتك، وابدأ صباحك في مساحةٍ تشبهك.`
  - ✓ `صباحك يبدأ بقهوة، ويومك مع زملاء يفهمون ما تعمل عليه.` ("Your morning starts with coffee, your day with colleagues who get what you're working on.")
  - **Nothing is lost by dropping the product list**: the finder enumerates all six spaces in the same viewport and the eyebrow carries category + city. Prose that repeats a widget is dead words.
- **Check the ADJACENT section for structural echoes, not just repeated words.** `WhyMazj` renders directly under the hero and already opens `تتّقد حين تكون بين من يشاركونك الشغف`, which ruled out an otherwise-clean `بين من يفهمون ما تعمل عليه` for the hero: same `بين من` + relative-clause shape, two sections apart. `زملاء` (0 prior uses) carried the same idea without the echo.
- **`str.count` the root before reaching for a "fresh" word.** Two obvious replacements were killed this way: `يمتزج` is already WhyMazj's payoff (`ويمتزج ذلك كله معاً`) and the door metaphor is already Network's (`قد تفتح باباً`), both on the same page as the footer.

### 3.3 The belonging + blend thread
The brand's emotional spine is *a place that is truly yours, among your people* (**مكانك وناسك**), and *work + community blended into one* (**مزج** = blend). Bookend it from the hero to the finale (hero `وناسك` → StepInto `التقِ بناسك`). Let the blend idea recur without repeating the same words.

---

## 4. Arabic naturalness (write for a Saudi ear)

- **Avoid calques (literal loans that read wrong).**
  - "staffed" is **not** `مخدومة` (reads as *being serviced / cleaned*) → `الفريق في استقبالك`.
  - EN calque `faces meet` (from `وجوه تلتقي`) → `people meet` (in English people meet, not faces).
- **Use Saudi-natural verbs, not Levantine/Egyptian.** `احكِ لنا` (storytelling connotation) → `حدّثنا` / `أخبرنا`.
- **No archaic imperatives.** `الْقَ ناسك` → `التقِ بناسك`.
- **City spelling is settled: `الخُبر`** (damma only), every time. Never bare `الخبر` (also reads "the news") or fully-vocalized `الخُبَر`.
- 🔴 **`برج الحياة` is an address, NOT a landmark. The default locator is `الخُبر` alone.** The tower is not famous, so naming it in marketing copy tells the reader nothing and just lengthens the line. It had spread to **38 keys** (hero subtitle, meta description, all four space pages, three FAQ product answers, four alt texts, two metaTitles) and was stripped from 26 of them.
  - ✗ `وقاعة فعاليات في برج الحياة بالخُبر` → ✓ `وقاعة فعاليات في الخُبر`
  - ✗ "MAZJ's meeting room at Life Tower in Al-Khobar" → ✓ "MAZJ's meeting room in Al-Khobar"
  - **The address-function rule:** the tower survives only where a real address, directions, or legal registration appears, i.e. the `Location` block, the "where are you?" and parking FAQs, the Privacy + Terms registered address, `/about`'s "One address" chapter, the office page's address paragraph, and `ContactPage.metaTitle`. Twelve keys total. Anywhere else, the locator is `الخُبر`.
  - 🔴 **`Location.address` is load-bearing beyond copy:** `app/[locale]/layout.tsx` feeds it into the JSON-LD `streetAddress` that Google reads for local search, so it must keep the full `برج الحياة، شارع زيد بن الخطاب، العليا، الخُبر` string. Never shorten that one for tone.
- **Digits:** Western in product and marketing copy (`24/7`, `15%`, `حتى 6`, `9 صباحاً حتى 9 مساءً`). Arabic-Indic (`٢٠٢٥`) only in dated archives (e.g. the events list).
- **Settled vocabulary, reuse EXACTLY, never coin a synonym** (a coined synonym has failed native review before):

  | Meaning | Arabic (use this) | Never |
  |---|---|---|
  | day pass | `الدخول اليومي` | تذكرة يومية |
  | open desk | `المكتب المرن` | |
  | private office | `المكتب الخاص` / `حيّز` | |
  | meeting room | `الملقى` (proper name) · `غرفة الاجتماعات` (generic) | |
  | events hall | `المعارج` | |
  | coworking space | `مساحة عمل مشتركة` | |
  | membership | `عضوية` | |
  | Life Tower · district · street | `برج الحياة` · `حي العليا` · `شارع زيد بن الخطاب` | (address/directions/legal only, see the locator rule above) |

  Before writing new Arabic, `str.count` the existing `ar.json` for the term you are about to use.

---

## 5. Conversion principles

- **CTAs name the outcome**, not a vague action.
  - ✗ "Message us on WhatsApp" / "Join MAZJ" → ✓ "Book a tour on WhatsApp" / "Book your seat" (`احجز مقعدك`).
- **Surface the strongest hook at the point of decision.** The day-pass-counts-toward-your-first-month line belongs **on the open-desk booking card**, not buried in the FAQ.
- **Concrete proof beats a vague claim.** ✗ "hosted them all" → ✓ "hosted more than 40 events since 2022" (only when truthful).
- **Warm + honest on hard facts.** Lead with the positive frame, state the fact plainly, offer help.
  - Refund: *"Each booking on mazj.sa is reserved just for you and held for your chosen date, so it stays non-refundable once it's placed. If your plans change, reach out before your booking date and we'll gladly help you find another time that works."*
- **Lead with welcome, let limits follow.** ✗ open with "each covers one person" → ✓ "You're always welcome to bring people along. A day pass is for one person, so for guests, book Al-Malqa…"
- **Do not repeat a fact within one viewport.** The hero states the location once; use the trustline for a *fresh* legitimacy signal (staffed hours), not the address again.

---

## 6. Hard constraints (never violate)

- **No prices or money amounts, ever.** Booking and checkout live on **mazj.sa**; link out. (Membership perks like "15% / 20% off the meeting room" are allowed.)
- **No em-dashes (—) anywhere**, Arabic or English. Use commas, colons, periods, parentheses (Arabic: `،` and `:`).
- **Never mention biometric / fingerprint.** Access is a **QR code or a card**.
- **"24/7" is members-only.** Reception is staffed `الأحد إلى الخميس، 9 صباحاً حتى 9 مساءً`. Keep this accurate.
- **The startups & builders offer is a closed envelope.** Never state its terms, amounts, or durations. It is a warm teaser into a WhatsApp conversation; its perks are **verifiable facts** (a real address in Life Tower, 24/7 access, a meeting room), not offer terms.
- **No rating or stars claim.** Lead with legitimacy signals (address, staffed hours, 24/7 member access, VAT), not reviews. (The real Google rating is 4.7; still do not put a rating in the hero or a proof block.)
- **Keep facts exact:** room names (`الملقى` / `المعارج`), capacities (6, 30), hours, VAT number `310240548700003`, URLs (`mazj.sa`, `mazj.org`), the entity `شركة مزج العمرانية شخص واحد`.
- **Never mention** investing, an accelerator, or AI.

---

## 7. Locked lines (do not rewrite without an explicit, specific instruction)

- **Hero headline:** `هنا تجد مكانك،` / `ونـــــاســـــك.` ("Find your place." / "And your people.")
  - 🔴 **The wording is locked on the possessive `ـك`, not on habit. `مكان للعمل` was weighed and rejected (owner ruling 2026-07-27).** `مكانك` says *whose* the place is (ownership, belonging); `مكان للعمل` says *what* it is (function), which every coworking space in الخُبر can claim word for word. Three costs beyond the voice: (1) `عمل` is the most-spent root in `ar.json` at **73** uses, more than the already-banned `مساحة` at 64, and the eyebrow ONE LINE ABOVE the h1 is `مساحة عمل مشتركة · الخُبر`, so it respends a word at the tightest seam on the page; (2) `تجد` takes an accusative object, so an indefinite noun needs tanween (`تجد مكاناً للعمل`, never `تجد مكان للعمل`), which means shipping either visible tanween on 85px display type or a grammar error on the largest text on the site, while the possessive suffix hides the case ending entirely; (3) it orphans the finale, since `StepInto.body` closes on `والتقِ بناسك`, the other half of the §3.3 bookend.
    - Strongest version of the rejected direction, recorded so it is not re-invented as fresh: `هنا تجد مكاناً للعمل، وناساً للعمر.` The `عمل`/`عمر` jinās is real and the paired tanween reads as intentional there. Still declined, for the three costs above.
    - **If the "the h1 never says what we do" itch returns, spend it in the eyebrow or the subtitle, never in the h1.** The eyebrow carries category + city and the finder enumerates every space in the same viewport, which is exactly what frees the h1 for the emotional job. A headline that restates the eyebrow is a wasted line.
    - `ناسك` is a homograph of `نَاسِك` (ascetic). Context kills it: the parallel possessive after `مكانك` forces the "your people" reading. Logged so it is not "discovered" and fixed.
  - 🔴 **The two kashidas in `ونـــــاســـــك.` are deliberate, not a typo.** The coral line carries **two** runs of exactly **5** `U+0640` tatweels each (owner ruling 2026-07-26): one on the `ن`→`ا` join, one on the `س`→`ك` join, 10 total. They are a symmetrical *mashq* flourish balanced either side of the `ا`. Do NOT "correct" it back to `وناسك.`, and note a spell-check pass or a find-and-replace on `ناسك` will silently strip it. Cmd+F for `ناسك` no longer matches the h1, and the elongation is **hero-only**: `StepInto.body`'s `التقِ بناسك` stays unstretched.
  - 🔴 **Do NOT lengthen these to justify the line.** Stretching one kashida until the coral line's left edge flushed with `مكانك،` above it (14 tatweels, edges 5px apart, measured and shipped) was tried on 2026-07-26 and the owner reverted it the same session. The block-justified h1 is a REJECTED direction. The line is *meant* to sit shorter than the one above it: it currently runs 401px against line 1's 523px at vw1440. Don't "fix" that gap.
  - Mechanics if a count ever does change: one tatweel moves the line **18.46px** at 85px/900, measured from rendered pixels (the h1's `lg:tracking-[-1.7px]` does NOT subtract across a kashida run, so predicting `advance − tracking` overshoots). A kashida run has **no break opportunity**: outgrow the column and it overflows into `.intro-mask`'s clip rather than wrapping. The floor is the 272px column at a 320px viewport, where the current line sets ~201px.
- **Space finder prompt:** `أي مساحــة تناســــبك؟` ("Which space suits you?")
  - 🔴 **Two kashidas here too, and they are deliberate** (owner ruling 2026-07-27): **2** `U+0640` tatweels on the `ح`→`ة` join of `مساحــة`, and **4** on the `س`→`ب` join of `تناســــبك`, 6 total. Same rule as the hero: a find-and-replace on `مساحة` or `تناسبك` silently strips them, and `مساحة` in particular is a term that gets swept site-wide (65+ uses). Arabic only; the EN string is untouched.
  - 🔴 **This label TRUNCATES, it does not wrap** (`Hero.tsx`, the trigger's `truncate` span: `overflow:hidden` + `ellipsis` + `nowrap`), so length here is a hard constraint, not a preference. Measured at 16px/400: each tatweel costs **3.71px**, so the 6 cost 22.3px, taking the string from 123.0px to **145.3px**. The tightest box is the 320px viewport, where the trigger label gets **167px**, leaving ~22px of slack. Verified by replicating the pill's flex geometry per breakpoint, because `--window-size=390` does NOT emulate mobile (it lays out desktop and crops).
  - ⚠️ Pre-existing, not caused by the kashidas: the **English** string `Which space suits you?` measures **165.8px** against that same 167px box, roughly **1px** of slack at 320px. The `@media (max-width:359.98px)` padding fix in `globals.css` that buys that room was calibrated for `What brings you in?` (141.9px), a string that no longer exists. Any EN rewording longer than the current one truncates immediately.
- **Meta** `title` / `metaTitle` / `siteName` / `city`: SEO and the static share cards depend on them. Changing `title` / `siteName` / `city` means regenerating the OG cards (`scripts/generate-og-cards.py`).
- **StepInto wordmark line:** `مزج`.

---

## 8. Bilingual craft and mechanics

- **Both files, one edit.** Every change mirrors in `messages/en.json` AND `messages/ar.json`: add a key to both, reword the other language to match the new meaning, remove from both. Same keys, arrays the same length. The **Arabic carries the meaning**; the English is derived. (Full file mechanics: see `CLAUDE.md` → the i18n content-sync rule.)
- **Display headings are large (up to 85px).** Keep hero and section statements **punchy**; long copy overflows the clip box or orphans a lone word on its own line. Section titles carry hand-placed `\n` breaks at natural points; keep the number of lines the design expects.
  - Measure a display line before shipping it, don't eyeball it: render the candidate at its real size in Thmanyah and read the ink width. The footer `<h2>` cell is **272px** at `lg`, so `اعثر على مساحتك` (346px) was escaping its column; `نراك قريباً.` is 199px. Check the descender too, with a baseline probe (`descent > lineBox − baselineOffset`), never ink height alone: `نراك قريباً.` clears by only 2.80px where the old line had 4.40px.
- **`photoAlt` describes the photograph**, never the heading (or the same phrase gets announced twice).
- **Arabic display text needs real heading tags** (`h1`/`h2`/`h3`) or explicit `leading-[1.35]`, or tall Arabic glyphs clip.
- **WhatsApp prefilled messages** (`ctaMsg` / `whatsappMsg`) are short, warm, first-person, written from the visitor to MAZJ.

---

## 9. Pre-ship checklist

- [ ] Arabic authored first; English reads native (not a back-translation).
- [ ] Zero negativity; every line invites.
- [ ] No phrase / hook / verb repeated across sections.
- [ ] Settled AR vocabulary + `الخُبر` spelling + Western digits.
- [ ] No prices, no em-dashes, no biometric, no rating; the offer stays a closed envelope.
- [ ] Facts, room names, URLs, VAT exact; locked lines untouched.
- [ ] Both `en.json` and `ar.json` updated; same keys; arrays same length.
- [ ] CTAs name the outcome.

---

## 10. Living document

This file compounds. **Whenever the owner gives copywriting feedback** (a correction, a "this word is wrong", a preference, a better phrasing): apply it to the copy **and** add the rule plus a concrete before → after example here, in the most relevant section, so it is never re-litigated. Keep examples real (quote what actually shipped).

**Provenance:** distilled 2026-07-24 from the full Arabic-first landing-copy rewrite and the 6-lens adversarial audit (native-Arabic, conversion, tone, uniqueness, facts, English) that produced most of §4 and §5. Related deep-context: `CLAUDE.md` (file mechanics, brand facts).
