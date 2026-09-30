# Alert organizer to data problem Task Specification

## Basic Information

- **Task ID:** H1
- **Task name:** Alert organizer to data problem
- **Task type:** Act
- **Task owner:** CPVC event operations lead

## 1. Task Description

This task notifies the CPVC event operations lead that a run has stopped without producing a forecast, and states what failed and what remains unknown. The workflow needs it because a run that ends on the exception path produces nothing the organizer would otherwise see: without a notification, a checkpoint would pass silently and an ordering decision would be made on stale information while everyone assumed a forecast was coming. The rule applied is fixed — one notification per failed run, carrying the recorded failure status verbatim, with no interpretation of the cause and no attempt at repair. This task ends the run; it does not return control to any forecasting task.

## 2. Inputs

### Input 1

- **Input name:** Failure record
- **Contents and format:** A structured record containing the recorded status, the error returned by the failing tool or data source, the task ID where the run stopped, the checkpoint identity, and the run identifier.
- **Source:** T1 Pull registration roster, on its exception path.

- **If a required input is missing or invalid:** The task sends a notification reporting that a run failed and that the failure detail could not be read, naming the checkpoint identity and run identifier if either is available. A missing failure record is never treated as an absence of failure.

## 3. Outputs

### Output 1

- **Output name:** Data problem notification
- **Contents and format:** A message to the CPVC event operations lead naming the checkpoint, the task that stopped, the recorded error, and the fact that no forecast exists for this checkpoint, together with the run identifier and the delivery confirmation returned on success.
- **Next task or recipient:** CPVC event operations lead. The run ends here at the no-forecast completion state; no further task receives output.
- **Complete when:** The messaging service has returned a delivery confirmation, and the failure record and notification are both stored against the run identifier.

## 4. Planned Tools

### Tool 1

- **Tool name:** notify_event_lead
- **Input:** Failure record
- **Output:** Data problem notification
- **Implementation Route:** web API calls
- **Integration approach:** direct integration
- **Role in this task:** Sends the failure detail to the CPVC event operations lead through the club messaging channel and returns the delivery confirmation. Sends a message and changes stored state.
- **Task timeout:** 30 seconds
- **Maximum retries:** 1
- **Retry only when:** The call returns a connection error with no delivery confirmation, after a 15-second wait. Because the tool sends a message, it may send at most one notification per run; the run identifier accompanies the notification so that a duplicate arriving from a retry can be recognised and discarded by the recipient.
- **On timeout, exhausted retries, or an error that cannot be retried:** Record the status as alert not delivered together with the full failure record, so the unresolved run stays visible in the run history for the CPVC event operations lead to find. Do not send through any other channel, and do not treat an undelivered alert as a completed handoff.
