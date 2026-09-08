You are working on **Dula HQ**, a football-first multi-tenant club and tournament management SaaS platform.

Your task is to **update the Coach Module**.

The Coach Module must be deeply interconnected with the existing:

- Player Profile
- Parent/Guardian Module
- Team Management
- Training
- Attendance
- Development
- Match Management
- Tournament Management

Do not treat the Coach as an isolated user dashboard.

The Coach is one of the primary operational users responsible for moving players through:

**Plan → Train → Play → Evaluate → Develop → Communicate**

---

# CORE PRODUCT PRINCIPLE

The Coach should have a command center that gives them everything they need to manage their assigned teams and develop their players.

The Coach should NOT automatically have access to every piece of player information.

Access must be permission-based.

The Coach's primary relationship is:

**Coach → Team → Players → Training → Development → Matches → Tournaments**

---

# COACH NAVIGATION

Use a clear structure such as:

1. Overview
2. Teams
3. Players
4. Training
5. Development
6. Matches
7. Tournaments
8. Communication

Additional settings/actions can exist where appropriate.

Do not unnecessarily duplicate information already available through the Player Profile.

---

# 1. OVERVIEW / COACH DASHBOARD

The Coach Dashboard should answer:

> "What do I need to know and do today?"

Show:

## Today's Schedule

- Training sessions
- Matches
- Tournament events
- Team events

## Upcoming

- Next training
- Next match
- Upcoming tournament
- Important deadlines
- Roster submission deadlines

## Team Snapshot

For each assigned team:

- Player count
- Available players
- Unavailable players
- Injured players
- Attendance trend
- Development activity

## Action Center

Examples:

- Confirm today's attendance
- Prepare training session
- Complete player evaluations
- Review development goals
- Fill tournament roster
- Review guardian acknowledgements
- Finalize tournament roster
- Submit match lineup
- Complete match report

The dashboard should prioritize actions rather than just display statistics.

---

# 2. TEAMS

Coach can access teams they are assigned to.

For each team show:

- Team name
- Age group
- Season
- Sport
- Coach
- Assistant Coach
- Player count
- Current schedule
- Upcoming matches
- Upcoming tournaments

## Team Roster

Show:

- Player photo
- Player name
- Jersey number
- Primary position
- Availability
- Attendance
- Development status
- Current team status

Selecting a player opens the canonical Player Profile.

Do NOT create a separate coach-only player record.

---

# 3. PLAYERS

The Coach should be able to view players belonging to their assigned teams.

Provide filtering by:

- Position
- Availability
- Attendance
- Development status
- Age group
- Team
- Season
- Injury/availability status where the coach has permission

Player cards/list should surface useful football information without exposing sensitive data.

Potential quick information:

- Name
- Photo
- Jersey number
- Position
- Preferred foot
- Availability
- Attendance
- Development focus
- Active goals
- Latest evaluation

Clicking the player opens the canonical Player Profile.

---

# 4. PLAYER DEVELOPMENT

The Coach should be able to manage the player's development through the same data used by the Player and Parent modules.

Coach capabilities:

- Create development goals
- Edit development goals
- Archive goals
- Add evaluations
- View historical evaluations
- Add player-visible feedback
- Add private coach notes
- Connect goals to drills
- Connect goals to training sessions
- Review progression
- View development timeline

Separate:

### Player-visible feedback

This can be seen by the player and authorized parent/guardian.

### Private coach notes

These are internal.

Never expose private coach notes to:

- Player
- Parent/Guardian

unless an explicit future permission mechanism allows it.

---

# 5. TRAINING

The Coach should be able to:

- Create training sessions
- Schedule training
- Build session plans
- Select drills
- Add training objectives
- Assign players
- Track attendance
- Record observations
- Connect training to development goals
- Review previous sessions

Training should connect directly to the Player Profile.

A player's training history should automatically become part of their development record.

---

# 6. DRILL LIBRARY

Support:

- Drill name
- Description
- Age suitability
- Position suitability
- Skill category
- Difficulty
- Duration
- Equipment
- Coaching points
- Variations

Drills should be linkable to:

- Training sessions
- Development goals
- Player development history

---

# 7. MATCH MANAGEMENT

Coach should be able to:

- View upcoming matches
- Prepare match
- Select lineup
- Select substitutes
- Assign positions
- Add tactical notes
- Record availability
- Record match events
- Record minutes
- Record goals
- Record assists
- Record basic statistics
- Add post-match observations
- Connect observations to player development

Match statistics should flow back into the Player Profile where appropriate.

---

