# Write forecast and range to planning sheet Task Specification

## Basic Information

- **Task ID:** T6
- **Task name:** Write forecast and range to planning sheet
- **Task type:** Remember
- **Task owner:** CPVC event operations lead

## 1. Task Description

This task takes the forecast record produced by T5 and enters it as the planning sheet row for this checkpoint, so that the organizer has something durable and specific to approve or reject. The workflow needs it because a forecast held only inside a run is not reviewable and cannot be compared against the forecast from the previous checkpoint. The rule applied is fixed: write the supplied fields to the row keyed on this checkpoint identity, return the record identifier, and change nothing about the forecast itself. This task does not judge whether the forecast is reasonable; that judgment belongs to the organizer at the review point that follows.

## 2. Inputs

### Input 1

- **Input name:** Selected forecast record
- **Contents and format:** A structured record containing the predicted headcount, its upper and lower bound, the reconciled registration count, the confirmation counts by status, the show rate applied, the permitted subtasks that produced it, and any unresolved issues.
- **Source:** T5 Combine statuses into adjusted forecast.

### Input 2

- **Input name:** Checkpoint identity
- **Contents and format:** Which scheduled checkpoint this run belongs to, or an indication that an organizer started the run on demand.
- **Source:** The workflow trigger described in Section 1.2 of workflow-of-tasks.md.

- **If a required input is missing or invalid:** The task writes nothing, records the status as forecast not written together with which field was missing, and hands the case to the CPVC event operations lead. A forecast arriving without a confidence range is treated as invalid and is not written.

## 3. Outputs

### Output 1

- **Output name:** Planning sheet entry
- **Contents and format:** One row in the club planning sheet for this checkpoint, containing the predicted headcount, the confidence range, the counts the forecast was derived from, the unresolved issues, and a record identifier returned by the planning sheet.
- **Next task or recipient:** CPVC event operations lead, for the approval decision that follows this task in the workflow.
- **Complete when:** The planning sheet has returned a record identifier and a read-back of that row shows the headcount and range that were supplied.

## 4. Planned Tools

### Tool 1

- **Tool name:** record_forecast_result
- **Input:** Selected forecast record; Checkpoint identity
- **Output:** Planning sheet entry
- **Implementation Route:** web API calls
- **Integration approach:** direct integration
- **Role in this task:** Writes the supplied forecast fields to the planning sheet row keyed on this checkpoint identity and returns the record identifier. Changes stored state.
- **Task timeout:** 45 seconds
- **Maximum retries:** 2
- **Retry only when:** The call returns a connection error or a timeout with no record identifier, and only after querying the planning sheet for a row already carrying this checkpoint identity, with a 15-second wait between attempts. Because the checkpoint identity is the key, a repeated write updates the same row rather than adding a second forecast for the same run. If the query cannot establish whether the earlier write landed, do not retry.
- **On timeout, exhausted retries, or an error that cannot be retried:** Record the status as write outcome uncertain, state which checkpoint identity may or may not have been written, and hand the case to the CPVC event operations lead for manual confirmation. Do not report the forecast as recorded and do not attempt a further write.
