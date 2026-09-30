# Combine statuses into adjusted forecast Task Specification

```yaml
# BASIC INFORMATION
task_id: "T5"
task_name: "Combine statuses into adjusted forecast"
task_owner: "CPVC event operations lead (the club officer accountable for food, drink, and swag ordering)"

# Agent Inference Configuration
Provider: Groq
Model: "openai/gpt-oss-120b"
Role: Assess response coverage, reconcile roster records, weight confirmed responses, apply baseline show rate, compare forecast methods, estimate confidence range
Maximum inference requests per task run: 6
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

### Task-Wide Limits

- **Total task timeout:** 15 minutes of elapsed time for one task run, including all tool calls, retries, and waiting.
- **Maximum tool calls:** 20 total calls across all tools during one task run; retries count toward this total.

### Tool 1

- **Tool name:** retrieve_registration_records
- **Input:** Registration roster; Recorded confirmation replies
- **Output:** Normalized record set pairing each registrant with a reply status of attending, not attending, unsure, or none
- **Implementation Route:** database query
- **Integration approach:** direct integration
- **Role in this task:** Supports Assess response coverage and Reconcile roster records
- **Task timeout:** 90 seconds of elapsed time within one task run
- **Maximum retries:** 2
- **Retry only when:** The query times out or returns a connection error, with a 10-second wait between attempts. This tool only reads, so a repeated call cannot duplicate or alter any record.
- **On timeout, exhausted retries, or an error that cannot be retried:** Record the status as roster unavailable, name the error returned, and hand the case to the CPVC event operations lead. Do not proceed to any forecast subtask using a partial record set.

### Tool 2

- **Tool name:** deduplicate_roster_entries
- **Input:** Normalized record set
- **Output:** Reconciled registration count and a list of records that could not be resolved, each with a reason
- **Implementation Route:** functions/scripts
- **Integration approach:** direct integration
- **Role in this task:** Supports Reconcile roster records
- **Task timeout:** 60 seconds of elapsed time within one task run
- **Maximum retries:** 1
- **Retry only when:** The script fails on a malformed record and the failing record can be excluded and named, with no waiting interval. The script writes nothing back to the roster, so rerunning it produces the same result from the same input.
- **On timeout, exhausted retries, or an error that cannot be retried:** Record the status as reconciliation incomplete, report how many records were resolved and how many were not, and hand the case to the CPVC event operations lead. Do not report a registration count as reconciled when it is not.

### Tool 3

- **Tool name:** calculate_forecast_estimate
- **Input:** Reconciled registration count; Normalized record set; Baseline forecast, including the historical show rate it used
- **Output:** Candidate forecast with an upper and lower bound and the counts it was derived from
- **Implementation Route:** functions/scripts
- **Integration approach:** direct integration
- **Role in this task:** Supports Weight confirmed responses, Apply baseline show rate, Compare forecast methods, and Estimate confidence range
- **Task timeout:** 60 seconds of elapsed time within one task run
- **Maximum retries:** 1
- **Retry only when:** The call fails on a missing or non-numeric field that can be named, with no waiting interval. The calculation is deterministic and stores nothing, so a repeated call with the same input returns the same candidate.
- **On timeout, exhausted retries, or an error that cannot be retried:** Record the status as forecast not produced, name which input was missing or unusable, and hand the case to the CPVC event operations lead. Do not substitute a forecast from a different method and present it as this one.

### Tool 4

- **Tool name:** record_forecast_result
- **Input:** Selected candidate forecast with its confidence range and evidence summary; Checkpoint identity
- **Output:** Written forecast record in the club planning sheet and the record identifier returned on success
- **Implementation Route:** web API call
- **Integration approach:** direct integration
- **Role in this task:** Produces the Outbound Deliverable in Section 6 and passes it to T6 Write forecast and range to planning sheet
- **Task timeout:** 45 seconds of elapsed time within one task run
- **Maximum retries:** 2
- **Retry only when:** The call returns a connection error or a timeout with no record identifier, and only after querying the planning sheet for a record already carrying this run's checkpoint identity, with a 15-second wait between attempts. This tool changes stored state, so the checkpoint identity serves as the key that prevents a second record for the same run. If the query cannot establish whether the earlier write landed, do not retry.
- **On timeout, exhausted retries, or an error that cannot be retried:** Record the status as write outcome uncertain, state which checkpoint identity may or may not have been written, and hand the case to the CPVC event operations lead for manual confirmation. Do not report the task as completed and do not attempt a further write.

### Tool 5

- **Tool name:** notify_event_lead
- **Input:** Handoff note stating the reason for stopping, unresolved questions, and what the reviewer needs to decide
- **Output:** Delivered notification to the CPVC event operations lead and the delivery confirmation returned on success
- **Implementation Route:** web API call
- **Integration approach:** direct integration
- **Role in this task:** Carries out the handoff required by Section 5 for every early-handoff condition
- **Task timeout:** 30 seconds of elapsed time within one task run
- **Maximum retries:** 1
- **Retry only when:** The call returns a connection error with no delivery confirmation, after a 15-second wait. This tool sends a message, so it may send at most one notification per task run; the run identifier accompanies the notification so a duplicate can be recognized and discarded by the recipient.
- **On timeout, exhausted retries, or an error that cannot be retried:** Record the status as handoff not delivered together with the full handoff note, so the unresolved case remains visible in the run record. Do not send through any other channel and do not treat an undelivered notification as a completed handoff.

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

- **Stop successfully when:** A single forecast has been selected, a confidence range has been attached to it, the record has been written to the club planning sheet and a record identifier returned, and the record names the reconciled registration count, the confirmation counts by status, the show rate used, and which permitted subtasks produced the result. Every roster record is either included in the count or listed as unresolved with a reason.
- **Hand off early when:** The registration roster is missing or unreadable; the candidate forecasts contradict each other by more than the confidence range can absorb; more than a small minority of roster records cannot be reconciled; the confidence range is too wide to support an ordering decision; the checkpoint identity cannot be determined; the outcome of a write to the planning sheet cannot be established; the total task timeout or maximum tool calls in Section 3 is reached; or the inference request limit in the Basic Information block is reached before a forecast has been selected.
- **Hand off to:** The CPVC event operations lead.

Stop at the first applicable budget limit or handoff condition. While awaiting review, take no further autonomous action.

## 6. Outbound Deliverable

- **Status:** Completed or escalated to human.
- **Result or recommendation:** The selected attendance forecast with its confidence range. If escalated before a forecast could be selected, write undetermined.
- **Evidence summary:** The reconciled registration count, the confirmation counts by status, the show rate applied, and the reason this candidate forecast was selected over the alternative.
- **Subtasks performed:** Permitted subtasks completed, including repeated attempts.
- **Unresolved issues:** Roster records that could not be reconciled, any disagreement between candidate forecasts that the confidence range does not absorb, and any write whose outcome could not be established; use none only if no unresolved issue remains.
- **Handoff note:** Reason for stopping, unresolved questions, and what the reviewer needs to decide; write "Not applicable" for a completed task.
- **Next task or recipient:** T6 Write forecast and range to planning sheet. Unresolved cases go to the CPVC event operations lead.
