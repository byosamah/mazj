# AI search visibility: audit and build record

**Measured and built 2026-08-02.** Everything here was read off the site as it
actually renders, not off the source files. Every number carries the measurement
that produced it. Where a claim is reasoned rather than measured, it says so.

Sibling briefs, already written, deliberately not repeated here:
[`google-business-profile-brief.md`](./google-business-profile-brief.md) and
[`mazj-org-301-redirect-map.md`](./mazj-org-301-redirect-map.md).

---

## PLAIN

MAZJ is currently invisible to every AI assistant, on purpose, and that is
correct. The site tells all crawlers to stay out because it still lives at a
temporary web address, and that block lifts by itself the day a real domain is
connected. Nothing here needs undoing.

What matters is what happens on that day. Getting quoted by ChatGPT, Perplexity,
Gemini or Google's AI answers is not the same job as ranking on Google. Ranking
is won with links and authority, which MAZJ does not have and cannot buy
quickly. Being **quoted** is won with facts a machine can lift cleanly off the
page, and that is winnable now, before launch, at no cost.

The site was in decent shape for it and had four gaps. Three are now closed:

1. The two files an AI shopping agent looks for by name did not exist. They do now.
2. Sixteen real questions and answers sitting on the four money pages were
   invisible to machines. They are now readable, which roughly **doubles** the
   number of MAZJ questions a machine can extract, from 18 to 34.
3. The exact capacity of the meeting room and the events hall existed only inside
   English and Arabic sentences. A machine now reads "6" and "30" as numbers,
   which is how an assistant answers "where can I run a workshop for 25 people in
   Al Khobar".

The fourth gap is not a bug and is not mine to close: **MAZJ has nothing worth
quoting except its own price list and room sizes.** No guide, no comparison, no
original data, no named human being. That is the ceiling, and it is a content
decision rather than a code one.

## DETAIL

Rendered-output measurement across all 26 routes, both locales, dev server on
port 3000, title check confirmed against `مزج` before any number was trusted.

| | Before | After |
|---|---|---|
| Machine-readable files at the site root | none (`/llms.txt` 404, `/pricing.md` 404) | both served, derived from `messages/*.json` |
| AI crawler rules in `robots.txt` | none (allowed only by wildcard) | 14 user-agents named explicitly, each restating `Disallow: /admin` |
| `FAQPage` nodes | 2 (`/faq` only) | 10 (`/faq` plus the 4 space pages, x2 locales) |
| Machine-readable Q&A pairs | 18 | 34 |
| `LocalBusiness` fields | 15 | 20 (`alternateName`, `paymentAccepted`, `amenityFeature` x11, `containsPlace` x2) |
| Room capacity as a number | nowhere | `maximumAttendeeCapacity` 6 and 30 |
| Tests pinning any of it | 9 | 32 |

---

## 1. Crawl state, and why the blocked robots.txt is correct

`app/robots.ts` serves `Disallow: /` with no `Sitemap:` line, because
`IS_PRELAUNCH_ORIGIN` in `lib/site.ts` is true for any `*.vercel.app` host.

🔴 **Do not "fix" this.** What sits on the staging host is a complete bilingual
copy of the pages `mazj.org` currently ranks #1-3 with on the Arabic head terms.
A crawler finding it before the domain move is a duplicate-content event against
MAZJ's only irreplaceable asset. The block lifts itself when
`NEXT_PUBLIC_SITE_URL` names a real domain, so there is no switch to remember.

**Verified in a real production build** at `NEXT_PUBLIC_SITE_URL=https://mazj.sa`,
because the dev server renders metadata routes per request and hides this class
of bug. The launch shape came back correct, including the sitemap line.

### The AI crawler groups (owner ruling 2026-08-02: allow everything)

`robots.txt` now names GPTBot, ChatGPT-User, OAI-SearchBot, ClaudeBot,
anthropic-ai, Claude-Web, PerplexityBot, Google-Extended, Bingbot, msnbot,
Applebot, Applebot-Extended, meta-externalagent and Amazonbot.

🔴 **The load-bearing detail is that each named group RESTATES `Disallow: /admin`.**
robots.txt group selection is most-specific-wins: a crawler obeys the one group
matching its own name and ignores every other group, `*` included. So the moment
GPTBot has a group of its own it stops inheriting the wildcard's admin rule, and
a group carrying only `Allow: /` hands the admin tool to that crawler. Nothing
about the file would look wrong; it would read as deliberately more open. This is
the same shape as the ESLint flat-config trap already recorded in the root
`CLAUDE.md`, and it has the same fix: a narrower block must restate everything
that still applies. `test/prelaunch-indexing.test.ts` now fails if any group
omits it.

⚠️ **Honest accounting: the groups are close to a no-op today**, because
`User-agent: * / Allow: /` already permits all of them. What they buy is a file
that states the decision, and survival of the next edit: the day anyone adds a
`Disallow:` to the wildcard, every AI crawler would have inherited it silently.

🔴 **CCBot is deliberately NOT blocked.** Blocking the training-only harvester
was put to the owner as an option and declined in favour of allowing everything.
It is the obvious-looking tidy-up, so there is a test asserting its absence with
the reason attached.

⚠️ `mazj.sa` (the Rekaz storefront) ships the opposite policy today, blocking
GPTBot, ClaudeBot and Google-Extended. That file is Rekaz's, not ours. Do not
reconcile them by copying theirs.

---

## 2. What a machine can actually lift off these pages

### The good news, measured

- **Every Arabic and English `<title>` is strong.** The `metaTitle` layer carries
  the query terms in both languages: `غرفة اجتماعات في الخبر: الحجز بالساعة`,
  `قاعة فعاليات في الخبر تتسع لـ30 شخصا`, `Private Office for Rent in Al-Khobar,
  24/7 Access`. This is the single highest-weight field and it is already doing
  its job.
- **One `<h1>` per route, all 26. Zero anomalies.**
- **All 18 FAQ answers ship in the visible HTML in both locales**, 18/18. The
  accordion collapses in CSS, not by withholding text, so the `FAQPage` markup
  describes content that is genuinely present. That claim was in the code
  comments; it is now verified against served bytes.
- **Zero images with a missing `alt` attribute** across 370 image elements.

### The ceiling, also measured

**Indexable body text: 5,699 words in English, 4,762 in Arabic**, across 11
routes each. Median route: 549 words English, 475 Arabic.

⚠️ **Arabic runs 16.4% lighter than English.** Key parity holds perfectly (705
leaf keys both files) so every automated check passes, but depth parity does not.
The thinnest pages are `/about` (234 English, 185 Arabic) and `/contact` (182,
166). For the language MAZJ has the most to win in, that is backwards.

**The formats AI cites most often, and what MAZJ has of each:**

| Format | Share of AI citations | MAZJ |
|---|---|---|
| Comparison articles | ~33% | none |
| Definitive guides | ~15% | none |
| Original research or data | ~12% | none published |
| Best-of listicles | ~10% | none |
| Product pages | ~10% | ✅ four, and they are good |
| How-to guides | ~8% | none |

**E-E-A-T signals, counted:** named human authors **0**. Expert quotes **0**.
Statistics with a cited source **0**. Visible "last updated" dates **0**.

The Princeton GEO study (KDD 2024) ranks citing sources at +40% visibility and
adding statistics at +37%, with the largest gains going to low-authority sites,
up to +115%. MAZJ is exactly the profile that would gain most and currently
scores zero on both.

---

## 3. 🔴 The Arabic typography finding

This is the most interesting thing measured, and it is **smaller than it first
looks**. Reported at its real size rather than its dramatic one.

