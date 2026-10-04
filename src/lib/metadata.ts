export function pageHead(title: string, description: string) {
  return { meta: [
    { title: `${title} — moveby` },
    { name: "description", content: description },
    { property: "og:title", content: `${title} — moveby` },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] };
}