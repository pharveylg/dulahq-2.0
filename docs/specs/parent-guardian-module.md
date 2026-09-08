You are working on **Dula HQ**, a football-first multi-tenant club and tournament management SaaS platform.

Your task is to **update the Parent/Guardian Module**.

This module must be deeply interconnected with:

- Player Profile
- Coach Module
- Team Management
- Training
- Attendance
- Development
- Matches
- Tournament Management
- Fees
- Membership
- Family

Do not create duplicate player records.

The Parent/Guardian experience must operate on the same canonical Player Profile used by Coaches and Players.

---

# CORE PRODUCT PRINCIPLE

The Parent/Guardian module should answer:

> "What do I need to know, what do I need to do, and how is my child progressing?"

The parent experience should prioritize:

**Schedule → Availability → Attendance → Development → Communication → Forms → Fees → Tournaments**

Parents/guardians are not coaches.

Do not give them access to internal coaching or club administration simply because they are connected to a player.

---

# PARENT/GUARDIAN NAVIGATION

Use a structure such as:

1. Overview
2. My Players
3. Calendar
4. Development
5. Attendance
6. Matches
7. Tournaments
8. Fees
9. Membership
10. Family
11. Communication

Keep the navigation clean and appropriate for mobile.

---

# 1. OVERVIEW

The Parent Dashboard should answer:

> "What do I need to know today?"

Show:

## My Players

If the guardian has multiple children:

- Player photo
- Name
- Team
- Age group
- Position
- Current status

Provide easy child switching.

Example:

Daniel Santos — U14 Boys  
Sofia Santos — U11 Girls

Do not create duplicate accounts for each child.

---

# 2. ACTION CENTER

Show actions requiring attention:

- Confirm availability
- Complete registration form
- Sign waiver
- Review tournament acknowledgement
- Confirm tournament participation
- Review payment
- Pay outstanding fee
- Read club announcement

Use clear states:

- Action Required
- Pending
- Completed
- Declined
- Expired

---

# 3. CALENDAR

Show:

- Training
- Matches
- Tournaments
- Team events
- Club events
- Registration deadlines
- Important dates

Allow the guardian to filter by child.

Each event should show:

- Date
- Time
- Location
- Team
- Event type
- Instructions
- RSVP/availability
- Required action

---

# 4. AVAILABILITY

Parent/Guardian should be able to manage availability for authorized children.

Statuses:

- Available
- Unavailable
- Maybe / Pending where supported

Require a reason only if the club configures it.

Availability should flow to:

Coach → Team → Match → Tournament planning

A coach should see the updated availability without the parent having to contact them manually.

---

# 5. ATTENDANCE

Show:

- Attendance percentage
- Sessions attended
- Sessions missed
- Late arrivals
- Recent attendance
- Attendance history

For multiple children, allow child switching.

Do not expose other players' attendance.

---

# 6. DEVELOPMENT

This must connect directly to the canonical Player Profile.

Parents can view information explicitly designated as player/parent visible.

Show:

## Development Summary

- Current focus
- Strengths
- Development priorities
- Active goals
- Latest evaluation
- Progress over time

## Goals

Show:

- Goal
- Description
- Status
- Target date
- Success criteria
- Related training/drills where appropriate

## Evaluations

Show parent-visible evaluation information.

Use the same categories:

Technical  
Tactical  
Physical  
Mental/Social

Use:

1 — Beginning  
2 — Developing  
3 — Competent  
4 — Strong  
5 — Advanced

Do NOT show internal/private coaching information.

## Coach Feedback

Show player-visible feedback intended for the family.

Parents should not see:

- Private coach notes
- Internal staff discussions
- Scouting notes
- Confidential disciplinary information

---

# 7. MATCHES

Show:

- Upcoming matches
- Past matches
- Match date
- Team
- Opponent
- Venue
- Player participation where available
- Authorized statistics

Potential statistics:

- Appearances
- Starts
- Minutes
- Goals
- Assists

Do not overemphasize competitive statistics for youth players.

Development remains the priority.

---

# 8. TOURNAMENTS

Create a dedicated tournament experience.

Parents should be able to see tournaments involving their authorized child.

Show:

- Tournament name
- Dates
- Location
- Team
- Category/division
- Schedule
- Relevant instructions
- Required forms
- Participation status

---

# 9. TOURNAMENT GUARDIAN ACKNOWLEDGEMENT

This is a critical workflow.

When a Coach submits a proposed tournament roster for acknowledgement, the authorized guardian should receive an email notification.

The email should direct them to the Dula HQ acknowledgement experience.

Do not treat email alone as the authoritative record.

---

# 10. TOURNAMENT ACKNOWLEDGEMENT SCREEN

Show:

TOURNAMENT

Tournament Name  
Team  
Age/Division  
Dates  
Venue

PLAYER

Player Name  
Team  
Relevant participation information

Then provide:

### Acknowledge / Confirm

The guardian confirms that they have reviewed the tournament participation information.

Possible actions:

- Confirm Participation
- Decline Participation

If supported:

- Ask a Question / Contact Coach

---

# 11. ACKNOWLEDGEMENT RECORD

When the guardian confirms, record:

- Player
- Guardian
- Tournament
- Confirmation status
- Timestamp
- Guardian account
- Version of acknowledgement
- Relevant tournament information at time of acknowledgement

Statuses:

- Pending
- Confirmed
- Declined
- Expired
- Revoked

Do not allow a guardian to confirm a player they are not authorized to manage.

---

# 12. MULTIPLE GUARDIANS

Support:

One Player
→ Multiple Guardians

One Guardian
→ Multiple Players

Each guardian relationship can have different permissions.

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
- ACKNOWLEDGE_TOURNAMENT
- VIEW_DOCUMENTS

