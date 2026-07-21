import createNextIntlPlugin from "next-intl/plugin";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // /pricing was merged into /spaces (the six mazj.sa products now live there,
  // grouped by commitment). Permanent so the old URL stops being indexed.
  async redirects() {
    return [
      {source: "/pricing", destination: "/en/spaces", permanent: true},
      {source: "/:locale(en|ar)/pricing", destination: "/:locale/spaces", permanent: true},
      // /community pulled for now (it's a future membership product, not a
      // page). /about carries the closest surviving copy.
      {source: "/community", destination: "/en/about", permanent: false},
      {source: "/:locale(en|ar)/community", destination: "/:locale/about", permanent: false},
    ];
  },
};

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

export default withNextIntl(nextConfig);
