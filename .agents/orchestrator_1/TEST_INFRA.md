# E2E Test Infra: AAI VABO IT Asset Management System

## Test Philosophy
- Opaque-box, requirement-driven. No dependency on implementation internal state.
- Derived strictly from `ORIGINAL_REQUEST.md` and user specifications.
- Methodology: Category-Partition + Boundary Value Analysis (BVA) + Pairwise Combinatorial Testing + Real-World Workload Testing.
- Progressive testability: Tier 1 tests verify fundamental paths; Tier 2 stresses boundaries; Tier 3 evaluates feature pairings; Tier 4 executes realistic multi-step airport IT workflows.

## Feature Inventory Coverage Matrix
| # | Feature | Source (Requirement) | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
|---|---------|----------------------|:------:|:------:|:------:|:------:|
| 1 | User Auth & JWT | R1, ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| 2 | User Registration & Unique Constraint | R1, ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | |
| 3 | Admin User Management & RBAC | R1, ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| 4 | Single Asset Registration & Tagging | R1, ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| 5 | Multi-Asset Entry Wizard & Atomicity | R1, R3, ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| 6 | Handover Workflow & Reference Voucher | R1, ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| 7 | Takeover Workflow & Store Reset | R1, ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| 8 | Physical Asset Holder Tracking | R1, ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| 9 | 18 Standard Fields CSV Export (BOM) | R1, ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| 10 | Bulk CSV Import & UPSERT | R1, R3, ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| 11 | Printable Slips & Terms | R1, R2, ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| 12 | Audit Trail & Diff Tracking | R1, R3, ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ | ✓ |
| 13 | Asset Deletion Safeguards | R1, R3, ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | |
| 14 | Asset Lifecycle (4 States) | R1, ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| 15 | Mutual Asset Linking | R1, ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | |
| 16 | UI States & Keyboard Accessibility | R2, ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ | ✓ |

## Test Architecture
- **Test Runner**: Node.js test runner (`node --test`), capable of executing unit, integration, and E2E browser tests.
- **Test Invocation**:
  - Full suite: `npm test`
  - Integration: `node --test tests/integration/*.test.js`
  - Unit: `node --test tests/unit/*.test.js`
  - Browser E2E: `node --test tests/e2e/*.test.js`
- **Pass/Fail Semantics**: Exit code 0 on 100% pass, non-zero on any failure.
- **Isolation**: Each test suite creates an isolated SQLite test database in a temporary directory (`os.tmpdir()`) or memory, and boots an isolated Express instance on a dynamic port (`0`).
- **Directory Layout**:
  - `tests/unit/`: Pure function and utility unit tests (`utils.test.js`, `tags.test.js`).
  - `tests/integration/`: API endpoint and database integration tests (`auth.test.js`, `assets.test.js`, `transactions.test.js`, `csv.test.js`).
  - `tests/e2e/`: Browser automation and full lifecycle tests (`browser.test.js`, `workflows.test.js`).

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | **New Employee Equipment Provisioning** | Multi-Asset Wizard, Handover, IP/Hostname binding, Printable Slip, Audit Log | High |
| 2 | **Employee Shift Department Transfer & Hardware Return** | Handover, Takeover to IT Store, Field Reset, Employee Trail verification | High |
| 3 | **Annual Airport IT Asset Audit & CSV Reconciliation** | 18-field CSV Export with UTF-8 BOM, bulk edits, re-import via UPSERT, collision check | High |
| 4 | **Security Forensics & Audit Log Modification Trail** | Handover, Admin record edit, JSON diff tracking in `edit_history`, soft delete protection | High |
| 5 | **RBAC Boundary & User Lifecycle** | Admin creates user, role enforcement, unauthorized asset deletion block, password self-service | High |

## Coverage Thresholds
- **Tier 1**: ≥5 per feature (16 features × 5 = 80 test cases)
- **Tier 2**: ≥5 per feature boundary (16 features × 5 = 80 test cases)
- **Tier 3**: 12 major cross-feature interaction test cases
- **Tier 4**: 5 realistic application-level enterprise scenarios
- **Browser E2E**: Automated browser tests for Login, Inventory CRUD, Handover slips, CSV export, and modal a11y.
- **Total Minimum Target**: ≥177 test cases with 100% pass rate.
