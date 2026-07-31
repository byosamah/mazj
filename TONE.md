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

- 🔴 **Brand-brief language is not copy. Mining the brief is right; pasting from it is a leak of voice, not just of secrets.** `/about`'s opening sentence shipped as a verbatim lift from mazj.org's positioning line and survived until 2026-07-28. It described the company to itself in the reader's first sentence, and it spent the two most prominent slots on the page (the intro under the h1, and a chapter heading) on the same abstract noun phrase.
  - ✗ `مساحة عمل مشتركة في الخُبر، بُنيت لتكون بيئة تفاعلية تعلّمية للمجتمع العمراني في المنطقة الشرقية.` / "built as an interactive, learning environment for the Eastern Province's urban community"
  - ✓ `وهذا ما يحدث في مساحة العمل المشتركة هنا في الخُبر: أعمالٌ من كل نوع، وأصحابها يعرفون بعضهم بالاسم.` / "That is what happens in the shared workspace here in Al-Khobar: work of every kind, and the people doing it know each other by name."
  - **The tell:** a phrase that appears in the brief and nowhere in `messages/*.json` except the one page. `المجتمع العمراني` ran exactly twice, both on `/about`. Meanwhile `Meta.description` already had the human version of the same idea ("where the Eastern Province's makers come together"), which is the register to match. Keep the CATEGORY (`مساحة عمل مشتركة` + `الخُبر`, which SEO needs) and drop the abstraction around it.

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

⚠️ **Four bullets in this section quote `/about`'s "principles ledger" (`إطار مزج`, the مقصد / وظيفية / تكوين block). THAT SECTION WAS DELETED on 2026-07-31, owner ruling.** The rules stand, the copy is gone, so `principlesLabel`, `principlesTitle`, `principlesNote` and `principles[*]` no longer exist in either message file and a grep for them returns nothing. They are kept here as WORKED EXAMPLES, which is the whole point of them, but do not go looking for the strings and do not "restore" a rule because its example is missing.

**Why it went, since the reasoning generalises.** The owner asked whether it should be replaced with a "what is MAZJ" block or simply dropped. Measured before answering: the page's own `title` (`المزج هو المقـــــصد`) and `intro` (`مزج تعني أن تجتمع الأشياء فتصير واحدة`) already ARE the "what is MAZJ" answer, so a replacement would have restated the first two lines of the page, which is the very defect this section polices. And the only FACTS the ledger uniquely carried were the two capacities, which survive in **7** other keys (`حتى 6`) and **11** (`حتى 30`) across the finder, the space cards, the FAQ and the space pages. Nothing was lost but prose. 🔴 **That measurement is the price of removing a section**: per the root `CLAUDE.md` rule, every "this survives over there" claim needs the count that proves it, in writing, at the time.
No hook, verb, metaphor, sentence-opening, or phrase repeated across sections. Each section earns its place with a distinct idea; vary how sentences open.

- Do not reuse the same `روّاد الأعمال والمستقلين والفرق` list in two adjacent sections.
- Watch section seams: "grows" in one heading bumping "ideas grow" in the next; "people building" echoing the startups band. Re-word the weaker instance.
- **`مساحة` is spent. Never build a display line on it.** ⚠️ **Re-count it, do not quote this figure.** It has been recorded here as 65 and as 64, and three independent reviewers each re-derived it as 58 on 2026-07-28 and 56 on 2026-07-29 (the finder gave one back). The claim is "spent"; the number drifts every time anyone touches copy. It runs ~56× in `ar.json` (`Nav.getStarted` `احجز مساحة`, `Steps.qualifyCta` `احجز مساحتك`, `Steps.step2Heading`, `Steps.step1Cta` `شاهد المساحات`, the locked finder prompt `أي مساحة تناسبك؟`). Same for the hero's `تجد` (7×). The footer sign-off `اعثر على مساحتك` broke both at once and was the **third** "find your ___" on one page (hero `تجد مكانك` → StepInto `التقِ بناسك` → footer), so it was the weaker instance and was re-worded: ✗ `اعثر على مساحتك` → ✓ `نراك قريباً.` ("See you soon.").
- **A closing line closes; it does not issue another CTA.** The footer `<h2>` sits below five booking CTAs, so an imperative there is the sixth. Prefer a positive-presumptive sign-off (assume the visit) over an instruction.
- 🔴 **The hero viewport is a shared word budget; the subtitle gets what's left.** In one screen the eyebrow owns the category + `الخُبر`, the locked h1 owns `مكانك` / `ناسك` / `تجد`, the finder owns `مساحة` + `احجز`, the chips own the amenities (`DRINKS + WI-FI`), and the trustline owns the hours. The subtitle may not respend any of them. The old one spent four at once: it repeated `الخُبر`, listed four products the finder beside it already lists, opened its second sentence with a third on-screen `احجز`, and closed on `مساحةٍ تشبهك`, which just restates the h1.
  - ✗ `مكاتب مرنة، ومكاتب خاصة، وغرفة اجتماعات، وقاعة فعاليات في الخُبر. احجز على راحتك، وابدأ صباحك في مساحةٍ تشبهك.`
  - ✓ `صباحك يبدأ بقهوة، ويومك مع زملاء يفهمون ما تعمل عليه.` ("Your morning starts with coffee, your day with colleagues who get what you're working on.")
  - **Nothing is lost by dropping the product list**: the finder enumerates every space in the same viewport and the eyebrow carries category + city. Prose that repeats a widget is dead words. (It listed **six** when this was written and lists **four** since 2026-07-29, because two pairs opened an identical booking page in an identical state. The argument is unaffected; the count is not the point.)
