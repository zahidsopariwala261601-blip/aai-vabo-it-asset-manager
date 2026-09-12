# Dispatch: Explorer Survey 3 / Spec Miner (Specification & Test Automation Framework)

## Role & Mission
You are Spec Miner / Explorer 3 on the AAI VABO IT Asset Management project.
Your mission is to perform a comprehensive specification extraction from ORIGINAL_REQUEST.md, codebase documentation, package.json scripts, and test infrastructure to map out the complete Feature Inventory and testing framework (Tiers 1-4 + E2E Playwright/Node).

## Authoritative User Request
Path: c:\Users\Zahid\Desktop\IT_Asset_managment\IT_Asset_managment\.agents\ORIGINAL_REQUEST.md
(Read this file thoroughly first!)

## Investigation Scope
1. Specification Extraction:
   - Extract every single requirement, acceptance criterion, edge case, and constraint from ORIGINAL_REQUEST.md and code comments/docs.
   - Enumerate all 18 standard fields: ID, Asset_Tag, Asset Type, Serial, Charger_Serial, Monitor_Make, Monitor_Serial, Keyboard_Make, Mouse_Make, Make, Model, IP, Hostname, Holder, Physical_Asset_Holder, Department, Designation, Year_of_Purchase.
   - Map exact requirements for: Asset lifecycle, Handover/Takeover printable slips, CSV import/export with UTF-8 BOM, Account Manager RBAC & JWT, 8 standard UI states, SQLite integrity & transactions, automated test pass criteria.
2. Current Test Infrastructure Audit:
   - What test runners exist in package.json (`npm test`, Jest, Mocha, Playwright, Vitest, Node test runner)?
   - Existing unit, integration, and E2E test files.
   - Current test execution status and failure points if any.
3. E2E Test Suite Architecture Design (Tiers 1-4):
   - Tier 1: Feature Coverage (>=5 per feature)
   - Tier 2: Boundary & Corner Cases (>=5 per feature)
   - Tier 3: Cross-Feature Combinations (Pairwise)
   - Tier 4: Real-World Application Scenarios
   - Playwright / Node browser automation setup for full E2E verification.

## Output Requirements
Write a detailed, structured report to:
`c:\Users\Zahid\Desktop\IT_Asset_managment\IT_Asset_managment\.agents\explorer_survey_3\handoff.md`
Including:
- Exhaustive Feature Inventory table (Feature #, Feature Name, Requirements, Verification Criteria)
- Test Infra audit findings and gaps
- Proposed E2E testing framework architecture and test run command
- Recommendations for TEST_INFRA.md and TEST_READY.md benchmarks
Send a completion message back to orchestrator once `handoff.md` is complete.

## 2026-09-12T11:36:34Z
You are Spec Miner / Explorer 3 (Specification Extraction & Test Framework Survey) for the AAI VABO IT Asset Management project.
Your working directory is: c:\Users\Zahid\Desktop\IT_Asset_managment\IT_Asset_managment\.agents\explorer_survey_3
Your task assignment is in: c:\Users\Zahid\Desktop\IT_Asset_managment\IT_Asset_managment\.agents\explorer_survey_3\DISPATCH.md
Read the authoritative user request at: c:\Users\Zahid\Desktop\IT_Asset_managment\IT_Asset_managment\.agents\ORIGINAL_REQUEST.md

Extract an exhaustive Feature Inventory from ORIGINAL_REQUEST.md and codebase documentation/code. Audit the existing test infrastructure (package.json scripts, unit/integration/E2E test files, test runners). Design the 4-tier E2E testing architecture (Tier 1: >=5 per feature, Tier 2: >=5 boundary cases per feature, Tier 3: pairwise combinations, Tier 4: realistic application scenarios, plus Playwright/Node browser automation setup).
Perform read-only investigation. DO NOT modify any code.
Write your exhaustive specification and test framework report to:
c:\Users\Zahid\Desktop\IT_Asset_managment\IT_Asset_managment\.agents\explorer_survey_3\handoff.md
When finished, send a message to parent orchestrator with your summary and handoff path.
