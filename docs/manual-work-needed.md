# Manual Work Needed

Last updated: 2026-06-10

## Needed From Peter Soon

1. Source discovery review workflow.

   New discovery records are created with:

   - `active` unchecked
   - `discovery_status` set to `needs_review` or `needs_manual_review`

   This means they are candidates only. MORS live runs ignore them until `active` is checked.

2. Get Cal eProcure credentials when convenient.

   We can probe public Cal eProcure pages without credentials, but a real account may be needed for stable detail-page/document access.

3. Confirm geo tier definitions.

   Current working definition:

   - `Tier 1`: Bay Area and immediate vicinity
   - `Tier 2`: Central and Northern California, including Sacramento, Central Coast, North Coast, and SLO/Santa Barbara/Ventura corridor
   - `Tier 3`: Southern California
   - `Tier 4`: Oregon/Nevada opportunistic

## Not Needed From Peter Right Now

- Do not manually Google every city/county/special district.
- Do not paste secrets into chat.
- Do not change FindRFP credentials; the app no longer uses them.
- Do not manually fill every source field yet. We will use automated discovery to create candidates first, then review ambiguous ones.

## Useful Review Work Later

When the first source-discovery candidate batch exists, review only records marked:

- `needs_review`
- `needs_manual_review`

For records that look correct:

- set `discovery_status` to `verified`
- check `active` only when you want MORS to use that source in live runs

For records that look wrong:

- set `discovery_status` to `rejected`
- leave `active` unchecked
