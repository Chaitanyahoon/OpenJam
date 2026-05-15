/**
 * Motion Manager
 * Centralizes GSAP animations for the OpenJam frontend to ensure
 * consistency and a premium, app-like feel.
 */

const Motion = {
  /**
   * Staggered entrance for a set of elements
   * @param {string|HTMLElement} target - Selector or element
   * @param {string} type - 'fade-up', 'pop', 'slide-right'
   */
  entrance(target, type = 'fade-up', stagger = 0.1) {
    const elements = typeof target === 'string' ? document.querySelectorAll(target) : [target];
    if (!elements.length) return;

    switch (type) {
      case 'fade-up':
        gsap.from(elements, {
          y: 30,
          opacity: 0,
          duration: 0.8,
          stagger: stagger,
          ease: 'power3.out',
        });
        break;
      case 'pop':
        gsap.from(elements, {
          scale: 0.8,
          opacity: 0,
          duration: 0.5,
          stagger: stagger,
          ease: 'back.out(1.7)',
        });
        break;
      case 'slide-right':
        gsap.from(elements, {
          x: -20,
          opacity: 0,
          duration: 0.6,
          stagger: stagger,
          ease: 'power2.out',
        });
        break;
    }
  },

  /**
   * Slide transition between mobile panels
   * @param {HTMLElement} activePanel - The panel to slide in
   * @param {HTMLElement} inactivePanel - The panel to slide out
   * @param {string} direction - 'left' or 'right'
   */
  slidePanel(activePanel, inactivePanel, direction = 'right') {
    if (!activePanel || !inactivePanel) return;

    const xOffset = direction === 'right' ? '100%' : '-100%';

    // Set initial position of active panel
    gsap.set(activePanel, { x: xOffset, opacity: 0 });

    // Animate both
    gsap.to(inactivePanel, {
      x: direction === 'right' ? '-100%' : '100%',
      opacity: 0,
      duration: 0.4,
      ease: 'power2.inOut',
      onComplete: () => {
        inactivePanel.style.display = 'none';
      }
    });

    gsap.to(activePanel, {
      x: 0,
      opacity: 1,
      duration: 0.4,
      ease: 'power2.inOut',
    });
  },

  /**
   * Springy pop for a single element (e.g., a new chat message)
   * @param {HTMLElement} el
   */
  popElement(el) {
    if (!el) return;
    gsap.from(el, {
      scale: 0.8,
      opacity: 0,
      x: el.classList.contains('self') ? 20 : -20,
      duration: 0.4,
      ease: 'back.out(1.7)',
    });
  },

  /**
   * Smooth zoom/fade for album art transitions
   * @param {HTMLElement} el
   */
  transitionArt(el) {
    if (!el) return;
    gsap.fromTo(el,
      { scale: 1.1, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.6, ease: 'power2.out' }
    );
  }
};

// Export for use in other scripts
window.Motion = Motion;