- **Check the ADJACENT section for structural echoes, not just repeated words.** `WhyMazj` renders directly under the hero and already opens `تتّقد حين تكون بين من يشاركونك الشغف`, which ruled out an otherwise-clean `بين من يفهمون ما تعمل عليه` for the hero: same `بين من` + relative-clause shape, two sections apart. `زملاء` (0 prior uses) carried the same idea without the echo.
- **`str.count` the root before reaching for a "fresh" word.** Two obvious replacements were killed this way: `يمتزج` is already WhyMazj's payoff (`ويمتزج ذلك كله معاً`) and the door metaphor is already Network's (`قد تفتح باباً`), both on the same page as the footer.
- 🔴 **A kashida BREAKS `str.count`, so the check directly above now under-reports by default.** Since 2026-07-29 every display heading carries a tatweel run (§8.1), and `تنمـــو` does not match a search for `تنمو`. Measured 2026-07-30: a candidate-word sweep run exactly as this section prescribes reported `تنمو` as **unused on the landing page** when it is Network's own headline, and `تستحق` as **unused site-wide** when it is `/about`'s `h2`. Both would have shipped as "fresh" words sitting one section from their originals. **Strip the tatweels before counting** (`json.dumps(ns, ensure_ascii=False).replace(chr(0x0640), "")`) and treat a zero on any display word as suspect until you have. The uniqueness rules in this section are only as good as the count behind them, and the kashida standard silently invalidated every count taken the old way.
- 🔴 **A page gets ONE hook. `/about` ran "a whole day" four times** (`principlesTitle`, `principlesNote`, `principles[2].body`, `closingBody`) and it read as a page with one idea rather than a page with a spine. Fixed 2026-07-28 by letting the h2 own it (`كيف تستحق الغرفة يوماً كاملاً` / "How a room earns a whole day") and re-writing the other three off it. **Count your own hook before shipping a page**, the same way you `str.count` a root: four uses is invisible while writing and obvious while reading.
- 🔴 **A button may not restate the headline above it.** `/about`'s closing plate ran `تعال وشاهدها بنفسك` as the `<h2>`, `تعال وشاهد المكان` as the primary button and `شاهد ما حدث هنا` as the secondary: `شاهد` ×3 and `تعال` ×2 inside one card. The headline and the label are two different jobs, so give them two different verbs.
  - ✗ h2 "Come see it for yourself" + button "Come see the space"
  - ✓ h2 `دعنا نُريك المكان بأنفسنا` / "Let us show you around" + button `احجز جولة على واتساب` / "Book a tour on WhatsApp"
  - The ✓ headline also does a second job: it is the only place on `/about` where **a person speaks**. An About page with no "we" in it is a brochure.
- **Three stacked lines of framing is two too many.** An eyebrow, a heading and a note that all announce "a framework is coming" spend three slots on zero information. Keep the eyebrow as a register label, let the heading make the claim, and make the note say something the other two don't (✓ `ثلاث كلمات من لغة مزج نفسها. نقيس بها كل غرفة قبل أن نفتحها لك.` / "Three words from MAZJ's own vocabulary. Every room here is measured against them before it opens.").
- **A body may not open on its own label.** In `/about`'s principles ledger the label and the body sit on the SAME BASELINE, one column apart, so an opening word that repeats the label is read twice in one glance. ✗ label "Form" + body "**Form** that stops you the first time…" → ✓ label "Form" + body "Stops you the first time and settles you every time after." Neither sibling row did it ("Purpose" / "A firm reason to exist."), which is the tell. **Check what renders BESIDE a string, not just above it**: this survived a full tone pass because the label lives in a different JSON key.
- ⚠️ **A HEADING, however, MAY echo its own eyebrow, and two sections do it deliberately. Do not "fix" either back.** The rule directly above is about a BODY, whose opening word lands on the same baseline as the label one column across. An eyebrow sits ABOVE its heading at 12px against 50px, which is a different relationship: the label sets the register, the heading makes the claim in the reader's own words. `Spaces.eyebrow` (`المساحات`) has always sat above `Spaces.title` (`أربـــع مساحات، وعنوان واحد`).
  - **Owner ruling 2026-07-30, the startups band:** name the audience and the product in the big type, out loud. ✗ `تبني مشـــروعاً؟ / ابنِه هنا` ("Building something?") → ✓ `تبني منتجاً، / أو شركةً ناشـــئة؟ / ابنِه هنا` ("Building a product, or a startup? Build it here"), under an eyebrow still reading `للشركات الناشئة وروّاد الأعمال`. The old line spent the largest type in the section on `شيئاً` / "something", a word that addresses nobody. **A generic noun in a display heading is a worse defect than an echo**, because an echo costs a repeated word while a generic noun costs the reader recognising themselves.
  - ⚠️ **The eyebrow was not an option here anyway:** `Founding.eyebrow` and `Startups.eyebrow` are ONE shared value, so rewording it to avoid the echo would have silently changed `/startups` too.
  - The same ruling fixed the body, which DID break the rule above: it opened `لدى مزج عرضٌ خاصٌ للشركات الناشئة وروّاد الأعمال`, restating the eyebrow **verbatim** and in the third person, describing the reader to nobody. → ✓ `لك عرضٌ خاصٌ صُمّم ليعطي فكرتك دفعتها الأولى.` ("There is an offer here for you…"). The audience is named once, in the heading, where it is loudest.
