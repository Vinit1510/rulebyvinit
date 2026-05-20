  -- Add block_credit flag for invoices that fall under Section 17(5) of the GST Act.
  -- These invoices are NOT eligible for Rule 43 (no monthly amortisation) — the
  -- entire ITC is blocked and shown separately in the report.
  alter table public.invoices
    add column if not exists block_credit boolean not null default false;
  