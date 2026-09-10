/**
 * The room the fridge stands in.
 *
 * Three large colour fields drifting slowly behind everything: two cold (the
 * appliance) and one warm (the food), which is what stops the page reading as a
 * single blue wash. They are radial gradients that fade to transparent rather
 * than blurred shapes, so there is no `filter: blur()` on a full-screen element
 * to repaint, and they move by `transform` alone, which the compositor can do
 * without touching layout or paint.
 *
 * No JavaScript: it is markup and a stylesheet, so it costs nothing at runtime
 * and renders identically on the server. It sits behind the content, ignores
 * the pointer, and is hidden from assistive tech — it carries no information.
 *
 * It holds still for anyone who asked for reduced motion; the colour stays, only
 * the drift stops.
 */
export function AmbientBackground() {
  return (
    <div aria-hidden className="ambient">
      <span className="ambient-blob ambient-blob-a" />
      <span className="ambient-blob ambient-blob-b" />
      <span className="ambient-blob ambient-blob-c" />
    </div>
  );
}
