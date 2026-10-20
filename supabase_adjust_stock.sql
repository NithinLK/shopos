-- Atomic stock adjustment. Run once in the Supabase SQL editor.
--
-- The change is applied inside the database as a single UPDATE
-- (stock_quantity = stock_quantity + delta), so it can never overwrite another
-- sale's deduction the way a client-side "read, subtract, write back" can.
-- Pass a NEGATIVE delta to deduct stock (sale), a POSITIVE one to add it back
-- (void / edit). Result may go negative on purpose (shows as "Oversold").
--
-- NOTE: if items.id is not a uuid in your schema, change the parameter type.

create or replace function public.adjust_stock(p_item_id uuid, p_delta numeric)
returns numeric
language sql
as $$
  update public.items
     set stock_quantity = coalesce(stock_quantity, 0) + p_delta
   where id = p_item_id
     and track_stock = true
  returning stock_quantity;
$$;

grant execute on function public.adjust_stock(uuid, numeric) to anon, authenticated;
