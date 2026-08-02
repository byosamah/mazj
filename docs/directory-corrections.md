# Directory corrections: the ready-to-send pack

**Measured 2026-08-02 by direct fetch of each listing.** Every "publishes"
line below was read off the live page, not inferred.

🔴 **This is no longer an argument. It was measured.** On 2026-08-02, ChatGPT,
Perplexity, Gemini and Google's AI Overview were each asked six questions about
MAZJ through a real signed-in browser. **20 answers were captured and 9 repeated
a fact MAZJ knows is wrong.** Full transcript and per-surface breakdown in
[`ai-search-visibility-audit.md`](./ai-search-visibility-audit.md) §7.

| Wrong fact an assistant stated | How many of the 4 repeated it | Source they cited |
|---|---|---|
| Printing and scanning | **3** | `thecoworkingspaces.com` |
| Fingerprint / biometric entry | **2** | `mazj.sa` |
| Hours 9pm / 21:00, one including Saturday | **2** | `mazj.org`, `thecoworkingspaces.com` |
| Rating 5.0 | 1 | `coworkingspaces.me` |

✅ **And the measurement points at the fix.** Every CORRECT hours answer cited
the **Google Business Profile**. Every wrong one cited `mazj.org` or a directory.
The profile is already right and already wins wherever an assistant reaches it.
So this is not a content problem on the new site, it is a question of which
source the assistant happens to read, and that makes the fix list short, cheap
and entirely off-repo.

⚠️ **The irony is worth keeping, because it sets the priority.** On the same day
this was measured, `lib/schema.ts` was written with `amenityFeature` deliberately
refusing to claim printing, because `طباعة` scores 0 in the Arabic copy and every
English `print` is inside the word "sprint". That care was correct and it is
currently worth nothing: three of four assistants say MAZJ has printing, and all
three got it from a directory. **Fix the listings before writing another line of
structured data.**

## The canonical facts

🔴 **Do not restate them here.** The single source is the table at the top of
[`google-business-profile-brief.md`](./google-business-profile-brief.md). A
second copy is a second thing to keep true, and hours have already been wrong in
three places at once on this project. Copy the values from there when filling a
form.

The two that every listing below gets wrong:

- **Staffed hours: Sunday to Thursday, 09:00 to 17:00.** Not 21:00. Not Saturday.
- **Access: QR code or access card.** Never "fingerprint" or "biometric".
  ⚠️ 24/7 is a **space-subscriber benefit**, so it belongs in the description,
  never in the opening-hours field. A directory that puts 24/7 in the hours field
  tells a walk-in the door is open at 2am.

---

## 0. 🔴 `mazj.sa`, the storefront. Not a directory, and it goes first.

**This is MAZJ's own property and it is the source of the worst measured
result.** It is listed here because it is the same kind of job: one field, no
negotiation, and an AI stops repeating something untrue.

The storefront tells buyers that entry works by fingerprint. Verified by direct
fetch: `بصمة` occurs **13 times** on the English-declared subscription page and
the page serves `robots: index, follow`.

Two strings do the damage. The first is the product line:

> `دخول لا محدود للمساحة المشتركة خلال فترة الإشتراك باستخدام البصمة الشخصية`

The second is worse, because it is not a passing mention but an **enrolment
procedure**:

> `تنويه: يجب الحضور لأول مرة خلال أوقات عمل الفريق لتفعيل بصمة الدخول`

**Perplexity quoted that second sentence back, verbatim, and concluded "It's
biometric via fingerprint."** Google's AI Overview independently returned
"Method: Personal fingerprint / biometric scanner (البصمة الشخصية)", citing
`mazj.sa`. So two of four assistants now describe MAZJ as a biometric-entry
business, accurately sourced from MAZJ.

🔴 **This is a regulatory exposure, not a copy nit.** Biometric data is
PDPL-sensitive in Saudi Arabia and implies a controller registration this
project has spent deliberate effort avoiding: the word was stripped from the new
site on 2026-07-23 for exactly that reason. The rule was enforced on the site
nobody can see and left standing on the one Google and every AI crawler reads.

**The fix:** replace both strings in the Rekaz dashboard. Access is by **QR code
or access card**. Suggested Arabic: `دخول على مدار الساعة طوال فترة الاشتراك،
عبر رمز QR أو بطاقة الدخول` and `تنويه: يجب الحضور لأول مرة خلال أوقات عمل
الفريق لتفعيل دخولك`.

