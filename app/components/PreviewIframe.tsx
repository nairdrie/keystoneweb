'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type CleanupFn = () => void;

/**
 * Renders its children inside an iframe so their viewport matches the
 * iframe's dimensions (not the parent window's). This is what makes
 * Tailwind responsive utilities and any custom block @media queries
 * actually fire at the simulated device width.
 *
 * Implementation: standard "portal into iframe document" pattern.
 *  - iframe is mounted with about:blank content.
 *  - On load we clone every <link rel="stylesheet"> and <style> from the
 *    parent <head> into the iframe <head> so the same compiled CSS
 *    (Tailwind included) is available inside.
 *  - A MutationObserver watches the parent <head> so styles injected
 *    later (HMR, lazy chunks, font links, etc.) get mirrored too.
 *  - React.createPortal mounts the children into iframe.contentDocument.
 *    Since this stays the same React tree, all contexts propagate.
 */
export default function PreviewIframe({
    bodyClassName,
    style,
    children,
}: {
    bodyClassName?: string;
    style?: React.CSSProperties;
    children: React.ReactNode;
}) {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [mountNode, setMountNode] = useState<HTMLElement | null>(null);

    // Keep the iframe body's className synced with the prop after mount.
    useEffect(() => {
        const iframe = iframeRef.current;
        const body = iframe?.contentDocument?.body;
        if (body) body.className = bodyClassName ?? '';
    }, [bodyClassName, mountNode]);

    useEffect(() => {
        const iframe = iframeRef.current;
        if (!iframe) return;
        let disposed = false;
        const cleanups: CleanupFn[] = [];

        const init = () => {
            if (disposed) return;
            const doc = iframe.contentDocument;
            if (!doc) return;

            // Make sure the inner doc has a sane base layout. We don't want
            // the iframe scrollbars to compete with the inner content's own
            // scrolling — the body is the scroll container.
            doc.documentElement.style.height = '100%';
            doc.body.style.margin = '0';
            doc.body.style.minHeight = '100%';
            doc.body.style.background = '#ffffff';
            if (bodyClassName) doc.body.className = bodyClassName;

            // Initial style/link clone.
            const cloneInto = (node: Element) => {
                // Avoid duplicates if we re-clone after HMR.
                const tagName = node.tagName.toLowerCase();
                if (tagName !== 'link' && tagName !== 'style') return;
                if (tagName === 'link' && node.getAttribute('rel') !== 'stylesheet') return;
                doc.head.appendChild(node.cloneNode(true));
            };
            Array.from(document.head.children).forEach(cloneInto);

            // Mirror future stylesheet/style additions. New <style> from HMR
            // or font links injected post-mount need to flow into the iframe
            // so its rendering stays in sync with the parent's.
            const obs = new MutationObserver((muts) => {
                for (const m of muts) {
                    m.addedNodes.forEach((node) => {
                        if (node instanceof Element) cloneInto(node);
                    });
                }
            });
            obs.observe(document.head, { childList: true });
            cleanups.push(() => obs.disconnect());

            setMountNode(doc.body);
        };

        // Force the iframe into a known empty state, then run init. about:blank
        // fires `load` synchronously in some browsers, asynchronously in others
        // — handle both by checking readyState.
        if (iframe.contentDocument && iframe.contentDocument.readyState === 'complete') {
            init();
        } else {
            iframe.addEventListener('load', init);
            cleanups.push(() => iframe.removeEventListener('load', init));
        }

        return () => {
            disposed = true;
            cleanups.forEach((c) => c());
            setMountNode(null);
        };
    }, [bodyClassName]);

    return (
        <>
            <iframe
                ref={iframeRef}
                className="ks-preview-iframe"
                style={style}
                title="Device preview"
                // about:blank ensures we own the document and avoid same-origin
                // surprises with arbitrary src URLs.
                src="about:blank"
            />
            {mountNode && createPortal(children, mountNode)}
        </>
    );
}
