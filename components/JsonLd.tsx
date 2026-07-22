/**
 * Renders a JSON-LD graph node into the document.
 *
 * Server component on purpose: the markup must exist in the initial HTML.
 * Schema injected client-side is invisible to plenty of crawlers, and it is the
 * reason `web_fetch`-style tools routinely report "no schema found" on sites
 * that have plenty.
 *
 * On `dangerouslySetInnerHTML`: it is required, not a shortcut. React escapes
 * text children, which would corrupt the JSON into unparseable markup, so every
 * JSON-LD implementation (Next.js's own docs included) writes it this way.
 *
 * Threat model: the payload is `JSON.stringify` of repo-controlled data
 * (`messages/*.json`, `lib/contact.ts`, `lib/links.ts`). No user input, no
 * request data, no CMS reaches it. The one real escape vector is a literal
 * `</script>` inside a translated string ending the block early. The `.replace`
 * below rewrites every `<` to its unicode JSON escape, which parsers still read
 * as `<` but the HTML tokenizer cannot see as a tag, so the block can never be
 * closed early.
 *
 * An HTML sanitiser (DOMPurify and friends) is the wrong tool here: this is
 * JSON inside a non-executed `type="application/ld+json"` block, not HTML, and
 * sanitising it would only mangle the payload.
 */
export default function JsonLd({data}: {data: object}) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