⚠️ **While you are in there:** the same product's URL slug is
`adwyh-almsahh-almshtrkh`, and `adwyh` transliterates `عضوية` (membership), the
word retired sitewide by owner ruling on 2026-07-31. A slug change breaks any
existing link, so weigh it. The two access strings do not have that problem and
should not wait on it.

---

## 1. `thecoworkingspaces.com/space/mazj-al-khobar` 🔴 highest priority among directories

**Unclaimed. The page renders a "Claim This Space" control**, so this is a form,
not a negotiation. It is also the listing that surfaced first in live testing.

| Field | Publishes today | Correct to |
|---|---|---|
| Hours | `09:00 - 21:00 ( Mon, Tue, Wed, Thu, Sat, Sun )` | `09:00 - 17:00 (Sun, Mon, Tue, Wed, Thu)` |
| Address | `MAZJ, Zaid Bin Al Khatab Street, Al Khobar Saudi Arabia` | add `Life Tower` and the `Al-Olaya` district |
| Rating | `4.7 - 3 Reviews` | ✅ correct. Leave it. |

**Seven listed amenities MAZJ has never claimed**, each measured at **0**
occurrences in `messages/en.json`: `Printing`, `Scanning`, `Standing desks`,
`Ergonomic chairs`, `Tech support services`, `Lounge areas`, `Charging stations`.

**Four are correct and should stay:** `Wi-Fi`, `Collaboration areas`,
`Receptionist or front desk services`, `On-site cafe or kitchenette`.

⚠️ `Cleaning services` and `Air conditioning` are not claimed in MAZJ's copy
either, but they are unremarkable for any office and not worth contesting. Say
nothing about them rather than asserting they are wrong.

**What the listing omits and should carry:** the meeting room **Al-Malqa** (up to
6, booked by the hour), the events hall **Al-Ma'arij** (up to 30, in 2 to 5 hour
slots), lockable private offices, free drinks, and 24/7 access for space
subscribers.

---

## 2. `coworkingspaces.me/al-khobar/`

Ranks MAZJ **#2 of 11**, which makes it the most valuable placement on this list
and the most expensive one to leave wrong.

- Publishes **`5.0 of 5 (14 reviews)`**. This is the origin of the "perfect 5.0"
  that reached a live AI answer.
- 🔴 **Do not send a replacement rating until the Google Business Profile is
  opened and read from a Saudi device.** Three sources disagree (4.7 with 3
  reviews, 5.0 with 14, "a perfect 5.0"), the review counts differ, and nobody
  has verified any of them. Asking a directory to publish a number MAZJ has not
  itself confirmed is how the next wrong fact gets created. **Ask them to remove
  the rating, or to attribute and date it**, rather than supplying a new one.
- Corrections go to `hello@coworkingspaces.me`.

---

## 3. `houseofsaud.com/travel/saudi-coworking-spaces/`

Published 2026-04-24. Publishes "a perfect 5.0 rating", "Pricing: Contact for
rates", "Hours: Standard business hours", and names none of the four rooms, while
giving competitors exact hours and a price. Same rating caveat as above: correct
the hours and the room names, leave the rating alone until it is verified.

---

## 4. `workin.space` (Al Khobar page)

Publishes, verbatim:
`Zaid Bin Al Khatab St, Amin Alraihani St, Olaya, Office 201, Life Tower, 21st Street, Al Khobar`

⚠️ **Do not simply correct this one. It asks MAZJ a question first.** The string
is low-quality on its face, because it concatenates **two different street
names**. But it also carries a **unit number, `Office 201`**, and MAZJ has never
published one: measured across both message files, `201` appears **0** times,
`الدور` **0**, and `floor` **0** in the Arabic.

So the real question is not "is the directory wrong", it is: **does a first-time
visitor who reaches Life Tower know where to go next?** Today MAZJ's address
stops at the building. Towers have lobbies and lifts, and an assistant asked
"where exactly is MAZJ" can only repeat what it is given.

- **If `Office 201` is right**, MAZJ's own address is the incomplete one and the
  fix belongs in `Location.address` in both message files, in the Google
  Business Profile, and in `lib/schema.ts`'s `streetAddress`. 🔴 That is a
  four-place change, and `app/CLAUDE.md` records that `Location.address` is
  load-bearing beyond copy because the JSON-LD reads it.