**What was measured.** `messages/ar.json` carries **162 `U+0640` ARABIC TATWEEL**
characters across 46 keys, rendering as **186** tatweels in the visible text of
the 11 Arabic routes, producing **46 distinct broken word-forms**. Every Arabic
page `<h1>` is affected. `المشتـ__ـرك` is not the string `المشترك`.

Separately, the city is spelled `الخُبر` with a combining damma in all 63
occurrences plus `lib/schema.ts`'s `addressLocality`. The bare `الخبر` that a
Saudi buyer actually types appears **zero** times anywhere on the site.

**Why it is not a crisis.** Three measurements bound it:

1. **Titles are clean.** 10 of 11 Arabic routes carry no tatweel in `<title>` or
   `og:title`. The eleventh is `لـ30`, which is **correct Arabic orthography**
   (a preposition joined to a numeral), not decoration.
2. **The money terms survive.** For every space page, the clean head term
   (`العمل المشترك`, `الاجتماعات`, `الفعاليات`, `المرن`, `الخاص`, `قاعة`,
   `غرفة`) appears undecorated in the body copy of its own page. 22 rescued
   across the 11 routes.
3. **Classical search normalises both away.** Stripping tatweel and harakat is
   step one of every Arabic information-retrieval pipeline. This costs MAZJ
   nothing in Google.

**What it does cost, honestly.** 30 word-forms exist ONLY in broken form on their
page, and every Arabic `<h1>` fails to string-match its own subject
(`"العمل المشترك" in h1: false as served, true after stripping tatweel`).
Language models do not normalise, so the decorated and undecorated forms tokenise
differently, and an assistant quoting an Arabic heading quotes the broken form
into its own answer. The 30 orphans are overwhelmingly connective words
(`قلب`, `المكان`, `مرحباً`, `أشياء`, `خطوات`) rather than search terms, which is
a credit to how the house standard was scoped: `test/arabic-kashida.test.ts`
deliberately never swashes a proper name or a product-name key.

⚠️ **The mechanism above is measured. The magnitude for LLM retrieval is
reasoned, not measured.** Nobody here has run an embedding-similarity comparison.
Treat it as directional.

**🔴 Nothing was changed on screen, and nothing should be without an owner
ruling.** The kashida is a deliberate, font-verified, owner-ruled house standard
pinned by a 200-line test. Thmanyah Sans draws 690 hand-made elongation glyphs
for it. It is `DESIGN.md`'s to change, not an audit's.

**What was built instead: a second, machine-only channel.** `lib/machine-text.ts`
strips the decoration for `/llms.txt` and `/pricing.md` only. Same sentences,
same facts, same order, no swashes and no diacritics.

⚠️ That is legitimate precisely because the content is identical. Serving
*different* content to crawlers is cloaking; serving the *same* content
undecorated is not.

🔴 **One subtlety cost a real bug on the first render and is now tested.** A
tatweel is decoration when an Arabic letter follows it and correct orthography
when a digit or Latin character does. A blanket strip turned `لـ30` into `ل30`,
which reads as a typo, inside a `metaTitle`. `test/machine-text.test.ts` walks
the real `messages/ar.json` and fails if any prefix is ever orphaned.

**The one decision left for the owner** is whether the swash should move off the
~9 headings where it lands on a head term. It is a design call. The house rule
protects proper nouns and decorates the descriptive word, which is right for a
reader and exactly backwards for a retriever, because the proper noun is the word
nobody searches for and the descriptive word is the word everybody does.

---

## 4. What was built this session

All of it verified against served output, not just written.

| Built | Where | Verified |
|---|---|---|
| `/llms.txt` | `app/llms.txt/route.ts` | 200, `text/plain`, prerendered in a real build |
| `/pricing.md` | `app/pricing.md/route.ts` | 200, `text/markdown`, `X-Robots-Tag: noindex` |
| AI crawler rules | `app/robots.ts` | launch shape read off a production `next start` |
| Undecorated-Arabic helper | `lib/machine-text.ts` | 10 tests incl. a walk of the real message file |
| `FAQPage` on the 4 space pages | `components/SpaceDetail.tsx` | 32 new Q&A pairs, 100% of answers present in the visible body, both locales |
| `LocalBusiness` enrichment | `lib/schema.ts` | 11 amenities, 2 rooms with capacities, both locales |
| Fact-drift tests | `test/schema-facts.test.ts` | 14 tests, mutation-checked |

**Both machine files are route handlers, not static files in `public/`,** and
that is deliberate. A static file cannot read `messages/*.json` or `SITE_URL`, so
it goes stale the first time anyone edits a product name, the hours or the
address, and nothing reports it. Everything in both is derived.

🔴 **`/pricing.md` contains no price, and that is a `TONE.md` ruling, not a gap to
fix.** What it gives an agent instead is what a comparison actually turns on and
MAZJ can state truthfully: what is sold, the unit each thing is sold in,
capacity, what is included, who may enter when, the currency, the VAT position,
and where the number lives. Enough to be shortlisted. Not enough to be misquoted.

⚠️ **Naming tension, flagged rather than decided.** There is a standing rule that
nothing user-facing may be labelled "Pricing" or "Plans". This file is not
user-facing: nothing links to it, it is in no navigation, and it ships `noindex`
so it can never surface as a search result promising prices it does not carry.
`/pricing.md` is simply the filename convention has settled on for the lookup. If
the owner would rather it did not carry that name, it is a one-line change plus
the reference in `llms.txt`.

### On the schema additions

Every amenity is quoted from copy that already ships, and **the omissions are as
deliberate as the inclusions**. Verified in both message files:

- **Printing and scanning: NOT claimed.** `طباعة` scores 0 in Arabic and every
  English `print` hit is inside the word "sprint". Every coworking space
  plausibly has a printer; this one has never said so.
- **Parking: real, and narrower than it looks.** The FAQ says parking is
  available "around the tower", not that MAZJ owns any, so the feature is worded
  as nearby.
- **Wi-Fi: the Arabic is `إنترنت سريع`** (19 occurrences). `واي فاي` scores 0, so
  the transliteration would have introduced a term the site does not use.

`aggregateRating` remains deliberately absent (self-serving review markup
violates Google's policy, and MAZJ's real 4.7 belongs on the Business Profile).
`priceRange` is absent for the same reason `/pricing.md` carries no number. Tests
assert both stay absent, and that no `Offer` ever grows a `price`.

---

## 5. Findings not acted on, with reasons

| Finding | Measured | Why not acted on |
|---|---|---|
| 41 archive events have no individual URLs, no `Event` markup, no sitemap presence | 41 `<h3>` entries on one page; sitemap has 22 URLs and zero events | This is MAZJ's only original data and the biggest untapped asset. But `app/CLAUDE.md` rules that the `/events` LIST is never marked up, and the archive is unlinked on purpose (41 near-empty URLs from the strongest page on the route). Needs an owner decision, not an audit's edit. |
| `/en/faq` `<title>` is 63 characters, over the ~60 SERP limit | measured sans combining marks | One-line copy fix, but copy edits must land in both languages in the same edit and this is a `TONE.md` surface. |
| 8 routes have meta descriptions under 70 characters | `/ar/spaces/meeting-room` is 41 | Same reason. Thin snippets cost click-through, not citation. |
| 5 hero photographs carry no `alt` and have no alt-bearing twin on their page | `/about`, `/contact`, `/startups`, `/events`, private-office | The empty alt is CORRECT on the space pages, where the lower instance carries it. On these five there is no lower instance. Small, real, and a copy change in both files. |
| The ZATCA VAT badge is `alt=""` on all 22 routes | 22 instances | It is a legitimacy signal an AI could read. Genuinely arguable as decorative. |

