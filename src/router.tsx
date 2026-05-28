import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Serve cached data instantly; revalidate in background.
        staleTime: 1000 * 30,
        gcTime: 1000 * 60 * 60 * 24 * 7, // 7 days — survives reloads via persister
        // 'offlineFirst' lets queries resolve from cache when offline instead of pausing.
        networkMode: "offlineFirst",
        retry: 2,
        refetchOnWindowFocus: false,
      },
      mutations: {
        // Queue mutations while offline; they fire automatically when the connection returns.
        networkMode: "offlineFirst",
        retry: 3,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
