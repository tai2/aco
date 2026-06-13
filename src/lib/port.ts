import { createServer } from 'node:net';

export function pickFreePort(preferred = 4723): Promise<number> {
  return new Promise((resolve, reject) => {
    const tryListen = (p: number, retryOnEaddr: boolean) => {
      const srv = createServer();
      srv.unref();
      srv.once('error', (err: NodeJS.ErrnoException) => {
        if (retryOnEaddr && err.code === 'EADDRINUSE') {
          tryListen(0, false);
        } else {
          reject(err);
        }
      });
      srv.listen(p, () => {
        const addr = srv.address();
        const port = typeof addr === 'object' && addr ? addr.port : p;
        srv.close(() => resolve(port));
      });
    };
    tryListen(preferred, true);
  });
}