# 8. TOURNAMENTS

Tournament Management is a separate first-class Dula HQ platform.

However, Coaches need controlled access to tournaments involving their teams.

The Coach should be able to:

- View assigned tournaments
- View tournament details
- View tournament schedule
- View venue information
- View tournament deadlines
- Fill tournament roster
- Review guardian acknowledgements
- Finalize tournament roster
- View finalized roster
- Download/export finalized roster

The Coach does NOT create or administer the entire tournament unless they have a separate tournament role/permission.

---

# 9. TOURNAMENT ROSTER WORKFLOW

This is a critical workflow.

Create a dedicated Coach function:

## Fill Tournament Roster

The Coach selects a tournament and team.

The system loads the team's current roster.

The Coach can select eligible players from the team's roster.

Do NOT allow the Coach to manually add arbitrary players who are not part of the team roster unless an authorized tournament workflow explicitly permits it.

---

## Roster Candidate Selection

Show:

- Player name
- Photo
- Jersey number
- Position
- Availability
- Eligibility
- Relevant tournament requirements
- Guardian status where applicable
- Confirmation status

For example:

```text
TOURNAMENT ROSTER

Player             Position     Guardian Status

Daniel Santos      Defender     ✓ Confirmed
Marco Reyes        Midfielder   ⏳ Pending
Luis Cruz          Forward      ✓ Confirmed
Andre Lim          Goalkeeper   ✓ Confirmed
```

The Coach can initially select players they intend to bring.

---

# 10. GUARDIAN ACKNOWLEDGEMENT WORKFLOW

Once the Coach has prepared the proposed tournament roster, provide:

**Submit for Guardian Acknowledgement**

The system should send an email notification to the authorized parent/guardian associated with each applicable minor player.

The email should contain:

- Tournament name
- Tournament date(s)
- Team
- Player name
- Relevant tournament information
- What the guardian is being asked to acknowledge
- Link to the Dula HQ confirmation experience

Do not treat the email itself as the only source of truth.

The actual acknowledgement must be recorded inside Dula HQ.

---

# 11. GUARDIAN CONFIRMATION

For minor players, the authorized guardian should be able to:

- Review tournament details
- Review the player's participation
- Acknowledge participation
- Confirm
- Decline
- Ask/flag a question if supported

The system must record:

- Player
- Guardian
- Tournament
- Timestamp
- Confirmation status
- Confirmation method
- Relevant version of the acknowledgement

Statuses:

- Pending
- Confirmed
- Declined
- Expired
- Revoked

If multiple guardians are authorized, follow the club's configured acknowledgement rule.

Do not assume that one guardian always has authority over another.

---

# 12. ROSTER CONFIRMATION STATUS

The Coach should have a dedicated roster status view.

Example:

```text
TOURNAMENT ROSTER

Daniel Santos       ✓ Confirmed
Marco Reyes         ⏳ Pending
Luis Cruz           ✓ Confirmed
Andre Lim           ✓ Confirmed
Sofia Tan           ✕ Declined
```

Clearly distinguish:

- Coach selected
- Guardian acknowledged
- Eligible
- Finalized

These are different states.

---

# 13. FINALIZE TOURNAMENT ROSTER

The Coach should have a:

**Finalize Roster**

action.

When finalizing, the system should only allow players who satisfy the tournament's configured requirements.

At minimum:

- Player belongs to the selected team
- Player is eligible for the tournament
- Required guardian acknowledgement has been received where applicable
- Required information/forms are complete where applicable

The Coach can select only players whose status is eligible for finalization.

Example:

```text
FINALIZABLE PLAYERS

✓ Daniel Santos
✓ Luis Cruz
✓ Andre Lim

Not Finalizable

⏳ Marco Reyes — Guardian acknowledgement pending
✕ Sofia Tan — Guardian declined
```

Do not allow the Coach to bypass this by simply clicking Finalize.

If an override is ever required, it should require an explicit authorized permission and create an audit log.

---

# 14. FINAL ROSTER

Once finalized, create an immutable/versioned tournament roster record.

The roster should contain:

## Tournament Information

- Tournament name
- Tournament organizer
- Tournament date(s)
- Venue(s)
- Team
- Age/category
- Division
- Roster submission date
- Roster status
- Roster version

## Player Information

For each player include only relevant tournament information.

Potential fields:

- Player full name
- Preferred name where appropriate
- Jersey number
- Date of birth or age/category information if required
- Position
- Player ID if required
- Team
- Emergency/guardian indicator where appropriate
- Required eligibility information
- Relevant registration status
- Required waiver/form completion status

