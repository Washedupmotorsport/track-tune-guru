import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/_authenticated/tyre-setup")({
  head: () => ({
    meta: [
      { title: "Tyre Pressure Records | My Race Engineer" },
      {
        name: "description",
        content: "Recorded tyre pressures and tyre sets for My Race Engineer.",
      },
      { property: "og:title", content: "Tyre Pressure Records | My Race Engineer" },
      {
        property: "og:description",
        content: "Recorded tyre pressures and tyre sets for My Race Engineer.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TyreSetupRedirect,
});

function TyreSetupRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate({ to: "/tyres", search: { tab: "pressures" }, replace: true });
  }, [navigate]);
  return null;
}
