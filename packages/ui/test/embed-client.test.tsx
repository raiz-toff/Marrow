// @vitest-environment happy-dom
/**
 * MarrowEmbed in a browser-like DOM: what the frame is loaded with, and how
 * the component reacts to (or the absence of) the diagram's ready message.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { MarrowEmbed } from '@marrow/ui';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// happy-dom does not load iframe pages, but a srcdoc frame gets a window —
// the message tests use `html` so `e.source` can be a real frame window.
const DOC = '<!doctype html><html><body>diagram</body></html>';

let host: HTMLDivElement;
let root: Root;

function render(node: React.ReactNode) {
  act(() => root.render(node));
  return [...host.querySelectorAll('iframe')];
}

function ready(frame: HTMLIFrameElement) {
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'marrow:ready' }, source: frame.contentWindow }));
  });
}

beforeEach(() => {
  document.documentElement.className = '';
  document.documentElement.removeAttribute('data-theme');
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('theme resolved at render', () => {
  test('host class="dark" goes on the first URL', () => {
    document.documentElement.classList.add('dark');
    const [frame] = render(<MarrowEmbed src="/d.html" />);
    expect(frame!.getAttribute('src')).toBe('/d.html#chrome=minimal;theme=dark');
  });

  test('data-theme="light" beats a dark OS scheme', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true, addEventListener() {}, removeEventListener() {} } as never);
    document.documentElement.setAttribute('data-theme', 'light');
    const [frame] = render(<MarrowEmbed src="/d.html" minimap="off" />);
    expect(frame!.getAttribute('src')).toBe('/d.html#chrome=minimal;minimap=off;theme=light');
  });

  test('without host hints the OS scheme decides', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true, addEventListener() {}, removeEventListener() {} } as never);
    const [frame] = render(<MarrowEmbed src="/d.html" />);
    expect(frame!.getAttribute('src')).toContain('theme=dark');
  });

  test('a later host flip is posted, not baked into a new URL', async () => {
    const [frame] = render(<MarrowEmbed html={DOC} />);
    const post = vi.spyOn(frame!.contentWindow!, 'postMessage');
    ready(frame!);
    expect(post).toHaveBeenLastCalledWith({ type: 'marrow:theme', theme: 'light' }, '*');
    // MutationObserver callbacks are async: let them run inside act
    await act(async () => {
      document.documentElement.classList.add('dark');
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(post).toHaveBeenLastCalledWith({ type: 'marrow:theme', theme: 'dark' }, '*');
    // the srcdoc keeps its first theme: a flip must not reload the document
    expect(frame!.getAttribute('srcdoc')).toContain('data-theme="light"');
  });
});

describe('html (srcdoc) mode', () => {
  test('flags and the resolved theme are written onto <html>', () => {
    document.documentElement.classList.add('dark');
    const markup = '<!doctype html><html lang="en" data-theme="light" data-theme-mode="auto"><body></body></html>';
    const [frame] = render(<MarrowEmbed html={markup} inspector="off" minimap="off" />);
    expect(frame!.getAttribute('srcdoc')).toBe(
      '<!doctype html><html lang="en" data-chrome="minimal" data-inspector="off" data-minimap="off" data-theme="dark"><body></body></html>',
    );
    expect(frame!.hasAttribute('src')).toBe(false);
  });
});

describe('load state', () => {
  test('no marrow:ready within loadTimeout → onError and the fallback', () => {
    vi.useFakeTimers();
    const onError = vi.fn();
    render(<MarrowEmbed src="/missing.html" onError={onError} loadTimeout={5000} fallback={<p>gone</p>} />);
    expect(host.querySelector('[role="status"]')).not.toBeNull();
    act(() => vi.advanceTimersByTime(4999));
    expect(onError).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]![0]).toBeInstanceOf(Error);
    expect(host.textContent).toContain('gone');
    expect(host.querySelector('[role="status"]')).toBeNull();
  });

  test('the default timeout is 8 s and the default fallback offers the file', () => {
    vi.useFakeTimers();
    render(<MarrowEmbed src="/missing.html" />);
    act(() => vi.advanceTimersByTime(8000));
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('did not load');
  });

  test('ready clears the spinner and cancels the timeout', () => {
    vi.useFakeTimers();
    const onReady = vi.fn();
    const onError = vi.fn();
    const [frame] = render(<MarrowEmbed html={DOC} onReady={onReady} onError={onError} />);
    ready(frame!);
    act(() => vi.advanceTimersByTime(10_000));
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
    expect(host.querySelector('[role="status"]')).toBeNull();
  });

  test('ready messages are matched to their own frame (e.source)', () => {
    const a = vi.fn();
    const b = vi.fn();
    const frames = render(
      <>
        <MarrowEmbed html={DOC} onReady={a} />
        <MarrowEmbed html={DOC} onReady={b} />
      </>,
    );
    ready(frames[1]!);
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);
    act(() => window.dispatchEvent(new MessageEvent('message', { data: { type: 'marrow:ready' } })));
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);
  });

  test('the ref is the iframe', () => {
    const ref = { current: null as HTMLIFrameElement | null };
    render(<MarrowEmbed src="/d.html" ref={ref} />);
    expect(ref.current).toBe(host.querySelector('iframe'));
  });
});

describe('fullscreen', () => {
  test('falls back to a fixed overlay without the Fullscreen API; Escape exits', () => {
    render(<MarrowEmbed src="/d.html" />);
    const wrapper = host.firstElementChild as HTMLElement;
    Object.defineProperty(wrapper, 'requestFullscreen', { value: undefined });
    act(() => (host.querySelector('button[title="Fullscreen"]') as HTMLButtonElement).click());
    expect(wrapper.className).toContain('fixed inset-0 z-50');
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
    expect(wrapper.className).not.toContain('fixed');
  });
});
