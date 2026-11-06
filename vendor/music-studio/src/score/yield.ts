/** Lets the page paint. MessageChannel when present, otherwise a timer, plus a frame when the page has one. */
export function yieldToUi(): Promise<void> {
  return new Promise((resolve) => {
    const done = () => resolve();
    // Node: never use MessageChannel (open ports hang the process) and never unref the
    // timer — unref + top-level await caused exit code 13 ("unsettled top-level await").
    const isNode = typeof process !== 'undefined' && !!(process as NodeJS.Process).versions?.node;
    if (isNode) {
      if (typeof setImmediate === 'function') setImmediate(done);
      else setTimeout(done, 0);
      return;
    }
    if (typeof MessageChannel !== 'undefined') {
      const channel = new MessageChannel();
      channel.port1.onmessage = () => {
        try {
          channel.port1.close();
          channel.port2.close();
        } catch { /* ignore */ }
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => done());
        else done();
      };
      channel.port2.postMessage(null);
      return;
    }
    setTimeout(done, 0);
  });
}
