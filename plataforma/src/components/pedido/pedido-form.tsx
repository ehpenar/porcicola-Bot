import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATALOGO, formatCOP, type Unidad } from "@/lib/pedidos";

export type ClienteForm = {
  cliente_nombre: string;
  cliente_telefono: string;
  cliente_cedula: string;
  cliente_direccion: string;
  cliente_barrio: string;
  cliente_ciudad: string;
};

export type LineaForm = {
  codigo_plu: string;
  nombre: string;
  cantidad: number;
  unidad: Unidad;
  preparacion: string;
  empaque: string;
  precio_unitario: number;
};

export type PedidoFormValue = { cliente: ClienteForm; lineas: LineaForm[]; notas: string };

export const emptyCliente: ClienteForm = {
  cliente_nombre: "",
  cliente_telefono: "",
  cliente_cedula: "",
  cliente_direccion: "",
  cliente_barrio: "",
  cliente_ciudad: "Medellín",
};

export function lineaFromCatalog(plu: string): LineaForm {
  const item = CATALOGO.find((c) => c.codigo_plu === plu) ?? CATALOGO[0]!;
  return {
    codigo_plu: item.codigo_plu,
    nombre: item.nombre,
    cantidad: 1,
    unidad: item.unidad,
    preparacion: "",
    empaque: "",
    precio_unitario: item.precio,
  };
}

export function PedidoForm({
  initial,
  submitLabel,
  submitting,
  onSubmit,
  onCancel,
}: {
  initial: PedidoFormValue;
  submitLabel: string;
  submitting?: boolean;
  onSubmit: (v: PedidoFormValue) => void;
  onCancel: () => void;
}) {
  const [cliente, setCliente] = useState(initial.cliente);
  const [lineas, setLineas] = useState<LineaForm[]>(initial.lineas.length ? initial.lineas : [lineaFromCatalog("PLU-201")]);
  const [notas, setNotas] = useState(initial.notas);
  const [error, setError] = useState<string | null>(null);

  const total = lineas.reduce((acc, l) => acc + Math.round((Number(l.cantidad) || 0) * (Number(l.precio_unitario) || 0)), 0);
  const setC = (k: keyof ClienteForm, v: string) => setCliente((c) => ({ ...c, [k]: v }));
  const setL = (i: number, patch: Partial<LineaForm>) => setLineas((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!cliente.cliente_nombre.trim()) return setError("Escribe el nombre del cliente.");
    if (lineas.length === 0) return setError("Agrega al menos un producto.");
    if (lineas.some((l) => !(Number(l.cantidad) > 0))) return setError("Todas las cantidades deben ser mayores a cero.");
    setError(null);
    onSubmit({ cliente, lineas, notas });
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="label-caps mb-2">Cliente</legend>
        <div className="sm:col-span-2">
          <Label htmlFor="f-nombre">Nombre *</Label>
          <Input id="f-nombre" value={cliente.cliente_nombre} onChange={(e) => setC("cliente_nombre", e.target.value)} maxLength={120} />
        </div>
        <div>
          <Label htmlFor="f-tel">Teléfono</Label>
          <Input id="f-tel" value={cliente.cliente_telefono} onChange={(e) => setC("cliente_telefono", e.target.value)} maxLength={30} />
        </div>
        <div>
          <Label htmlFor="f-ced">Cédula / NIT</Label>
          <Input id="f-ced" value={cliente.cliente_cedula} onChange={(e) => setC("cliente_cedula", e.target.value)} maxLength={20} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="f-dir">Dirección</Label>
          <Input id="f-dir" value={cliente.cliente_direccion} onChange={(e) => setC("cliente_direccion", e.target.value)} maxLength={200} />
        </div>
        <div>
          <Label htmlFor="f-barrio">Barrio</Label>
          <Input id="f-barrio" value={cliente.cliente_barrio} onChange={(e) => setC("cliente_barrio", e.target.value)} maxLength={80} />
        </div>
        <div>
          <Label htmlFor="f-ciudad">Ciudad</Label>
          <Input id="f-ciudad" value={cliente.cliente_ciudad} onChange={(e) => setC("cliente_ciudad", e.target.value)} maxLength={80} />
        </div>
      </fieldset>

      <fieldset>
        <div className="mb-2 flex items-center justify-between">
          <legend className="label-caps">Productos</legend>
          <Button type="button" size="sm" variant="outline" onClick={() => setLineas((ls) => [...ls, lineaFromCatalog("PLU-204")])}>
            <Plus /> Agregar producto
          </Button>
        </div>
        <div className="space-y-2">
          {lineas.map((l, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 rounded-md border bg-muted/40 p-2.5 sm:grid-cols-12">
              <div className="col-span-2 sm:col-span-4">
                <Label className="text-xs">Producto</Label>
                <Select
                  value={l.codigo_plu}
                  onValueChange={(plu) => {
                    const c = lineaFromCatalog(plu);
                    setL(i, { codigo_plu: c.codigo_plu, nombre: c.nombre, unidad: c.unidad, precio_unitario: c.precio_unitario });
                  }}
                >
                  <SelectTrigger aria-label="Producto">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATALOGO.map((c) => (
                      <SelectItem key={c.codigo_plu} value={c.codigo_plu}>
                        <span className="font-mono text-xs text-muted-foreground">{c.codigo_plu}</span> {c.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">Cantidad ({l.unidad === "KG" ? "kg" : "und"})</Label>
                <Input
                  type="number"
                  step={l.unidad === "KG" ? "0.1" : "1"}
                  min="0"
                  value={l.cantidad}
                  onChange={(e) => setL(i, { cantidad: Number(e.target.value) })}
                />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">Precio unit.</Label>
                <Input type="number" min="0" step="100" value={l.precio_unitario} onChange={(e) => setL(i, { precio_unitario: Number(e.target.value) })} />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">Preparación</Label>
                <Input value={l.preparacion} placeholder="Ej. filetes" onChange={(e) => setL(i, { preparacion: e.target.value })} maxLength={120} />
              </div>
              <div className="flex items-end gap-1 sm:col-span-2">
                <div className="flex-1">
                  <Label className="text-xs">Empaque</Label>
                  <Input value={l.empaque} placeholder="Ej. al vacío" onChange={(e) => setL(i, { empaque: e.target.value })} maxLength={120} />
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={`Quitar ${l.nombre}`}
                  onClick={() => setLineas((ls) => ls.filter((_, idx) => idx !== i))}
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-right text-sm">
          Total estimado: <span className="font-semibold tabular">{formatCOP(total)}</span>
        </p>
      </fieldset>

      <div>
        <Label htmlFor="f-notas">Notas comerciales</Label>
        <Textarea id="f-notas" value={notas} onChange={(e) => setNotas(e.target.value)} maxLength={1000} rows={2} />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

export function lineasToPayload(lineas: LineaForm[]) {
  return lineas.map((l) => ({
    codigo_plu: l.codigo_plu,
    nombre: l.nombre,
    cantidad: Number(l.cantidad),
    unidad: l.unidad,
    preparacion: l.preparacion.trim(),
    empaque: l.empaque.trim(),
    precio_unitario: Number(l.precio_unitario),
  }));
}
