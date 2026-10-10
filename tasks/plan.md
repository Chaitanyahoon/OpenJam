# Implementation Plan: Mobile App Architecture & Performance Optimization

## Overview
Decompose and optimize the OpenJam mobile app architecture and test execution pipeline. Eliminate 44 dynamic runtime reparsing warnings by establishing a native ESM test package seam, implement microsecond performance budget assertions for critical engine contracts, slice the monolithic `RoomContext` into isolated state seams to eliminate re-render cascades, and enforce O(1) geometry layout adapters across virtualized lists for a guaranteed 60fps experience.

---

## Architecture Decisions
1. **Native ESM Package Seam for Tests**: Establish `mobile/test/package.json` with `{"type": "module"}` to eliminate Node.js CommonJS-to-ESM reparsing warnings and enable parallel test worker execution (`--test-concurrency`).
2. **Context Slicing with Unified Leverage Facade**: Decompose the 38-property `RoomApi` into internal sliced contexts (`RoomPlaybackContext`, `RoomQueueContext`, `RoomChatContext`, `RoomReactionsContext`) while preserving `useRoom()` as a backward-compatible consolidated facade.
3. **O(1) Layout Adapters for List Virtualization**: Enforce `getItemLayout`, `removeClippedSubviews`, `maxToRenderPerBatch`, and `windowSize` on all high-churn list surfaces (`QueueList.tsx`, `ChatPanel.tsx`, `offline/index.tsx`) to guarantee 60fps momentum scrolling.
4. **Microsecond Performance Budget Enforcement in CI**: Introduce `perf_budget.test.ts` to assert that core mathematical operations (clock drift evaluation, stream classification, optimistic chat reconciliation) execute within strict microsecond budgets (<0.5ms).

---

## Task List

### Phase 1: Test Runner Performance & Native ESM Seam

#### Task 1: Establish Native ESM Test Package Seam & Concurrency
**Description:** Configure a dedicated package boundary in `mobile/test/` specifying `{"type": "module"}` and update the `npm test` script in `mobile/package.json` to enable concurrent worker execution (`--test-concurrency`), eliminating 44 dynamic reparsing warnings.
**Acceptance criteria:**
- [ ] `mobile/test/package.json` exists with `{"type": "module"}`.
- [ ] `npm test` executes cleanly without any `[MODULE_TYPELESS_PACKAGE_JSON]` warnings.
- [ ] Test execution time drops by &gt;40% on multi-core systems.
**Verification:**
- [ ] Tests pass: `npm test` in `mobile/`
- [ ] Build succeeds: `npx tsc --noEmit` exits with 0
- [ ] Manual check: Verify zero warning lines in test runner stdout.
**Dependencies:** None
**Files likely touched:**
- `mobile/test/package.json`
- `mobile/package.json`
**Estimated scope:** Small (2 files)

#### Task 2: Implement Microsecond Performance Budget Assertions
**Description:** Create `mobile/test/perf_budget.test.ts` to continuously guard and enforce execution performance budgets on core algorithms, including SNTP clock drift compensation, stream classification, chat reconciliation, and damping math.
**Acceptance criteria:**
- [ ] `SyncEngine.evaluateDrift` completes 10,000 iterations in &lt;50ms (&lt;0.005ms/call).
- [ ] `classifyStreamInput` and `parseYouTubeId` complete 5,000 iterations in &lt;30ms.
- [ ] `reconcileIncomingChatMessage` with a 200-message buffer completes in &lt;0.1ms per message.
- [ ] All performance assertions pass reliably without flakiness.
**Verification:**
- [ ] Tests pass: `node --test test/perf_budget.test.ts`
- [ ] Build succeeds: `npx tsc --noEmit` exits with 0
**Dependencies:** Task 1
**Files likely touched:**
- `mobile/test/perf_budget.test.ts`
**Estimated scope:** Small (1 file)

### Checkpoint: Phase 1 (Foundation)
- [ ] All 45+ test suites pass with 0 warnings.
- [ ] `npm test` runtime is sub-1.5 seconds.
- [ ] TypeScript compiler exits with 0 errors.

---

### Phase 2: Room State Slicing & Re-Render Elimination

#### Task 3: Decompose Room State Machine into Sliced Contexts
**Description:** Refactor `mobile/src/state/RoomContext.tsx` to define sliced internal contexts (`RoomPlaybackContext`, `RoomQueueContext`, `RoomChatContext`, `RoomReactionsContext`) while retaining `useRoom()` as a composite facade.
**Acceptance criteria:**
- [ ] Sliced contexts created and provided inside `RoomProvider`.
- [ ] `useRoomPlayback()`, `useRoomQueue()`, `useRoomChatContext()`, and `useRoomReactionsContext()` exposed for fine-grained subscriptions.
- [ ] `useRoom()` continues returning the full `RoomApi` with zero breaking changes.
**Verification:**
- [ ] Tests pass: `npm test` (all room tests pass)
- [ ] Build succeeds: `npx tsc --noEmit` exits with 0
**Dependencies:** Task 1, Task 2
**Files likely touched:**
- `mobile/src/state/RoomContext.tsx`
- `mobile/src/state/slices/roomPlayback.ts`
- `mobile/src/state/slices/roomQueue.ts`
**Estimated scope:** Medium (3 files)

