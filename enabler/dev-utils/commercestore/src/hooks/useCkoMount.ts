import { useEffect, useState, type RefObject } from 'react';
import type { EnablerInstance, MountableComponent, DropinBuildOptions } from '../types.ts';

let mountCounter = 0;

/** The enabler mounts by CSS selector, so each container gets a unique id on first use. */
function selectorFor(element: HTMLElement): string {
  if (!element.id) element.id = `cs-mount-${++mountCounter}`;
  return `#${element.id}`;
}

export function useCkoMount(
  component: MountableComponent | null | undefined,
  containerRef: RefObject<HTMLElement>,
): void {
  useEffect(() => {
    const container = containerRef.current;
    if (!component || !container) return;

    container.innerHTML = '';
    component.mount(selectorFor(container)).catch((e: Error) => {
      console.error('Failed to mount component:', e);
    });

    return () => {
      container.innerHTML = '';
    };
  }, [component]); // eslint-disable-line react-hooks/exhaustive-deps
}

export function useDropinMount(
  enabler: EnablerInstance | null,
  containerRef: RefObject<HTMLElement>,
  options: DropinBuildOptions = {},
): boolean {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!enabler || !container) return;
    let cancelled = false;
    setMounted(false);

    (async () => {
      try {
        const builder = await enabler.createDropinBuilder('embedded');
        if (cancelled) return;
        const dropin = builder.build(options);
        await dropin.mount(selectorFor(container));
        if (!cancelled) setMounted(true);
      } catch (e) {
        console.error('Failed to mount dropin:', e);
      }
    })();

    return () => {
      cancelled = true;
      container.innerHTML = '';
    };
  }, [enabler]); // eslint-disable-line react-hooks/exhaustive-deps

  return mounted;
}
