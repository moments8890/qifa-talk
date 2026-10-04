# qifa-talk Host Intake and Content Sync Design

Date: 2026-10-03

## Objective

Replace manual event-page maintenance with a controlled workflow in which hosts submit candidate events through Google Forms, operations confirms and schedules them, and confirmed public data is synchronized into the qifa-talk GitHub Pages site and the existing coordination spreadsheet.

The workflow must keep candidate contact information private, preserve an approval gate before publication, support operations-owned posters, and allow the externally maintained Notion page to be retired after a one-time historical backfill.

## Product Decisions

- Host submissions are candidates, not public events.
- Operations must confirm a candidate before it receives an official event number or appears on GitHub Pages.
- Host-provided candidate content is authoritative, subject to operations confirmation.
- Notion is a read-only historical/backfill source. The new workflow does not write to or depend on Notion after migration.
- Candidates choose only from operations-approved, currently available Sundays.
- Selecting a date places an immediate temporary hold so another candidate cannot select it.
- Posters are created and uploaded manually by operations for the initial release. Automatic poster generation may replace that step later without changing downstream interfaces.
- WeChat ID and email are required private contact fields and are never published.

## System Architecture

```text
Host
  -> Google Form
  -> private Form Responses table
  -> private normalized Candidates table
  -> operations review and date confirmation
  -> public-source Events spreadsheet
       -> Jekyll content generator
       -> GitHub Pages build and deployment

Existing coordination spreadsheet
  <-> Apps Script availability and booking adapter
  -> available-Sunday choices in Google Form

Operations poster folder
  -> event-number-based poster lookup
  -> Jekyll public assets

Notion public page
  -> one-time historical backfill only
```

Google Workspace owns candidate intake, private contact data, reservation state, coordination-sheet updates, and confirmed event records. GitHub owns the static-site generator, templates, validation code, deployment workflow, and public output. GitHub Actions reads a separate public-source Events spreadsheet and the poster folder through a narrowly scoped, read-only service account.

## Google Form

The candidate form contains:

### Required inputs

- Google account email, collected automatically when supported
- WeChat ID
- Available Sunday, selected from a dynamically maintained choice list
- Short public event title

The title is the exact public headline used by the website, coordination spreadsheet, and poster workflow. Form helper text should recommend 8–30 Chinese characters and explicitly say not to enter an event description in this field.

### Default logistics

The form asks whether the standard logistics apply. The standard values are:

- Start time: 2:00 PM
- End time: 5:00 PM
- Location: Bellevue Library
- Capacity: 16
- Event type: 科普 / 分享
- Time zone: America/Los_Angeles

Event type is not shown as a host-facing question in the initial release. It remains a configurable system default. If standard logistics do not apply, the form reveals override fields for start time, end time, location, and capacity.

### Optional inputs

- Activity description: one to three sentences, approximately 50–150 Chinese characters
- Detailed material or Google Doc link
- Other notes (`其他说明`), private by default

The activity description may be used on the website and by operations as poster copy. Blank optional fields render as absent; the system does not publish empty sections or placeholder values such as `待定`.

### Private-field rule

Email, WeChat ID, and `其他说明` remain in Google Workspace. They must not appear in generated Markdown, public JSON/YAML, build artifacts, GitHub Actions output, posters, or the public site.

A public host display name is not requested from the candidate. Operations may add one during confirmation. When absent, the website omits host attribution.

## Spreadsheet Model

Private intake data and confirmed public-source data are stored in separate spreadsheet files. This prevents the GitHub service account from gaining file-level access to candidate contact data, because Google Sheets permissions cannot be restricted to individual tabs.

The private intake workbook contains three logical tabs.

### Form Responses

The native Google Forms response destination is treated as read-only by automation. A host may change the underlying response through Google's edit-response flow, so the table is not assumed to be append-only. Candidate IDs and observed source revisions preserve the relationship between edits and confirmed public versions.

### Candidates

The normalized working table contains:

- candidate ID
- source response ID and timestamp
- private email and WeChat ID
- requested Sunday
- title
- optional description and material link
- optional private notes
- resolved logistics and default/override provenance
- reservation state and hold expiry
- review state and operations notes
- link to the host's editable response when available
- source revision and last-updated timestamps

### Operations Log

This tab records reservation and review transitions, including candidate ID, previous and next state, actor, timestamp, and concise reason. It does not duplicate email, WeChat ID, or free-text candidate content.

### Published Events spreadsheet

This separate spreadsheet contains confirmed public data only:

- permanent internal event ID
- official public event number
- public title
- start and end timestamp in America/Los_Angeles
- public location
- capacity
- event type
- optional public host display name
- optional public description
- optional public detail/material link
- publication state
- poster state and Drive file ID
- source candidate ID and confirmed revision
- confirmation and last-sync timestamps

No private contact fields are copied into Published Events. The GitHub service account can read this file without access to the private intake workbook.

The existing coordination spreadsheet is both the availability authority and a confirmed-booking destination. Apps Script maps fields by verified header name rather than hard-coded column position. The implementation must inspect its exact tab and headers before enabling writes.

## Reservation State Machine

```text
Available Sunday
  -> Held by candidate
     -> Confirmed and booked
     -> Released by operations
     -> Released automatically on expiry
```

The coordination spreadsheet is the availability authority. Only Sundays explicitly marked available appear in the Form. Closed dates, holidays, existing holds, and booked dates are omitted.

Submitting the Form immediately places a configurable seven-day hold. A transactional Apps Script lock prevents two near-simultaneous submissions from claiming the same Sunday. When a hold is confirmed, the date becomes booked. Rejection, manual release, or expiry returns the date to available and refreshes the Form choices.

