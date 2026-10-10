# Todo List: Mobile App Architecture & Performance Optimization

## Phase 1: Test Runner Performance & Native ESM Seam
- [x] Task 1: Establish Native ESM Test Package Seam & Concurrency <!-- id: 0 -->
  - [x] Create `mobile/test/package.json` with `{"type": "module"}`
  - [x] Update `mobile/package.json` test script with `--test-concurrency`
  - [x] Verify `npm test` runs with zero `[MODULE_TYPELESS_PACKAGE_JSON]` warnings
- [x] Task 2: Implement Microsecond Performance Budget Assertions <!-- id: 1 -->
  - [x] Create `mobile/test/perf_budget.test.ts` for SNTP drift, stream classifier, and chat reconciliation
  - [x] Verify sub-millisecond execution times and 100% pass rate
- [x] Checkpoint: Phase 1 Foundation <!-- id: 2 -->
  - [x] 0 warnings, runtime <1.5s, `npx tsc --noEmit` exits 0

## Phase 2: Room State Slicing & Re-Render Elimination
- [x] Task 3: Decompose Room State Machine into Sliced Contexts <!-- id: 3 -->
  - [x] Create sliced contexts (`RoomPlaybackContext`, `RoomQueueContext`, etc.)
  - [x] Expose fine-grained hooks while retaining full `useRoom()` backward compatibility
- [x] Task 4: Connect Room Consumers to Targeted Slices <!-- id: 4 -->
  - [x] Update `ChatPanel.tsx` to subscribe to chat & reaction slices
  - [x] Update `QueueList.tsx` to subscribe to queue slice
  - [x] Verify zero re-render leakage across state seams
- [x] Checkpoint: Phase 2 State Seams <!-- id: 5 -->
  - [x] All room tests pass, no state desync

## Phase 3: FlatList Virtualization & Render Optimization
- [x] Task 5: Enforce Fixed-Height Layout Adapters on High-Churn Lists <!-- id: 6 -->
  - [x] Implement `getItemLayout` (64dp) on `QueueList.tsx` and windowing on `offline/index.tsx`
  - [x] Add `removeClippedSubviews` and windowing params for 60fps scrolling
- [x] Task 6: Audit and Enforce Image Memory Caching Policies <!-- id: 7 -->
  - [x] Configure `cachePolicy="memory-disk"` and `recyclingKey` on `expo-image`
  - [x] Verify smooth scrolling and zero flicker
- [x] Checkpoint: Phase 3 Production Readiness <!-- id: 8 -->
  - [x] Full test suite passes, 0 TypeScript errors, clean git status

## Phase 4: UI Locality & Precision Scrubber Extraction
- [x] Task 7: Extract Deep PrecisionScrubber Component <!-- id: 9 -->
  - [x] Create `mobile/src/components/player/PrecisionScrubber.tsx`
  - [x] Implement local 200ms position polling and deflection PanResponder
- [x] Task 8: Integrate PrecisionScrubber in SpotifyPlayerModal <!-- id: 10 -->
  - [x] Remove 200ms `setInterval` from `SpotifyPlayerModal`
  - [x] Verify 5Hz modal re-render churn eliminated
- [x] Checkpoint: Phase 4 Locality & Frame Rate <!-- id: 11 -->
  - [x] Full test pass rate, 0 TypeScript errors, clean git status
