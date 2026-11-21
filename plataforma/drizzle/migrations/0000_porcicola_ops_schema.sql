
-- ===== Enums =====
create type public.app_role as enum ('general','comercial','contable','carnicero');
create type public.pedido_status as enum ('capturado','verificado_comercial','pago_solicitado','comprobante_recibido','liberado_produccion','listo_despacho','notificado_cliente','archivado','en_correccion','rechazado','cancelado');
create type public.pedido_origen as enum ('bot','comercial_manual');
create type public.unidad_medida as enum ('KG','UND');
create type public.comprobante_resultado as enum ('pendiente','aceptado','rechazado');

-- ===== Profiles & roles =====
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now()
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles ur join public.profiles p on p.id = ur.user_id
    where ur.user_id = _user_id and ur.role = _role and p.active
  )
$$;

create or replace function public.current_app_role()
returns public.app_role language sql stable security definer set search_path = public as $$
  select ur.role from public.user_roles ur join public.profiles p on p.id = ur.user_id
  where ur.user_id = auth.uid() and p.active limit 1
$$;

create policy "Ver propio perfil o general ve todos" on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(), 'general'));
create policy "Ver propio rol o general ve todos" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'general'));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), new.email)
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===== Pedidos =====
create sequence public.pedido_codigo_seq;
grant usage on sequence public.pedido_codigo_seq to service_role;

create table public.pedidos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique default ('ORD-' || lpad(nextval('public.pedido_codigo_seq')::text, 4, '0')),
  origen public.pedido_origen not null default 'bot',
  status public.pedido_status not null default 'capturado',
  cliente_nombre text not null default '',
  cliente_telefono text,
  cliente_chat_id text,
  cliente_direccion text,
  cliente_barrio text,
  cliente_ciudad text,
  cliente_cedula text,
  monto_estimado numeric(14,0) not null default 0,
  monto_pagado numeric(14,0),
  notas_comercial text,
  notas_contable text,
  novedades_carnicero text,
  verified_at timestamptz,
  payment_requested_at timestamptz,
  proof_received_at timestamptz,
  released_at timestamptz,
  prep_done_at timestamptz,
  client_notified_at timestamptz,
  archived_at timestamptz,
  status_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index pedidos_status_idx on public.pedidos(status);
create index pedidos_created_idx on public.pedidos(created_at desc);
grant select on public.pedidos to authenticated;
grant all on public.pedidos to service_role;
alter table public.pedidos enable row level security;

create policy "Pedidos visibles por rol" on public.pedidos for select to authenticated
  using (
    public.current_app_role() in ('general','comercial','contable')
    or (public.current_app_role() = 'carnicero' and status in ('verificado_comercial','pago_solicitado','comprobante_recibido','liberado_produccion','listo_despacho','notificado_cliente','archivado'))
  );

create table public.pedido_lineas (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  orden int not null default 0,
  codigo_plu text not null,
  nombre text not null,
  cantidad numeric(10,3) not null default 1,
  unidad public.unidad_medida not null default 'KG',
  preparacion text,
  empaque text,
  precio_unitario numeric(14,0) not null default 0,
  cantidad_real numeric(10,3)
);
create index pedido_lineas_pedido_idx on public.pedido_lineas(pedido_id);
grant select on public.pedido_lineas to authenticated;
grant all on public.pedido_lineas to service_role;
alter table public.pedido_lineas enable row level security;
create policy "Lineas visibles si el pedido es visible" on public.pedido_lineas for select to authenticated
  using (exists (select 1 from public.pedidos p where p.id = pedido_id));

create table public.pedido_comprobantes (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  file_path text,
  recibido_at timestamptz not null default now(),
  validado_por uuid,
  resultado public.comprobante_resultado not null default 'pendiente',
  nota text,
  created_at timestamptz not null default now()
);
create index pedido_comprobantes_pedido_idx on public.pedido_comprobantes(pedido_id);
grant select on public.pedido_comprobantes to authenticated;
grant all on public.pedido_comprobantes to service_role;
alter table public.pedido_comprobantes enable row level security;
create policy "Comprobantes visibles para general, comercial y contable" on public.pedido_comprobantes for select to authenticated
  using (public.current_app_role() in ('general','comercial','contable'));

create table public.pedido_eventos (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  actor_id uuid,
  actor_role public.app_role,
  accion text not null,
  from_status public.pedido_status,
  to_status public.pedido_status,
  detalle text,
  created_at timestamptz not null default now()
);
create index pedido_eventos_pedido_idx on public.pedido_eventos(pedido_id, created_at);
grant select on public.pedido_eventos to authenticated;
grant all on public.pedido_eventos to service_role;
alter table public.pedido_eventos enable row level security;
create policy "Eventos visibles si el pedido es visible" on public.pedido_eventos for select to authenticated
  using (exists (select 1 from public.pedidos p where p.id = pedido_id));

create table public.config_pago (
  id int primary key default 1 check (id = 1),
  instrucciones text not null default '',
  qr_url text,
  updated_at timestamptz not null default now()
);
grant select on public.config_pago to authenticated;
grant all on public.config_pago to service_role;
alter table public.config_pago enable row level security;
create policy "Config de pago visible para usuarios con rol" on public.config_pago for select to authenticated
  using (public.current_app_role() is not null);

