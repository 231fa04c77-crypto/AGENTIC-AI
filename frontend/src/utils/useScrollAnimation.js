import { useEffect, useRef } from 'react'

/**
 * useScrollAnimation
 * Watches .animate-on-scroll elements inside the container ref (or document.body).
 * Uses both IntersectionObserver (scroll trigger) and MutationObserver
 * (catches elements added late, e.g. after an API response).
 *
 * Usage:
 *   const ref = useScrollAnimation()
 *   <section ref={ref}>
 *     <div className="animate-on-scroll">…</div>
 *     <div className="animate-on-scroll stagger-2">…</div>
 *   </section>
 */
const useScrollAnimation = (options = {}) => {
    const ref = useRef(null)

    useEffect(() => {
        const root = ref.current || document.body

        // ── IntersectionObserver: adds 'in-view' when element enters viewport ──
        const io = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('in-view')
                        io.unobserve(entry.target) // one-shot
                    }
                })
            },
            {
                threshold: options.threshold ?? 0.10,
                rootMargin: options.rootMargin ?? '0px 0px -30px 0px',
            }
        )

        // Observe helper – also immediately marks in-view if already visible
        const observe = (el) => {
            // If element is already in the viewport (above the fold), show immediately
            const rect = el.getBoundingClientRect()
            const inViewport =
                rect.top < window.innerHeight && rect.bottom > 0

            if (inViewport) {
                el.classList.add('in-view')
            } else {
                io.observe(el)
            }
        }

        // Observe all current .animate-on-scroll elements
        root.querySelectorAll('.animate-on-scroll').forEach(observe)

        // ── MutationObserver: catches elements added after the initial render ──
        // (e.g. doctor/hospital cards loaded via API)
        const mo = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType !== 1) return // skip text/comment nodes
                    // Check the node itself
                    if (node.classList?.contains('animate-on-scroll')) {
                        observe(node)
                    }
                    // Check descendants
                    node.querySelectorAll?.('.animate-on-scroll').forEach(observe)
                })
            })
        })

        mo.observe(root, { childList: true, subtree: true })

        return () => {
            io.disconnect()
            mo.disconnect()
        }
    }, [options.threshold, options.rootMargin])

    return ref
}

export default useScrollAnimation
