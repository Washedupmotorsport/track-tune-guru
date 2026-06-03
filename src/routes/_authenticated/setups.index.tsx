import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/setups/")({
  beforeLoad: () => {
    throw redirect({ to: "/setup-library" });
  },
});