-- ===== Business functions (all writes go through these) =====
create or replace function public.transicionar_pedido(p_pedido uuid, p_to public.pedido_status, p_nota text default null, p_monto_pagado numeric default null)
returns public.pedidos language plpgsql security definer set search_path = public as $$
declare
  v_role public.app_role := public.current_app_role();
  v_p public.pedidos;
  v_from public.pedido_status;
  v_allowed public.app_role;
  v_accion text;
  v_nota_req boolean;
  v_nota text := nullif(trim(coalesce(p_nota, '')), '');
begin
  if v_role is null then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  select * into v_p from public.pedidos where id = p_pedido for update;
  if not found then
    raise exception 'Pedido no encontrado';
  end if;
  v_from := v_p.status;

  select r.rol::public.app_role, r.accion, r.nota into v_allowed, v_accion, v_nota_req
  from (values
    ('capturado','verificado_comercial','comercial','verificar_pedido',false),
    ('capturado','rechazado','comercial','rechazar_pedido',true),
    ('capturado','en_correccion','comercial','enviar_a_correccion',true),
    ('verificado_comercial','pago_solicitado','contable','solicitar_pago',false),
    ('verificado_comercial','en_correccion','contable','devolver_a_comercial',true),
    ('en_correccion','capturado','comercial','regresar_a_captura',false),
    ('en_correccion','verificado_comercial','comercial','verificar_pedido',false),
    ('pago_solicitado','comprobante_recibido','contable','marcar_comprobante_recibido',false),
    ('pago_solicitado','cancelado','contable','cancelar_pedido',true),
    ('comprobante_recibido','liberado_produccion','contable','validar_pago_y_liberar',false),
    ('comprobante_recibido','pago_solicitado','contable','rechazar_comprobante',true),
    ('liberado_produccion','listo_despacho','carnicero','marcar_listo_despacho',false),
    ('listo_despacho','notificado_cliente','contable','notificar_cliente',false),
    ('listo_despacho','archivado','contable','notificar_cliente_y_archivar',false),
    ('notificado_cliente','archivado','contable','archivar',false)
  ) as r(desde, hacia, rol, accion, nota)
  where r.desde = v_from::text and r.hacia = p_to::text;

  if v_accion is null then
    raise exception 'Transición no permitida: % → %', v_from, p_to;
  end if;
  if v_role <> 'general' and v_role <> v_allowed then
    raise exception 'Tu rol no puede realizar esta acción' using errcode = '42501';
  end if;
  if v_nota_req and v_nota is null then
    raise exception 'Debes escribir una nota para esta acción';
  end if;
  if p_to = 'liberado_produccion' and (p_monto_pagado is null or p_monto_pagado <= 0) then
    raise exception 'Indica el monto pagado';
  end if;

  update public.pedidos set
    status = p_to,
    status_changed_at = now(),
    updated_at = now(),
    verified_at = case when p_to = 'verificado_comercial' then now() else verified_at end,
    payment_requested_at = case when p_to = 'pago_solicitado' then now() else payment_requested_at end,
    proof_received_at = case when p_to = 'comprobante_recibido' then now() else proof_received_at end,
    released_at = case when p_to = 'liberado_produccion' then now() else released_at end,
    monto_pagado = case when p_to = 'liberado_produccion' then p_monto_pagado else monto_pagado end,
    prep_done_at = case when p_to = 'listo_despacho' then now() else prep_done_at end,
    client_notified_at = case when p_to = 'notificado_cliente' or (p_to = 'archivado' and client_notified_at is null) then now() else client_notified_at end,
    archived_at = case when p_to = 'archivado' then now() else archived_at end
  where id = p_pedido
  returning * into v_p;

  if p_to = 'liberado_produccion' then
    update public.pedido_comprobantes set resultado = 'aceptado', validado_por = auth.uid()
    where pedido_id = p_pedido and resultado = 'pendiente';
  end if;
  if v_from = 'comprobante_recibido' and p_to = 'pago_solicitado' then
    update public.pedido_comprobantes set resultado = 'rechazado', validado_por = auth.uid(), nota = coalesce(v_nota, nota)
    where pedido_id = p_pedido and resultado = 'pendiente';
  end if;

  insert into public.pedido_eventos (pedido_id, actor_id, actor_role, accion, from_status, to_status, detalle)
  values (p_pedido, auth.uid(), v_role, v_accion, v_from, p_to, v_nota);

  if p_to = 'pago_solicitado' then
    insert into public.pedido_eventos (pedido_id, actor_id, actor_role, accion, detalle)
    values (p_pedido, auth.uid(), v_role, 'mensaje_simulado', 'Mensaje simulado enviado al cliente: instrucciones de pago (cuenta / QR)');
  elsif p_to = 'notificado_cliente' or (p_to = 'archivado' and v_from = 'listo_despacho') then
    insert into public.pedido_eventos (pedido_id, actor_id, actor_role, accion, detalle)
    values (p_pedido, auth.uid(), v_role, 'mensaje_simulado', 'Mensaje simulado enviado al cliente: pedido listo para despacho');
  end if;

  return v_p;
end $$;

create or replace function public.registrar_comprobante(p_pedido uuid, p_file_path text default null, p_nota text default null)
returns public.pedidos language plpgsql security definer set search_path = public as $$
declare
  v_role public.app_role := public.current_app_role();
  v_p public.pedidos;
