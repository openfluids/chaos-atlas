/**
 * URL of the module worker served from public/.
 *
 * GitHub Pages injects a basePath via actions/configure-pages. Next inlines
 * that as process.env.__NEXT_ROUTER_BASEPATH in the client bundle. The unit
 * test calls this with an explicit prefix so the build-time env is not required.
 */
export function diagnosticsWorkerUrl(
  basePath: string = process.env.__NEXT_ROUTER_BASEPATH ?? '',
): string {
  const trimmed = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
  return `${trimmed}/dynachaos-diagnostics.worker.js`;
}
