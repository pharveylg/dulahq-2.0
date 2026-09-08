You are working on **Dula HQ**, a football-first multi-tenant club and tournament management SaaS platform.

Your task is to **update the Player Profile / Player Overview experience only**.

Do not redesign unrelated parts of the application. Do not change the overall Dula HQ information architecture unless something is strictly required to support the Player Profile.

## Existing Player Profile Navigation

The Player currently has these primary sections:

1. Overview
2. Development
3. Fees
4. Membership
5. Family

Keep these five primary sections.

Your job is to significantly improve the depth, structure, usability, permissions, and data presentation inside these sections.

---

# PRODUCT PRINCIPLE

The Player Profile should not simply be a roster record.

It should become a **living player record** that connects:

**Identity → Team → Training → Attendance → Drills → Evaluations → Goals → Feedback → Matches → Progression**

The profile must work for both:

- Minor players
- Adult players

Do NOT create separate `MinorPlayer` and `AdultPlayer` entities.

Use one canonical Player entity/profile with:

- date of birth / age
- account relationship
- team relationship
- optional guardian relationships
- role/permission-based visibility

The system should determine access based on relationships and permissions.

---

# CORE UX PRINCIPLE

Create one canonical Player Profile.

Then provide different views of the same underlying data depending on the viewer.

Conceptually:

PLAYER PROFILE
        │
   ┌────┼────┐
   ↓    ↓    ↓
 COACH PLAYER PARENT

Coach:
- Full football/development view
- Team information
- Training
- Attendance
- Evaluations
- Development goals
- Matches
- Appropriate operational information

Player:
- Their own profile
- Development
- Goals
- Feedback
- Training
- Attendance
- Matches
- Membership
- Fees
- Appropriate personal information

Parent/Guardian:
- Authorized child's information
- Schedule
- Attendance
- Development
- Evaluations
- Feedback
- Matches
- Fees
- Membership
- Family information

Do not duplicate player records for different roles.

---

# 1. OVERVIEW

The Overview should answer:

> "Who is this player, what is their current football context, and how are they doing?"

## Profile Header

Include:

- Player photo
- Full name
- Preferred name
- Jersey number
- Current team
- Age group
- Primary position
- Secondary position(s)
- Preferred foot
- Player status

Possible statuses:

- Active
- Injured
- Temporarily Inactive
- Suspended
- Archived

Do not prominently label a player as "Minor" or "Adult" in the UI.

That is primarily a permission/data relationship concern.

## Player Information

Include:

- First name
- Last name
- Preferred name
- Date of birth
- Gender if the club collects it
- Internal Player ID
- Registration status
- Club join date
- Current season
- Current team
- Previous teams/seasons

## Football Snapshot

Include:

- Primary position
- Secondary positions
- Preferred foot
- Playing style
- Tactical role
- Position flexibility
- Key strengths
- Development priorities

## Development Snapshot

Show:

- Current development focus
- Active goals
- Latest evaluation
- Previous evaluation
- Recent progress
- Latest player-visible coach feedback

Development information should be prominent.

For youth players especially, do not make the profile primarily about competitive statistics.

## Training Snapshot

Include:

- Attendance percentage
- Sessions attended
- Sessions missed
- Late arrivals
- Recent training activity

## Match Snapshot

Where data exists, show:

- Appearances
- Starts
- Minutes
- Goals
- Assists

Keep this secondary to development for youth players.

## Availability

Show current/upcoming availability:

- Available
- Unavailable
- Injured
- Pending Response

## Recent Activity / Timeline

Create a compact chronological activity feed.

Example:

Sep 6 — Training Session — Attended  
Sep 4 — Coach Feedback — Added  
Sep 1 — Evaluation — Updated  
Aug 28 — Development Goal — Completed  
Aug 25 — Match — 45 minutes

The timeline should eventually become part of the player's long-term development history.

---

# 2. DEVELOPMENT

This should be the **most important section of the Player Profile**.

Overview = current snapshot.

Development = complete progression history.

## Development Summary

Show:

- Current development phase
- Current focus areas
- Strengths
- Areas for improvement
- Latest evaluation
- Previous evaluation
- Development trend

