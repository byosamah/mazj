/**
 * What the startup-offer emails say, in both languages.
 *
 * 🔴 WHY THIS IS NOT IN `messages/{en,ar}.json` LIKE EVERY OTHER STRING ON THE
 * SITE. `server/` may not import `next-intl` (ESLint enforces it), and that rule
 * is the whole reason this folder could be lifted into its own service later.
 * Reaching across the boundary for a translation function would be one import
 * that quietly ends that property.
 *
 * So the MECHANISM is duplicated and the CONTENT is not: no string here appears
 * anywhere in `messages/*.json`, and none should. Email is a different register
 * doing a different job. It is read cold, in an inbox, days after the visit,
 * often on a phone lock screen, by someone who has forgotten they applied.
 *
 * `server/email/copy.test.ts` asserts the two locales carry identical key paths,
 * which is the same guarantee the i18n rule gives the site.
 *
 * The standing copy rules still apply in full (`TONE.md`): Arabic authored
 * first, zero negativity, no em-dashes, Western digits, `الخُبر` spelled with the
 * damma, مزج grammatically feminine.
 *
 * 🔴 AND THE ONE THAT MATTERS MOST HERE: the offer is a closed envelope. Not one
 * line below states a discount, an amount, a duration or an inclusion. The
 * approval says a code exists and that a person will honour it. The terms are
 * still told face to face, exactly as `TONE.md` §6 requires.
 */

export type EmailLocale = "en" | "ar";

export type StartupEmailCopy = {
  /** Shared chrome. */
  brand: string;
  signOff: string;
  teamName: string;
  footerAddress: string;
  footerWhy: string;

  received: {
    subject: string;
    heading: string;
    body: string;
    referenceLabel: string;
    next: string;
  };

  approved: {
    subject: string;
    heading: string;
    body: string;
    codeLabel: string;
    /** 🔴 The line that stops a founder hunting for a discount box. */
    howToUse: string;
    expiryLabel: string;
    expiryNote: string;
    whatsappCta: string;
  };

  rejected: {
    subject: string;
    heading: string;
    body: string;
    reasonLabel: string;
    openDoor: string;
    spacesCta: string;
  };
};

/**
 * `{placeholder}` substitution.
 *
 * Deliberately dumb: it replaces only keys it was given, leaves anything else
 * alone, and does no escaping of its own. Escaping happens at the HTML boundary
 * in `templates.ts`, where it belongs, because the same filled string is also
 * used for the plain-text part where escaping would be wrong.
 */
export function fill(
  template: string,
  values: Record<string, string | number>
): string {
  return Object.entries(values).reduce(
    (out, [key, value]) => out.split(`{${key}}`).join(String(value)),
    template
  );
}

const en: StartupEmailCopy = {
  brand: "MAZJ",
  signOff: "See you in Al-Khobar,",
  teamName: "The MAZJ team",
  footerAddress: "MAZJ · Life Tower, Al Olaya, Al-Khobar",
  footerWhy: "You are receiving this because you applied to the MAZJ startups and builders offer.",

  received: {
    subject: "We have your application",
    heading: "Your application is in",
    body: "Thank you for telling us what you are building, {founder}. We read every application ourselves, so it takes a few days rather than a few minutes.",
    referenceLabel: "Your reference",
    next: "We will write to you here either way. Keep this email, and quote that reference if you message us in the meantime.",
  },

  approved: {
    subject: "You are in",
    heading: "Welcome to MAZJ",
    body: "We read what {startup} is building, and we would like to make room for it here. Your startups and builders offer is approved.",
    codeLabel: "Your code",
    howToUse:
      "Bring this code with you, or send it to us on WhatsApp, and our team applies the offer for you. It is your approval, not a checkout coupon, so there is nothing to type into a payment page.",
    expiryLabel: "Good until",
    expiryNote: "After that date the code closes, so come and see us before then.",
    whatsappCta: "Message us on WhatsApp",
  },

  rejected: {
    subject: "About your MAZJ application",
    heading: "Thank you for sharing it",
    body: "We read what {startup} is building, {founder}, and we gave it real thought. We are not able to extend the startups and builders offer to this application.",
    reasonLabel: "Here is our thinking",
    openDoor:
      "Our doors stay open to you. The open desk, Al-Malqa and Al-Ma'arij are all there to book any day, and if something changes with your project you are welcome to apply again. We will read it fresh.",
    spacesCta: "See the spaces",
  },
};