begin
  if v_role is null or v_role not in ('general','contable') then
    raise exception 'Tu rol no puede registrar comprobantes' using errcode = '42501';
  end if;
  select * into v_p from public.pedidos where id = p_pedido for update;
  if not found then raise exception 'Pedido no encontrado'; end if;
  if v_p.status not in ('pago_solicitado','comprobante_recibido') then
    raise exception 'Solo se pueden adjuntar comprobantes cuando el pago fue solicitado';
  end if;
  insert into public.pedido_comprobantes (pedido_id, file_path, nota)
  values (p_pedido, nullif(trim(coalesce(p_file_path,'')), ''), nullif(trim(coalesce(p_nota,'')), ''));
  if v_p.status = 'pago_solicitado' then
    v_p := public.transicionar_pedido(p_pedido, 'comprobante_recibido', p_nota);
  else
    insert into public.pedido_eventos (pedido_id, actor_id, actor_role, accion, detalle)
    values (p_pedido, auth.uid(), v_role, 'comprobante_adjuntado', nullif(trim(coalesce(p_nota,'')), ''));
  end if;
  return v_p;
end $$;

create or replace function public._recalcular_monto(p_pedido uuid)
returns void language sql security definer set search_path = public as $$
  update public.pedidos set monto_estimado = coalesce((select sum(round(l.cantidad * l.precio_unitario)) from public.pedido_lineas l where l.pedido_id = p_pedido), 0)
  where id = p_pedido;
$$;