DO NOT automatically dump the entire Player Profile into the tournament roster.

Only include information relevant and authorized for the tournament.

---

# 15. FINAL ROSTER EXPORT

Allow the Coach to generate:

- TXT
- PDF

The PDF should be professional and tournament-ready.

Suggested structure:

DULA HQ

TOURNAMENT ROSTER

Tournament: [Tournament Name]  
Team: [Team Name]  
Category: [Age/Division]  
Date: [Tournament Date]  
Venue: [Venue]

ROSTER

# | Player | Position | Jersey | Relevant Info

1 | Daniel Santos | Defender | 4 | ...
2 | Luis Cruz | Forward | 9 | ...
3 | Andre Lim | GK | 1 | ...

Then include appropriate:

- Coach
- Assistant Coach
- Team contact information
- Tournament information
- Required acknowledgements/status if appropriate
- Generated date
- Roster version

The PDF must not contain sensitive information unless explicitly required and authorized.

For example, do NOT include detailed medical information by default.

---

# 16. ROSTER VERSIONING

Tournament rosters should be versioned.

Example:

Roster v1 — Submitted  
Roster v2 — Updated  
Roster v3 — Finalized

Once finalized, preserve the final version.

If changes are required after finalization, require an authorized roster update process.

Do not silently mutate the historical roster.

---

# 17. COMMUNICATION

Coach communication should connect to:

- Players
- Parents/Guardians
- Team
- Tournament

Support:

- Team announcements
- Training reminders
- Match reminders
- Tournament reminders
- Guardian acknowledgement reminders
- Direct communication where permitted

For tournament acknowledgement, provide:

- Initial notification
- Reminder
- Confirmation received
- Declined notification
- Final roster notification

Respect notification preferences.

---

# 18. COACH → PARENT → PLAYER CONNECTION

The core relationship should be:

```text
                 TEAM
                  │
             ┌────┴────┐
             ↓         ↓
           COACH      PLAYERS
                        │
                 ┌──────┴──────┐
                 ↓             ↓
               PLAYER       GUARDIAN
```

The same Player Profile powers all three experiences.

Example:

Coach creates development goal.

↓

Player sees the goal.

↓

Authorized Parent sees the goal.

↓

Coach adds feedback.

↓

Player sees feedback.

↓

Parent sees player-visible feedback.

This should happen through shared underlying records, not copied data.

---

# 19. PERMISSIONS

Do not use a single "Coach = everything" permission.

Examples:

- VIEW_TEAM
- VIEW_PLAYER
- EDIT_PLAYER_FOOTBALL_PROFILE
- VIEW_ATTENDANCE
- MANAGE_ATTENDANCE
- VIEW_DEVELOPMENT
- MANAGE_DEVELOPMENT
- ADD_EVALUATION
- ADD_PLAYER_FEEDBACK
- ADD_PRIVATE_COACH_NOTE
- MANAGE_TRAINING
- MANAGE_MATCH
- MANAGE_LINEUP
- VIEW_TOURNAMENT
- FILL_TOURNAMENT_ROSTER
- REQUEST_GUARDIAN_ACKNOWLEDGEMENT
- FINALIZE_TOURNAMENT_ROSTER
- EXPORT_TOURNAMENT_ROSTER

Permissions must be scoped by:

- Tenant
- Team
- Season
- Competition/tournament
- Relationship

---

# 20. SECURITY

Supabase Row Level Security is mandatory.

The Coach should only access:

- Their assigned tenant
- Their assigned teams
- Players associated with those teams
- Tournaments they are authorized to participate in/manage

UI hiding is not security.

All sensitive actions should be server-authorized.

Important actions such as:

- Guardian acknowledgement
- Roster submission
- Roster finalization
- Roster changes
- Export generation

should create audit records.

---

# 21. SUCCESS CRITERIA

The Coach Module should make it possible for a coach to:

1. Manage their teams.
2. See their players.
3. Access the canonical Player Profile.
4. Plan training.
5. Track attendance.
6. Manage player development.
7. Evaluate players.
8. Prepare matches.
9. Manage tournament participation.
10. Fill a tournament roster from the team roster.
11. Send guardian acknowledgement requests.
12. Track acknowledgement status.
13. Finalize only eligible/acknowledged players.
14. Generate a professional TXT/PDF final roster.
15. Keep all of this synchronized with Player and Parent/Guardian experiences.

The Coach Module should feel like the operational command center for football development and team management.

The core workflow is:

**Plan → Train → Play → Evaluate → Develop → Communicate → Compete**