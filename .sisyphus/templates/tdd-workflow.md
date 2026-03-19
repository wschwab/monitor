# Test-Driven Development Workflow

> **All Monitor tasks MUST follow this TDD workflow.** Red-green-refactor is non-negotiable.

## Why TDD?

- **Design first, implement second** - Tests document intent before code exists
- **Confidence in changes** - Refactor safely with test coverage
- **Living documentation** - Tests describe expected behavior
- **Catch bugs early** - Failures point directly to the issue

## The Red-Green-Refactor Cycle

### 🔴 RED Phase: Write Failing Test

**Before writing ANY implementation code:**

1. **Identify the behavior to implement** from the task's acceptance criteria
2. **Write a failing test** that describes the expected behavior
3. **Run the test** - it MUST fail with a clear error message
4. **Save evidence**:
   ```bash
   # Run the failing test
   pnpm test --filter @monitor/{package} 2>&1 | tee .sisyphus/evidence/{task-id}-red.txt
   # OR for contracts
   cd contracts && forge test 2>&1 | tee ../.sisyphus/evidence/{task-id}-red.txt
   ```

**Evidence requirements:**
- Test file must exist with descriptive test name(s)
- Test run output showing RED (failure with expected error)
- Failure reason must match what you're about to implement

**Example RED evidence:**
```
FAIL src/spend-ledger.test.ts > spendLedger > recordSpend > should reject duplicate idempotency keys
AssertionError: expected undefined to be 'DUPLICATE_IDEMPOTENCY_KEY'
```

### 🟢 GREEN Phase: Make It Pass

**Write the minimum code to pass:**

1. **Implement only what's needed** to make the failing test pass
2. **Run the test** - it MUST pass
3. **Save evidence**:
   ```bash
   pnpm test --filter @monitor/{package} 2>&1 | tee .sisyphus/evidence/{task-id}-green.txt
   ```

**Evidence requirements:**
- Same test file, now passing
- Test run output showing GREEN (all pass)
- No other test regressions

**Example GREEN evidence:**
```
✓ src/spend-ledger.test.ts > spendLedger > recordSpend > should reject duplicate idempotency keys (5ms)
Test Files  1 passed (1)
Tests  1 passed (1)
```

### 🔄 REFACTOR Phase: Clean Up

**After tests pass, improve the code:**

1. **Refactor for clarity** - rename variables, extract functions
2. **Remove duplication** - DRY principle
3. **Add comprehensive tests** - edge cases, error paths
4. **Run full test suite** - no regressions
5. **Save evidence**:
   ```bash
   pnpm test 2>&1 | tail -20 | tee .sisyphus/evidence/{task-id}-refactor.txt
   ```

## Workflow Checklist

For each task, complete these in order:

- [ ] **RED**: Failing test file committed
- [ ] **RED**: Test run output saved to evidence
- [ ] **GREEN**: Implementation committed
- [ ] **GREEN**: Test run output showing pass
- [ ] **REFACTOR**: Code cleaned up (if needed)
- [ ] **REFACTOR**: Full test suite passes

## Acceptance Criteria Integration

Every task's acceptance criteria should include:

```
**TDD Evidence:**
- `.sisyphus/evidence/{task-id}-red.txt` - Failing test output
- `.sisyphus/evidence/{task-id}-green.txt` - Passing test output
- All tests pass with `pnpm test` (or `forge test` for contracts)
```

## Common Patterns by Task Type

### For TypeScript Packages (backend, web, shared, data-proxy)

```bash
# 1. Create test file
cat > packages/shared/src/new-feature.test.ts << 'EOF'
import { describe, it, expect } from 'vitest';
import { newFeature } from './new-feature';

describe('newFeature', () => {
  it('should do X when Y', () => {
    // Arrange
    const input = { /* ... */ };
    
    // Act & Assert (RED phase - this should fail)
    expect(() => newFeature(input)).toThrow('NOT_IMPLEMENTED');
  });
});
EOF

# 2. Run and save RED evidence
pnpm test --filter @monitor/shared 2>&1 | tee .sisyphus/evidence/{task-id}-red.txt

# 3. Implement
cat > packages/shared/src/new-feature.ts << 'EOF'
export function newFeature(input) {
  // Minimal implementation to make test pass
  // ...
}
EOF

# 4. Run and save GREEN evidence
pnpm test --filter @monitor/shared 2>&1 | tee .sisyphus/evidence/{task-id}-green.txt
```

### For Solidity Contracts

```bash
# 1. Create test file
cat > contracts/test/NewFeature.t.sol << 'EOF'
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/NewFeature.sol";

contract NewFeatureTest is Test {
    function test_ShouldDoX_WhenY() public {
        // Arrange
        NewFeature feature = new NewFeature();
        
        // Act & Assert (RED phase)
        vm.expectRevert("NOT_IMPLEMENTED");
        feature.doSomething();
    }
}
EOF

# 2. Run and save RED evidence
cd contracts && forge test 2>&1 | tee ../.sisyphus/evidence/{task-id}-red.txt

# 3. Implement contract
# ...

# 4. Run and save GREEN evidence
forge test 2>&1 | tee ../.sisyphus/evidence/{task-id}-green.txt
```

## Anti-Patterns to Avoid

| ❌ Anti-Pattern | ✅ Correct Approach |
|----------------|---------------------|
| Write implementation first | Write failing test first |
| `expect(true).toBe(true)` placeholder | Write real test with expected behavior |
| Skip RED evidence | Save failing test output |
| Test only happy path | Test edge cases, errors, boundary conditions |
| Giant test for everything | Small, focused tests for one behavior |

## Task Completion Gate

Before marking a task complete, verify:

```bash
# Check TDD evidence exists
ls -la .sisyphus/evidence/{task-id}-*.txt

# Must have at least:
# - {task-id}-red.txt    (failing test)
# - {task-id}-green.txt  (passing test)

# Verify all tests pass
pnpm test    # TypeScript packages
forge test    # Contracts
```

## References

- Kent Beck, "Test-Driven Development: By Example"
- Martin Fowler, "Refactoring"
- Monitor Work Plan: `.sisyphus/plans/monitor-executor-work-plan.md`