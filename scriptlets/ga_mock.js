// Stealth Google Analytics Mock Scriptlet
(function() {
  console.log("[Stealth Blocker] Injecting Google Analytics mock scriptlet.");
  const noop = function() {};
  
  // Define standard ga global
  const ga = function() {
    (ga.q = ga.q || []).push(arguments);
  };
  ga.l = +new Date();
  ga.q = [];
  ga.create = function() { return { get: noop, set: noop, send: noop }; };
  ga.getByName = function() { return { get: noop, set: noop, send: noop }; };
  ga.getAll = function() { return []; };
  ga.remove = noop;
  
  window.ga = ga;
  window.GoogleAnalyticsObject = "ga";
  
  // Mock standard Tracker object properties
  window.AnalyticsTracker = noop;
  
  // Set analytics loaded flag to true to satisfy check scripts
  window._gat = {
    _getTracker: function() { return { _trackPageview: noop, _trackEvent: noop }; },
    _getTrackerByName: function() { return { _trackPageview: noop, _trackEvent: noop }; },
    _createTracker: function() { return { _trackPageview: noop, _trackEvent: noop }; }
  };
})();
