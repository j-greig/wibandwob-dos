export interface RenderSchedulerCallbacks {
  sync: () => void;
  persist: () => void;
  render: () => void;
  scheduleFlush?: (flush: () => void) => void;
}

export interface RenderScheduler {
  requestSync: () => void;
  requestPersist: () => void;
  requestRender: () => void;
  flushNow: () => void;
}

/**
 * Tiny app-level invalidation seam above Blessed.
 *
 * Intent is tracked separately:
 * - requestSync() updates cheap in-memory/live state
 * - requestPersist() records a heavier checkpoint and subsumes sync
 * - requestRender() commits the current widget tree to the terminal
 *
 * The scheduler batches repeated requests into one flush so callers can express
 * intent without each path deciding final render timing for itself.
 *
 * Existing direct screen.render() calls from unconverted windows still work.
 * This seam only governs callers that opt in.
 */
export function createRenderScheduler(callbacks: RenderSchedulerCallbacks): RenderScheduler {
  let syncRequested = false;
  let persistRequested = false;
  let renderRequested = false;
  let flushScheduled = false;
  const scheduleFlush = callbacks.scheduleFlush ?? ((flush: () => void) => queueMicrotask(flush));

  const flush = () => {
    flushScheduled = false;
    if (!syncRequested && !persistRequested && !renderRequested) {
      return;
    }

    const shouldPersist = persistRequested;
    const shouldSync = syncRequested && !shouldPersist;
    const shouldRender = renderRequested;

    syncRequested = false;
    persistRequested = false;
    renderRequested = false;

    if (shouldSync) {
      callbacks.sync();
    }
    if (shouldPersist) {
      callbacks.persist();
    }
    if (shouldRender) {
      callbacks.render();
    }
  };

  const ensureFlushScheduled = () => {
    if (flushScheduled) {
      return;
    }
    flushScheduled = true;
    scheduleFlush(flush);
  };

  return {
    requestSync: () => {
      syncRequested = true;
      ensureFlushScheduled();
    },
    requestPersist: () => {
      persistRequested = true;
      ensureFlushScheduled();
    },
    requestRender: () => {
      renderRequested = true;
      ensureFlushScheduled();
    },
    flushNow: flush,
  };
}