- ⚠️ **Fixing a repetition can install a fresh one, so re-count after the fix, not before.** The 2026-07-28 pass correctly retired the spent `مساحة` / "space" and the 4× "a whole day" hook, and replaced them with `room` / `غرف` at **7** uses, including "Every room here" opening two paragraphs that render one directly above the other. A six-lens audit caught it; the tone pass that created it did not. Note it was **English-only**: the Arabic openings already differed (`نقيس بها كل غرفة` is verb-initial, `كل غرفة هنا بدأت` is noun-initial), which is the normal shape of this defect, because the English is derived and drifts toward whatever the Arabic means rather than how it is built.
- **An empty state may not name a different first channel than the intro above it.** `/events` shipped an intro promising "new dates appear here the moment they are set" above an empty-state string still saying Instagram announces first. Both render on the same page, and the empty state is the one showing whenever nothing is scheduled. **When you move a primacy claim, grep the page's other strings for the old claim.**

### 3.3 The belonging + blend thread
The brand's emotional spine is *a place that is truly yours, among your people* (**مكانك وناسك**), and *work + community blended into one* (**مزج** = blend). Bookend it from the hero to the finale (hero `وناسك` → StepInto `التقِ بناسك`). Let the blend idea recur without repeating the same words.

---

## 4. Arabic naturalness (write for a Saudi ear)

- **Avoid calques (literal loans that read wrong).**
  - "staffed" is **not** `مخدومة` (reads as *being serviced / cleaned*) → `الفريق في استقبالك`.
  - EN calque `faces meet` (from `وجوه تلتقي`) → `people meet` (in English people meet, not faces).
- **Use Saudi-natural verbs, not Levantine/Egyptian.** `احكِ لنا` (storytelling connotation) → `حدّثنا` / `أخبرنا`.
- **Owner correction 2026-07-30: `تتلاقح` is out.** ✗ `في مزج وجوهٌ تلتقي وأفكارٌ تتلاقح` → ✓ `في مزج وجوهٌ تلتقي وأفكارٌ تتولد` (`Network.body`). The rejected verb is the botanical one for cross-pollination: vivid, but technical, and it asks the reader to decode a metaphor in the section's opening sentence. The English moved with it, ✗ "ideas cross paths" → ✓ "ideas are born". Do not restore the more colourful verb.
  - ⚠️ **This knowingly puts the `ولد` root twice in one section**, because `Network.titleLine2` renders directly above it as `وتُولد الفرص.` (171 characters apart in the DOM). It also reassigns the heading's own pairing: the heading gives *growing* to ideas and *being born* to opportunities, and the body then gives *being born* to ideas. Both were flagged to the owner when the change was made. **If the body still reads `تتولد`, that is settled and must not be "fixed" by reverting it**; the fix, if one is ever wanted, belongs in the heading or in a different verb, never in undoing this instruction.
- **No archaic imperatives.** `الْقَ ناسك` → `التقِ بناسك`.
- **City spelling is settled: `الخُبر`** (damma only), every time. Never bare `الخبر` (also reads "the news") or fully-vocalized `الخُبَر`.
- 🔴 **`برج الحياة` is an address, NOT a landmark. The default locator is `الخُبر` alone.** The tower is not famous, so naming it in marketing copy tells the reader nothing and just lengthens the line. It had spread to **38 keys** (hero subtitle, meta description, all four space pages, three FAQ product answers, four alt texts, two metaTitles) and was stripped from 26 of them.
  - ✗ `وقاعة فعاليات في برج الحياة بالخُبر` → ✓ `وقاعة فعاليات في الخُبر`
  - ✗ "MAZJ's meeting room at Life Tower in Al-Khobar" → ✓ "MAZJ's meeting room in Al-Khobar"
  - **The address-function rule:** the tower survives only where a real address, directions, or legal registration appears, i.e. the `Location` block, the "where are you?" and parking FAQs, the Privacy + Terms registered address, `/about`'s "One address" chapter, the office page's address paragraph, and `ContactPage.metaTitle`. Twelve keys total. Anywhere else, the locator is `الخُبر`.
  - 🔴 **`Location.address` is load-bearing beyond copy:** `app/[locale]/layout.tsx` feeds it into the JSON-LD `streetAddress` that Google reads for local search, so it must keep the full `برج الحياة، شارع زيد بن الخطاب، العليا، الخُبر` string. Never shorten that one for tone.
