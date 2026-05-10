import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth-context";

export type CarAccess = "owner" | "editor" | "viewer";

export function useCarAccess(carId: string | undefined, ownerUserId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["car-access", carId, user?.id],
    enabled: !!carId && !!user,
    queryFn: async (): Promise<CarAccess> => {
      if (ownerUserId && ownerUserId === user!.id) return "owner";
      const { data, error } = await supabase
        .from("car_shares")
        .select("role")
        .eq("car_id", carId!)
        .eq("shared_with_user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data?.role as CarAccess) ?? "viewer";
    },
  });
}

export const canEdit = (a: CarAccess | undefined) => a === "owner" || a === "editor";