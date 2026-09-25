# Platform admin guide

For the people who run Dulà HQ itself. You look after every organization on the
platform: setting them up, choosing what they can use, helping when they get
stuck, and billing them.

_Last checked: 2026-09-21 · Try it: sign in at `/demo` as **Platform admin**
(Queenie Alvarado), which opens the console._

## What you can and can't do

You can see every organization, club, tournament and person on the platform, and
you can act in all of them. Nobody else can.

- **Being a platform admin** is a row in the `platform_admins` table, matched to
  your sign-in email. There is no screen for adding or removing one yet.
- **You are never "viewed as".** The troubleshooting tool (below) refuses to
  inspect another platform admin.
- **Everything you do that matters is recorded** in an audit log that nobody, you
  included, can edit or delete.

## The platform console

Open `/platformconsole`. Five tabs run across the top:

| Tab | What it's for |
|---|---|
| **Tenant directory** | Every organization: rename, choose its products, suspend or reactivate |
| **Provisioning** | Create a new organization and its first administrator |
| **Support** | The queue of requests organizations send you. The number in brackets is how many are open |
| **Billing** | Invoice organizations, set payment instructions, verify payments |
| **Troubleshoot** | See exactly what a person in an organization can and can't do |
| **Listings** | Every club and tournament, whether it's in the public directory, and a **Block** to hide one |

Anyone who isn't a platform admin who opens the console sees only a short notice
that it's for platform admins.

## Set up a new organization

1. Open **Provisioning**.
2. Fill in:
   - **Organizer / business name**, for example *Rally Point Sports*.
   - **Org slug**, the short lowercase name used in web addresses. It fills in from
     the name; change it if you like. Letters, numbers and hyphens only.
   - **Accent color**.
   - **Admin email**, the person who will administer the organization.
   - **Products**: tick **Club**, **Tournament**, or both. You must tick at least
     one.
   - Optionally the organization's **first club** and/or **first tournament**
     (each needs its product ticked).
3. Choose the create button.

This creates the organization, gives it its products, sets up its Dulà HQ billing
account and a default subscription for each product, and makes the admin email an
**org admin** of it. If you filled in a first club or tournament it creates those
too.

**What it does not do:**

- **It doesn't send anything.** Nobody is emailed. Tell the admin yourself that
  their organization is ready.
- **It doesn't create a login.** The admin email is linked to the organization,
  but the person can only sign in if an account with that exact email exists. The
  app has no staff sign-up page, so today that login is created outside the app.
  Once an account with that email exists, the person is an org admin
  automatically, with no further step.

If something fails part-way, the message says what did get created and where to
finish the job. For example, *"Tenant and admin created, but the first club
failed… create it from /clubs/new instead"*.

## Manage an organization

In **Tenant directory**, each organization shows its name, whether it's
**Active** or **Suspended**, and its products. If it has none, you'll see
*No products — can't create anything*.

- **Rename or recolor.** Choose **Manage**, edit the name or accent color, and
  **Save**.
- **Change products.** In **Manage**, tick or untick **Club** and **Tournament**
  and choose **Save products**. Unticking removes the organization's right to
  create and change that product's clubs or tournaments; it doesn't delete
  anything. Re-saving without changing anything leaves existing products exactly as
  they are. Try a change on a test organization before you do it to a live one.
- **Suspend.** Choose **Suspend** and confirm. It asks:
  *"Suspend [name]? Every member — staff, guardians, players — loses access
  immediately until you reactivate it."*

  What suspension does:
  - Everyone in the organization sees empty pages and a banner reading
    *"[name] is suspended — access is paused"*, so they aren't left guessing.
  - Its clubs and tournaments drop out of the public directory.
  - **Billing records and support requests are exempt from the pause**, so an
    organization suspended over an unpaid invoice isn't cut off from settling it or
    from contacting you.
  - You still see everything.
- **Reactivate.** Choose **Activate**. Access returns immediately.

Suspending and reactivating are both written to the audit log.

## Help someone who's stuck (Troubleshoot)

Use this when someone says "I can't see X" or "why can't I do Y". You don't
become them and you don't gain their access. You get a readout of what their
role does and doesn't allow.