- **Digits:** Western in product and marketing copy (`24/7`, `15%`, `حتى 6`, `9 صباحاً حتى 9 مساءً`). Arabic-Indic (`٢٠٢٥`) only in dated archives (e.g. the events list).
  - ⚠️ **A stat row is marketing copy, not an archive.** `/about`'s numbers shipped as `٢٥ / ٣ / ٣٠` sitting directly beside a Western `24/7`, so one row of four figures used two numeral systems. Fixed to `25 / 3 / 30` on 2026-07-28. **Sweep for this, don't read for it:** `re.search(r'[٠-٩]', json.dumps(ns, ensure_ascii=False))` over every namespace returns `EventsPage` (legitimate) and nothing else. It found `AboutPage` as the only violation on the site.
  - Spelled-out numbers in prose (`ستة حول طاولة الملقى`, `تسع مرات`) are NOT affected: the rule bans the Arabic-Indic *glyphs*, not Arabic number words, and prose reads better spelled.
  - 🔴 **Since 2026-07-28 the events numerals are no longer in `messages/ar.json` at all: they are FORMATTED AT RUNTIME**, so the rule is now enforced by which locale tag a formatter is given, and getting that wrong is silent. The split is drawn at REGISTER, not at language, and both halves are deliberate:
    - **Dates and archive years → `ar-SA-u-ca-gregory`**, which yields `١٢ أكتوبر ٢٠٢٥`. This is the dated-archive case, and it matches the 41 rows that already shipped that way.
    - **Seat counts, capacities and prices → next-intl's plain `ar`**, which yields `4`. These are live product figures on a card, i.e. marketing copy, and the same rule that fixed `/about`'s stat row to `25 / 3 / 30` applies.
    - So one event card legitimately carries `١٢ أكتوبر ٢٠٢٥` and `بقيت 6 مقاعد` at once. That is not the mixed-numerals defect: the defect is two systems inside ONE row of the same kind of figure.
    - ⚠️ **`-u-ca-gregory` is not optional.** `ar-SA` carries region Saudi Arabia, whose ICU default calendar is `islamic-umalqura`; whether an engine applies it varies by ICU version, so a server and a browser can disagree inside one `<time>` element, which is a hydration mismatch rather than a wrong date. Pinned in `server/domain/events.ts`, and dates are formatted on the server so only one engine ever decides.
  - ⚠️ **The `/events` intro no longer states a count.** It said `اثنتان وأربعون` while the archive held **41** rows, and the same claim ran three more ways elsewhere (§5). Any hardcoded total now goes stale the first time the owner publishes from the admin, so the sentence was rewritten without one on 2026-07-28.
- 🔴 **مزج is grammatically FEMININE, everywhere, in every sentence.** The site says `جاءت مزج`, `استضافت مزج`, `تُدار مزج`. `/about`'s closing card broke it mid-card, `تعال وشاهد**ها** بنفسك` in the heading and `أن تقضي **فيه** يوماً` in the body directly beneath, one subject with two genders two lines apart. It survives every read-through because each sentence is correct in isolation. **Grep the pronoun, not the sentence:** check `فيه`/`فيها`, `به`/`بها`, `منه`/`منها` wherever مزج is the antecedent.
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
- **Concrete proof beats a vague claim**, but see §6: **the proof may never be a count of events.** Name the thing, don't tally it. ✗ "hosted them all" → ✓ "a sketching series that came back nine times, design sprints, film nights". The three named formats are more persuasive than any total, and they cannot go stale.
- 🔴 **Copy may not promise an action that no control on the page performs.** `/about`'s `closingBody` said `احجز جولة` / "Book a tour" while its two buttons went to `/spaces` and `/events`, and the only working tour CTA on the site was one page away on `/contact`. The page walked a warm reader to the door and handed them a menu. Fixed 2026-07-28: the primary button is now `احجز جولة على واتساب` (see `components/CLAUDE.md` for why `/about` is a sanctioned WhatsApp exception), and the prose stopped restating the label.
  - **The check is mechanical:** for every imperative verb in a page's body copy, name the control that performs it. If you cannot, either wire the control or delete the verb.
  - Corollary: once the button says it, **the prose must not.** ✗ body "Book a tour, or look through what the community built" beside a button reading "Book a tour on WhatsApp" → ✓ body explains what the visit is like (`الجولة مجانية، والقهوة علينا.` / "The tour is free, and the coffee is on us"), the button names the action.
- **One fact, one number, site-wide** (and if you cannot settle on the number, that is a signal the fact does not belong in copy at all). The events count shipped **three different ways at once**: `EventsPage` and `SpaceEventHall` said forty-two, `HostEvent` said `أكثر من 40`, `/about` said "more than forty". A tone pass reconciled all four to forty-two on 2026-07-28, and the owner then removed the count entirely the same day (§6). **Read the disagreement as the warning it was:** a number nobody could state the same way twice was a number the brand did not actually want to make a claim about. Before reconciling a figure across pages, ask whether it should be a figure.
  - ⚠️ Matching a number is never enough, **the sentence around it must still differ.** `/about` and `EventsPage` both read "forty-two workshops, talks, screenings and gatherings", a whole clause duplicated across two pages, which no amount of getting the number right would have fixed.
- **Warm + honest on hard facts.** Lead with the positive frame, state the fact plainly, offer help.
  - Refund: *"Each booking is reserved just for you and held for your chosen date, so it stays non-refundable once it's placed. If your plans change, reach out before your booking date and we'll gladly help you find another time that works."* (Quoted post-sweep. It read "Each booking on mazj.sa" until 2026-07-27; naming the domain added nothing.)
- **Lead with welcome, let limits follow.** ✗ open with "each covers one person" → ✓ "You're always welcome to bring people along. A day pass is for one person, so for guests, book Al-Malqa…"
- **Do not repeat a fact within one viewport.** The hero states the location once; use the trustline for a *fresh* legitimacy signal (staffed hours), not the address again.

---

## 6. Hard constraints (never violate)

- 🔴 **Prices: RELAXED 2026-07-27 (owner ruling). Marketing copy stays money-free; the BOOKING FLOW shows live prices.**
  - Everything outside `/spaces/*/book` keeps the old rule: no SAR amounts in headings, intros, FAQ answers, space pages or meta. (Membership perks like "15% / 20% off the meeting room" were always allowed and still are.)
  - Inside the booking flow, prices are shown, pulled live from the Rekaz API. Nobody enters card details without seeing a total.
  - **Never hardcode a price in copy.** Rekaz rotates price ids when a price is edited, and a number typed into `messages/*.json` goes stale silently. The flow reads them at request time.
