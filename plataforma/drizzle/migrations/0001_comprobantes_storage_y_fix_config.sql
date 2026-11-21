
create or replace function public.actualizar_config_pago(p_instrucciones text, p_qr_url text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'general') then
    raise exception 'Solo el administrador puede editar las instrucciones de pago' using errcode = '42501';
  end if;
  insert into public.config_pago (id, instrucciones, qr_url, updated_at)
  values (1, coalesce(p_instrucciones, ''), nullif(trim(coalesce(p_qr_url,'')), ''), now())
  on conflict (id) do update set instrucciones = excluded.instrucciones, qr_url = excluded.qr_url, updated_at = now();
end $$;

create policy "Comprobantes: subir contable o general" on storage.objects for insert to authenticated
  with check (bucket_id = 'comprobantes' and public.current_app_role() in ('general','contable'));
create policy "Comprobantes: ver general, comercial, contable" on storage.objects for select to authenticated
  using (bucket_id = 'comprobantes' and public.current_app_role() in ('general','contable','comercial'));
