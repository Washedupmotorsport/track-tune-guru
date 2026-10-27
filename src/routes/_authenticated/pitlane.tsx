import { createFileRoute, redirect } from "@tanstack/react-router";

// Merged into the unified Race Mode screen.
export const Route = createFileRoute("/_authenticated/pitlane")({
  head: () => ({ meta: [
    { title: "Race Mode | My Race Engineer" },
    { name: "description", content: "Race Mode: race-weekend tools and records for My Race Engineer." },
    { property: "og:title", content: "Race Mode | My Race Engineer" },
    { property: "og:description", content: "Race Mode: race-weekend tools and records for My Race Engineer." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),

  beforeLoad: () => { throw redirect({ to: "/race-mode" }); },
});