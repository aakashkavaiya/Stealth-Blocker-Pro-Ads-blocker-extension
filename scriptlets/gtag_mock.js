// Stealth Google Tag Manager (gtag) Mock Scriptlet
(function() {
  console.log("[Stealth Blocker] Injecting Google Tag Manager mock scriptlet.");
  const noop = function() {};
  
  // Define standard dataLayer array
  window.dataLayer = window.dataLayer || [];
  
  // Define standard gtag function
  if (!window.gtag) {
    window.gtag = function() {
      window.dataLayer.push(arguments);
    };
  }
  
  // Simulate page view event which is often expected
  window.gtag('js', new Date());
  window.gtag('config', 'UA-MOCK-ID');
  
  // Create mock GoogleTagManager global object
  window.google_tag_manager = window.google_tag_manager || {
    targets: {},
    create: noop,
    get: noop,
    getAll: function() { return []; }
  };
})();
