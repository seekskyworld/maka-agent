/**
 * Tests for KeyedMutex — per-key serialization used to make file-mutating tools
 * race-free when the AI SDK runs a step's tool calls concurrently.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { KeyedMutex } from '../keyed-mutex.js';

const tick = () => new Promise<void>((r) => setImmediate(r));

describe('KeyedMutex', () => {
  test('serializes tasks sharing a key, in submission order', async () => {
    const mutex = new KeyedMutex();
    const events: string[] = [];
    const task = (id: string) => mutex.runExclusive('f', async () => {
      events.push(`${id}:start`);
      await tick();
      await tick();
      events.push(`${id}:end`);
    });
    await Promise.all([task('a'), task('b'), task('c')]);
    // No interleaving: each task fully completes before the next starts.
    assert.deepEqual(events, [
      'a:start', 'a:end',
      'b:start', 'b:end',
      'c:start', 'c:end',
    ]);
  });

  test('different keys run concurrently', async () => {
    const mutex = new KeyedMutex();
    const events: string[] = [];
    const task = (key: string, id: string) => mutex.runExclusive(key, async () => {
      events.push(`${id}:start`);
      await tick();
      events.push(`${id}:end`);
    });
    await Promise.all([task('x', 'a'), task('y', 'b')]);
    // Both start before either ends — they did not serialize against each other.
    assert.equal(events[0], 'a:start');
    assert.equal(events[1], 'b:start');
    assert.deepEqual(events.slice(2).sort(), ['a:end', 'b:end']);
  });

  test('no lost update: serialized read-modify-write over a shared cell', async () => {
    const mutex = new KeyedMutex();
    const cell = { value: 0 };
    // Each task reads, yields, then writes read+1. Unserialized, concurrent tasks
    // would all read the same value and the final count would be < N.
    const bump = () => mutex.runExclusive('cell', async () => {
      const seen = cell.value;
      await tick();
      cell.value = seen + 1;
    });
    await Promise.all(Array.from({ length: 20 }, bump));
    assert.equal(cell.value, 20);
  });

  test('a rejecting task does not wedge the key', async () => {
    const mutex = new KeyedMutex();
    const order: string[] = [];
    const failing = mutex.runExclusive('f', async () => {
      order.push('fail');
      throw new Error('boom');
    });
    await assert.rejects(failing, /boom/);
    const after = await mutex.runExclusive('f', async () => {
      order.push('after');
      return 'ok';
    });
    assert.equal(after, 'ok');
    assert.deepEqual(order, ['fail', 'after']);
  });

  test('returns the task result and propagates its rejection to the caller', async () => {
    const mutex = new KeyedMutex();
    assert.equal(await mutex.runExclusive('k', async () => 42), 42);
    await assert.rejects(mutex.runExclusive('k', async () => { throw new Error('nope'); }), /nope/);
  });

  test('reclaims keys once their chain drains', async () => {
    const mutex = new KeyedMutex();
    await Promise.all([
      mutex.runExclusive('a', async () => { await tick(); }),
      mutex.runExclusive('b', async () => { await tick(); }),
    ]);
    // Let the GC microtasks settle.
    await tick();
    await tick();
    assert.equal(mutex.size, 0);
  });
});