- **If it is wrong**, ask them to drop it and use the canonical address.

Either way somebody at MAZJ has to say which. Nothing on the web can settle it.

⚠️ Separately, its FAQ says "We currently list 3 coworking spaces in Al Khobar"
and names three others, so MAZJ appears in an unlinked text block without being
counted. Ask to be listed properly.

## 4b. 🔴 THE LISTING THAT DOES NOT EXIST: event-venue directories

**This is not a correction. It is the gap the whole audit ended up pointing at,
and it is not covered anywhere in the build plan.**

Measured 2026-08-02 with a controlled comparison. Same assistant, same language,
one variable changed:

| Prompt | MAZJ |
|---|---|
| "Where can I **run a 30-person workshop** in Al Khobar?" | **named 1st** |
| "Where can I **rent a small event hall for 30 people** in Al Khobar?" | **absent** |

Gemini split that second answer into "Social Event & Banquet Halls" and "Meeting
Rooms & Corporate Event Spaces", named ten operators across the two, and MAZJ was
in neither. ChatGPT's version of the same answer named **White Spaces** as the
coworking-style alternative to a hotel. So a coworking operator can hold that
slot. MAZJ simply does not.

**The likely reason is a listings gap, not a content gap.** Every MAZJ listing
this audit traced is a **coworking** directory: `thecoworkingspaces.com`,
`coworkingspaces.me`, `workin.space`, `coworker.com`. That is exactly why MAZJ
appears on coworking questions and vanishes on venue questions. The venue and
event-space marketplaces that fill those answers have never been approached.

**The action:** find where Al Khobar event venues are listed and get Al-Ma'arij
onto them, described as venue inventory (capacity 30, screen, sound system,
2 to 5 hour slots, hourly/session booking) rather than as a room inside a
coworking space. The competitors that own these answers are hotels, so the
directories worth finding are the ones a hotel banqueting team submits to.

⚠️ Two honest caveats. This rests on one controlled prompt pair on two surfaces,
not a large sample, so re-test in Arabic before treating it as universal. And
nobody has yet identified WHICH venue directories serve this market: that is the
first task, not an assumption that they exist and are open.

## 5. `zoominfo.com/c/mazj/556922471`

Points at the stale 2021 site. Low priority, but it is a business-data source
other tools ingest, so a wrong website field propagates.

---

## The upstream fix, which makes most of the above stop recurring

Directories scrape the Google Business Profile. Claiming and correcting that
profile is what stops a wrong rating and wrong hours being re-imported next time.
It is item C6 in [`ai-search-build-plan.md`](./ai-search-build-plan.md) and every
field value is already drafted in the GBP brief, so it is execution rather than
authoring.

🔴 **And fix `mazj.org` in the same sitting.** It is MAZJ's own property, it is
fully indexable (`noindex` count measured at **0**), and it publishes
`الأحد إلى الخميس ٩ صباحاً حتى الـ ٩ مساءً`. A directory can be forgiven for
getting the hours wrong while MAZJ's own live site states them wrong.

## Suggested message

Short, factual, one per listing. Keep the tone of a correction, not a complaint.

> Hello,
>
> I'm writing on behalf of MAZJ, the coworking space you list in Al Khobar,
> Saudi Arabia. A few details on our page are out of date and I'd like to
> correct them.
>
> Opening hours: we are staffed **Sunday to Thursday, 09:00 to 17:00**. The page
> currently shows 09:00 to 21:00 and includes Saturday, and we are closed on
> Saturday.
>
> Address: **Life Tower, Zaid Ibn Alkhattab St, Al-Olaya, Al-Khobar, Eastern
> Province, Saudi Arabia**.
>
> Amenities: could you please remove Printing, Scanning, Standing desks,
> Ergonomic chairs, Tech support services, Lounge areas and Charging stations,
> which we do not offer. Please add our meeting room Al-Malqa (seats up to 6,
> booked by the hour) and our events hall Al-Ma'arij (seats up to 30, booked in
> 2 to 5 hour slots), along with private offices and complimentary drinks.
>
> Access outside staffed hours is 24/7 for space subscribers, by QR code or
> access card. Please don't list it as general opening hours.
>
> Thank you,
