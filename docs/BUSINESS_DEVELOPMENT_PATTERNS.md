# Business Development patterns (Handbook Task 24)

How to run a business-development push — outreach to prospective
clients, a marketing campaign, anything in that spirit — using ordinary
Firm Work. This is a usage guide, not a new feature: everything
described here already exists (Projects since Task 15, the
Business Development `firm_category` since the original Firm Work
schema, next action/blocker/checklist/updates since Task 15-18, the
optional Result update type since Task 18). See
[PRODUCT_BOUNDARIES.md](PRODUCT_BOUNDARIES.md#business-development) for
the boundary this stays inside — no CRM, ever, regardless of how useful
one might eventually look.

## The pattern

1. **Create a Project** for the campaign, named for what it actually is
   and when — e.g. "Restaurant Outreach - August." A Project is just a
   label (Manage Projects, on the Firm Work page); it carries no
   pipeline stages, no per-contact records, nothing beyond a name and an
   optional description.
2. **Create Firm Work items under that Project**, category
   "Business Development," one per real chunk of work. A typical push
   looks like:
   - *Research 30 businesses*
   - *Contact 10 businesses*
   - *Follow up on previous outreach*
   - *Prepare accounting-services proposal*
   - *Review outreach result and next target*
3. **Use the fields that already exist** — title, project, category,
   owner, target date, priority, description, checklist, next action,
   updates. If a specific business or contact name matters, put it in
   the title or description as plain text ("Contact 10 businesses —
   focus on Thamel/Baneshwor restaurants"). There is no structured
   company/contact field, and none is planned unless usage actually
   proves a real CRM is needed.
4. **Record the outcome as a Result update, or in the description** —
   not a new field, not a status. When a piece of outreach concludes,
   post an update on that Firm Work item and tag it **Result** (the
   optional update type from Task 18's detail page). Plain-text
   examples: "No response after two follow-ups." / "Meeting scheduled
   for next Tuesday." / "Proposal sent, awaiting reply." / "Converted —
   see Alpha Trading in Clients." Nothing aggregates these across
   people or time — there is deliberately no "conversion rate" number
   anywhere in this app, for anyone.
5. **If an outreach actually converts, create the client deliberately**
   in the Clients module, the same way every other client has ever been
   created. Nothing in Firm Work auto-creates a client, links to one, or
   infers one from a title — that step is always a separate, intentional
   action by a human.

## Repeating the pattern next month

Firm Work Detail (any item) has a **Duplicate** button next to Edit
Basics. It opens the same "New Firm Work" form pre-filled from that
item's category, owner, priority, description, and project (and copies
its checklist, unchecked, once the duplicate is created) — deliberately
does **not** copy status, due date, next action, or update history,
since those belong to the old item's own progress, not a fresh one.
Rename "Restaurant Outreach - August" to "...- September," adjust the
target date, and the whole checklist shape carries over without retyping
it. This is the "reusable examples/templates" this task asked for — a
plain reuse of the existing create flow, not a new templates table or
management screen. If Firm Work templates ever become worth a dedicated
system (visible per-category defaults, admin-managed, etc.), that's a
new, separately-scoped task — not assumed necessary yet.

## What this deliberately does not do

No prospects/leads table, no pipeline stages tied to a person or
company, no lead score, no automated outreach, no email/SMS/WhatsApp
integration, no employee conversion-rate leaderboard, no auto-conversion
of a Firm Work item into a client. If real usage over time shows these
patterns are genuinely insufficient, that's a signal to design a real
CRM deliberately later — not a gap to quietly work around now.
