# Record replies as attending, not attending, or unsure Task Specification

## Basic Information

- **Task ID:** T4
- **Task name:** Record replies as attending, not attending, or unsure
- **Task type:** Reason
- **Task owner:** CPVC event operations lead

## 1. Task Description

This task reads each reply a registrant sent in response to the confirmation request and assigns it one of three statuses — attending, not attending, or unsure — then stores the result against the registrant identifier. The workflow needs it because replies arrive as free text and cannot be counted until they are categorised. The operation is model-supported rather than rule-based: a reply such as "should be able to make it" carries no keyword that a fixed rule could match reliably, so the classification requires interpretation of meaning. That interpretation is bounded in two ways. Every reply resolves to one of the same three categories, and a reply the model cannot place with confidence is recorded as unsure rather than guessed. A registrant who did not reply is not classified at all and is simply absent from the output.

## 2. Inputs

### Input 1

- **Input name:** Registrant replies
- **Contents and format:** One entry per reply received, each containing a registrant identifier, the reply text as written, and the receipt timestamp.
- **Source:** Registrants, through the club messaging channel used by T3 Send one opt-in confirmation message.

### Input 2

- **Input name:** Message dispatch log
- **Contents and format:** One entry per message sent, each naming the registrant identifier, the checkpoint it was sent at, and the send timestamp, used to confirm that a reply corresponds to a request the system actually sent.
- **Source:** T3 Send one opt-in confirmation message.

- **If a required input is missing or invalid:** A reply carrying no registrant identifier, or a registrant identifier with no matching dispatch entry, is not classified. It is recorded as an unmatched reply with its identifier and the case is handed to the CPVC event operations lead. The task continues classifying the remaining replies.

## 3. Outputs

### Output 1

- **Output name:** Recorded confirmation replies
- **Contents and format:** A structured record set containing one entry per registrant who replied, each with the registrant identifier, a status of attending, not attending, or unsure, and the receipt timestamp. Registrants who did not reply are absent. A separate list names any unmatched replies.
- **Next task or recipient:** T5 Combine statuses into adjusted forecast.
- **Complete when:** Every reply in the input either carries one of the three statuses or appears on the unmatched list, and no registrant identifier holds two different statuses for the same checkpoint.

## 4. Planned Tools

### Tool 1

- **Tool name:** classify_reply_status
- **Input:** Registrant replies
- **Output:** Recorded confirmation replies
- **Implementation Route:** web API calls
- **Integration approach:** direct integration
- **Role in this task:** Passes each reply's text to the language model and returns one of the three permitted statuses, returning unsure when the reply does not clearly indicate attendance or non-attendance. Reads and classifies; stores nothing itself.
- **Task timeout:** 4 minutes
- **Maximum retries:** 2
- **Retry only when:** The call returns a connection error, a timeout, or a response outside the three permitted statuses, with a 10-second wait between attempts. The tool writes nothing, so reclassifying the same reply cannot create a duplicate entry.
- **On timeout, exhausted retries, or an error that cannot be retried:** Record that registrant's status as unsure, note that the classification failed rather than that the reply was ambiguous, and continue with the remaining replies. If more than a small minority of replies fail to classify, record the status as classification incomplete and hand the case to the CPVC event operations lead.

### Tool 2

- **Tool name:** store_reply_statuses
- **Input:** Recorded confirmation replies
- **Output:** Recorded confirmation replies
- **Implementation Route:** database queries
- **Integration approach:** direct integration
- **Role in this task:** Writes each registrant identifier and its status to the stored reply record for this event, replacing any earlier status for the same registrant at the same checkpoint. Changes stored state.
- **Task timeout:** 60 seconds
- **Maximum retries:** 1
- **Retry only when:** The write returns a connection error or a timeout with no confirmation, after a 15-second wait, and only after reading back the stored record for that registrant. Because the write is keyed on registrant identifier and checkpoint, a repeated write replaces the same entry rather than adding a second one. If the read-back cannot establish what was stored, do not retry.
- **On timeout, exhausted retries, or an error that cannot be retried:** Record the status as reply statuses not stored, naming the registrants whose statuses are uncertain, and hand the case to the CPVC event operations lead. Do not pass the set to T5 as complete.