create or replace function public._insertar_lineas(p_pedido uuid, p_lineas jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.pedido_lineas (pedido_id, orden, codigo_plu, nombre, cantidad, unidad, preparacion, empaque, precio_unitario)
  select p_pedido, (x.ord - 1)::int,
    coalesce(x.v->>'codigo_plu', ''), coalesce(x.v->>'nombre', ''),
    coalesce((x.v->>'cantidad')::numeric, 1),
    coalesce(x.v->>'unidad', 'KG')::public.unidad_medida,
    nullif(x.v->>'preparacion', ''), nullif(x.v->>'empaque', ''),
    coalesce((x.v->>'precio_unitario')::numeric, 0)
  from jsonb_array_elements(coalesce(p_lineas, '[]'::jsonb)) with ordinality as x(v, ord);
end $$;

create or replace function public.crear_pedido(p_origen public.pedido_origen, p_cliente jsonb, p_lineas jsonb, p_notas text default null)
returns public.pedidos language plpgsql security definer set search_path = public as $$
declare
  v_role public.app_role := public.current_app_role();
  v_p public.pedidos;
begin
  if v_role is null or v_role not in ('general','comercial') then
    raise exception 'Tu rol no puede crear pedidos' using errcode = '42501';
  end if;
  if coalesce(trim(p_cliente->>'cliente_nombre'), '') = '' then
    raise exception 'El nombre del cliente es obligatorio';
  end if;
  if jsonb_array_length(coalesce(p_lineas, '[]'::jsonb)) = 0 then
    raise exception 'El pedido debe tener al menos una línea';
  end if;
  insert into public.pedidos (origen, cliente_nombre, cliente_telefono, cliente_chat_id, cliente_direccion, cliente_barrio, cliente_ciudad, cliente_cedula, notas_comercial)
  values (p_origen, trim(p_cliente->>'cliente_nombre'), p_cliente->>'cliente_telefono', p_cliente->>'cliente_chat_id',
    p_cliente->>'cliente_direccion', p_cliente->>'cliente_barrio', p_cliente->>'cliente_ciudad', p_cliente->>'cliente_cedula',
    nullif(trim(coalesce(p_notas,'')), ''))
  returning * into v_p;
  perform public._insertar_lineas(v_p.id, p_lineas);
  perform public._recalcular_monto(v_p.id);
  insert into public.pedido_eventos (pedido_id, actor_id, actor_role, accion, to_status, detalle)
  values (v_p.id, auth.uid(), v_role, 'pedido_creado', 'capturado',
    case when p_origen = 'bot' then 'Pedido demo recibido por bot de WhatsApp (simulado)' else 'Pedido creado manualmente por comercial' end);
  select * into v_p from public.pedidos where id = v_p.id;
  return v_p;
end $$;

create or replace function public.actualizar_pedido(p_pedido uuid, p_cliente jsonb, p_lineas jsonb default null, p_notas_comercial text default null)
returns public.pedidos language plpgsql security definer set search_path = public as $$
declare
  v_role public.app_role := public.current_app_role();
  v_p public.pedidos;
begin
  if v_role is null or v_role not in ('general','comercial') then
    raise exception 'Tu rol no puede editar pedidos' using errcode = '42501';
  end if;
  select * into v_p from public.pedidos where id = p_pedido for update;
  if not found then raise exception 'Pedido no encontrado'; end if;
  if v_p.status not in ('capturado','en_correccion') then
    raise exception 'Solo se puede editar un pedido capturado o en corrección';
  end if;
  if coalesce(trim(p_cliente->>'cliente_nombre'), '') = '' then
    raise exception 'El nombre del cliente es obligatorio';
  end if;
  update public.pedidos set
    cliente_nombre = trim(p_cliente->>'cliente_nombre'),
    cliente_telefono = p_cliente->>'cliente_telefono',
    cliente_direccion = p_cliente->>'cliente_direccion',
    cliente_barrio = p_cliente->>'cliente_barrio',
    cliente_ciudad = p_cliente->>'cliente_ciudad',
    cliente_cedula = p_cliente->>'cliente_cedula',
    notas_comercial = nullif(trim(coalesce(p_notas_comercial, '')), ''),
    updated_at = now()
  where id = p_pedido;
  if p_lineas is not null then
    if jsonb_array_length(p_lineas) = 0 then
      raise exception 'El pedido debe tener al menos una línea';
    end if;
    delete from public.pedido_lineas where pedido_id = p_pedido;
    perform public._insertar_lineas(p_pedido, p_lineas);
    perform public._recalcular_monto(p_pedido);
  end if;
  insert into public.pedido_eventos (pedido_id, actor_id, actor_role, accion, detalle)
  values (p_pedido, auth.uid(), v_role, 'pedido_editado', 'Datos del cliente / líneas actualizados');
  select * into v_p from public.pedidos where id = p_pedido;
  return v_p;
end $$;

create or replace function public.actualizar_nota(p_pedido uuid, p_campo text, p_valor text)
returns public.pedidos language plpgsql security definer set search_path = public as $$
declare
  v_role public.app_role := public.current_app_role();
  v_p public.pedidos;
  v_valor text := nullif(trim(coalesce(p_valor, '')), '');
begin
  if v_role is null then raise exception 'No autorizado' using errcode = '42501'; end if;
  select * into v_p from public.pedidos where id = p_pedido for update;
  if not found then raise exception 'Pedido no encontrado'; end if;
  if p_campo = 'notas_contable' then
    if v_role not in ('general','contable') then raise exception 'Tu rol no puede editar esta nota' using errcode = '42501'; end if;
    update public.pedidos set notas_contable = v_valor, updated_at = now() where id = p_pedido;
  elsif p_campo = 'novedades_carnicero' then
    if v_role not in ('general','carnicero') then raise exception 'Tu rol no puede editar esta nota' using errcode = '42501'; end if;
    if v_p.status <> 'liberado_produccion' then raise exception 'Solo se registran novedades durante la producción'; end if;
    update public.pedidos set novedades_carnicero = v_valor, updated_at = now() where id = p_pedido;
  elsif p_campo = 'notas_comercial' then
    if v_role not in ('general','comercial') then raise exception 'Tu rol no puede editar esta nota' using errcode = '42501'; end if;
    update public.pedidos set notas_comercial = v_valor, updated_at = now() where id = p_pedido;
  else
    raise exception 'Campo no válido';
  end if;
  insert into public.pedido_eventos (pedido_id, actor_id, actor_role, accion, detalle)
  values (p_pedido, auth.uid(), v_role, 'nota_actualizada', case p_campo when 'novedades_carnicero' then 'Novedades: ' else 'Nota: ' end || coalesce(v_valor, '(vacía)'));
  select * into v_p from public.pedidos where id = p_pedido;
  return v_p;
end $$;

create or replace function public.actualizar_cantidad_real(p_linea uuid, p_cantidad numeric)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_role public.app_role := public.current_app_role();
  v_status public.pedido_status;
  v_pedido uuid;
begin
  if v_role is null or v_role not in ('general','carnicero') then
    raise exception 'Tu rol no puede registrar cantidades reales' using errcode = '42501';
  end if;
  select p.status, p.id into v_status, v_pedido from public.pedido_lineas l join public.pedidos p on p.id = l.pedido_id where l.id = p_linea;
  if v_pedido is null then raise exception 'Línea no encontrada'; end if;
  if v_status <> 'liberado_produccion' then raise exception 'Solo se registra la cantidad real durante la producción'; end if;
  if p_cantidad is not null and p_cantidad < 0 then raise exception 'La cantidad no puede ser negativa'; end if;
  update public.pedido_lineas set cantidad_real = p_cantidad where id = p_linea;
  update public.pedidos set updated_at = now() where id = v_pedido;
end $$;

create or replace function public.admin_set_role(p_user uuid, p_role public.app_role)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'general') then
    raise exception 'Solo el administrador puede asignar roles' using errcode = '42501';
  end if;
  if p_user = auth.uid() and p_role <> 'general' then
    raise exception 'No puedes quitarte tu propio rol de administrador';
  end if;
  insert into public.user_roles (user_id, role) values (p_user, p_role)
  on conflict (user_id) do update set role = excluded.role;
end $$;

create or replace function public.admin_set_active(p_user uuid, p_active boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'general') then
    raise exception 'Solo el administrador puede activar o desactivar usuarios' using errcode = '42501';
  end if;
  if p_user = auth.uid() and not p_active then
    raise exception 'No puedes desactivar tu propia cuenta';
  end if;
  update public.profiles set active = p_active where id = p_user;
end $$;

create or replace function public.actualizar_config_pago(p_instrucciones text, p_qr_url text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'general') then
    raise exception 'Solo el administrador puede editar las instrucciones de pago' using errcode = '42501';
  end if;
  insert into public.config_pago (id, instrucciones, qr_url, updated_at) values (1, coalesce(p_instrucciones, ''), nullif(trim(coalesce(p_qr_url,'')), ''), now())
  on conflict (id) do update set instrucciones = excluded.instructions, qr_url = excluded.qr_url, updated_at = now();
