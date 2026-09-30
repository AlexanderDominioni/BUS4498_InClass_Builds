# Pull registration roster Task Specification

## Basic Information

- **Task ID:** T1
- **Task name:** Pull registration roster
- **Task type:** Retrieve
- **Task owner:** CPVC event operations lead

## 1. Task Description

This task opens the club registration form's stored responses for the current event and returns the full set of registrant records, then checks that the returned set can be read. The workflow needs it because every later task counts, weights, or writes against this roster, and a forecast built on a partial or unreadable roster would be wrong without appearing wrong. The rule applied is fixed: retrieve all records for the current event, confirm that the expected fields are present and parseable, and report the record count. No judgment is exercised about which records to keep.

## 2. Inputs

### Input 1

- **Input name:** Event identifier
- **Contents and format:** The identifier of the event whose registrations are being retrieved, supplied as a single value alongside the checkpoint identity that started the run.
- **Source:** The workflow trigger described in Section 1.2 of workflow-of-tasks.md.

- **If a required input is missing or invalid:** The task stops without returning a roster, records the status as roster unavailable together with the error returned by the data source, and hands the case to H1 Alert organizer to data problem. It does not return a partially retrieved set.

## 3. Outputs

### Output 1

- **Output name:** Registration roster
- **Contents and format:** A structured record set containing one record per registrant, each with a registrant identifier and a registration timestamp, together with the total record count and the event identifier the set was retrieved for.
- **Next task or recipient:** T2 Calculate baseline forecast from historical show rate; T5 Combine statuses into adjusted forecast; T3 Send one opt-in confirmation message at confirmation checkpoints.
- **Complete when:** The record set has been returned, every record parses into the expected fields, and the reported record count matches the number of records returned.

## 4. Planned Tools

### Tool 1

- **Tool name:** retrieve_registration_records
- **Input:** Event identifier
- **Output:** Registration roster
- **Implementation Route:** database queries
- **Integration approach:** direct integration
- **Role in this task:** Queries the stored registration responses for the given event identifier, returns every matching record with its registrant identifier and registration timestamp, and reports the record count. Reads only; changes no stored state.
- **Task timeout:** 90 seconds
- **Maximum retries:** 2
- **Retry only when:** The query times out or returns a connection error, with a 10-second wait between attempts. The tool only reads, so a repeated call cannot duplicate or alter any registration record.
- **On timeout, exhausted retries, or an error that cannot be retried:** Record the status as roster unavailable together with the error returned, and hand the case to H1 Alert organizer to data problem. Do not report a roster as retrieved and do not pass a partial record set to any downstream task.
