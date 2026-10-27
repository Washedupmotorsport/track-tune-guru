import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/setups/")({
  head: () => ({ meta: [
    { title: "Setup Library | My Race Engineer" },
    { name: "description", content: "Setup Library: race-weekend tools and records for My Race Engineer." },
    { property: "og:title", content: "Setup Library | My Race Engineer" },
    { property: "og:description", content: "Setup Library: race-weekend tools and records for My Race Engineer." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),

  beforeLoad: () => {
    throw redirect({ to: "/setup-library", search: { tab: "baselines" } });
  },
});