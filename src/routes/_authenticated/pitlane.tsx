import { createFileRoute, redirect } from "@tanstack/react-router";

// Merged into the unified Race Mode screen.
export const Route = createFileRoute("/_authenticated/pitlane")({
  beforeLoad: () => { throw redirect({ to: "/race-mode" }); },
});