end $$;

revoke execute on function public.transicionar_pedido(uuid, public.pedido_status, text, numeric) from public, anon;
revoke execute on function public.registrar_comprobante(uuid, text, text) from public, anon;
revoke execute on function public.crear_pedido(public.pedido_origen, jsonb, jsonb, text) from public, anon;
revoke execute on function public.actualizar_pedido(uuid, jsonb, jsonb, text) from public, anon;
revoke execute on function public.actualizar_nota(uuid, text, text) from public, anon;
revoke execute on function public.actualizar_cantidad_real(uuid, numeric) from public, anon;
revoke execute on function public.admin_set_role(uuid, public.app_role) from public, anon;
revoke execute on function public.admin_set_active(uuid, boolean) from public, anon;
revoke execute on function public.actualizar_config_pago(text, text) from public, anon;
revoke execute on function public._recalcular_monto(uuid) from public, anon, authenticated;
revoke execute on function public._insertar_lineas(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.transicionar_pedido(uuid, public.pedido_status, text, numeric) to authenticated;
grant execute on function public.registrar_comprobante(uuid, text, text) to authenticated;
grant execute on function public.crear_pedido(public.pedido_origen, jsonb, jsonb, text) to authenticated;
grant execute on function public.actualizar_pedido(uuid, jsonb, jsonb, text) to authenticated;
grant execute on function public.actualizar_nota(uuid, text, text) to authenticated;
grant execute on function public.actualizar_cantidad_real(uuid, numeric) to authenticated;
grant execute on function public.admin_set_role(uuid, public.app_role) to authenticated;
grant execute on function public.admin_set_active(uuid, boolean) to authenticated;
grant execute on function public.actualizar_config_pago(text, text) to authenticated;

-- ===== Realtime =====
alter publication supabase_realtime add table public.pedidos;
alter publication supabase_realtime add table public.pedido_eventos;

-- ===== Seed: payment config =====
insert into public.config_pago (id, instrucciones) values (1,
'Bancolombia — Cuenta de ahorros 123-456789-01 a nombre de Porcicola S.A.S. (NIT 901.234.567-8). También Nequi 300 123 4567. Envía el comprobante por este chat.');

-- ===== Seed: historical archived pedidos (last 13 days) =====
insert into public.pedidos (codigo, origen, status, cliente_nombre, cliente_telefono, cliente_chat_id, cliente_direccion, cliente_barrio, cliente_ciudad, cliente_cedula,
  created_at, verified_at, payment_requested_at, proof_received_at, released_at, prep_done_at, client_notified_at, archived_at, status_changed_at, updated_at)
select
  'ORD-' || lpad((row_number() over (order by h.c))::text, 4, '0'),
  (case when h.g % 4 = 0 then 'comercial_manual' else 'bot' end)::public.pedido_origen,
  'archivado'::public.pedido_status,
  (array['María Fernanda Ospina','Carlos Andrés Restrepo','Luz Dary Gómez','Jhon Jairo Henao','Paula Andrea Zuluaga','Restaurante El Fogón','Asadero La Brasa','Diana Marcela Rojas','Hernán Darío Pérez','Tienda Doña Rosa'])[(h.g % 10) + 1],
  '+57 3' || lpad(((h.g * 7919) % 1000000000)::text, 9, '0'),
  'wa-57' || (3000000000 + h.g * 1013)::text,
  'Calle ' || (10 + h.g) || ' # ' || (20 + h.g % 30) || '-' || (h.g % 80 + 10),
  (array['Laureles','Belén','Envigado Centro','El Poblado','Robledo','Castilla','Itagüí','Bello Niquía'])[(h.g % 8) + 1],
  'Medellín',
  (1000000000 + h.g * 123457)::text,
  h.c,
  h.c + make_interval(mins => 8 + (h.g * 7) % 25),
  h.c + make_interval(mins => 15 + (h.g * 7) % 25),
  h.c + make_interval(mins => 35 + (h.g * 7) % 25 + (h.g * 11) % 50),
  h.c + make_interval(mins => 42 + (h.g * 7) % 25 + (h.g * 11) % 50),
  h.c + make_interval(mins => 42 + (h.g * 7) % 25 + (h.g * 11) % 50 + 28 + (h.g * 13) % 55),
  h.c + make_interval(mins => 52 + (h.g * 7) % 25 + (h.g * 11) % 50 + 28 + (h.g * 13) % 55),
  h.c + make_interval(mins => 52 + (h.g * 7) % 25 + (h.g * 11) % 50 + 28 + (h.g * 13) % 55),
  h.c + make_interval(mins => 52 + (h.g * 7) % 25 + (h.g * 11) % 50 + 28 + (h.g * 13) % 55),
  h.c + make_interval(mins => 52 + (h.g * 7) % 25 + (h.g * 11) % 50 + 28 + (h.g * 13) % 55)
from (
  select g, date_trunc('day', now()) - make_interval(days => (g % 13) + 1) + interval '13 hours' + make_interval(mins => (g * 37) % 480) as c
  from generate_series(1, 30) g
) h;

-- ===== Seed: active pedidos =====
insert into public.pedidos (codigo, origen, status, cliente_nombre, cliente_telefono, cliente_chat_id, cliente_direccion, cliente_barrio, cliente_ciudad, cliente_cedula,
  notas_comercial, notas_contable, novedades_carnicero, created_at, verified_at, payment_requested_at, proof_received_at, released_at, prep_done_at, client_notified_at, archived_at, status_changed_at, updated_at)
values
 ('ORD-0031','bot','capturado','Sandra Milena Arango','+57 310 482 1190','wa-573104821190','Cra 70 # 44-21','Laureles','Medellín','43876512',
   null,null,null, now()-interval '25 minutes',null,null,null,null,null,null,null, now()-interval '25 minutes', now()-interval '25 minutes'),
 ('ORD-0032','bot','capturado','Restaurante La Cazuela','+57 304 551 7820','wa-573045517820','Calle 10 # 38-15 Local 2','El Poblado','Medellín','901445210',
   null,null,null, now()-interval '70 minutes',null,null,null,null,null,null,null, now()-interval '70 minutes', now()-interval '70 minutes'),
 ('ORD-0033','comercial_manual','capturado','Gustavo Adolfo Muñoz','+57 315 220 3344',null,'Diagonal 75B # 2A-80','Belén','Medellín','71234998',
   'Cliente llamó al punto. Prefiere entrega en la mañana.',null,null, now()-interval '10 minutes',null,null,null,null,null,null,null, now()-interval '10 minutes', now()-interval '10 minutes'),
 ('ORD-0034','bot','en_correccion','Yuliana Cardona','+57 301 778 9021','wa-573017789021','Calle 50 sur','Envigado Centro','Envigado','1036654321',
   null,'Dirección incompleta, confirmar número de casa y barrio.',null, now()-interval '3 hours', now()-interval '170 minutes',null,null,null,null,null,null, now()-interval '150 minutes', now()-interval '150 minutes'),
 ('ORD-0035','bot','verificado_comercial','Asadero Don Chepe','+57 320 665 4410','wa-573206654410','Av. 80 # 32-11','Robledo','Medellín','900887123',
   'Cliente frecuente, pide factura.',null,null, now()-interval '2 hours', now()-interval '100 minutes',null,null,null,null,null,null, now()-interval '100 minutes', now()-interval '100 minutes'),
 ('ORD-0036','bot','verificado_comercial','Natalia Bedoya','+57 312 909 1188','wa-573129091188','Calle 33 # 65-40 Apto 502','Laureles','Medellín','1017223344',
   null,null,null, now()-interval '90 minutes', now()-interval '50 minutes',null,null,null,null,null,null, now()-interval '50 minutes', now()-interval '50 minutes'),
 ('ORD-0037','bot','pago_solicitado','Fernando Villa','+57 300 431 2267','wa-573004312267','Cra 48 # 12 sur-90','Itagüí','Itagüí','98765432',
   null,null,null, now()-interval '3 hours', now()-interval '160 minutes', now()-interval '140 minutes',null,null,null,null,null, now()-interval '140 minutes', now()-interval '140 minutes'),
 ('ORD-0038','bot','comprobante_recibido','Carnes y Parrilla El Paisa','+57 318 223 5501','wa-573182235501','Calle 52 # 49-28','Bello Niquía','Bello','901223987',
   null,null,null, now()-interval '4 hours', now()-interval '220 minutes', now()-interval '200 minutes', now()-interval '40 minutes',null,null,null,null, now()-interval '40 minutes', now()-interval '40 minutes'),
 ('ORD-0039','bot','liberado_produccion','Lina María Torres','+57 311 650 9087','wa-573116509087','Cra 43A # 1-50','El Poblado','Medellín','1152334455',
   null,null,null, now()-interval '5 hours', now()-interval '285 minutes', now()-interval '270 minutes', now()-interval '240 minutes', now()-interval '35 minutes',null,null,null, now()-interval '35 minutes', now()-interval '35 minutes'),
 ('ORD-0040','comercial_manual','liberado_produccion','Hotel Las Palmas','+57 305 118 4420',null,'Calle 10 # 42-11','El Poblado','Medellín','890456112',
   'Empacar por porciones de 500 g para cocina.',null,'Costilla con poco stock, se completa con espinazo si el cliente acepta.', now()-interval '6 hours', now()-interval '340 minutes', now()-interval '330 minutes', now()-interval '300 minutes', now()-interval '80 minutes',null,null,null, now()-interval '80 minutes', now()-interval '80 minutes'),
 ('ORD-0041','bot','listo_despacho','Andrés Felipe Ríos','+57 319 004 7765','wa-573190047765','Calle 44 # 80-15','Castilla','Medellín','1020445566',
   null,null,null, now()-interval '7 hours', now()-interval '400 minutes', now()-interval '390 minutes', now()-interval '330 minutes', now()-interval '120 minutes', now()-interval '40 minutes',null,null, now()-interval '40 minutes', now()-interval '40 minutes'),
 ('ORD-0042','bot','archivado','Claudia Patricia Vélez','+57 316 300 2201','wa-573163002201','Cra 80 # 30-05','Belén','Medellín','43555123',
   null,null,null, now()-interval '9 hours', now()-interval '530 minutes', now()-interval '520 minutes', now()-interval '480 minutes', now()-interval '470 minutes', now()-interval '420 minutes', now()-interval '400 minutes', now()-interval '400 minutes', now()-interval '400 minutes', now()-interval '400 minutes'),
 ('ORD-0043','bot','rechazado','Mauricio Giraldo','+57 302 990 1234','wa-573029901234','Sin dirección',null,'Medellín',null,
   null,null,null, now()-interval '1 day',null,null,null,null,null,null,null, now()-interval '23 hours', now()-interval '23 hours');

select setval('public.pedido_codigo_seq', 43);

-- ===== Seed: lines =====
insert into public.pedido_lineas (pedido_id, orden, codigo_plu, nombre, cantidad, unidad, preparacion, empaque, precio_unitario)
select p.id, v.orden, v.plu, v.nombre, v.cant, v.unidad::public.unidad_medida, v.prep, v.emp, v.precio
from (values
 ('ORD-0031',0,'PLU-201','Lomo sin hueso',2.0,'KG','Filetes de 1 cm','Bolsa al vacío',26000),
 ('ORD-0031',1,'PLU-212','Chorizo',10,'UND',null,'Bandeja',3500),
 ('ORD-0032',0,'PLU-204','Costilla',8.0,'KG','Cortada en tiras para BBQ','Bolsa x 2 kg',19000),
 ('ORD-0032',1,'PLU-205','Bondiola',5.0,'KG','Entera','Bolsa al vacío',23000),
 ('ORD-0032',2,'PLU-206','Tocino',3.0,'KG','En cubos para chicharrón','Bolsa',17000),
 ('ORD-0033',0,'PLU-203','Chuleta fresca',3.0,'KG','Delgada','Bandeja',21000),
 ('ORD-0033',1,'PLU-209','Molida',1.5,'KG','Molida dos veces','Bolsa',18000),
 ('ORD-0034',0,'PLU-207','Pernil',4.0,'KG','En trozos para sudado','Bolsa',20000),
 ('ORD-0035',0,'PLU-204','Costilla',12.0,'KG','Para asar','Bolsa x 3 kg',19000),
 ('ORD-0035',1,'PLU-212','Chorizo',40,'UND',null,'Bandeja x 10',3500),
 ('ORD-0035',2,'PLU-206','Tocino',5.0,'KG','En tiras','Bolsa',17000),
 ('ORD-0036',0,'PLU-208','Solomito',1.5,'KG','Medallones','Bolsa al vacío',32000),
 ('ORD-0036',1,'PLU-202','Chuleta ahumada',2.0,'KG',null,'Bandeja',24000),
 ('ORD-0037',0,'PLU-211','Espinazo',3.0,'KG','En trozos','Bolsa',12000),
 ('ORD-0037',1,'PLU-210','Manitas',6,'UND','Partidas en mitades','Bolsa',4500),
 ('ORD-0038',0,'PLU-204','Costilla',10.0,'KG','Para asar','Bolsa x 2 kg',19000),
 ('ORD-0038',1,'PLU-201','Lomo sin hueso',5.0,'KG','Entero','Bolsa al vacío',26000),
 ('ORD-0039',0,'PLU-208','Solomito',2.0,'KG','Medallones de 3 cm','Bolsa al vacío',32000),
 ('ORD-0039',1,'PLU-203','Chuleta fresca',2.5,'KG','Gruesa','Bandeja',21000),
 ('ORD-0040',0,'PLU-205','Bondiola',6.0,'KG','Porciones de 500 g','Bolsa al vacío x porción',23000),
 ('ORD-0040',1,'PLU-204','Costilla',4.0,'KG','Para horno','Bolsa',19000),
 ('ORD-0040',2,'PLU-209','Molida',3.0,'KG',null,'Bolsa x 1 kg',18000),
 ('ORD-0041',0,'PLU-202','Chuleta ahumada',3.0,'KG',null,'Bandeja',24000),
 ('ORD-0041',1,'PLU-212','Chorizo',20,'UND',null,'Bandeja x 10',3500),
 ('ORD-0042',0,'PLU-207','Pernil',5.0,'KG','Entero','Bolsa',20000),
 ('ORD-0043',0,'PLU-201','Lomo sin hueso',1.0,'KG',null,null,26000)
) as v(codigo, orden, plu, nombre, cant, unidad, prep, emp, precio)
join public.pedidos p on p.codigo = v.codigo;

update public.pedido_lineas l set cantidad_real = l.cantidad
from public.pedidos p where p.id = l.pedido_id and p.codigo in ('ORD-0041','ORD-0042');

with cat(idx, plu, nombre, unidad, precio, prep, emp) as (values
 (0,'PLU-201','Lomo sin hueso','KG',26000,'Filetes','Bolsa al vacío'),
 (1,'PLU-202','Chuleta ahumada','KG',24000,null,'Bandeja'),
 (2,'PLU-203','Chuleta fresca','KG',21000,'Delgada','Bandeja'),
 (3,'PLU-204','Costilla','KG',19000,'Para asar','Bolsa'),
 (4,'PLU-205','Bondiola','KG',23000,'Entera','Bolsa al vacío'),
 (5,'PLU-206','Tocino','KG',17000,'En cubos','Bolsa'),
 (6,'PLU-207','Pernil','KG',20000,'En trozos','Bolsa'),
 (7,'PLU-208','Solomito','KG',32000,'Medallones','Bolsa al vacío'),
 (8,'PLU-209','Molida','KG',18000,null,'Bolsa'),
 (9,'PLU-210','Manitas','UND',4500,'Partidas','Bolsa'),
 (10,'PLU-211','Espinazo','KG',12000,'En trozos','Bolsa'),
 (11,'PLU-212','Chorizo','UND',3500,null,'Bandeja')
), hist as (
  select id, substring(codigo from 5)::int as n from public.pedidos where codigo <= 'ORD-0030'
)
insert into public.pedido_lineas (pedido_id, orden, codigo_plu, nombre, cantidad, unidad, preparacion, empaque, precio_unitario, cantidad_real)
select h.id, k.orden, c.plu, c.nombre,
  case when c.unidad = 'UND' then 6 + (h.n % 4) * 2 else 1.5 + (h.n % 5) end,
  c.unidad::public.unidad_medida, c.prep, c.emp, c.precio,
  case when c.unidad = 'UND' then 6 + (h.n % 4) * 2 else 1.5 + (h.n % 5) end
from hist h
cross join (values (0), (1)) as k(orden)
join cat c on c.idx = case when k.orden = 0 then h.n % 12 else (h.n * 5 + 3) % 12 end;

update public.pedidos p set monto_estimado = coalesce((select sum(round(l.cantidad * l.precio_unitario)) from public.pedido_lineas l where l.pedido_id = p.id), 0);
update public.pedidos set monto_pagado = monto_estimado where released_at is not null;

-- ===== Seed: comprobantes =====
insert into public.pedido_comprobantes (pedido_id, file_path, recibido_at, resultado, nota)
select id, null, proof_received_at - interval '20 minutes', 'rechazado', 'Comprobante ilegible, se pidió de nuevo'
from public.pedidos where codigo <= 'ORD-0030' and substring(codigo from 5)::int % 6 = 0;

insert into public.pedido_comprobantes (pedido_id, file_path, recibido_at, resultado, nota)
select id, null, proof_received_at, case when status = 'comprobante_recibido' then 'pendiente' else 'aceptado' end::public.comprobante_resultado,
  'Comprobante recibido por bot (WhatsApp)'
from public.pedidos where proof_received_at is not null;

-- ===== Seed: events =====
insert into public.pedido_eventos (pedido_id, actor_role, accion, from_status, to_status, detalle, created_at)
select id, null::public.app_role, 'pedido_creado', null::public.pedido_status, 'capturado'::public.pedido_status,
  case when origen = 'bot' then 'Pedido recibido por bot de WhatsApp' else 'Pedido creado manualmente por comercial' end, created_at
from public.pedidos
union all
select id, 'comercial'::public.app_role, 'verificar_pedido', 'capturado'::public.pedido_status, 'verificado_comercial'::public.pedido_status, null, verified_at
from public.pedidos where verified_at is not null
union all
select id, 'contable'::public.app_role, 'solicitar_pago', 'verificado_comercial'::public.pedido_status, 'pago_solicitado'::public.pedido_status, null, payment_requested_at
from public.pedidos where payment_requested_at is not null
union all
select id, 'contable'::public.app_role, 'mensaje_simulado', null::public.pedido_status, null::public.pedido_status, 'Mensaje simulado enviado al cliente: instrucciones de pago (cuenta / QR)', payment_requested_at + interval '1 second'
from public.pedidos where payment_requested_at is not null
union all
select id, 'contable'::public.app_role, 'marcar_comprobante_recibido', 'pago_solicitado'::public.pedido_status, 'comprobante_recibido'::public.pedido_status, 'Comprobante recibido por bot (WhatsApp)', proof_received_at
from public.pedidos where proof_received_at is not null
union all
select id, 'contable'::public.app_role, 'validar_pago_y_liberar', 'comprobante_recibido'::public.pedido_status, 'liberado_produccion'::public.pedido_status, null, released_at
from public.pedidos where released_at is not null
union all
select id, 'carnicero'::public.app_role, 'marcar_listo_despacho', 'liberado_produccion'::public.pedido_status, 'listo_despacho'::public.pedido_status, null, prep_done_at
from public.pedidos where prep_done_at is not null
union all
select id, 'contable'::public.app_role, 'notificar_cliente_y_archivar', 'listo_despacho'::public.pedido_status, 'archivado'::public.pedido_status, null, archived_at
from public.pedidos where archived_at is not null
union all
select id, 'contable'::public.app_role, 'mensaje_simulado', null::public.pedido_status, null::public.pedido_status, 'Mensaje simulado enviado al cliente: pedido listo para despacho', archived_at + interval '1 second'
from public.pedidos where archived_at is not null
union all
select id, 'contable'::public.app_role, 'devolver_a_comercial', 'verificado_comercial'::public.pedido_status, 'en_correccion'::public.pedido_status, 'Dirección incompleta, confirmar número de casa y barrio.', status_changed_at
from public.pedidos where codigo = 'ORD-0034'
union all
select id, 'comercial'::public.app_role, 'rechazar_pedido', 'capturado'::public.pedido_status, 'rechazado'::public.pedido_status, 'Pedido duplicado del cliente; se atendió por otro chat.', status_changed_at
from public.pedidos where codigo = 'ORD-0043';