#### Task 4: Connect Room Consumers to Targeted Slices
**Description:** Update `ChatPanel.tsx`, `QueueList.tsx`, and `FlyingReactions.tsx` to consume their dedicated sliced contexts, preventing chat typing or emoji reactions from triggering queue list or player re-renders.
**Acceptance criteria:**
- [ ] `ChatPanel.tsx` consumes `useRoomChatContext()` and `useRoomReactionsContext()`.
- [ ] `QueueList.tsx` consumes `useRoomQueue()` and `useRoomPlayback()`.
- [ ] Typing and emoji bursts do not cause `QueueList` or player re-renders.
**Verification:**
- [ ] Tests pass: `npm test`
- [ ] Build succeeds: `npx tsc --noEmit` exits with 0
**Dependencies:** Task 3
**Files likely touched:**
- `mobile/src/components/ChatPanel.tsx`
- `mobile/src/components/QueueList.tsx`
- `mobile/src/components/FlyingReactions.tsx`
**Estimated scope:** Medium (3 files)

### Checkpoint: Phase 2 (State Seams)
- [ ] Chat updates and reactions operate with zero re-render leakage to queue and player views.
- [ ] 100% test pass rate maintained.

---

### Phase 3: FlatList Virtualization & Render Optimization

#### Task 5: Enforce Fixed-Height Layout Adapters on High-Churn Lists
**Description:** Implement `getItemLayout`, `removeClippedSubviews={true}`, and tuned windowing parameters (`windowSize={5}`, `maxToRenderPerBatch={10}`) across `QueueList.tsx`, `ChatPanel.tsx`, and `app/offline/index.tsx`.
**Acceptance criteria:**
- [ ] `QueueList.tsx` implements O(1) `getItemLayout` for track rows (68dp height).
- [ ] `offline/index.tsx` implements `getItemLayout` for offline playlist and vault tracks.
- [ ] `removeClippedSubviews` enabled to unmount off-screen subviews and clamp heap memory.
**Verification:**
- [ ] Tests pass: `npm test`
- [ ] Build succeeds: `npx tsc --noEmit` exits with 0
- [ ] Manual check: Fast scrolling on 100+ track queues remains fluid at 60fps.
**Dependencies:** Task 4
**Files likely touched:**
- `mobile/src/components/QueueList.tsx`
- `mobile/src/app/offline/index.tsx`
**Estimated scope:** Small (2 files)

#### Task 6: Audit and Enforce Image Memory Caching Policies
**Description:** Configure explicit disk and memory caching policies (`cachePolicy="memory-disk"`, `recyclingKey`) across `expo-image` usages in list rows (`QueueList.tsx`, `RoomCard.tsx`, `offline/index.tsx`).
**Acceptance criteria:**
- [ ] High-frequency list item images utilize `cachePolicy="memory-disk"`.
- [ ] Fast scrolling does not flash empty placeholders for previously rendered album artwork.
**Verification:**
- [ ] Tests pass: `npm test`
- [ ] Build succeeds: `npx tsc --noEmit` exits with 0
**Dependencies:** Task 5
**Files likely touched:**
- `mobile/src/components/QueueList.tsx`
- `mobile/src/components/RoomCard.tsx`
- `mobile/src/app/offline/index.tsx`
**Estimated scope:** Small (3 files)

### Checkpoint: Phase 3 (Production Readiness)
- [ ] All acceptance criteria met across Phases 1-3.
- [ ] Zero TypeScript errors and 100% test pass rate in mobile and backend.

---

## Risks and Mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| `test/package.json` with `{"type": "module"}` interferes with Metro bundler | High | `test/` is excluded from Metro build configuration via `metro.config.js` and `tsconfig.json`. Verify Metro build and tests independently. |
| Context slicing introduces state synchronization delay between slices | Medium | Slices are computed from the same single source of truth in `RoomProvider`; state changes commit in the same React render pass. |
| Fixed height `getItemLayout` causes clipping if track titles wrap onto multiple lines | Medium | Standardize track rows with strict `numberOfLines={1}` with ellipsis truncation to guarantee constant height geometry. |

---

## Open Questions
- None. All architectural seams adhere strictly to `/codebase-design` and maintain 100% backward compatibility.
