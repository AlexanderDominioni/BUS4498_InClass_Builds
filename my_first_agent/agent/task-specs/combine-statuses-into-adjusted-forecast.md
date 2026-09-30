# Combine statuses into adjusted forecast Task Specification

```yaml
# BASIC INFORMATION
task_id: "T5"
task_name: "Combine statuses into adjusted forecast"
task_owner: "CPVC event operations lead (the club officer accountable for food, drink, and swag ordering)"

# Agent Inference Configuration
Provider: Claude
Model: "claude-sonnet-5-5"
Role: Assess response coverage, reconcile roster records, weight confirmed responses, apply baseline show rate, compare forecast methods, estimate confidence range
Maximum inference requests per task run: "8"
On inference failure or exhausted limits: Record the unresolved status and hand the case to the CPVC event operations lead.
```

## 1. Task Goal

- **Objective:** Produce a single attendance forecast for the current checkpoint, expressed as a predicted headcount with a confidence range and the counts it was derived from, so that the CPVC event operations lead can decide how much food, drink, and swag to order without relying on the raw registration count.

## 2. Inbound Inputs

### Input 1

- **Input name:** Registration roster
- **What it contains:** One record per registrant, including a registrant identifier and a registration timestamp; the total record count is the current registration total.
- **Source:** T1 Pull registration roster.

### Input 2

- **Input name:** Baseline forecast
- **What it contains:** A predicted headcount produced by applying the historical show rate from past club events to the current registration total, together with the show rate that was used.
- **Source:** T2 Calculate baseline forecast from historical show rate.

### Input 3

- **Input name:** Recorded confirmation replies
- **What it contains:** For each registrant who replied, a status of attending, not attending, or unsure. Registrants who did not reply are absent from this input. This input is present only at the 7-day and 48-hour confirmation checkpoints and is absent at the 14-day and 12-hour checkpoints.
- **Source:** T4 Record replies as attending, not attending, or unsure.

### Input 4

- **Input name:** Checkpoint identity
- **What it contains:** Which scheduled checkpoint this run belongs to, or an indication that an organizer started the run on demand.
- **Source:** The workflow trigger described in Section 1.2 of workflow-of-tasks.md.

## 3. Tool Permissions and Boundaries

## 4. How the Agent Should Reason

### Permitted Subtask 1

- **Subtask name:** Assess response coverage
- **Subtask description:** Examines the recorded confirmation replies against the registration roster to determine what share of registrants have responded, and produces a coverage finding describing whether confirmations are numerous enough to carry weight in the forecast.
- **Subtask boundary:** May read the roster and the confirmation replies. May not contact registrants, request additional replies, or treat a non-reply as any particular intention. Requires that a registration roster is present. If Input 3 is absent for this checkpoint, coverage is recorded as none.
- **Retry limits:** 1

### Permitted Subtask 2

- **Subtask name:** Reconcile roster records
- **Subtask description:** Examines the registration roster for duplicate registrants, incomplete records, and replies that cannot be matched to a registrant, and produces a reconciled registration count together with a list of records it could not resolve.
- **Subtask boundary:** May exclude a record from the count and must record the reason. May not alter, merge, or delete records at the source, and may not exclude more than a small minority of records without handing off. Requires that a registration roster is present.
- **Retry limits:** 1

### Permitted Subtask 3

- **Subtask name:** Weight confirmed responses
- **Subtask description:** Examines the recorded statuses and produces a candidate forecast built primarily from registrants who confirmed attendance, applying the historical show rate only to registrants who did not reply or replied unsure.
- **Subtask boundary:** May produce a candidate forecast only. May not treat this candidate as the final result without comparing it against the baseline, and may not invent a response for a registrant who did not reply. Requires a completed coverage assessment.
- **Retry limits:** 1

### Permitted Subtask 4

- **Subtask name:** Apply baseline show rate
- **Subtask description:** Examines the reconciled registration count and the historical show rate and produces a candidate forecast built from the baseline alone, for use when confirmation coverage is too low to be informative or when confirmations are unavailable.
- **Subtask boundary:** May use only the show rate supplied in Input 2. May not substitute a show rate of its own, and may not adjust the rate to fit an expected answer.
- **Retry limits:** 1

### Permitted Subtask 5

- **Subtask name:** Compare forecast methods
- **Subtask description:** Examines the candidate forecasts produced so far and reports the size and direction of the difference between them, producing a finding on whether they broadly agree or contradict each other.
- **Subtask boundary:** May report a discrepancy. May not average two contradictory candidates into a single number to conceal the disagreement, and may not select a candidate on the grounds that it is more convenient to plan around. Requires at least two candidate forecasts.
- **Retry limits:** 0

### Permitted Subtask 6

- **Subtask name:** Estimate confidence range
- **Subtask description:** Examines the selected candidate forecast together with the coverage finding and the count of unresolved records, and produces an upper and lower bound reflecting how much of the forecast rests on confirmed responses rather than on the historical rate.
- **Subtask boundary:** May widen the range to reflect weak evidence. May not narrow the range below the spread implied by the unconfirmed portion of the roster, and may not report a forecast without a range attached.
- **Retry limits:** 1

- **Decision guidance:** After each subtask, use its findings to select the permitted subtask most likely to resolve the most important remaining uncertainty. Do not follow a fixed sequence. If no permitted subtask can make useful progress, stop and hand the case to a person.

## 5. When to Stop or Hand Off to a Human

- **Stop successfully when:** A single forecast has been selected, a confidence range has been attached to it, and the record names the reconciled registration count, the confirmation counts by status, the show rate used, and which permitted subtasks produced the result. Every roster record is either included in the count or listed as unresolved with a reason.
- **Hand off early when:** The registration roster is missing or unreadable; the candidate forecasts contradict each other by more than the confidence range can absorb; more than a small minority of roster records cannot be reconciled; the confidence range is too wide to support an ordering decision; the checkpoint identity cannot be determined; or the inference request limit in the Basic Information block is reached before a forecast has been selected.
- **Hand off to:** The CPVC event operations lead.

Stop at the first applicable budget limit or handoff condition. While awaiting review, take no further autonomous action.

## 6. Outbound Deliverable

- **Status:** Completed or escalated to human.
- **Result or recommendation:** The selected attendance forecast with its confidence range. If escalated before a forecast could be selected, write undetermined.
- **Evidence summary:** The reconciled registration count, the confirmation counts by status, the show rate applied, and the reason this candidate forecast was selected over the alternative.
- **Subtasks performed:** Permitted subtasks completed, including repeated attempts.
- **Unresolved issues:** Roster records that could not be reconciled, and any disagreement between candidate forecasts that the confidence range does not absorb; use none only if no unresolved issue remains.
- **Handoff note:** Reason for stopping, unresolved questions, and what the reviewer needs to decide; write "Not applicable" for a completed task.
- **Next task or recipient:** T6 Write forecast and range to planning sheet. Unresolved cases go to the CPVC event operations lead.
