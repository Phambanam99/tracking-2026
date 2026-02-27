export function startRenderer(render: () => void): number {
  return requestAnimationFrame(function frame() {
    render();
    requestAnimationFrame(frame);
  });
}
