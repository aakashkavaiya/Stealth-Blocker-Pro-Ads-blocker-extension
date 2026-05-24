// Stealth Blocker - Isolated World Content Script
// Mediates communications between webpage content and the extension background worker.
(function() {
  'use strict';
  
  console.log("[Stealth Blocker] Isolated content script active.");

  // Request initial configuration from background worker
  chrome.runtime.sendMessage({ action: "getConfig" }, (response) => {
    if (chrome.runtime.lastError) {
      console.warn("[Stealth Blocker] Background script unavailable, running in local fallback mode.");
      return;
    }
    
    if (response) {
      handleConfigUpdate(response.config);
    }
  });

  // Message listener for config changes from popup or background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "updateConfig") {
      handleConfigUpdate(message.config);
      sendResponse({ status: "ok" });
    }
    return true;
  });

  // Process config updates
  function handleConfigUpdate(config) {
    if (!config) return;
    
    console.log("[Stealth Blocker] Received configuration: ", config);
    
    // Manage Cosmetic Engine
    if (window.__stealthCosmeticEngine) {
      if (config.cosmeticFiltering) {
        window.__stealthCosmeticEngine.init();
      } else {
        window.__stealthCosmeticEngine.disable();
      }
    }
  }

  // Listen for fingerprinting block notifications from MAIN world runtime
  window.addEventListener('stealth-fingerprint-blocked', (event) => {
    const type = event.detail?.type || "unknown";
    chrome.runtime.sendMessage({ action: "incrementFingerprintBlocked", type: type }, () => {
      // Ignore runtime errors if background isn't active
      const err = chrome.runtime.lastError;
    });
  });
})();
