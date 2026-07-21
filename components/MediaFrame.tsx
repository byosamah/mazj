/**
 * The site's ONE media container.
 *
 * This is the landing page's idiom, lifted verbatim from USP: media sits
 * directly on the page surface inside a 16px radius with a 1px inset hairline
 * drawn by an `after:` pseudo-element — no white card, no drop shadow.
 *
 * Why a pseudo-element and not `shadow-[inset_...]` on the box itself: an inset
 * box-shadow paints UNDERNEATH an opaque <img> inside an overflow-clip parent,
 * so it renders invisible. Every landing-page media block already worked around
 * this; the sub-pages did not, which is one reason they looked flatter.
 *
 * The sub-pages previously wrapped every image in
 * `bg-white rounded-[16px] shadow-[0_10px_32px_rgba(0,0,0,0.08)]` — a generic
 * floating card that appears nowhere on the landing page. Routing all media
 * through this component is what makes the two halves of the site agree.
 */
export default function MediaFrame({
  src,
  alt = "",
  ratio = "aspect-[4/3]",
  width,
  height,
  eager = false,
  fx,
  overlay,
  className = "",
  children,
}: {
  src: string;
  alt?: string;
  /** Tailwind aspect class. Portrait 4/5 matches the landing's USP media. */
  ratio?: string;
  width?: number;
  height?: number;
  eager?: boolean;
  /** ScrollFX hook, e.g. "clip" for the scrubbed reveal. */
  fx?: string;
  /** Optional scrim, for text sitting over the media. */
  overlay?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      {...(fx ? {"data-fx": fx} : {})}
      className={`relative ${ratio} w-full overflow-clip rounded-[16px] after:pointer-events-none after:absolute after:inset-0 after:rounded-[16px] after:shadow-[inset_0_0_0_1px_rgba(0,0,0,0.1)] after:content-[''] ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        className="h-full w-full object-cover"
      />
      {overlay && (
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent"
        />
      )}
      {children}
    </div>
  );
}
