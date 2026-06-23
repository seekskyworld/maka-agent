// packages/runtime/src/keyed-mutex.ts
// A minimal async mutex keyed by an arbitrary string. Tasks sharing a key run
// strictly one-at-a-time, in submission order; tasks with different keys run
// concurrently. Used to serialize file-mutating tools (Write/Edit) on the same
// path so a model emitting two edits to one file in a single step cannot lose an
// update via interleaved read-modify-write (cf. opencode's per-file Semaphore).

/**
 * Serializes async work per key. `runExclusive(key, fn)` waits until any prior
 * work for `key` settles, then runs `fn`, then releases the key for the next
 * waiter. Distinct keys never block each other. Keys are reclaimed once their
 * chain drains, so the internal map does not grow without bound.
 */
export class KeyedMutex {
  private readonly tails = new Map<string, Promise<void>>();

  runExclusive<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.tails.get(key) ?? Promise.resolve();
    // Run fn after prev settles either way: a prior failed task must not wedge
    // the key. `prev.then(fn, fn)` ignores prev's value/error and just sequences.
    const run = prev.then(fn, fn);
    // The next waiter chains off `tail`, which tracks completion only (swallowing
    // result and error) so one task's rejection never propagates down the chain.
    const tail = run.then(() => {}, () => {});
    this.tails.set(key, tail);
    void tail.then(() => {
      // Drop the key once nobody chained after us, so the map stays bounded.
      if (this.tails.get(key) === tail) this.tails.delete(key);
    });
    return run;
  }

  /** Number of keys with in-flight or queued work. Intended for tests/diagnostics. */
  get size(): number {
    return this.tails.size;
  }
}
