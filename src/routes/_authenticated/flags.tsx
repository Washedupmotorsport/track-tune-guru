import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/_authenticated/flags")({
  component: () => {
    const nav = useNavigate();
    useEffect(() => {
      nav({ to: "/driver-hub", search: { tab: "sympathy" }, replace: true });
    }, []);
    return null;
  },
});