⚠️ **The alt-text number nearly shipped as a much larger finding.** The raw count
is 96 images with `alt=""`, which reads as a serious gap. Most are video posters
and duplicate heroes where an empty alt is the correct choice, per the convention
in `components/CLAUDE.md`. The honest figure is 5 photographs plus one badge.

---

## 6. What the outside world says, which this repo cannot see

A 15-agent audit ran the same day: four agents measuring live search in both
languages, five auditing this repo, one adversary refuting each dimension, one
synthesist. **50 findings survived, 21 were refuted, 25 more were found by the
adversaries.** The full prioritised backlog is
[`ai-search-build-plan.md`](./ai-search-build-plan.md); these are the four
findings that change the launch plan.

🔴 **1. `mazj.org` is NOT noindexed, and the project record said it was.** Four
`curl` runs across four user agents returned identical 191,085-byte responses
with `noindex` count **0**, no `X-Robots-Tag`, an allow-all robots.txt and a
live 14-page sitemap. ⚠️ Firecrawl's *cached* metadata reports `noindex` and is
wrong; the same session caught it wrong about another domain. **Live fetch beats
cached crawler metadata.** This changes launch from "recover a residual
ranking" to "do not drop a currently-earned one", and the 301 map must be
re-verified against the live sitemap before anything is pointed anywhere.

🔴 **2. The live storefront sells fingerprint access, indexed.** `mazj.sa/ar`
describes the shared seat as "دخول لا محدود ... باستخدام **البصمة الشخصية**", on
a page serving `robots: index, follow`, with `بصمة` occurring **15 times**
across the English-declared surface. This is the exact biometric claim stripped
from this site on 2026-07-23 because biometric data is PDPL-sensitive. **The
rule was enforced on the site nobody can see and not on the one Google and every
AI crawler reads.** One field edit in the Rekaz dashboard, and it is the highest
risk-to-effort item in the entire report.

🔴 **3. `mazj.org` publishes several false things right now.** Hours as 9am to
9pm (the truth is 9 to 5, and the Instagram bio already says 9 to 5, so MAZJ's
two loudest surfaces publicly disagree). `/عن-مزج/` sells three spaces with no
private office and caps the hall at "more than 20" against the real 30. And two
indexed pages are placeholder filler: `/services/` is 407 words of Latin filler
selling "Digital Marketing" and "Google Ads" (measured: 44 filler tokens in 407
words, only 261 Arabic characters, `noindex` count 0), while `/home-2/`
self-canonicalises and ranks **4th on MAZJ's own brand name**.

⚠️ **4. THE ENTITY NAME IS A DIFFERENT KIND OF PROBLEM AND THE FIRST DRAFT OF
THIS DOCUMENT GOT IT WRONG.** It was recorded here as a third party publishing a
false name. It is not. Measured across three live surfaces, all under the SAME
commercial registration 2051222684:

| Surface | Trade name |
|---|---|
| This site, `TermsPage` and `PrivacyPage` in both locales | `شركة مزج العمرانية شخص واحد` / MAZJ Al-Omrania One Person Company |
| `mazj.org/terms/`, live and indexed | `شركة مزج العمرانية لحاضنات ومسرعات الأعمال` |
| `sian.monshaat.gov.sa/ar/members/234`, live, HTTP 200 | the same, as a **member of the Saudi Incubators and Accelerators Network**, carrying `info@mazj.org` and MAZJ's own `مقصد` / `وظيفية` / `تكوين` brand framework copy |

The Monsha'at page is not a scrape. It quotes MAZJ's own brand language and
MAZJ's own email, so somebody at MAZJ registered it. **So this is not a listing
to correct, it is a contradiction between MAZJ's legal identity and MAZJ's brand
rule**, and only the owner holds the document that settles it.

🔴 **Which makes it more serious than an SEO defect, because it lands on the
legal pages.** Either the CR trade name is still "لحاضنات ومسرعات الأعمال", in
which case **this site's Terms and Privacy name an entity that does not match the
register**, on documents that are meant to be legally operative and that already
await a licensed review. Or the name was legally changed, in which case
`mazj.org` and a government registry are both stale. Nothing in this repo can
distinguish the two. Ask for the CR extract before touching either.

⚠️ And note what it does NOT license: `TONE.md`'s rule that MAZJ never presents
itself as an accelerator or incubator is a **brand** rule about how the site
speaks, and it stands whatever the register says. A legal trade name is not
positioning.

🔴 **4. WHAT WAS CALLED "THE STRUCTURAL OPENING" HERE IS FALSE, AND THE
MEASUREMENT THAT KILLED IT IS IN §7b.**

This item read: Regus and Spaces both serve a 1,163-byte Imperva interstitial
carrying `META ROBOTS NOINDEX, NOFOLLOW` to a full Chrome user agent, therefore
**"they cannot be read or cited by AI engines at all"**, therefore MAZJ can take
the operator slot by being the one readable bilingual operator.

The first clause is a real measurement and may still hold. **The conclusion
drawn from it is contradicted by observation.** Asked six category questions on
2026-08-02, Google's AI Overview named **Spaces and Servcorp in every single
one**, and Regus in two.

The likely mechanism, and it is worth understanding because it generalises: a
`noindex` wall on a marketing site does not remove a business from the local
knowledge graph. Google already holds their Business Profiles, their Maps
records and their directory listings, and for a "best coworking in X" question
it does not need to crawl their marketing pages at all. **Being crawlable is not
what puts an operator in that answer. Being an established local entity is.**

