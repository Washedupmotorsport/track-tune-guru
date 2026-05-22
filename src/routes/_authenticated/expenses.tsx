import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useUnits, CURRENCIES, type CurrencyCode } from "@/lib/units";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Receipt, Plus, ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/expenses")({ component: ExpensesPage });

type Car = { id: string; name: string };
type Expense = { id: string; car_id: string | null; category: string; description: string | null; amount: number; currency: string; spent_on: string; };
const CATEGORIES = ["tires", "fuel", "entry", "travel", "parts", "consumables", "other"];

function ExpensesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const units = useUnits();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ car_id: "none", category: "tires", description: "", amount: "", currency: units.currency as string, spent_on: new Date().toISOString().slice(0, 10) });
  useEffect(() => { setForm((f) => ({ ...f, currency: units.currency })); }, [units.currency]);

  const carsQ = useQuery({
    queryKey: ["cars-min", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("cars").select("id, name").order("created_at");
      if (error) throw error;
      return data as Car[];
    }, enabled: !!user,
  });

  const expensesQ = useQuery({
    queryKey: ["expenses", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("*").order("spent_on", { ascending: false });
      if (error) throw error;
      return data as Expense[];
    }, enabled: !!user,
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.amount) throw new Error("Amount required");
      const { error } = await supabase.from("expenses").insert({
        user_id: user!.id, car_id: form.car_id === "none" ? null : form.car_id,
        category: form.category, description: form.description || null,
        amount: Number(form.amount), currency: form.currency, spent_on: form.spent_on,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Expense logged");
      setOpen(false);
      setForm({ ...form, description: "", amount: "" });
      qc.invalidateQueries({ queryKey: ["expenses"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expenses"] }),
  });

  const expenses = expensesQ.data ?? [];
  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const byCategory = CATEGORIES.map((c) => ({
    category: c,
    total: expenses.filter((e) => e.category === c).reduce((s, e) => s + Number(e.amount), 0),
  })).filter((x) => x.total > 0);
  const carName = (id: string | null) => id ? (carsQ.data?.find((c) => c.id === id)?.name ?? "—") : "general";

  return (
    <div>
      <Link to="/garage" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to garage
      </Link>
      <div className="mt-4 flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="font-mono text-xs uppercase tracking-widest text-primary flex items-center gap-1"><Receipt className="w-3 h-3" /> Budget</div>
          <h1 className="font-display text-4xl font-bold mt-1">Expenses</h1>
          <p className="text-sm text-muted-foreground mt-1">Track what racing really costs you.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="shadow-glow"><Plus className="w-4 h-4 mr-1" /> Add expense</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New expense</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Category</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Date</Label><Input type="date" value={form.spent_on} onChange={(e) => setForm({ ...form, spent_on: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Amount *</Label><Input type="number" step="any" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
                <div>
                  <Label>Currency</Label>
                  <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v as CurrencyCode })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.code} {c.symbol}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Car (optional)</Label>
                <Select value={form.car_id} onValueChange={(v) => setForm({ ...form, car_id: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— general —</SelectItem>
                    {(carsQ.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={() => create.mutate()} disabled={create.isPending}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-lg border border-primary/40 bg-card p-4">
          <div className="font-mono text-[10px] uppercase tracking-widest text-primary">Total</div>
          <div className="font-display text-3xl font-bold mt-1">{units.formatCurrency(total)}</div>
        </div>
        {byCategory.map((c) => (
          <div key={c.category} className="rounded-lg border border-border bg-card p-4">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{c.category}</div>
            <div className="font-display text-2xl font-bold mt-1">{units.formatCurrency(c.total)}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-lg border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs font-mono uppercase tracking-widest text-muted-foreground border-b border-border">
            <th className="py-3 px-4">Date</th><th className="py-3 px-4">Category</th><th className="py-3 px-4">Description</th><th className="py-3 px-4">Car</th><th className="py-3 px-4 text-right">Amount</th><th></th>
          </tr></thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e.id} className="border-b border-border/50">
                <td className="py-3 px-4 font-mono text-xs">{e.spent_on}</td>
                <td className="py-3 px-4"><span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded bg-muted">{e.category}</span></td>
                <td className="py-3 px-4 text-muted-foreground">{e.description ?? "—"}</td>
                <td className="py-3 px-4 text-muted-foreground text-xs">{carName(e.car_id)}</td>
                <td className="py-3 px-4 text-right font-mono font-bold">{units.formatCurrency(Number(e.amount), e.currency)}</td>
                <td className="py-3 px-4 text-right">
                  <button onClick={() => { if (confirm("Delete?")) del.mutate(e.id); }} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
            {expenses.length === 0 && !expensesQ.isLoading && (
              <tr><td colSpan={6} className="py-10 text-center text-sm text-muted-foreground">No expenses yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}