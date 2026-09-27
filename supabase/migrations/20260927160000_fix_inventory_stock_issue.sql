-- KSS ERP: Fix inventory stock issue calculation
-- Avoid SELECT ... FOR UPDATE against the stock-balance view.

create or replace function public.issue_inventory_stock(
  p_item_id bigint,
  p_quantity numeric,
  p_vehicle_id integer default null,
  p_reason text default null,
  p_created_by text default null
)
returns public.inventory_stock_movements
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_current numeric;
  v_row public.inventory_stock_movements%rowtype;
begin
  if not public.is_current_user_superadmin() then
    raise exception 'SUPERADMIN authorization required';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Issue quantity must be greater than zero';
  end if;

  if not exists (
    select 1
    from public.inventory_items
    where item_id = p_item_id
      and is_active = true
  ) then
    raise exception 'Inventory item not found or inactive';
  end if;

  if p_vehicle_id is not null and not exists (
    select 1
    from public.vehicles
    where vehicle_id = p_vehicle_id
  ) then
    raise exception 'Invalid vehicle';
  end if;

  /*
    Lock the item master row so two simultaneous issue requests
    cannot both pass the stock check against the same balance.
  */
  perform 1
  from public.inventory_items
  where item_id = p_item_id
    and is_active = true
  for update;

  select coalesce(sum(
    case
      when movement_type in (
        'OPENING',
        'PURCHASE_RECEIPT',
        'RETURN',
        'ADJUSTMENT_IN'
      ) then quantity

      when movement_type in (
        'ISSUE',
        'ADJUSTMENT_OUT',
        'REVERSAL'
      ) then -quantity

      else 0
    end
  ), 0)
  into v_current
  from public.inventory_stock_movements
  where item_id = p_item_id;

  if v_current < p_quantity then
    raise exception
      'Insufficient stock. Available: %, requested: %',
      v_current,
      p_quantity;
  end if;

  insert into public.inventory_stock_movements (
    item_id,
    movement_type,
    quantity,
    reference_type,
    vehicle_id,
    reason,
    created_by
  )
  values (
    p_item_id,
    'ISSUE',
    p_quantity,
    'WORKSHOP_ISSUE',
    p_vehicle_id,
    nullif(btrim(p_reason), ''),
    nullif(btrim(p_created_by), '')
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.issue_inventory_stock(
  bigint,
  numeric,
  integer,
  text,
  text
) from public;

grant execute on function public.issue_inventory_stock(
  bigint,
  numeric,
  integer,
  text,
  text
) to authenticated;