const ar: StartupEmailCopy = {
  brand: "مزج",
  signOff: "نراك في الخُبر،",
  teamName: "فريق مزج",
  footerAddress: "مزج · برج الحياة، حي العليا، الخُبر",
  footerWhy: "وصلتك هذه الرسالة لأنك تقدّمت إلى عرض الشركات الناشئة وروّاد الأعمال في مزج.",

  received: {
    subject: "وصلنا طلبك",
    heading: "طلبك بين أيدينا",
    body: "شكراً لأنك حدّثتنا عمّا تبنيه يا {founder}. نقرأ كل طلب بأنفسنا، فخذ الأمر أياماً قليلة لا دقائق.",
    referenceLabel: "رقم طلبك",
    next: "سنكتب إليك هنا في الحالتين. احتفظ بهذه الرسالة، واذكر الرقم إن راسلتنا قبل ذلك.",
  },

  approved: {
    subject: "أهلاً بك في مزج",
    heading: "أهلاً بك",
    body: "قرأنا ما تبنيه {startup}، ونودّ أن نفسح له مكاناً هنا. تمّت الموافقة على عرض الشركات الناشئة وروّاد الأعمال.",
    codeLabel: "رمزك",
    howToUse:
      "أحضر هذا الرمز معك، أو أرسله لنا على واتساب، ويطبّقه فريقنا لك. هو إثبات موافقتنا لا قسيمة شراء، فليس هناك ما تكتبه في صفحة دفع.",
    expiryLabel: "صالح حتى",
    expiryNote: "بعد هذا التاريخ يُغلق الرمز، فتعال إلينا قبله.",
    whatsappCta: "راسلنا على واتساب",
  },

  rejected: {
    subject: "بخصوص طلبك في مزج",
    heading: "شكراً لمشاركتك إيّاه",
    body: "قرأنا ما تبنيه {startup} يا {founder}، وأعطيناه حقّه من التفكير. لن نتمكّن هذه المرة من تقديم عرض الشركات الناشئة وروّاد الأعمال لهذا الطلب.",
    reasonLabel: "وهذا ما رأيناه",
    openDoor:
      "أبوابنا تبقى مفتوحة لك. المكتب المرن والملقى والمعارج جاهزة للحجز في أي يوم، وإن تغيّر شيء في مشروعك فقدّم طلباً جديداً ونقرأه من جديد.",
    spacesCta: "تصفّح المساحات",
  },
};

export const STARTUP_EMAIL_COPY: Record<EmailLocale, StartupEmailCopy> = {
  en,
  ar,
};

/**
 * Formats an expiry instant for a human, in their language.
 *
 * 🔴 TWO traps, both silent, both live in this one call.
 *
 * `ar-SA` defaults to the **Umm al-Qura (Hijri) calendar**, so an expiry of
 * 27 August 2026 renders as "٤ ربيع الأول ١٤٤٨". That is a correct date and the
 * wrong one to print beside a deadline somebody is going to act on, and nobody
 * reviewing the English copy would ever see it. `-ca-gregory` pins it.
 *
 * `ar-SA` also renders Arabic-Indic digits, which `TONE.md` §4 reserves for
 * dated archives; product copy uses Western digits throughout the site.
 * `-nu-latn` pins that.
 *
 * Riyadh time, because the venue is where the code gets used.
 */
export function formatEmailDate(value: string | Date, locale: EmailLocale): string {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat(
    locale === "ar" ? "ar-u-ca-gregory-nu-latn" : "en-GB",
    {
      timeZone: "Asia/Riyadh",
      day: "numeric",
      month: "long",
      year: "numeric",
    }
  ).format(date);
}