## Development Goals

Each goal should support:

- Goal name
- Description
- Category
- Start date
- Target date
- Status
- Current level
- Target level
- Success criteria
- Related drills
- Related training sessions
- Coach feedback

Goal statuses:

- Not Started
- In Progress
- On Track
- Needs Attention
- Achieved
- Archived

Do not use arbitrary progress percentages unless the percentage is objectively derived from meaningful data.

Example:

Improve First Touch

Status: In Progress

Current Level: Developing

Target Level: Competent

Success Criteria:
Consistently control first touch under pressure.

Related:
- Receiving Under Pressure
- First Touch Circuit
- Small-Sided Games

## Skills / Evaluations

Organize evaluation areas into:

### Technical

- First Touch
- Passing
- Receiving
- Dribbling
- Finishing
- Crossing
- Heading
- Ball Control

### Tactical

- Positioning
- Decision Making
- Scanning
- Defensive Awareness
- Attacking Movement
- Transition
- Game Understanding

### Physical

- Speed
- Agility
- Coordination
- Endurance
- Strength
- Mobility

### Mental / Social

- Confidence
- Communication
- Focus
- Resilience
- Teamwork
- Coachability

Use a 1–5 development scale:

1 — Beginning  
2 — Developing  
3 — Competent  
4 — Strong  
5 — Advanced

IMPORTANT:

Do NOT create a single "Overall Player Rating."

Dula HQ should emphasize development by area rather than reducing a player to one number.

## Development Progress

Show historical progression.

Example:

First Touch:

Jan — 2  
Mar — 2  
May — 3  
Jul — 3  
Sep — 4

The UI should make it easy to understand whether the player is:

- Improving
- Stable
- Regressing
- Recently evaluated
- Missing enough data to determine a trend

Do not manufacture trends from insufficient data.

## Training History

Show:

- Training sessions
- Attendance
- Training topics
- Training themes
- Coach observations
- Training trends

## Drill History

Show the player's exposure/completion history.

Example:

First Touch Circuit — 8 sessions  
1v1 Attacking — 5 sessions  
Finishing — 7 sessions  
Defensive Transition — 4 sessions

Eventually drills should connect directly to development goals.

## Coach Feedback

Show player-visible feedback:

- Date
- Coach
- Context
- Feedback
- Related development goal

Private coach notes must remain separate.

Never expose private/internal coaching notes to players or parents unless explicitly configured by permission.

## Development Timeline

Create a chronological history connecting:

- Evaluations
- Development goals
- Training
- Drills
- Coach feedback
- Matches
- Other meaningful development events

This should eventually become one of Dula HQ's most valuable player features.

---

# 3. FEES

Fees should represent the financial relationship between the player/family and the club.

## Fee Summary

Show:

- Current balance
- Amount paid
- Amount outstanding
- Next payment
- Payment status

Example:

Season Fee — ₱12,000

Paid — ₱8,000  
Remaining — ₱4,000

Next Payment — September 15  
Amount — ₱2,000

## Charges

Support:

- Registration fee
- Season fee
- Training fee
- Tournament fee
- Uniform/equipment
- Other club charges

## Payment History

Show:

- Date
- Amount
- Payment method
- Reference
- Status
- Receipt

## Payment Plans

If installment payments are supported, show:

Installment 1 — Paid  
Installment 2 — Paid  
Installment 3 — Due  
Installment 4 — Upcoming

## Financial Permissions

Financial data must be permission-controlled.

Treasurer/admin may see:

- Discounts
- Scholarships
- Waivers
- Adjustments
- Refunds
- Outstanding balances
- Internal payment notes

Coaches should NOT automatically have access to financial information.

---

# 4. MEMBERSHIP

Membership should represent the player's relationship with the club.

It is separate from football development and financial transactions.

## Membership Status

Support:

- Active
- Pending
- Expired
- Suspended
- Cancelled
- Archived

## Current Membership

Show:

- Club
- Membership type
- Season
- Start date
- End date
- Registration date
- Current team
- Age group

## Registration

Show:

- Registration status
- Registration date
- Registration forms
- Required forms
- Completed forms
- Missing forms

