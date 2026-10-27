import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/_authenticated/flags")({
  head: () => ({ meta: [
    { title: "Flags | My Race Engineer" },
    { name: "description", content: "Flags: race-weekend tools and records for My Race Engineer." },
    { property: "og:title", content: "Flags | My Race Engineer" },
    { property: "og:description", content: "Flags: race-weekend tools and records for My Race Engineer." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),

  component: () => {
    const nav = useNavigate();
    useEffect(() => {
      nav({ to: "/driver-hub", search: { tab: "sympathy" }, replace: true });
    }, []);
    return null;
  },
});
