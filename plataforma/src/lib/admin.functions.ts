import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const createUserSchema = z.object({
  email: z.string().trim().email("Correo no válido").max(255),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres").max(72),
  full_name: z.string().trim().min(2, "Escribe el nombre").max(120),
  role: z.enum(["general", "comercial", "contable", "carnicero"]),
});

export const crearUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createUserSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "general",
    });
    if (!isAdmin) throw new Error("Solo el administrador puede crear usuarios");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (error || !created.user) {
      const msg = error?.message ?? "";
      throw new Error(msg.includes("already") ? "Ya existe un usuario con ese correo" : "No se pudo crear el usuario");
    }
    const userId = created.user.id;
    await supabaseAdmin.from("profiles").upsert({ id: userId, full_name: data.full_name, email: data.email });
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: data.role }, { onConflict: "user_id" });
    if (roleError) throw new Error("Usuario creado, pero no se pudo asignar el rol");
    return { id: userId };
  });