- 🔴 **Booking happens HERE now, not on mazj.sa. Copy must never send people away.**
  - The site used to link out to the Rekaz storefront, so 58 strings said so. They were swept on 2026-07-27, and the trap is that the LINKS were fixed first: `lib/links.ts` pointed at `/spaces/<space>/book` while the button beside it still read "Book on mazj.sa". Changing a link does not change the sentence around it.
  - ✗ `احجز عبر mazj.sa` / "Book on mazj.sa" → ✓ `احجز الآن` / "Book now"
  - ✗ `وتُحجز بالساعة عبر mazj.sa.` → ✓ `وتُحجز بالساعة.` **Usually the location is simply deleted.** "Booked by the hour" is warmer and shorter than naming a domain, and per §3.2 prose that repeats what the widget already does is dead words.
  - ✗ `يتم الدفع عبر mazj.sa حيث السعر المحدّث دائماً` → ✓ `ويظهر السعر المحدّث أثناء الحجز`
  - ⚠️ **Payment still leaves the site** (Rekaz exposes no payments API, so checkout is a Rekaz-hosted page). The owner chose a plain redirect with no explanatory copy, so **do not write a line about the hand-off**. Do not describe payment as happening "on our site" either; say the price is shown as you book and stop there.
  - The one surviving `mazj.sa` mention is `PrivacyPage.sections[0]`, which discloses that both properties belong to the same company. That is an ownership fact, not a booking instruction, and it stays.
- 🔴 **Legal copy is a factual claim, not tone.** Terms and Privacy said bookings were "booked and paid for on mazj.sa", and the Privacy data-flow section named the wrong processor. Both were corrected in the same sweep, and the Privacy disclosure now names **Rekaz** as the booking and payments platform, which is what PDPL expects and what "on mazj.sa" never conveyed. **When the product changes, re-read `TermsPage` and `PrivacyPage` before assuming only marketing is affected.**
- **No em-dashes (—) anywhere**, Arabic or English. Use commas, colons, periods, parentheses (Arabic: `،` and `:`).
  - ⚠️ **They hid as list bullets.** Terms and Privacy shipped with 46 `U+2014` characters used as line-start markers, which read as legitimate punctuation and survived every prose read-through. Swept to `•` on 2026-07-27. Grep for the codepoint, do not trust your eyes.
  - ⚠️ **And the FIX over-applied.** A blanket `— ` → `• ` assumed every dash was a bullet; two were parenthetical mid-sentence, so Terms 5 and Privacy 3 shipped reading "a personal digital access credential • a QR code or an access card • issued through our booking system". A punctuation replace needs a POSITION check (line-start only), not just a character match. The Arabic was untouched because it uses comma apposition, which is also the correct English fix.
- **Never mention biometric / fingerprint.** Access is a **QR code or a card**.
- **"24/7" is members-only.** Reception is staffed `الأحد إلى الخميس، 9 صباحاً حتى 9 مساءً`. Keep this accurate.
- 🔴 **The startups & builders offer is a closed envelope.** Never state its terms, amounts, durations or inclusions, anywhere: not on the landing band, not on `/startups`, and not in the approval email. Its perks are **verifiable facts** (a real address in الخُبر, 24/7 access, the ملقى meeting room), never offer terms. Owner ruling 2026-07-22, reaffirmed 2026-07-28.
  - ⚠️ **It is no longer "a teaser into a WhatsApp conversation".** Since 2026-07-28 the band's CTA opens `/startups`, where the offer is explained and applied for, and the terms arrive in the approval email. The envelope is unchanged; only the route into it is. `Founding.ctaMsg` (the old prefilled WhatsApp message) was deleted from both message files, so a reference to it anywhere is stale.
  - **Say that it is closed rather than being coy about it.** Withholding the terms silently reads as evasion; naming the withholding reads as tailoring. ✓ `لا ننشر تفاصيل العرض هنا، ولا نُخفيها: نرويها كاملةً في رسالة الموافقة` / "We do not publish the terms here, and we are not hiding them: they arrive in full in the approval email."
  - 🔴 **The approval email must say a PERSON applies the offer.** Rekaz has no coupon API, so no code can discount anything anywhere. ✓ "our team applies the offer for you. It is your approval, not a checkout coupon, so there is nothing to type into a payment page." Cut that sentence for brevity and every approved founder hunts for a discount box that does not exist.
  - `test/i18n-parity.test.ts` and `server/email/copy.test.ts` both assert no percentage, no SAR amount and no "discount" reaches the page or the emails, because this is the rule an enthusiastic copy pass is most likely to break.
- **No rating or stars claim.** Lead with legitimacy signals (address, staffed hours, 24/7 member access, VAT), not reviews. (The real Google rating is 4.7; still do not put a rating in the hero or a proof block.)
- 🔴 **Never state a COUNT of events. Owner ruling, 2026-07-28.** No "42", no "forty-two", no `اثنتان وأربعون`, no "more than 40", no `أكثر من 40`, and no live `{count}` fed from the database. It was removed from all four places it appeared (`EventsPage.intro`, `HostEvent.body`, `SpaceEventHall.about`, `AboutPage.communityBody`) in both locales.
  - ✗ "The hall has hosted forty-two community events since 2022" → ✓ "The hall has been hosting community events since 2022"
  - ✗ `استضافت المعارج أكثر من 40 فعالية منها منذ 2022` → ✓ `كلها أقيمت في المعارج منذ 2022`
  - ✗ `{count} ورشة ولقاءً وعرضاً وأمسية` → ✓ `ورشٌ ولقاءات وعروض وأمسيات`
  - **Keep `since 2022`**: longevity is the legitimacy signal, and it never goes stale. Keep the NAMED formats too (sketching series, design sprints, film nights) and the four recurring series, which are a different claim. What is banned is the tally.
  - ⚠️ **This ban outranks a live data source.** The events archive moved into Supabase the same week, which makes a real-time total trivial to render. Trivial is not permission: a dynamic count is still a count.