## Forms / Waivers / Documents

Potential examples:

- Player registration
- Code of conduct
- Consent forms
- Image/media consent
- Tournament forms
- Club policies
- Other required documents

Use a clear status model:

Registration — Complete  
Code of Conduct — Complete  
Photo Consent — Complete  
Tournament Waiver — Missing

## Uniform / Equipment

Where supported:

- Jersey number
- Uniform issued
- Kit size
- Equipment issued
- Equipment returned
- Outstanding equipment

## Membership History

Show historical club membership.

Example:

2026 — Academy Member — Active  
2025 — Academy Member — Completed  
2024 — Development Member — Completed

---

# 5. FAMILY

Family is especially important because Dula HQ supports both minors and adults.

Do not force every player to have a parent/guardian relationship.

## Minor Players

Show authorized guardians.

Example:

Mother — Maria Santos — Authorized  
Father — Juan Santos — Authorized

However, guardian access must be permission-based.

Potential permissions:

- VIEW_SCHEDULE
- MANAGE_AVAILABILITY
- VIEW_ATTENDANCE
- VIEW_DEVELOPMENT
- VIEW_EVALUATIONS
- VIEW_FEEDBACK
- VIEW_MATCHES
- VIEW_STATISTICS
- RECEIVE_NOTIFICATIONS
- COMMUNICATE_WITH_CLUB
- MANAGE_FORMS
- MANAGE_FEES
- VIEW_DOCUMENTS

Do not assume every guardian automatically has every permission.

## Multiple Children

A parent/guardian may be connected to multiple players.

Support a family switcher such as:

My Family

Daniel Santos — U14 Boys  
Sofia Santos — U11 Girls  
Miguel Santos — U9 Boys

Allow the parent to switch between children without creating duplicate accounts.

## Emergency / Authorized Contacts

Staff-authorized views may include:

- Guardian relationship
- Contact information
- Emergency contact
- Authorized pickup
- Relationship to player

This information must be permission-controlled.

## Adult Players

Adult players may have:

- No guardian relationship
- Optional authorized contacts
- Their own account
- Their own permissions

Do not display "No parent" as a negative or prominent state.

Simply allow the Family section to contain optional relationships.

---

# RESTRICTED INFORMATION

Do NOT put sensitive information directly into the normal Overview.

Create a restricted/private player information area that is only accessible to authorized staff.

Potential areas:

## Medical & Safety

- Medical alerts
- Allergies
- Relevant medical information
- Emergency information
- Medical restrictions
- Insurance information if collected

## Emergency Contacts

- Emergency contact
- Phone
- Relationship

## Internal Notes

- Administrative notes
- Private coach notes
- Internal staff discussions
- Sensitive disciplinary information

Use granular permissions.

A coach may need some safety-related information without being entitled to every sensitive piece of information.

Never expose sensitive data merely because someone has a `COACH` role.

---

# ROLE-BASED VIEW REQUIREMENTS

The same Player Profile should adapt based on the viewer.

## Coach View

Prioritize:

- Football profile
- Team
- Training
- Attendance
- Availability
- Drills
- Evaluations
- Development goals
- Coach feedback
- Matches
- Appropriate operational information

Do not automatically show:

- Fees
- Private family details
- Sensitive medical information
- Private administrative information

unless permissions explicitly allow it.

## Player View

Prioritize:

- Personal information
- Football profile
- Development
- Goals
- Evaluations
- Player-visible feedback
- Training
- Attendance
- Matches
- Membership
- Fees
- Appropriate family information

Players should never see:

- Private coach notes
- Internal staff discussions
- Other players' data
- Confidential administrative information

## Parent/Guardian View

Prioritize:

- Child profile
- Schedule
- Availability
- Attendance
- Development
- Evaluations
- Player-visible coach feedback
- Matches
- Fees
- Membership
- Forms
- Family relationships
- Communication

Parents should never automatically see:

- Private coach notes
- Internal staff discussions
- Other players
- Other families
- Confidential disciplinary information

## Club Admin View

Club administrators should have broader access according to their permissions.

Do not simply make every administrator a superuser.

Treasurer should primarily access financial information.

