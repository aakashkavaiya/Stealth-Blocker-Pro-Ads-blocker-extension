// Stealth Blocker - Cosmetic Engine
// Implements DOM Cloaking, Shadow DOM Traversal, and Mutation Optimization.
(function() {
  'use strict';
  
  console.log("[Stealth Blocker] Cosmetic Engine active.");

  // Target selectors for ads and placeholders
  const adSelectors = [
    'amp-ad',
    'ins.adsbygoogle',
    'div[class*="ad-banner"]',
    'div[id*="ad-slot"]',
    'div[class*="ad-container"]',
    'iframe[src*="doubleclick"]',
    'iframe[src*="googleads"]',
    'div[id^="google_ads_iframe"]',
    'div[class*="-ad-wrap"]',
    'div[class*="sponsor-box"]',
    'aside[class*="sponsored-links"]'
  ];

  // Map to store already processed nodes to prevent endless loops
  const processedNodes = new WeakSet();

  // Randomized class name for DOM Cloaking
  // Generated per-site load so anti-adblockers cannot build static blacklists for it
  const generateRandomClass = () => 'stlh-' + Math.random().toString(36).substring(2, 8);
  const cloakedClassName = generateRandomClass();
  
  // Create and inject the cloaked stylesheet
  let cloakedStyleElement = null;
  function injectCloakedStyles() {
    if (cloakedStyleElement) return;
    
    cloakedStyleElement = document.createElement('style');
    cloakedStyleElement.id = 'stealth-cosmetic-shield';
    // Use the randomized class with !important to hide matching elements
    cloakedStyleElement.textContent = `
      .${cloakedClassName} {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        height: 0 !important;
        width: 0 !important;
        pointer-events: none !important;
      }
    `;
    
    // Append at the top/head as soon as possible
    (document.head || document.documentElement).appendChild(cloakedStyleElement);
  }

  // Shadow DOM recursive traversal to find selectors inside shadow roots
  function traverseShadowDOM(node, callback) {
    if (!node) return;
    
    // Check if node itself matches ad selectors (if it's an element)
    if (node.nodeType === Node.ELEMENT_NODE) {
      for (const selector of adSelectors) {
        if (node.matches && node.matches(selector)) {
          callback(node);
          break;
        }
      }
      
      // Traverse Shadow Root if it exists
      if (node.shadowRoot) {
        traverseShadowDOM(node.shadowRoot, callback);
      }
    }
    
    // Traverse standard children
    let child = node.firstChild;
    while (child) {
      traverseShadowDOM(child, callback);
      child = child.nextSibling;
    }
  }

  // Efficient batch elements hiding using requestAnimationFrame (Mutation Optimizer)
  let pendingHides = [];
  let isFrameScheduled = false;

  function scheduleHide(element) {
    if (processedNodes.has(element)) return;
    processedNodes.add(element);
    
    pendingHides.push(element);
    
    if (!isFrameScheduled) {
      isFrameScheduled = true;
      requestAnimationFrame(flushHides);
    }
  }

  function flushHides() {
    isFrameScheduled = false;
    const elementsToHide = pendingHides;
    pendingHides = [];

    // Inject styles if they aren't loaded yet
    injectCloakedStyles();

    // Hide elements by assigning the cloaked class
    for (const el of elementsToHide) {
      try {
        el.classList.add(cloakedClassName);
        
        // Dynamic reporting to extension isolated scope (if needed)
        // console.log("[Stealth Blocker] Hiding cosmetic element: ", el);
      } catch (e) {
        // Element might have been detached
      }
    }
  }

  // Scan document for elements to hide
  function scanDOM() {
    traverseShadowDOM(document.documentElement, (element) => {
      scheduleHide(element);
    });
  }

  // Set up optimized MutationObserver to handle dynamically injected ads
  let observer = null;
  function startObserver() {
    if (observer) return;
    
    observer = new MutationObserver((mutations) => {
      let shouldScan = false;
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          // Verify if added nodes are elements or containers
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              shouldScan = true;
              break;
            }
          }
        }
        if (shouldScan) break;
      }
      
      if (shouldScan) {
        scanDOM();
      }
    });
    
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  // Initialize cosmetic engine
  function init() {
    // Inject styles early
    injectCloakedStyles();
    
    // Scan immediately
    scanDOM();
    
    // Start observer for dynamic ad injections
    startObserver();
    
    // Additional scans on states
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', scanDOM);
    }
    window.addEventListener('load', scanDOM);
  }

  // Expose engine controls to content_isolated
  window.__stealthCosmeticEngine = {
    init: init,
    scan: scanDOM,
    disable: function() {
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      if (cloakedStyleElement) {
        cloakedStyleElement.remove();
        cloakedStyleElement = null;
      }
    }
  };

  // Run automatically if active
  init();
})();