## Candidate Review and Publication State

Candidate review states are:

- `Candidate`: submitted and private
- `Needs changes`: operations has requested a correction
- `Confirmed`: approved, assigned an official number, and eligible for publication
- `Rejected`: not scheduled; history retained privately
- `Cancelled`: a previously confirmed event is removed from upcoming listings

`Completed` is derived from a confirmed event's end timestamp and is not a manual review state.

Operations confirmation performs the following atomic transition:

1. validate required and public fields;
2. verify that the held date still belongs to the candidate;
3. assign the next official event number;
4. create or update the Published Events record;
5. upsert the confirmed booking in the coordination spreadsheet and mark the Sunday booked;
6. request a content synchronization run.

Apps Script performs this transition under a lock and uses idempotent upserts. If either cross-file write fails, it records the failure and compensates the completed write before releasing the lock, leaving the candidate held rather than partially confirmed.

Host edits to an already confirmed candidate create a pending revision. The live Published Events record stays unchanged until operations reconfirms the revision. An invalid or incomplete revision never replaces the last confirmed public version.

## Poster Workflow

Posters are operations-owned and excluded from the host form.

For the initial release, operations creates a poster manually and uploads it to a dedicated Drive folder using the official event number as the filename, for example `054.png`, `054.jpg`, or `054.webp`.

The synchronization job matches the filename to the event number, validates the file type, downloads the asset with the Google service account, and publishes it at a stable path such as `/assets/images/events/054.webp`. A missing poster does not block a confirmed event; the site displays a branded placeholder.

Future automatic poster generation must write the same numbered asset contract. No website, spreadsheet, or generator interface changes are required for that migration.

## GitHub Synchronization

The repository gains a deterministic synchronization command with separate responsibilities:

- Google reader: reads Published Events and poster metadata
- validator: enforces schema, timestamps, unique IDs/numbers, safe URLs, and public/private field boundaries
- normalizer: applies defaults and canonical representations
- Jekyll generator: creates event data/pages and stable asset paths
- reporter: writes privacy-safe status to the GitHub Actions summary

The GitHub Actions workflow supports manual dispatch and a schedule fallback. A Google Apps Script form/review trigger may request an immediate run. The scheduled run guarantees eventual synchronization if the trigger fails.

Upcoming versus past classification is derived from the event end timestamp in America/Los_Angeles during each build. The existing file-moving archive action becomes unnecessary and should be retired only after the new classification path is verified.

Synchronization is idempotent: repeated runs with the same source revision produce the same public output and do not duplicate spreadsheet rows. A failure preserves the last successfully deployed site.

## Notion Backfill

The public Notion page is used once to populate historical/reference events 001–067. The importer extracts the best available public fields and preserves useful public links and notes where practical.

The duplicate public number `066` must be resolved during migration before any new number is assigned. Backfilled placeholders and inconsistent values are normalized or omitted; they do not become new schema requirements.

The backfill is reviewed through a dry-run diff against the current repository and Notion page before it becomes the initial Published Events dataset. After acceptance, routine synchronization does not read or write Notion.

## Error Handling

- A candidate with missing required fields remains private and receives a validation status.
- A confirmed-event revision that fails validation leaves the previous confirmed version live.
- A missing or invalid poster falls back to the placeholder and produces a warning.
- A failed Published Events or coordination-spreadsheet write leaves the candidate held and unconfirmed; compensating logic prevents a partially confirmed booking.
- A failed public build or deployment leaves the prior GitHub Pages version active.
- No record is hard-deleted by automation. Rejection, cancellation, release, and completion are state transitions with retained audit history.
- Logs identify candidate/event IDs and field names, not private field values.

## Security and Access

- The GitHub service account receives read-only access to the separate Published Events spreadsheet and poster folder. It has no access to the private intake workbook or coordination spreadsheet.
- Service-account credentials are stored only in GitHub Actions secrets.
- Apps Script secrets, including any GitHub dispatch credential, are stored in Script Properties rather than cells or source code.
- Public generation uses an explicit allowlist of fields. Private fields are not merely hidden in templates; they are excluded before serialization.
- External links are validated for supported HTTPS schemes before rendering.

## Verification Strategy

Automated tests cover:

- default application for time, location, capacity, type, and time zone;
- explicit logistics overrides;
- Sunday availability filtering;
- transactional prevention of double holds;
- hold confirmation, release, and expiry;
- candidate-to-confirmed transitions and pending confirmed-event revisions;
- unique internal IDs and official numbers;
- cancellation and completed-event classification;
- missing optional description, detail link, public host name, and poster;
- privacy allowlisting that prevents email, WeChat ID, and private notes from reaching public output or logs;
- idempotent synchronization and coordination-sheet upserts;
- Pacific Time date-boundary behavior.

Integration verification includes a fixture workbook, a dry-run against a copy of the real spreadsheet structure, a complete Jekyll build, and local inspection of home, upcoming, past, event-detail, missing-poster, and cancelled-event states.

Rollout verification requires:

1. snapshot the current working site;
2. backfill and review event data;
3. run the new pipeline without deployment;
4. compare generated content with the current site and Notion reference;
5. deploy through GitHub Pages;
6. confirm the live next event, upcoming list, past list, poster fallback, and absence of private fields;
7. keep the previous Git revision available for rollback.

## Non-Goals for the Initial Release

- Writing changes back to Notion
- Automatic poster generation
- A custom event-admin web application
- Host-controlled public publication
- Arbitrary non-Sunday date requests
- Publishing private contact or operations notes