Do not assume all guardians have identical authority.

---

# 13. TOURNAMENT STATUS

After acknowledgement, the parent should be able to see:

Pending

↓

Confirmed

or

Declined

The final tournament roster status should be visible where appropriate.

Example:

Tournament Roster

Daniel Santos

Guardian Status:
✓ Confirmed

Roster Status:
✓ Finalized

Do not expose internal coach workflow details that aren't relevant to the parent.

---

# 14. FEES

Parents should be able to see authorized financial information.

Show:

- Current balance
- Amount paid
- Outstanding amount
- Upcoming payment
- Payment plan
- Payment history
- Receipts
- Charges

Potential charges:

- Registration
- Season
- Training
- Tournament
- Uniform
- Equipment

Parents should only see their authorized family's financial information.

Never expose another family's fees.

---

# 15. MEMBERSHIP

Show:

- Membership status
- Current season
- Registration status
- Required forms
- Completed forms
- Missing forms
- Waivers
- Documents
- Equipment/uniform status

Use clear statuses:

Complete  
Missing  
Pending  
Expired

---

# 16. FAMILY

Provide a family management area.

Show:

- Authorized children
- Guardian relationships
- Guardian permissions
- Contact information
- Authorized contacts where permitted

Allow a guardian to switch between authorized children.

Example:

MY FAMILY

Daniel Santos  
U14 Boys

Sofia Santos  
U11 Girls

The family switcher should be available throughout the parent experience where appropriate.

---

# 17. DOCUMENTS AND FORMS

Parents should be able to:

- View required forms
- Complete forms
- Sign waivers where supported
- Upload required documents
- View completed documents
- See expiration dates

Examples:

- Registration
- Code of conduct
- Media consent
- Tournament waiver
- Club policies
- Required participation forms

---

# 18. COMMUNICATION

Provide communication between:

Parent/Guardian
↕
Coach
↕
Club

Support:

- Team announcements
- Coach messages
- Tournament reminders
- Training reminders
- Match reminders
- Guardian acknowledgement reminders
- Club announcements

Do not expose private coach communications or internal club discussions.

---

# 19. NOTIFICATIONS

Support notifications for:

- Training schedule changes
- Match changes
- Tournament information
- Guardian acknowledgement requests
- Reminder to acknowledge
- Registration deadlines
- Missing forms
- Payment reminders
- Coach feedback
- Development updates
- Club announcements

Respect notification preferences.

---

# 20. MINOR VS ADULT PLAYER MODEL

Do not create separate MinorPlayer and AdultPlayer entities.

Use one Player entity.

For minors:

Player
→ Guardian relationships

For adults:

Player
→ Usually self-managed account
→ Optional authorized contacts

The Parent/Guardian module should only appear when a valid guardian relationship exists.

Do not display awkward UI such as:

"No Parent"

for adult players.

Simply show optional family/authorized-contact information.

---

# 21. PRIVACY

Parents/guardians should only see information they are authorized to access.

Never expose:

- Other players
- Other families
- Private coach notes
- Internal staff discussions
- Confidential scouting
- Confidential disciplinary information
- Sensitive medical information unless explicitly authorized
- Financial information belonging to another family

A guardian relationship does not automatically mean unrestricted access to every field.

Use explicit permissions.

---

# 22. COACH → GUARDIAN → PLAYER WORKFLOW

The core relationship is:

Coach creates development goal
↓
Player sees goal
↓
Authorized Parent sees goal
↓
Coach adds player-visible feedback
↓
Player sees feedback
↓
Parent sees feedback

For tournaments:

Coach selects player
↓
Coach submits proposed tournament roster
↓
Guardian receives email
↓
Guardian reviews tournament information
↓
Guardian confirms/declines
↓
Dula HQ records acknowledgement
↓
Coach sees status
↓
Coach finalizes only eligible/acknowledged players
↓
Final roster generated
↓
Parent can see final participation status

This should all be driven by shared underlying data.

---

# 23. SECURITY / RLS

Supabase Row Level Security is mandatory.

The Parent/Guardian must only access:

- Their own account
- Authorized players
- Authorized family records
- Authorized financial records
- Authorized development information
- Authorized tournament information

Never rely solely on frontend visibility.

UI hiding is not security.

Every database query and mutation must enforce authorization.

---

# 24. AUDIT LOGGING

Audit important actions:

- Guardian relationship created
- Guardian relationship removed
- Permission changed
- Tournament acknowledgement submitted
- Tournament acknowledgement changed
- Form completed
- Waiver signed
- Payment made
- Document uploaded
- Sensitive information accessed where required

---

# 25. MOBILE EXPERIENCE

The Parent/Guardian experience will frequently be used on mobile.

Prioritize:

- Simple dashboard
- Clear action buttons
- Calendar
- Availability
- Tournament acknowledgement
- Forms
- Payments
- Notifications

A parent should be able to receive an email, open the link, authenticate if required, review the tournament information, and acknowledge participation with minimal friction.

---

# 26. SUCCESS CRITERIA

The Parent/Guardian Module should make it possible to:

1. Manage multiple children.
2. View each child's canonical Player Profile information that is authorized.
3. See schedules.
4. Manage availability.
5. Review attendance.
6. Follow development.
7. Review evaluations.
8. Read player-visible coach feedback.
9. View matches.
10. View tournaments.
11. Receive tournament acknowledgement requests.
12. Confirm or decline tournament participation.
13. Complete required forms and waivers.
14. View fees and payment history.
15. Manage family information.
16. Communicate with the club/coach.
17. Receive relevant notifications.
18. Maintain privacy and permission boundaries.

The Parent/Guardian experience should feel like a **family football management portal**, not an administrative database.

The core experience is:

**Know → Respond → Support → Develop → Participate**