Secretary should primarily access membership, registration, records and communications.

Committee heads should only receive permissions relevant to their responsibilities.

---

# DATA MODEL PRINCIPLES

Do not create duplicate player records for each role.

Use a canonical Player entity.

Conceptually:

Player
├── Account
├── Team Memberships
├── Training Records
├── Attendance
├── Drill Records
├── Evaluations
├── Development Goals
├── Coach Feedback
├── Match Records
├── Membership
├── Fees
├── Guardians
├── Documents
└── Restricted Information

Use relationships rather than duplicating data.

All tenant-owned records must remain tenant-scoped.

Use `tenant_id` consistently where appropriate.

Supabase Row Level Security must enforce tenant isolation and role/relationship-based access.

UI hiding is NOT security.

---

# IMPORTANT PRIVACY PRINCIPLE

Age should influence relationships and permissions, not create separate player architectures.

For minors:

Player → Guardian relationships may exist.

For adults:

Guardian relationships are optional.

The system should support:

- One player → multiple guardians
- One guardian → multiple players
- Different permissions per guardian
- Revoking guardian access
- Multiple authorized contacts
- Player-owned account
- Club-managed account where appropriate

---

# UX REQUIREMENTS

The Player Profile should feel like a modern football development platform.

Avoid making it look like a generic CRM contact page.

Prioritize:

- Clear hierarchy
- Strong visual profile header
- Development-focused cards
- Useful summaries
- Timeline
- Progress visualization
- Clear status indicators
- Responsive design
- Mobile-friendly coach experience
- Mobile-friendly parent experience

The Overview should provide a useful snapshot without requiring the user to open every section.

The Development tab should contain the deepest information.

Avoid unnecessary charts where the underlying data is insufficient.

Avoid vanity metrics.

Avoid "AI-looking" UI unless an actual AI feature exists.

---

# IMPLEMENTATION APPROACH

Before changing code:

1. Inspect the existing Player Profile implementation.
2. Identify the current routes/components.
3. Identify the existing database schema.
4. Identify existing player/team/coach/guardian relationships.
5. Identify existing permission/RLS implementation.
6. Reuse existing components and data structures where appropriate.
7. Do not create duplicate functionality.
8. Do not break existing features.
9. Preserve existing visual language/design system unless improvements are necessary.

Then implement the Player Profile incrementally.

Prioritize:

### Phase 1
- Overview structure
- Player header
- Football snapshot
- Development snapshot
- Training snapshot
- Match snapshot
- Availability
- Recent activity

### Phase 2
- Development goals
- Evaluations
- Skill progression
- Training history
- Drill history
- Coach feedback
- Development timeline

### Phase 3
- Fees
- Membership
- Family
- Guardian relationships
- Permission-aware views

### Phase 4
- Restricted information
- Advanced permissions
- Long-term development history
- Cross-season progression

---

# DO NOT

Do not:

- Create separate MinorPlayer and AdultPlayer models.
- Create separate duplicate profiles for Coach/Player/Parent.
- Expose private coach notes to players or parents.
- Expose financial data to coaches by default.
- Expose sensitive medical data to every staff member.
- Expose other players' data.
- Create a single "Overall Player Rating."
- Manufacture statistics or progression data.
- Use fake percentages.
- Treat the player profile as only a roster card.
- Redesign unrelated Dula HQ modules.
- Replace the existing five primary sections with a completely different navigation system.

---

# SUCCESS CRITERIA

The finished Player Profile should make it possible to answer:

### Overview
"Who is this player and how are they currently doing?"

### Development
"How has this player developed over time, and what are they working on next?"

### Fees
"What does this player/family owe, and what has been paid?"

### Membership
"What is this player's current relationship and registration status with the club?"

### Family
"Who is connected to this player, and what access do they have?"

The ultimate goal is for Dula HQ to maintain a **living football development record**, not just a database entry.

The Player Profile should therefore connect:

**Identity → Team → Training → Attendance → Drills → Evaluations → Goals → Feedback → Matches → Progression**

Build this as a scalable foundation that works for both youth and adult football players and remains compatible with Dula HQ's future multi-sport architecture.