1. Open **Troubleshoot** and choose the **Organization**. Its people are listed:
   club staff, tournament staff, and external entry contacts.
2. Next to the person, choose **View as**.
3. The browser asks *"Why are you viewing as [name]?"*. **A reason is required.**
   Type one and confirm.
4. A banner appears on every page for the length of the session, saying which
   organization and when it **expires**. The **Effective access** panel lists, for
   each club or tournament they belong to, their role, the permissions they have,
   and the ones they don't. The "don't have" list is usually the answer.
5. When you're done, choose **End session**.

The rules built into it:

- Sessions last 30 minutes by default (2 hours at most), and you can have one at
  a time.
- You can't view as yourself or as another platform admin.
- The person must belong to that organization.
- The audit record shows **you** as the actor, never the person you inspected.
- If the organization is suspended, the panel says so, because their permissions
  look healthy on paper while every check is being refused.

## Hide something from the public directory (Listings)

Owners decide whether their own club or tournament is listed: the club IT admin, tournament
IT admin or an organization admin switches it on. You only step in to hide something that
shouldn't be public. On **Listings**, filter by **Listed**, **Blocked** or **Everything**, and
choose **Block** next to it. A reason is required, and the owner sees it. A blocked item
disappears from the public directory even if its owner has it switched on; their setting is
kept, and **Unblock** brings it straight back. Blocks and unblocks are audited.

## Create a login, or reset one (Logins)

On **Logins**, enter a name and email and choose **Create login** to make an account with a temporary password, shown once. The person must choose their own password on first sign-in; unused, it stops working after 72 hours. To help someone locked out, type their email under **Reset any account's password** and confirm. You can reissue any ordinary account this way, but never another platform admin's. Everything is audited. No email is sent, so pass the password on yourself.

## Answer support requests

**Support** lists what organizations have sent you. Each request shows the
subject, the message, who sent it, which products the organization has, and a
*suspended* marker if it is.

- Change the **status** from the dropdown: *open, in progress, waiting on org,
  resolved, closed*. Status is yours to set. The organization follows up by
  replying, not by editing the request.
- Type in **Reply to the org…** and choose **Reply**.

## Bill an organization

**Billing** is labelled *Simulation / manual QR mode — no payment provider
connected*. Dulà HQ doesn't take card payments. You invoice, the organization pays
by QR or bank transfer, and you check it arrived.

1. **Create an invoice.** Choose the **Organization**, enter the **Amount (PHP)**
   and a **Description** (for example *Club entitlement — September 2026*),
   optionally a **Due date** and **Notes**, then **Create invoice**. The
   organization must already have a platform billing account, which provisioning
   creates.
2. **Set payment instructions.** Under **Manual payment instructions**, write what
   the organization should do (*Scan the Dulà HQ QR code and put the invoice number
   in the note*) and **Save instructions**. There's a field for a QR image's
   storage key, but no upload button: the image has to be uploaded separately and
   its key pasted in.
3. **Verify payments.** When an organization submits a payment it appears under
   **Payment submissions**. Choose **Verify** (a note is optional) once you've
   confirmed the money arrived, or **Reject** (you're asked for a reason, so the
   payer knows what to fix).

The page also shows each organization's subscriptions and recent usage events.

## When something looks wrong

| You see | What it usually means |
|---|---|
| A new org admin says they can't sign in | The account doesn't exist yet. Provisioning links the email but doesn't create the login |
| A club has no manager yet | The org admin can add one from the club's **Staff** tab (see the [org admin guide](org-admin.md#appoint-the-first-club-manager)), and so can you. They need a login first |
| An organization says everything is empty | Check the directory: it may be suspended |
| A club can't be created | The organization has no **Club** product. Tick it under **Manage** |
| A payment was rejected by mistake | A rejected payment reopens the invoice for another attempt; ask them to resubmit |

## Not available yet

- A screen for the platform audit log. The records exist and are kept, but there is
  no page in the console to read them.
- Inviting people by email and "forgot password" emails (email delivery isn't set up).
- Trials or grace periods for products. A product is simply on or off.
- Uploading a payment QR image from the Billing tab.
- Deleting an organization.
