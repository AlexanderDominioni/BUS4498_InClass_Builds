# Calculate baseline forecast from historical show rate Task Specification

## Basic Information

- **Task ID:** T2
- **Task name:** Calculate baseline forecast from historical show rate
- **Task type:** Reason
- **Task owner:** CPVC event operations lead

## 1. Task Description

This task multiplies the current registration count by the show rate observed at past club events to produce a first estimate of attendance, and reports the show rate it used alongside the result. The workflow needs it because it establishes the reference point every later forecast is measured against: without it there is nothing to compare a confirmation-weighted forecast to, and at checkpoints where no confirmations exist it is the only forecast available. The rule applied is fixed arithmetic — reconciled registration count multiplied by the stored show rate — with no judgment about whether the rate is appropriate.

## 2. Inputs

### Input 1

- **Input name:** Registration roster
- **Contents and format:** A structured record set containing one record per registrant with a registrant identifier and a registration timestamp, together with the total record count.
- **Source:** T1 Pull registration roster.

### Input 2

- **Input name:** Historical show rate
- **Contents and format:** A single proportion representing the share of registrants who attended at past club events, together with the number of past events it was derived from.
- **Source:** Club event history record maintained by the CPVC event operations lead.

- **If a required input is missing or invalid:** The task stops without producing a forecast, records the status as baseline not produced together with which input was missing or non-numeric, and hands the case to the CPVC event operations lead. It does not substitute a show rate of its own.

## 3. Outputs

### Output 1

- **Output name:** Baseline forecast
- **Contents and format:** A structured record containing a predicted headcount, the registration count it was derived from, the show rate applied, and the number of past events that rate was derived from.
- **Next task or recipient:** T5 Combine statuses into adjusted forecast.
- **Complete when:** A predicted headcount has been returned together with the show rate used, and the headcount is consistent with the registration count and rate supplied.

## 4. Planned Tools

### Tool 1

- **Tool name:** calculate_baseline_forecast
- **Input:** Registration roster; Historical show rate
- **Output:** Baseline forecast
- **Implementation Route:** functions/scripts
- **Integration approach:** direct integration
- **Role in this task:** Multiplies the roster's record count by the supplied show rate and returns the predicted headcount together with both figures it used. Computes only; stores nothing and changes no record.
- **Task timeout:** 30 seconds
- **Maximum retries:** 1
- **Retry only when:** The call fails on a missing or non-numeric field that can be named, with no waiting interval. The calculation is deterministic and writes nothing, so a repeated call on the same input returns the same result.
- **On timeout, exhausted retries, or an error that cannot be retried:** Record the status as baseline not produced, name the input that was missing or unusable, and hand the case to the CPVC event operations lead. Do not return an estimate produced by any other method in place of this one.
