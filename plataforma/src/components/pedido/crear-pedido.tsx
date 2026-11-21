import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bot, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PedidoForm, emptyCliente, lineasToPayload, type PedidoFormValue } from "./pedido-form";
import { isDemoMode } from "@/lib/demo-mode";
import { demoCrearPedido } from "@/lib/demo-store";
import { CATALOGO, errorMessage } from "@/lib/pedidos";

const DEMO_NOMBRES = ["Juliana Restrepo", "Restaurante Sabor Paisa", "Óscar Iván Mejía", "Asadero El Carbón", "Beatriz Elena Cano", "Tienda La Esquina", "Camilo Andrés Duque"];
const DEMO_BARRIOS = ["Laureles", "Belén", "El Poblado", "Robledo", "Envigado Centro", "Sabaneta"];

function pick<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function buildDemoPedido() {
  const tel = `3${Math.floor(100000000 + Math.random() * 899999999)}`;
  const items = [...CATALOGO].sort(() => Math.random() - 0.5).slice(0, 1 + Math.floor(Math.random() * 3));
  return {
    cliente: {
      cliente_nombre: pick(DEMO_NOMBRES),
      cliente_telefono: `+57 ${tel.slice(0, 3)} ${tel.slice(3, 6)} ${tel.slice(6)}`,
      cliente_chat_id: `wa-57${tel}`,
      cliente_direccion: `Calle ${10 + Math.floor(Math.random() * 80)} # ${Math.floor(Math.random() * 90)}-${Math.floor(Math.random() * 90)}`,
      cliente_barrio: pick(DEMO_BARRIOS),
      cliente_ciudad: "Medellín",
      cliente_cedula: String(Math.floor(10000000 + Math.random() * 1000000000)),
    },
    lineas: items.map((c) => ({
      codigo_plu: c.codigo_plu,
      nombre: c.nombre,
      cantidad: c.unidad === "KG" ? 1 + Math.round(Math.random() * 8) / 2 : 4 + Math.floor(Math.random() * 12),
      unidad: c.unidad,
      preparacion: pick(["", "Porcionado", "En cubos", "Para asar"]),
      empaque: pick(["Bolsa", "Bandeja", "Bolsa al vacío"]),
      precio_unitario: c.precio,
    })),
  };
}

export function CrearPedidoDemoButton() {
  const queryClient = useQueryClient();
  const m = useMutation({
    mutationFn: async () => {
      const demo = buildDemoPedido();
      if (isDemoMode()) {
        return demoCrearPedido("bot", demo.cliente, demo.lineas);
      }
      const { data, error } = await supabase.rpc("crear_pedido", {
        p_origen: "bot",
        p_cliente: demo.cliente,
        p_lineas: demo.lineas,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (p) => {
      toast.success(`Pedido demo ${p.codigo} recibido del bot`);
      void queryClient.invalidateQueries({ queryKey: ["pedidos"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Button variant="outline" onClick={() => m.mutate()} disabled={m.isPending}>
      <Bot /> Crear pedido demo (bot)
    </Button>
  );
}

export function CrearPedidoManualButton() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const m = useMutation({
    mutationFn: async (v: PedidoFormValue) => {
      if (isDemoMode()) {
        return demoCrearPedido("comercial_manual", v.cliente as Record<string, string>, lineasToPayload(v.lineas), v.notas);
      }
      const { data, error } = await supabase.rpc("crear_pedido", {
        p_origen: "comercial_manual",
        p_cliente: v.cliente,
        p_lineas: lineasToPayload(v.lineas),
        p_notas: v.notas,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (p) => {
      toast.success(`Pedido ${p.codigo} creado`);
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      navigate({ to: "/pedidos/$id", params: { id: p.id } });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus /> Crear pedido manual
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuevo pedido manual</DialogTitle>
            <DialogDescription>Se crea en estado Capturado para que lo verifiques.</DialogDescription>
          </DialogHeader>
          {open && (
            <PedidoForm
              initial={{ cliente: emptyCliente, lineas: [], notas: "" }}
              submitLabel="Crear pedido"
              submitting={m.isPending}
              onSubmit={(v) => m.mutate(v)}
              onCancel={() => setOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