- 🔴 **`/about` carries NO stat block. Same ruling, same day.** The "MAZJ in numbers" row (25 open desks / 3 private offices / 30 seats / 24-7) was deleted from the page and from both message files. **Do not restore a counter to `/about` from an audit finding about "missing proof".**
  - ⚠️ **Two of those four facts now appear NOWHERE on the site, and this line said otherwise until an audit measured it.** Surviving: **30 seats** (19 strings) and **24/7** (32 strings). Gone: `"25"` appears in **zero** strings, and no string in either file says how many private offices exist. `AboutPage.spaceBody` names "the open desks, the private offices" with no figure, so citing it as the fallback was false. **Measure before you write a "this is still stated over there" rationale**: a comment that names a non-existent fallback is worse than no comment, because the next reader stops checking.
  - If "three private offices" is ever wanted back (it is a real scarcity fact), its home is `SpaceOffice`, at the buyer's decision point, not `/about`. Owner's call, not an audit's.
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
- **Space finder prompt:** `أي مساحــة تناســــبك؟` ("Which one suits you?")
  - ⚠️ **The two halves diverged on 2026-07-29, deliberately.** The Arabic is
    untouched, kashidas and all. The English became `Which one suits you?`
    (151.2px) because `Which space suits you?` (165.8px) was **measurably
    truncating** in the shipped default state, see the corrected box figures
    below. "One" also stops the word *space* appearing three times in one
    viewport (eyebrow `Shared workspace`, nav `Book a space`, this), and it
    accepts the first-person options that replaced the old space names.
  - 🔴 **Two kashidas here too, and they are deliberate** (owner ruling 2026-07-27): **2** `U+0640` tatweels on the `ح`→`ة` join of `مساحــة`, and **4** on the `س`→`ب` join of `تناســــبك`, 6 total. Same rule as the hero: a find-and-replace on `مساحة` or `تناسبك` silently strips them, and `مساحة` in particular is a term that gets swept site-wide (65+ uses). Arabic only; the EN string is untouched.
  - 🔴 **This label TRUNCATES, it does not wrap** (`Hero.tsx`, the trigger's `truncate` span: `overflow:hidden` + `ellipsis` + `nowrap`), so length here is a hard constraint, not a preference. Measured at 16px/400: each tatweel costs **3.71px**, so the 6 cost 22.3px, taking the string from 123.0px to **145.3px**. The tightest box is the 320px viewport, where the trigger label gets **167px**, leaving ~22px of slack. Verified by replicating the pill's flex geometry per breakpoint, because `--window-size=390` does NOT emulate mobile (it lays out desktop and crops).
  - 🔴 **THE BOX IS TWO NUMBERS, NOT ONE, AND THE OLD SINGLE FIGURE WAS WRONG.**
    Corrected 2026-07-29 from a live chrome-devtools pass. **EN 160.95px / AR
    167.37px at vw320**, 202.95 / 209.37 at vw390, 193.49 / 189.63 at vw1440.
    The locales differ because the trigger box is whatever the Book button
    leaves behind, and on phones that button renders `ctaShort`, where `احجز`
    is 6.4px narrower than "Book". Above 448px the labels swap to the long form
    and the relationship inverts, which is why **desktop is the tightest
    English breakpoint, not mobile**. The old "167px" was the ARABIC box quoted
    for both, so the English string was measured against a box 6.4px wider than
    it ever gets: `Which space suits you?` was recorded as having ~1px of slack
    when it was really **4.8px OVER** and rendering as `Which space suits yo…`
    on a 320px phone in the shipped default state. Any budget check that uses
    one number for both locales repeats that error.
  - ⚠️ **Measure Arabic at ZERO tracking.** `globals.css`
    `html[lang="ar"] * { letter-spacing: normal !important }` makes the Latin
    `-0.01em` a no-op, so modelling AR with it overstates every string by ~2%.
    A HarfBuzz rig on the real `thmanyah-sans-400.woff2` reproduces every known
    value here to 0.1px once that is fixed.
  - The `@media (max-width:359.98px)` padding fix in `globals.css` was
    calibrated for `What brings you in?` (141.9px), the prompt this finder
    shipped with in its first commit. **Keep it**: the longest current EN label
    leaves only ~15px against the padded box.
- **Meta** `title` / `metaTitle` / `siteName` / `city`: SEO and the static share cards depend on them. Changing `title` / `siteName` / `city` means regenerating the OG cards (`scripts/generate-og-cards.py`).
- **StepInto wordmark line:** `مزج`.

---

## 8. Bilingual craft and mechanics

### 8.1 The kashida standard (Arabic headings)

🔴 **Every Arabic page `h1` and every Arabic section heading carries exactly ONE
stretched join. Five tatweels on a page `h1`, three on a section heading.**
Owner ruling 2026-07-29. `test/arabic-kashida.test.ts` pins the full inventory;
adding, removing or resizing a kashida is a deliberate edit to that table too.

**Why 1 to 5 and never 6.** Thmanyah Sans does not stretch a kashida the way
most Arabic faces do. It ships **690 hand-drawn glyphs** whose only job is to be
the elongated form: 138 letter shapes × runs of exactly 1, 2, 3, 4 and 5
tatweels, present identically in all four weights (read out of the woff2 files
with fontTools, 2026-07-29). There is no sixth drawing. At six the shaper falls
back to repeating the generic flat `U+0640`, so the join stops being calligraphy
and becomes a ruled line. Measured on `المقصد` at 60px/900: runs 1-5 each add
~7px, the sixth jumps **+39px**.

⚠️ **This paragraph used to say the 6-run is "thinner than the surrounding
strokes", and that is wrong.** Measured from rendered pixels 2026-07-30 it is the
**same** weight as its neighbours (13.33 CSS px at 85px against the letters'
12.67-13.33). What breaks is the SHAPE: a drawn swash modulates 178-220% of its
median thickness and its centreline rises 16-28 CSS px across the run, while the
6-run is dead constant (2%) and perfectly flat (0.17px). It reads as a ruled line
because it is STRAIGHT, not because it is light, so **a thickness check alone will
never catch the degrade.** Two cheaper tells: it is materially WIDER (+51.4px on
`خاصة` and +52.2px on `للمبدعين` going 5 to 6 at 85px/700), and its elongation
measures **113.2px regardless of the preceding letter**, because six generic
tatweels no longer know what they follow, where a real drawn run differs per
letter (40.9 vs 32.7 at three tatweels). The ceiling is a property of the font
file, not a matter of taste, and no ruling can relax it. This is also the
mechanical reason the 14-tatweel hero experiment below looked wrong.

**Where it may go.** Display headings only: the page `h1` and section headings,
plus the two landing-page `Why.card*Statement` lines (owner ruling 2026-07-30).
Those two are not `*.title` keys and not section labels either: they are a
section's whole statement, rendered `WordReveal as="h2"` at 85px, which is the
largest type on the site after the hero `h1`. They take the section length, 3,
and they take it on the payload word of line 1 rather than on the first word
(`خاصـــة`, "special", and `للمبدعـــين`, "for the creatives").
🔴 Never in `metaTitle` (it reaches Google's snippet), never in `alt` or any
`aria-*` string (a screen reader gets a word the user cannot search for), never
in body copy, never in `messages/en.json`.

⚠️ **Where this prose and `test/arabic-kashida.test.ts` disagree, the TEST is the
inventory.** Its table carves out `SpaceFinder.trigger` at `runs: [2, 4]` even
though `Hero.tsx` feeds that string to an `aria-label`, which the rule directly
above appears to forbid. Two reviewers reached opposite conclusions from the
prose alone on 2026-07-29; the table settled it. Note the test enforces that rule
by KEY NAME (`/aria.*/`), so a kashida reaching aria through a differently-named
key is invisible to it.

**Which join.** The kashida attaches to the letter BEFORE it, and only if that
letter joins forward. 🔴 Never after `ا آ أ إ ؤ ٱ د ذ ر ز و ة ء`: those do not
connect to what follows, so the tatweel does not become a swash, it becomes a
dash floating in the word gap, which reads as a spelling error. Every other
Arabic letter is dual-joining and Thmanyah draws its swash. Put the swash on the
word the line is actually about (`المقـــــصد`, `تستحـــق`), not on whichever
word happens to be longest.

**Verify before shipping one.** Render it and measure the cost per tatweel in
`em`. The drawn swash runs **0.10 to 0.20em** per tatweel; the flat fallback
costs **0.435em**. Anything near the upper figure means the shaper did not find
a drawn form and the join is broken. All six on `/about` measure 0.096-0.198em.

✅ **Better: ask the shaper what glyph it actually picked, and read its NAME.**
The em-cost figures above are a proxy for the real question, and a proxy has a
grey zone. Thmanyah names its elongation glyphs after the run they carry, so the
answer is unambiguous and needs no browser at all. Shape the word with HarfBuzz
against the real woff2 and print the glyph names: a correct 3-tatweel swash
collapses letter-plus-tatweels into ONE glyph called
`<letter>Ar.<init|medi>_kashida_kashida_kashida`. If you instead see the tatweels
as separate glyphs, or any `uni0640`, the drawn form was not found. Verified this
way 2026-07-30 for both `Why` statements in all four weights: `خاصـــة` picks
`sadAr.init_kashida_kashida_kashida` and `للمبدعـــين` picks
`ainAr.init_kashida_kashida_kashida`. The substitution is a **`liga`** lookup, so
shaping with `{"liga": False}` is the control that proves the rig is live (it
breaks the same word back into 7 glyphs).

⚠️ **Two traps in that rig, both silent.** HarfBuzz here is built without brotli,
so handing it woff2 bytes shapes everything to `.notdef` and every string returns
the same width: decompress first with fontTools (`TTFont(path)`, then
`font.flavor = None`, then `save()`). And glyph names are NOT guessable, so do
not hand-write one: the unstretched forms are `uniFExx`, not `sadAr.init`. Take
the plain name from the shaper too, and diff the two glyph runs positionally.

**Note the position tag is `init`, not `medi`, in both of the above**, because
the letter before each (`ا` in `خاصة`, `د` in `للمبدعين`) does not join forward
and therefore starts a new joining group. That is the same rule as "which join"
above, seen from the font's side.

**Two things it does not break, both checked 2026-07-29.** The reveal animations
split by LINE (`SplitText type:"lines"`) and by WHITESPACE (`WordReveal`), never
per character, so intra-word joining survives; and `*.title` keys never feed
metadata, which lives in separate `metaTitle` keys. Overflow headroom is
comfortable: the `/about` h1 word sets 178.9px at `text-45` against the 272px
column at a 320px viewport.

🔴 **Never stretch a proper name.** `مزج`, `الملقى`, `المعارج` and `الخُبر` are
identity, not display copy. The two space pages take their swash on the
descriptive line instead (`غرفة الاجتمـــــاعات`, `قاعة الفعـــــاليات`), which
is why their `h1` flourish does not sit on the room name it opens with.

**Where the standard deliberately does NOT reach**, each for its own reason:

- **Terms, Privacy, the 404 and the error page** (owner ruling 2026-07-29). A
  flourish reads as decoration where the reader wants plainness, and as the
  wrong register on an apology.
- **The booking flow `h1`.** It renders a PRODUCT NAME (`المكتب المرن`), and that
  one value serves five keys: the spaces grid, the offers list,
  `SpaceCoworking.eyebrow`, `Booking.space.*` and a `/startups` form dropdown. A
  kashida there leaks into all of them. The booking flow therefore has no swash.
- **`Faq.groups[*].label`.** Rendered as `h2` on `/faq`, but they are category
  labels, and one of them IS `Nav.events`, so a swash would reach the navigation.
- **`Footer.morePower`.** An `h2` on every page. The same swash 13 times is a tic.
- **`Usp.*Title`.** The three landing-page USP cards, `h2` at 50px. Owner ruling
  2026-07-30, asked and answered directly: three flourishes sitting side by side
  in one row stop reading as flourishes and start reading as a repeating pattern.
  ⚠️ Do NOT "extend the standard for consistency" from the entry below. The two
  `Why` statements earned one because they are 85px and each stands alone in its
  own full-bleed card; these are 50px and come in a set of three.
- **`Why.risk1`, `risk2`, `risk3`.** Three sequential lines at 45px, and
  deliberately `Reveal as="span"` rather than headings (they are one continuous
  statement). Flourishing one of the three reads as arbitrary; flourishing all
  three is the `Footer.morePower` tic at a smaller scale.

**A tatweel is not always decoration.** `لـ30 شخصاً` and `عنوان الـIP` attach a
one-letter proposition to a digit or Latin run, which is spelling. Those are
always exactly one tatweel, they are allowed in body copy and in metadata, and
no pass over headings may touch them.

- **Both files, one edit.** Every change mirrors in `messages/en.json` AND `messages/ar.json`: add a key to both, reword the other language to match the new meaning, remove from both. Same keys, arrays the same length. The **Arabic carries the meaning**; the English is derived. (Full file mechanics: see `CLAUDE.md` → the i18n content-sync rule.)
- **Display headings are large (up to 85px).** Keep hero and section statements **punchy**; long copy overflows the clip box or orphans a lone word on its own line. Section titles carry hand-placed `\n` breaks at natural points; keep the number of lines the design expects.
  - Measure a display line before shipping it, don't eyeball it: render the candidate at its real size in Thmanyah and read the ink width. The footer `<h2>` cell is **272px** at `lg`, so `اعثر على مساحتك` (346px) was escaping its column; `نراك قريباً.` is 199px. Check the descender too, with a baseline probe (`descent > lineBox − baselineOffset`), never ink height alone: `نراك قريباً.` clears by only 2.80px where the old line had 4.40px.
- **`photoAlt` describes the photograph**, never the heading (or the same phrase gets announced twice).
  - ⚠️ **And no two alts on one page may be near-twins.** `/about` shipped "Inside MAZJ's space in Al-Khobar" and "The shared floor at MAZJ in Al-Khobar" on two different photographs: a screen reader heard the same sentence twice, which is the same defect as describing the heading, just harder to see. An alt that would fit any photo on the site is not describing this one. ✓ `أحدهم يصعد الدرج الأبيض داخل مزج نحو نافذة عالية` / "Someone climbing the white staircase inside MAZJ toward a tall window".
- **Arabic display text needs real heading tags** (`h1`/`h2`/`h3`) or explicit `leading-[1.35]`, or tall Arabic glyphs clip.
- **WhatsApp prefilled messages** (`ctaMsg` / `whatsappMsg`) are short, warm, first-person, written from the visitor to MAZJ.

---

## 9. Pre-ship checklist

- [ ] Arabic authored first; English reads native (not a back-translation).
- [ ] Zero negativity; every line invites.
- [ ] No phrase / hook / verb repeated across sections.
- [ ] Settled AR vocabulary + `الخُبر` spelling + Western digits.
- [ ] No prices, no em-dashes, no biometric, no rating, **no event count**; the offer stays a closed envelope.
- [ ] Facts, room names, URLs, VAT exact; locked lines untouched.
- [ ] Both `en.json` and `ar.json` updated; same keys; arrays same length.
- [ ] CTAs name the outcome.

---

## 10. Living document

This file compounds. **Whenever the owner gives copywriting feedback** (a correction, a "this word is wrong", a preference, a better phrasing): apply it to the copy **and** add the rule plus a concrete before → after example here, in the most relevant section, so it is never re-litigated. Keep examples real (quote what actually shipped).

**Provenance:** distilled 2026-07-24 from the full Arabic-first landing-copy rewrite and the 6-lens adversarial audit (native-Arabic, conversion, tone, uniqueness, facts, English) that produced most of §4 and §5. Related deep-context: `CLAUDE.md` (file mechanics, brand facts).
