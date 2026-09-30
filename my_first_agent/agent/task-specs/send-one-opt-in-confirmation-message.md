# Send one opt-in confirmation message Task Specification

## Basic Information

- **Task ID:** T3
- **Task name:** Send one opt-in confirmation message
- **Task type:** Act
- **Task owner:** CPVC event operations lead

## 1. Task Description

At the 7-day and 48-hour confirmation checkpoints, this task sends a single fixed confirmation request to each registrant who has not already replied, and records what was sent to whom. The workflow needs it because registration alone does not indicate intent, and a direct request is the only evidence of intent the design permits the system to gather. The rule applied is fixed: the message text does not vary, the recipient rule is every registrant with no recorded reply, and the system goal caps total contact at two messages per registrant across the whole event cycle. The dispatch log is consulted before sending so that no registrant is contacted a third time.

## 2. Inputs

### Input 1

- **Input name:** Registration roster
- **Contents and format:** A structured record set containing one record per registrant with a registrant identifier and a registration timestamp.
- **Source:** T1 Pull registration roster.

### Input 2

- **Input name:** Checkpoint identity
- **Contents and format:** Which scheduled checkpoint this run belongs to, or an indication that an organizer started the run on demand.
- **Source:** The workflow trigger described in Section 1.2 of workflow-of-tasks.md.

### Input 3

- **Input name:** Message dispatch log
- **Contents and format:** One entry per message previously sent, each naming the registrant identifier, the checkpoint it was sent at, and the send timestamp. Empty before the first confirmation checkpoint.
- **Source:** T3 Send one opt-in confirmation message, from earlier runs in the same event cycle.

- **If a required input is missing or invalid:** The task sends nothing, records the status as confirmation request not sent together with which input was missing, and hands the case to the CPVC event operations lead. If the dispatch log cannot be read, no message is sent, because the two-message cap cannot be enforced without it.

## 3. Outputs

### Output 1

- **Output name:** Message dispatch log
- **Contents and format:** The updated log, adding one entry per message sent in this run with the registrant identifier, checkpoint identity, and send timestamp, plus a list of registrants deliberately not contacted and the reason, such as having already replied or having already received two messages.
- **Next task or recipient:** T4 Record replies as attending, not attending, or unsure.
- **Complete when:** Every registrant eligible under the recipient rule has either a send entry or a named reason for exclusion, and no registrant has more than two entries across the event cycle.

## 4. Planned Tools

### Tool 1

- **Tool name:** send_confirmation_message
- **Input:** Registration roster; Checkpoint identity; Message dispatch log
- **Output:** Message dispatch log
- **Implementation Route:** web API calls
- **Integration approach:** direct integration
- **Role in this task:** Reads the dispatch log to determine who is eligible, sends the fixed confirmation text to each eligible registrant one at a time, and writes a dispatch entry immediately after each successful send. Sends messages and changes stored state.
- **Task timeout:** 10 minutes
- **Maximum retries:** 1
- **Retry only when:** A send returns a connection error or a timeout with no delivery confirmation, after a 20-second wait, and only after re-reading the dispatch log for an entry already recording this registrant at this checkpoint. Because the tool sends messages, the registrant identifier paired with the checkpoint identity is the key that prevents a second message for the same run. If the log cannot establish whether the message went out, do not retry.
- **On timeout, exhausted retries, or an error that cannot be retried:** Record the status as delivery outcome uncertain, naming each registrant whose send could not be confirmed, and hand the case to the CPVC event operations lead. Do not attempt a further send to those registrants and do not record the task as completed.