⚠️ **The lesson is bigger than the error.** A measured fact ("their site serves
noindex") was turned into a strategic conclusion ("therefore they are invisible
to AI") without testing the conclusion, and it survived an adversarial verify
pass because the underlying measurement was sound. Test the conclusion, not just
the premise.

⚠️ **And one Arabic word fails retrieval.** `المكتب المرن`, MAZJ's settled term
for its flagship product, returns Syrian company-formation law (a ministerial
decree defines it as a licensed registered office) and the Saudi Ministry of
HR's flexible-employment programme. **Zero Saudi coworking results.** MAZJ's own
storefront already uses the market-correct `مقعد في المساحة المشتركة`. By
contrast `الدخول اليومي` is confirmed correct and must not be touched. 🔴 The
term is named as settled in the root `CLAUDE.md`, so no string moves without an
owner ruling, and one string serves six keys.

## 7. 🔴 MEASURED: four assistants asked about MAZJ, and nine of twenty answers were wrong

**This section is the only one in any MAZJ document that reports what a named AI
assistant actually said.** Everything before it was inference. Run 2026-08-02
through the user's own signed-in Chrome: 24 questions, **20 answers captured**,
each read verbatim off a rendered page.

### The result

| Surface | Captured | Repeated a known-wrong fact |
|---|---|---|
| **Perplexity** | 5 | 🔴 **4** |
| **Google AI Overview** | 6 | 🔴 **4** |
| **ChatGPT** | 6 | 1 |
| **Gemini** | 3 | **0** |
| **Total** | **20** | **9** |

**By fact, and this is the fix list in priority order:**

| Wrong fact | Assistants that repeated it | Source they cited |
|---|---|---|
| Hours 9pm / 21:00, one including **Saturday** | Google AIO (Arabic), Perplexity (both languages) | `mazj.org`, `thecoworkingspaces.com` |
| **Fingerprint / biometric entry** | Google AIO, Perplexity | `mazj.sa` |
| **Printing and scanning** | Google AIO, ChatGPT, Perplexity | `thecoworkingspaces.com` |
| Rating **5.0** | Google AIO | `coworkingspaces.me` |
| Accelerator / incubator | **none** | |

### The three that matter most, verbatim

**Google AI Overview, asked in Arabic about opening hours**, citing `mazj.org`:

> "من الساعة 9 صباحاً حتى الساعة 9 مساءً ... العطلة: الجمعة والسبت مغلق"

**Google AI Overview, asked about access**, citing `mazj.sa`:

> "Access to MAZJ in Al Khobar is granted using **personal fingerprint
> recognition** (البصمة الشخصية) ... Method: Personal fingerprint / **biometric
> scanner**"

**Perplexity, asked the same**, citing MAZJ's own storefront, and this is the
worst result of the run because it is not a paraphrase:

> "MAZJ explicitly states you must come during team working hours to activate
> your entry fingerprint (**يجب الحضور لأول مرة خلال أوقات عمل الفريق لتفعيل بصمة
> الدخول**) ... It's biometric via fingerprint."

🔴 **That Arabic sentence was independently verified by direct fetch and is
live on `mazj.sa/en/subscription/adwyh-almsahh-almshtrkh` right now.** So
Perplexity is not hallucinating and it is not misreading: it is quoting MAZJ's
own published copy, accurately, and correctly concluding that MAZJ uses
biometric entry. The storefront does not merely mention a fingerprint, it
documents an **enrolment procedure** for one. Every other document in this repo
treats "no biometric claim" as settled since 2026-07-23. It is not settled
anywhere a customer or a crawler can see.

### ✅ The finding that tells you what to do about it

**Every correct hours answer cited the Google Business Profile. Every wrong one
cited `mazj.org` or a directory.** Google AIO in English, Gemini in both
languages and ChatGPT all read the GBP card and returned 9 to 5. Google AIO in
Arabic and Perplexity in both languages read `mazj.org` and returned 9pm.

The Business Profile is already correct and it is already winning wherever it is
consulted. The failures are not a content problem on this site, they are a
question of which source the assistant happens to reach. That makes the fix
list short and entirely off-repo: **correct `mazj.org`, correct the storefront,
claim the directory.**

⚠️ **And it resolves a disagreement this document could not close.** Section 8
recorded the Google rating as unresolved between 4.7 and 5.0. Two independent
assistants reading the GBP card returned **4.7**, and ChatGPT put it at "4.7 out
of 5, based on **96 Google reviews**". Treat 4.7 as settled. ⚠️ Treat 96 as
unverified and worth checking, because it is one surface's number and it is far
above the 3 and 14 the directories publish and above this project's own belief
that MAZJ has "few reviews".

### ⚠️ How these numbers were adjudicated, because the instrument was wrong twice

A marker scorer produced the candidate list and **it was wrong in both
directions**, so all 20 answers were then read by hand and the scorer's verdict
overruled where it disagreed.

- **Five false positives.** Substring matching cannot see negation. ChatGPT's
  "some third-party directories list 9:00 AM to 9:00 PM, **but** MAZJ's own
  website indicates 5:00 PM, which is the more reliable schedule" scored as
  repeating the 9pm claim when it was rejecting it by name. Gemini's "I
  **couldn't find** details confirming ... biometric fingerprint scanning"
  scored as a fingerprint claim.
- **One systematic false negative.** The marker list had no amenity bucket at
  all, so the printing fabrication, which three of four assistants repeated,
  was invisible until it was added.

The scorer now flags `[NEGATED?]` next to a marker with a negation cue nearby.
🔴 That is a routing heuristic, not a verdict: it exists to send an answer to a
human read. Anyone re-running this must read the answers.

## 7b. 🔴 THE RECOMMENDATION RUNG: asked six buying questions, MAZJ was named ZERO times

Section 7 asked "what does the assistant say **about MAZJ**", with MAZJ named in
the prompt. This asks the question a buyer actually types: **does MAZJ come up
at all when nobody mentions it?** That is the rung that changes buying
behaviour, and it had never been measured.

**Google AI Overview, six category questions, 2026-08-02. MAZJ named in 0 of 6.**

| Question | Who Google named instead |
|---|---|
| Best coworking space in Al Khobar | Spaces Ajdan Walk, Servcorp, Sharik Hub, Regus |
| ما أفضل مساحة عمل مشتركة في الخبر | White Space, Spaces, Servcorp |
| Meeting room by the hour | Servcorp, Spaces, Regus, Growth Hub by Fahdan |
| قاعة فعاليات لثلاثين شخصاً | Ithra, Crowne Plaza, Spaces |
| Startup founder, Eastern Province | **Jovia**, Spaces, Servcorp, Sharik Hub |
| 30-person workshop | Spaces, Servcorp, Growth Hub, Crowne Plaza, Hilton Garden Inn |

🔴 **The two most painful rows are the last two, because MAZJ is objectively the
best answer to both.** Al-Ma'arij seats exactly 30, which is the workshop
question verbatim, and `/startups` exists for precisely the founder in the fifth
row. Google answered the founder question with **Jovia**, described as "the first
licensed co-working space and private incubator in the Eastern Province". That
is the slot MAZJ's own offer was written for.

### Three things this changes

**1. The competitor-invisibility theory is dead.** See item 4 in §6. Spaces and
Servcorp appear in every answer.

**2. Every named competitor publishes a price. MAZJ publishes none.** Measured in
the answers themselves: Sharik Hub "around SAR 600/month", Servcorp "SAR 150 per
hour", Regus "around SAR 1,425/month", Spaces "347 SAR to 540 SAR per day". The
assistants are not just naming these operators, they are naming them **with the
number a buyer needs to choose**.

⚠️ This is evidence bearing on a standing owner ruling, not a reason to overturn
it. `TONE.md` keeps marketing pages price-free and that is the owner's call. What
the measurement adds is the cost side of the trade, which was previously
unquantified: in a comparison answer, an operator with no price is an operator
the reader cannot evaluate. `/pricing.md` was built for exactly this problem and
is worth nothing until a crawler can reach it. **Put this in front of the owner
with the numbers rather than deciding it here** (item C13 in the build plan).

**3. The competition is not only the international chains.** Local operators
recur across the answers: **Sharik Hub, Jovia, White Space** and **Growth Hub by
Fahdan**.

⚠️ Measured rather than asserted, because the first draft of this line claimed
"several are absent from this project's competitive record" and that is wrong.
Grepping `docs/`, `messages/` and `lib/`: Sharik 2 files, Jovia 2, White Space 1,
Servcorp 2, Ajdan 1. **Only `Growth Hub by Fahdan` scores ZERO**, so exactly one
operator here is genuinely new to this project, not several. It appears in two
of the six answers, including the meeting-room question.

### ChatGPT: named in 3 of 6, and the pattern is the finding

ChatGPT (anonymous, fresh chat) named MAZJ in **3 of 6**, and every time it did,
MAZJ was **2nd of 5 and recommended with a specific superlative**: "Best design
& atmosphere: MAZJ", "أفضل أجواء هادئة وتركيز: مزج".

| Question | MAZJ |
|---|---|
| Best coworking space (EN) | ✅ 2nd of 5, recommended |
| ما أفضل مساحة عمل مشتركة (AR) | ✅ 2nd of 5, recommended |
| Meeting room by the hour | ✅ 2nd of 5, recommended |
| قاعة فعاليات لثلاثين شخصاً | ❌ absent |
| Startup founder, Eastern Province | ❌ absent |
| 30-person workshop | ❌ absent |

🔴 **THE PATTERN, AND BOTH SURFACES AGREE ON IT.** MAZJ appears on **generic
coworking** questions and vanishes on **event** and **startup** questions. Those
are the two products MAZJ has the most differentiated claim to: a hall built for
exactly thirty, and a standing offer written for exactly that founder. Google
named MAZJ on neither. ChatGPT named MAZJ on neither. **MAZJ is legible as "a
coworking space" and illegible as "a venue" or "a startup home".**

⚠️ **Confound, reported rather than buried.** Partway through this run ChatGPT
showed "You're using our basic model. Log in or sign up for more intelligence",
so queries 4 to 6 ran degraded and leaned harder on hotels. That weakens the
ChatGPT half of the pattern. It does not touch the Google half, which was
0-of-6 with no degradation, and the two agree.

### 🔴 The finding that matters most, and it is about positioning, not SEO

ChatGPT describes MAZJ as **"quiet environment"** in English and
**`أفضل أجواء هادئة وتركيز`** ("best quiet atmosphere and focus") in Arabic.

**Quiet is a value the owner explicitly retired on 2026-07-31.** `TONE.md`
records the sweep and the result: `quiet / calm / serene / lively / vibrant /
buzzing / energetic / distraction`, plus the Arabic roots
`هدوء / هادئ / سكون / صمت / سكينة`, are **all zero in both message files**.
Verified again 2026-08-02: `quiet` 0, `هادئ` 0, `الهدوء` 0.

So MAZJ removed the word from its own site, and the market says it anyway.
ChatGPT sourced it from `coworkingspaces.me`, which is a directory built on
reviews.

🔴 **`TONE.md`'s own lesson was "the photograph was the bigger offender than the
copy". This is the next lesson up: the third-party review is a bigger offender
than either.** A brand cannot fix its positioning by editing its own strings
when the answer engine is reading what other people wrote about it. MAZJ's
chosen positioning is creative, builders, community. The web's stored impression
is "quiet and good for focus", and that impression is what a buyer now hears.

⚠️ This is not a copy task and there is nothing in this repo to change. It is a
reviews-and-community task, and it belongs with C6 and C17 in the build plan.

### Two more corrections to project beliefs

**MAZJ does not have "few reviews".** Root `CLAUDE.md` says "4.7 with few
reviews". Two independent ChatGPT sessions returned **"4.7/5 (90+ reviews)"** and
"4.7 out of 5, based on 96 Google reviews". Treat the count as roughly 90 to 96
and confirm it at the profile. The "few reviews" framing has been used to argue
against leaning on review signals; that argument no longer holds.

🔴 **And review VOLUME beats rating, measured.** ChatGPT's number-one
recommendation in both languages is **"Efficiency Center | مركز الكفاءة"** at
**4.6/5 with 170+ reviews**, ranked ABOVE MAZJ at **4.7/5 with 90+**. A lower
rating with roughly twice the volume wins the top slot. That is the single
clearest lever measured in this entire audit, and it costs nothing but asking.

⚠️ **`Efficiency Center | مركز الكفاءة` scores ZERO across `docs/`, `messages/`,
`lib/` and `components/`.** ChatGPT's top-recommended coworking space in Al
Khobar, in both languages, is a competitor this project has never once named.

🔴 **And it is not alone. Across all four surfaces the assistants named 19
operators, and 13 of them appear NOWHERE in this repo.** Measured over `docs/`,
`messages/`, `lib/` and `components/`. Known: Sharik, Jovia, Servcorp, Regus,
RCH. Unknown: **Efficiency Center, BURO, Aziz (عزيز), White Space, Spaces Ajdan
Walk, Growth Hub by Fahdan, Normas Hall, BoxSquare, WAED Ventures, Ithra, Crowne
Plaza, InterContinental, Hilton Garden Inn**.

⚠️ An earlier draft of this line said "9 of 15" off a shorter roster. The
corrected figure is 13 of 19, and the direction of the error is worth noting:
every time this competitive set was re-counted it got worse, because it was
assembled from coworking SERPs and the assistants answer from a wider field.

**Read that list by category and it explains the pattern above.** Ithra, Crowne
Plaza, InterContinental, Normas Hall and BoxSquare are **event venues**, and
they are exactly who answers the questions MAZJ disappears from. Al-Ma'arij does
not compete with Regus for a thirty-person workshop, it competes with a hotel
ballroom and a cultural centre, and nobody on this project has ever looked at
one of them. The competitive record was built from coworking SERPs, so it can
only see coworking competitors.

### All four surfaces, and the answer is better than Google alone suggested

| Surface | Captured | Named MAZJ | Position when named |
|---|---|---|---|
| **Perplexity** | 2 | **2** | 1st (EN, recommended), 3rd (AR, neutral) |
| **Gemini** | 3 | **2** | **1st of 7** (EN), **1st of 8** (AR) |
| **ChatGPT** | 6 | 3 | always 2nd of 5, recommended |
| **Google AI Overview** | 6 | **0** | absent |
| **Total** | **17** | **7** | |

🔴 **So the headline is not "MAZJ is invisible to AI". It is narrower and much
more useful: MAZJ ranks FIRST on the generic coworking question on Perplexity
and Gemini, second on ChatGPT, and does not exist on Google.**

Google AI Overview is the outlier, and it is the one that matters most by reach:
it appears in roughly 45% of Google searches, which is more traffic than the
other three combined. Perplexity's English answer opened with
"the top-rated and most consistently recommended options are **MAZJ**, RCH ...
and Servcorp", and Gemini named MAZJ first of seven unprompted, in a genuinely
fresh session. That is a strong position that Google alone does not see.

### 🔴 The "event and startup blind spot" was wrong. It is a SURFACE pattern, not a query pattern.

This section reported a blind spot three times and each new data point weakened
it, until the gap-fill killed it outright. Recording the whole arc, because the
final answer points somewhere completely different from the first one.

Gemini, in fresh sessions, named MAZJ **first** on the startup-founder question
AND **first** on the 30-person workshop question. Those are the two queries
Google, ChatGPT and Perplexity all skipped. So the absence does not track the
QUESTION at all.

**MAZJ named, by surface and query:**

| Query | Google AIO | ChatGPT | Perplexity | Gemini |
|---|---|---|---|---|
| Best coworking (EN) | ✗ | 2nd | **1st** | **1st** |
| Best coworking (AR) | ✗ | 2nd | 3rd | **1st** |
| Meeting room, hourly | ✗ | 2nd | not captured | ✗ |
| Startup founder | ✗ | ✗ | ✗ | **1st** |
| 30-person workshop (EN) | ✗ | ✗ | ✗ | **1st** |
| 🔴 Event hall, 30 people (AR) | ✗ | ✗ | not captured | ✗ |

**22 cells captured, MAZJ named in 9.**

Read down the columns, not across the rows:

- **Gemini: 4 of 6, and MAZJ is FIRST in every one of the four.**
- **ChatGPT: 3 of 6, always second.**
- **Perplexity: 2 of 4, first and third.**
- **Google AI Overview: 0 of 6.**

🔴 **And read ONE row across: the event-hall question is the only universal
blind spot.** Every surface that answered it skipped MAZJ, including Gemini,
which named MAZJ first on four other questions. Al-Ma'arij is built for exactly
the capacity being asked about, and nothing found it.

⚠️ **But that row cannot yet be interpreted, because two variables moved
together.** The event-hall prompt is **Arabic** AND framed as **"rent a hall"**.
The workshop prompt that Gemini answered with MAZJ first is **English** AND
framed as **"run a workshop"**. Same product, same capacity, opposite result,
two changes at once.

The two readings have completely different consequences:

- **If it is the FRAMING**, MAZJ does not register as a rentable venue, and the
  consideration set for "rent a hall" is hotels and serviced offices. That is a
  positioning problem with a clear fix.
- **If it is the ARABIC**, that is far more serious, because Arabic is where
  MAZJ's entire ranking equity lives.

### ✅ RESOLVED: it is the FRAMING, not the Arabic. This is the cleanest result in the audit.

`Where can I rent a small event hall for 30 people in Al Khobar?` was put to
Gemini and ChatGPT in English, holding language constant against the workshop
prompt and changing only the framing. **MAZJ vanished from both**, including the
surface that had just named it first.

| Same assistant, same language, one variable | MAZJ |
|---|---|
| "Where can I **run a 30-person workshop** in Al Khobar?" | **1st of 6** |
| "Where can I **rent a small event hall for 30 people** in Al Khobar?" | **absent** |

Arabic is not the variable. **"Rent a venue" puts MAZJ outside the consideration
set in any language.**

**And Gemini's own answer says why, in its structure.** It split the reply into
two labelled groups:

- **"Social Event & Banquet Halls"**: قاعة السلطانة, Grand Hyatt, Diyafa
  Almakan, AlMasyia Hall
- **"Meeting Rooms & Corporate Event Spaces"**: Regus, Spaces Ajdan Walk,
  Servcorp, Sharik, Efficiency Center

Ten operators across two buckets. **MAZJ was in neither.** The model has a
category for banquet halls and a category for corporate meeting rooms, and a
coworking space with a thirty-person hall does not land in either one.

🔴 **And this is not a limit of the category, which is the part that makes it
actionable.** ChatGPT's answer to the same prompt named **White Spaces** as "a
coworking/event-style option that may work better than a hotel if you only need
a compact space". So a coworking operator CAN occupy the venue-rental slot.
White Spaces does. MAZJ does not. That removes the comfortable explanation and
leaves a specific gap.

### What follows, and it is not more copy

**Al-Ma'arij needs to exist as bookable VENUE INVENTORY, not only as a room
inside a coworking space that someone might find via coworking intent.**

Three concrete consequences, in order of leverage:

1. 🔴 **MAZJ is listed on coworking directories and, as far as this audit found,
   on zero event-venue directories.** Every listing traced in §6 and §7
   (`thecoworkingspaces.com`, `coworkingspaces.me`, `workin.space`,
   `coworker.com`) is a coworking directory, which is precisely why MAZJ
   surfaces on coworking questions and disappears on venue questions. The venue
   marketplaces that fill these answers were never approached. **This is a new
   item, not covered anywhere in the build plan**, and it is the single
   highest-leverage thing this measurement produced.
2. ✅ **The on-site half is already built and is currently inert.** `EventVenue`
   with `maximumAttendeeCapacity: 30` went into `containsPlace` earlier today,
   which is exactly the machine-readable statement "this is a venue that holds
   thirty". It cannot help while the site serves `Disallow: /`. At launch it
   starts working without further edits.
3. ⚠️ **The page's own framing is worth re-reading against this.**
   `/spaces/event-hall` is written in activity language ("made for workshops,
   meetups, and gatherings"), which is what MAZJ sounds like and is why it wins
   the workshop query. A buyer typing "rent a hall" uses rental language. That
   is a `TONE.md` question, not an SEO instruction, and it should go to the
   owner rather than be resolved here: the honest framing of the trade is that
   the current copy wins one query and loses the other.

⚠️ **Scope of the claim.** Two surfaces, one prompt pair, one language. It is a
controlled comparison rather than a large sample, and it should be re-run in
Arabic before anyone calls it universal. It is strong enough to act on because
the control was clean, not because the sample was big.

🔴 **The two Google products disagree completely with each other, and that is
the finding.** Gemini puts MAZJ at the top of four separate answers. Google's AI
Overview never mentions it once. Both have access to the same Business Profile,
and Gemini demonstrably reads it: it returned 4.7 and the correct 9-to-5 hours
from the profile card. So this is not a data-access problem, and it is not a
content problem, because Gemini finds plenty to say.

**Which relocates the whole question.** The thing to explain is no longer "why
is MAZJ invisible on event queries", it is **"why does Google AI Overview, alone
among four assistants, not surface MAZJ at all"**. That is a local-search and
entity question, not a copy question, and it points at C6 (claim the Business
Profile) rather than at any page in this repo.

⚠️ **Honest note on sample size, because it cuts against the flattering
reading.** Gemini's 4-of-4 rests on four captures in a surface that hung twice
and needed a fresh tab per query to behave. Google's 0-of-6 is the cleanest,
largest and least-caveated sample in the whole set. **The most reliable number
here is the worst one.**

### 🔴 The gap-fill settled it, and it is not a MAZJ problem. It is a CATEGORY problem.

The open question was whether the event and startup blind spot was universal or
just a Google and ChatGPT artifact, because those two questions had never been
reached on the surfaces where MAZJ performs best. Perplexity answered it.

**Perplexity names MAZJ FIRST for "best coworking space in Al Khobar" and does
not name it at all for "30-person workshop" or "startup founder".** Same engine,
same business. So the blind spot is a property of the QUESTION, not of the
engine, and the optimistic reading is dead.

**But the reason is not what it looked like, and this is the part worth acting
on.** Read who actually filled those two slots:

| Question | Who Perplexity named |
|---|---|
| 30-person workshop | Park Inn by Radisson, Hilton Garden Inn, Holiday Inn Corniche, Mövenpick. **Four hotels. Zero coworking operators.** |
| Startup founder | **Nobody.** Al Olaya, Al Rakah, Al Aqrabiyah, the Corniche. Districts, not businesses, plus the instruction to "Search for 'coworking space Al Khobar'". |

🔴 **MAZJ is not losing the workshop query to a competitor. The entire coworking
category is absent from it.** Servcorp, Spaces, Regus, Sharik and Efficiency
Center are missing too, on an answer whose own opening line promises
"coworking/event spaces" and then lists four hotels. The assistants do not model
a coworking space as a workshop venue at all.

🔴 **And the startup question has NO winner.** Perplexity named zero operators
and told the founder to go and search. That slot is not owned by Jovia or anyone
else on this surface; it is empty.

**Which changes the recommendation completely.** The instinct from the earlier
data was "MAZJ must out-rank Servcorp and Spaces for event queries". That is the
wrong game and probably unwinnable. **No coworking space in Al Khobar is legible
as an event venue to any assistant**, so there is no incumbent to displace.

🔴 **AND THE FIRST DRAFT OF THIS SECTION THEN GOT THE CONCLUSION WRONG, IN THE
MOST EMBARRASSING WAY AVAILABLE.** It said the missing thing is "a page that
answers where do I run a thirty-person workshop in Al-Khobar". **That page
exists.** `/spaces/event-hall` ships a `metaTitle` of "Event Hall Rental in
Al-Khobar, **Up to 30 Guests**" and an intro of "Room for 30, with screen and
sound: **made for workshops**, meetups, and gatherings". `workshop` occurs **14**
times in `en.json`. The content is not missing and it is not badly targeted; it
is close to a perfect answer to the exact query measured.

**It is invisible because this site serves `Disallow: /`.** Every round 2
measurement was taken against a MAZJ that does not include this site at all.
What the assistants could actually read was `mazj.org`, which sells three spaces,
has no private office, and caps the hall at "أكثر من 20" against the real 30.

**So the event gap decomposes into two parts, and they need different work:**

1. **The MAZJ-shaped part is largely a LAUNCH artifact.** The page that answers
   this query is written, indexable in `lib/routes.ts`, and blocked. Connecting
   a real domain publishes it. Nothing needs writing. ⚠️ And until then,
   `mazj.org`'s "more than 20" is the only capacity claim a crawler can reach,
   which is both wrong and below the threshold the query asks for: a buyer
   needing 30 is told MAZJ fits "more than 20", which reads as a maybe. Fixing
   that one number on `mazj.org` is worth more than any page written here today.
2. **The category-shaped part is structural and launch will NOT fix it.**
   Assistants answer "30-person workshop in Al Khobar" with hotels, and no
   coworking operator appears at all. Being crawlable gets MAZJ considered; it
   does not by itself teach an assistant that a coworking space belongs in that
   answer. That is what CD3's events-hall intent page is for, and it is now
   measured rather than argued.

⚠️ Same shape for the founder question, with the same caveat: an empty slot may
be empty because the question is hard to answer with a business name, not
because it is available. Do not read "nobody owns it" as "MAZJ can own it"
without testing that.

### The check, run across every query MAZJ was absent from

Not one of them is a content gap. Each already has a page whose `metaTitle`
reads almost like it was written for that exact query, and each is behind
`Disallow: /`:

| Query MAZJ was absent from | The blocked page's `metaTitle` |
|---|---|
| 30-person workshop | **Event Hall Rental in Al-Khobar, Up to 30 Guests** |
| Meeting room by the hour | **Meeting Room Rental in Al-Khobar, by the Hour** |
| Startup founder in the Eastern Province | **Startups Offer, Coworking for Founders in Al-Khobar** |
| Private office month to month | **Private Office for Rent in Al-Khobar, Day or Month** |
| Day pass | **Open Desk & Day Pass Coworking in Al-Khobar** |

Meanwhile the capacity claim a crawler CAN reach, live on `mazj.org` right now,
is `يتسع لأكثر من 20 شخص`: "fits more than 20 people". The real answer is 30. A
buyer who needs thirty is being told MAZJ fits "more than 20", which reads as a
maybe rather than a yes.

**So the one-sentence version of this entire audit is: MAZJ's content is good
and invisible, and the visible content is wrong.**

🔴 **The general lesson, and it is the third time this session:** a measurement
of what AI says about MAZJ today is a measurement of MAZJ **minus this entire
site**. Every absence in round 2 must be checked against "is this content
already written and merely blocked" before it becomes a content recommendation.
Every single time that check was run, it changed the answer.

⚠️ **Coverage caveat, and it is not small.** Perplexity walled after one query
each attempt (2 of 6 captured) and Gemini hung on one and was not pushed further
(3 of 6). So the two surfaces where MAZJ performs BEST are also the two with the
thinnest sample, and the event and startup questions were never reached on
either. **The optimistic half of this table is the less-measured half.** Do not
quote the "1st on Perplexity and Gemini" line without it.

### 🔴 A third failure mode nobody was looking for: fabrication

Gemini described MAZJ, in both languages, as

> "featuring standard **revenue-sharing parameters** and strong support for
> those pursuing **subsidized allocations** or **micro-enterprise initiatives**"

and in Arabic

> "توفر بيئة مرنة **تدعم نماذج مشاركة الأرباح**"

**MAZJ states none of this.** Measured across both message files: `revenue` 0,
`equity` 0, `subsidiz` 0, `micro-enterprise` 0, `مشاركة الأرباح` 0, `الأرباح` 0.
This is not a poisoned source being repeated, because no source says it. It is
invention.

⚠️ **AND THE FIRST READING OF THIS WAS TOO POINTED. It is category boilerplate,
not a MAZJ-specific claim.** This was written up as "Gemini invents the one
thing `TONE.md` most forbids", on the reasoning that revenue-sharing describes a
business taking a cut of your company, which is the accelerator positioning MAZJ
refuses. Then the same fabrication turned up in a later answer attached to a
**different** operator: "An ideal environment for micro-enterprises, which
seamlessly aligns with **subsidized co-working space allocations** from
initiatives like Monshaat", said of Growth Hub by Fahdan.

So Gemini applies this language to coworking spaces generally. It is still
false, it is still attached to MAZJ in one answer, and it still describes a
business model MAZJ does not have. But it is not evidence that anything about
MAZJ specifically invited it, and reporting it that way would have been reading
a category tic as a targeted problem.

⚠️ Fabrication is a different problem from the other two and neither fix touches
it. Correcting `mazj.org` will not stop it and getting reviews will not stop it.
The only defence is **giving the model something specific and true to say
instead**, because a model with nothing concrete about a business fills the gap
with category boilerplate. That is an argument for the concrete facts already
built in this session, `maximumAttendeeCapacity`, `amenityFeature`, `/llms.txt`,
and it is the one finding in this audit that argues for on-site work.

🔴 **AND THERE IS A SECOND, STRANGER KIND, CAPTURED ON THE SAME SURFACE.** Asked
where a startup founder should work, Gemini recommended MAZJ first and justified
it like this:

> "**MAZJ shares the exact name of your business project**, making this coworking
> space on Amin Alraihani Street a uniquely fitting base for your operations."

The prompt never named a business. There was no business to share a name with.
The model invented a **fact about the reader** in order to manufacture a reason
to recommend MAZJ.

**That is a different failure from inventing an attribute, and arguably worse.**
Inventing "revenue-sharing" misdescribes MAZJ, which is bad but at least
checkable. Inventing a personal coincidence produces a recommendation that
sounds tailored, is not, and collapses the moment the reader notices. A buyer
who chooses MAZJ for a reason that was never true is a buyer arriving with a
false expectation, and MAZJ never said any of it.

⚠️ Nothing in this repo can prevent it and no off-site fix touches it either. It
is recorded because it changes what an AI-visibility number MEANS: MAZJ was
"recommended first" in that answer, and part of the reason given was fiction.
**A favourable mention is not automatically a good mention.** Any future
prompt-tracking should read the framing, not just count the placements.

⚠️ Note the same answer also placed MAZJ on **"Amin Alraihani Street"**, the
third capture of that bad-directory address across two rounds.

### The bad directory address reached an assistant, verbatim

Gemini placed MAZJ on **"Amin Alraihani St"** in both languages. Measured:
`Alraihani` and `الريحاني` score **0** in MAZJ's own copy, which says
`Life Tower, Zaid Ibn Alkhattab St, Al-Olaya` and
`برج الحياة، شارع زيد بن الخطاب، العليا`.

That street name comes from `workin.space`, whose MAZJ entry reads
`Zaid Bin Al Khatab St, Amin Alraihani St, Olaya, Office 201, Life Tower, 21st
Street`. It is a mangled concatenation naming two streets, and an assistant has
now picked the wrong one out of it and stated it as fact, twice.

✅ That converts item 4 of `directory-corrections.md` from a judgement call into
a confirmed defect with a measured consequence, and it is the strongest evidence
in the whole audit that a single bad directory row propagates.

### One more thing worth its own line

**Perplexity's hours were CORRECT here (9 to 5), citing `mazj`.** In round 1, the
same engine answered a direct hours question with 9pm citing `mazj.org`. Same
engine, same business, two different answers depending on the shape of the
question. **Do not model these systems as having a stable stored fact about
MAZJ.** They re-retrieve per question, so the same wrong source can win one
prompt and lose the next, and a single clean answer proves nothing about the
next one.

⚠️ It also corroborates the review count a third time: Perplexity printed
"MAZJ 4.7 (96)". Three independent captures now agree on roughly 96.

### The earlier, weaker observation, kept for the record

**What was run.** Two English and one Arabic query through a live
search-and-summarise tool on 2026-08-02, plus direct fetches of every source it
cited. ⚠️ **Calibration first, because it matters:** this is a search tool's own
grounded summary, NOT ChatGPT, Perplexity or Gemini. It is a weaker instrument
than a production answer engine. What makes it worth reporting is that it is the
same mechanism (retrieve third-party pages, summarise, answer) and it drew on
the same sources those engines would.

**The result, verbatim, on the query "MAZJ coworking Al Khobar opening hours
address":**

> "A boutique coworking space with **a perfect 5.0 rating** ... Free coffee and
> **snacks** are included ... **Opening Hours: Standard business hours**"

And on a second query:

> "The space has a rating of **5.0 of 5 based on 14 reviews** ... referenced at
> an address on Zaid Bin Al Khatab St in **Life Tower, 21st Street**, Al Khobar"

Three things there are wrong. The rating is **4.7**, not 5.0. MAZJ does not
claim snacks anywhere. The hours are Sunday to Thursday, 9 to 5, not "standard
business hours". Not one of these came from MAZJ: every cited source was a
third-party directory.

**The Arabic run failed differently and more instructively.** It correctly
refused to state hours and told the reader to go to `mazj.org`, which publishes
**9am to 9pm**. So the answer was well-behaved and still routed the buyer to the
wrong number. It also returned **both `mazj.org/` and `mazj.org/home-2/` in one
result set**, so the self-canonicalising duplicate is not theoretical.

### The source that is doing most of the damage

`thecoworkingspaces.com/space/mazj-al-khobar`, fetched directly:

| Field | What the directory publishes | Truth |
|---|---|---|
| Hours | `09:00 - 21:00 (Mon, Tue, Wed, Thu, Sat, Sun)` | Sunday to Thursday, 09:00 to 17:00 |
| Address | `MAZJ, Zaid Bin Al Khatab Street, Al Khobar` | Life Tower, Zaid Ibn Alkhattab St, **Al-Olaya** |
| Rating | `4.7 - 3 Reviews` | ✅ correct, and the only correct field |
| Features | Collaboration areas, Lounge areas, Standing desks, Ergonomic chairs, Wi-Fi, **Printing**, **Scanning**, Charging stations, Tech support services, Receptionist, Cleaning, Air conditioning, On-site cafe | MAZJ claims Wi-Fi and drinks. |

**Nine of those thirteen amenities score ZERO in MAZJ's own copy**, measured:
`Printing` 0, `Scanning` 0, `Standing desk` 0, `Ergonomic` 0, `Tech support` 0,
`Lounge` 0, `Charging` 0.

🔴 **This is the single most important finding in the whole audit, and it
inverts the priority order.** Earlier today, building `amenityFeature` in
`lib/schema.ts`, printing was deliberately refused because `طباعة` scores 0 in
Arabic and every English `print` is inside the word "sprint". That care was
correct and it is currently worth nothing, because a directory publishes
Printing and Scanning as MAZJ features and **the directory is what the assistant
reads.** For a business with no domain authority, off-site accuracy beats
on-site perfection. Every hour spent on schema is worth less than the ten
minutes it takes to press "Claim This Space" on that page, which the page
offers.

The wrong day is worth its own line: the listing includes **Saturday** and runs
six days. Somebody driving to Al-Khobar on a Saturday afternoon on the strength
of an AI answer finds a locked door, and neither MAZJ nor the assistant ever
learns why they did not come back.

## 8. What nobody measured

Stated so the gap is visible rather than implied.

✅ **1. CLOSED on 2026-08-02.** ChatGPT, Perplexity, Gemini and Google AI
Overview have now been asked directly, 20 answers captured verbatim, and the
result is section 7. This item read "nobody has ever run a real AI assistant
query for MAZJ" for the life of this document and it is no longer true.

⚠️ **What remains open inside it is narrower and worth naming.** Bing Copilot
was not reached. Claude was not asked. Only the six brand-fact probes ran, so
**not one category question was tested**: nothing here measures whether MAZJ is
named at all when somebody asks "best coworking space in Al Khobar" without
naming MAZJ first. That is the recommendation rung, it is the one that moves
buying behaviour, and it is still entirely unmeasured. The ten category prompts
are already written in `ai-query-set.json`.

**Why it is still open is tooling, not choice, and this is worth recording so
the next session does not repeat the attempt blind.** The `claude-in-chrome`
extension was not connected: `list_connected_browsers` returned an empty list,
i.e. zero Chrome instances registered, rather than the known
disconnected-but-recoverable flake. An agent dispatched to run the query set
correctly captured **nothing** and refused to fill the reachability table from
general knowledge, which was the right call: a reconstructed answer inside a
report about AI systems repeating things that are not true would have been
self-refuting.

🔴 **AND THE OBVIOUS INDEPENDENT ROUTE IS MEASURED SHUT. Do not spend the hour
re-attempting it.** Perplexity was the best candidate because it has historically
answered anonymously and always cites sources. Driven headlessly with Python
Playwright (a real Chromium, desktop Chrome user agent, `en-US`) against
`perplexity.ai/search?q=…` on 2026-08-02, all three probes failed, and they
failed in two different ways:

| Probe | What the page actually returned |
|---|---|
| 1 | The query rendered, then `Sign up and repeat your request.` plus a `Sign in to continue using Perplexity` modal. No answer, no sources. |
| 2 and 3 | `Performing security verification ... protect against malicious bots`, Cloudflare, Ray IDs `a24abc31d97dace6` and `a24abdacaf25ace6`. |

So Perplexity is sign-in walled and bot-challenged **for a headless, cookieless
browser hitting the search URL directly.** The remaining routes are an
authenticated human browser (the Claude Chrome extension, or a person with a
keyboard) or a paid API key. **Nothing in this repo can close this gap
unattended**, and that is the honest finding rather than a to-do.

🔴 **Read that result for exactly what it is, and no more. It measures that we
cannot ASK, not that Perplexity cannot ANSWER.** Nothing here is evidence about
what a real signed-in user sees when they ask about MAZJ, and a later session
skimming this section could easily turn "we were blocked" into "MAZJ does not
appear in Perplexity", which is a completely different and entirely unmeasured
claim. The gap in item 1 above remains open in full.

The instrument is built and ready: the 20-query set is `ai-query-set.json` in
the session scratchpad, paired with `score_answers.py`, which matches each
answer against the known-wrong values (9pm, fingerprint, 5.0, accelerator,
printing) and the known-correct ones. The scorer was self-tested against
synthetic answers and the synthetic data was then deleted, so it cannot be
mistaken for a result. 🔴 It records an uncaptured answer as `null`, never as an
absence of the marker: conflating those two is exactly how a gap becomes a false
clean bill of health.

2. **No embedding-similarity test** on decorated versus undecorated Arabic. The
   tokenisation difference is certain; the retrieval cost is reasoned.
3. **The live Google rating is unresolved.** The repo and one directory say 4.7
   with 3 reviews; two other directories say 5.0 with 14. Google Maps returned a
   JavaScript shell and Bing carried no rating, so nobody could settle it. **Do
   not quote any figure** until the Business Profile is claimed. The differing
   review counts suggest different scrape dates rather than a contradiction.
4. **No Bing Webmaster Tools or Brave Search coverage check.** Copilot reads
   Bing and Claude reads Brave; neither index has been verified to hold MAZJ.
5. **`/llms.txt` and `/pricing.md` are unverified as effective.** They are built
   correctly and serve correctly. Whether any engine retrieves them for MAZJ is
   unmeasured, and the honest prior is that adoption is early.

---

## 9. Verification recipes for this layer

- **Measure rendered output, never source.** `NextIntlClientProvider` serialises
  every namespace into a `<script>`, so grepping raw HTML false-positives on copy
  that is nowhere on screen. Strip `<script>` and `<style>` first.
- 🔴 **Confirm the port before believing any "not rendered" result.**
  `.claude.local.md` says MAZJ is on 3001; on 2026-08-02 it was on 3000. The
  `<title>` check against `مزج` is the only authority.
- **Decode HTML entities before asserting a string is absent from the body.** A
  check for `you're` fails against `you&#x27;re` and reads as a missing FAQ
  answer. Cost one false alarm here.
- **Count title length sans combining marks.** The damma in `الخُبر` overcounts
  by one per occurrence.
- **Re-derive a numeric claim a second way before reporting it.** The alt-text
  finding was 96 on the first pass and 6 on the correct one.
