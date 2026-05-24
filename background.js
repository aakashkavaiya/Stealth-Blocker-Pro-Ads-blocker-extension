// Stealth Blocker - Background Service Worker
// Orchestrates MV3 state, WebRTC policies, DNR controls, and Native Messaging bridge.

// Default configuration settings
const DEFAULT_CONFIG = {
  adBlockEnabled: true,
  cosmeticFiltering: true,
  fingerprintShield: true,
  dynamicCnameUncloaking: true,
  webRTCProtection: true
};

let currentConfig = { ...DEFAULT_CONFIG };
let nativePort = null;
let connectionStatus = "Disconnected";

// Live stats counter
let stats = {
  blockedAds: 0,
  blockedTrackers: 0,
  spoofedFingerprints: 0,
  webrtcBlocks: 0,
  cnameResolutions: 0
};

// CNAME cache to avoid thrashing native bridge
const cnameCache = new Map();

// Initialize service worker
chrome.runtime.onInstalled.addListener(() => {
  console.log("[Stealth Blocker] Background SW Installed.");
  chrome.storage.local.set({ config: currentConfig, stats: stats }, () => {
    applyConfig();
  });
});

// Load config and statistics on startup
chrome.storage.local.get(["config", "stats"], (result) => {
  if (result.config) currentConfig = result.config;
  if (result.stats) stats = result.stats;
  
  applyConfig();
  connectNativeBackend();
});

// ==========================================
// 1. NATIVE MESSAGING BRIDGE CLIENT
// ==========================================
function connectNativeBackend() {
  if (!currentConfig.dynamicCnameUncloaking) {
    disconnectNativeBackend();
    return;
  }

  if (nativePort) return;

  console.log("[Stealth Blocker] Connecting to Rust Native Backend...");
  try {
    nativePort = chrome.runtime.connectNative("com.stealth.blocker");
    connectionStatus = "Connected";

    nativePort.onMessage.addListener((msg) => {
      handleNativeMessage(msg);
    });

    nativePort.onDisconnect.addListener(() => {
      console.warn("[Stealth Blocker] Disconnected from Rust Native Backend. Error: ", chrome.runtime.lastError);
      nativePort = null;
      connectionStatus = "Disconnected";
    });
  } catch (e) {
    console.error("[Stealth Blocker] Native Messaging connection failed: ", e);
    connectionStatus = "Failed";
  }
}

function disconnectNativeBackend() {
  if (nativePort) {
    nativePort.disconnect();
    nativePort = null;
  }
  connectionStatus = "Disconnected";
}

function sendNativeMessage(msg) {
  if (nativePort) {
    try {
      nativePort.postMessage(msg);
    } catch (e) {
      console.error("[Stealth Blocker] Error sending to Native: ", e);
    }
  }
}

function handleNativeMessage(msg) {
  console.log("[Stealth Blocker] Message from Native Backend: ", msg);
  if (msg.type === "cname_resolution") {
    const { domain, resolved_cname, is_tracker } = msg;
    cnameCache.set(domain, { resolved_cname, is_tracker });
    
    stats.cnameResolutions++;
    if (is_tracker) {
      stats.blockedTrackers++;
      console.log(`[Stealth Blocker] CNAME Unmasked tracker blocked: ${domain} -> ${resolved_cname}`);
      // In a production build, dynamically add DNR rule to block this domain
      blockDomainDynamically(domain);
    }
    
    saveStats();
  }
}

// Dynamically add domain to DNR dynamic rules if Rust unmasks it as tracker
let dynamicRuleId = 10000;
async function blockDomainDynamically(domain) {
  try {
    dynamicRuleId++;
    await chrome.declarativeNetRequest.updateDynamicRules({
      addRules: [{
        id: dynamicRuleId,
        priority: 2,
        action: { type: "block" },
        condition: {
          urlFilter: `||${domain}`,
          resourceTypes: ["script", "xmlhttprequest", "image"]
        }
      }]
    });
  } catch (e) {
    console.error(`[Stealth Blocker] Failed to dynamically block unmasked domain: ${domain}`, e);
  }
}

// ==========================================
// 2. CONFIGURATION ENGINE & POLICIES
// ==========================================
function applyConfig() {
  // A. WebRTC Leak Protector Policy
  if (chrome.privacy && chrome.privacy.network) {
    const policy = currentConfig.webRTCProtection 
      ? 'disable_non_proxied_udp' 
      : 'default';
    
    chrome.privacy.network.webRTCIPHandlingPolicy.set({ value: policy }, () => {
      if (chrome.runtime.lastError) {
        console.warn("[Stealth Blocker] Failed to set WebRTC IP Policy: ", chrome.runtime.lastError);
      } else {
        console.log(`[Stealth Blocker] WebRTC IP policy updated to: ${policy}`);
        if (currentConfig.webRTCProtection) stats.webrtcBlocks++;
      }
    });
  }

  // B. Declarative Net Request Ruleset Toggle
  const rulesetId = "ruleset_1";
  chrome.declarativeNetRequest.updateEnabledRulesets({
    [currentConfig.adBlockEnabled ? "enableRulesetIds" : "disableRulesetIds"]: [rulesetId]
  }, () => {
    if (chrome.runtime.lastError) {
      console.error("[Stealth Blocker] DNR ruleset update error: ", chrome.runtime.lastError);
    } else {
      console.log(`[Stealth Blocker] Static adblock rules ruleset status: ${currentConfig.adBlockEnabled}`);
    }
  });

  // C. Toggle Native Connection state
  if (currentConfig.dynamicCnameUncloaking) {
    connectNativeBackend();
  } else {
    disconnectNativeBackend();
  }
}

// ==========================================
// 3. TELEMETRY STATS COLLECTOR
// ==========================================
// Capture matching rules to update stats (only works when compiled for Dev, but we also increment dynamically)
if (chrome.declarativeNetRequest.onRuleMatchedDebug) {
  chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
    if (info.rule.rulesetId === "ruleset_1") {
      stats.blockedAds++;
      saveStats();
    }
  });
}

// Intercept CNAME validation logic on requests
chrome.webRequest?.onBeforeRequest.addListener(
  (details) => {
    if (!currentConfig.dynamicCnameUncloaking || connectionStatus !== "Connected") return;
    
    const url = new URL(details.url);
    const domain = url.hostname;
    
    // Ignore direct IP requests and obvious third parties
    if (/^[0-9.]+$/.test(domain) || domain.split('.').length < 3) return;

    // Check if CNAME result already cached
    if (cnameCache.has(domain)) {
      const cached = cnameCache.get(domain);
      if (cached.is_tracker) {
        stats.blockedTrackers++;
        saveStats();
        return { cancel: true };
      }
      return;
    }

    // Send query to Rust backend over Native Messaging to uncloak CNAME
    sendNativeMessage({
      action: "resolve_cname",
      domain: domain
    });
  },
  { urls: ["<all_urls>"] }
);

function saveStats() {
  chrome.storage.local.set({ stats });
  // Notify open popups of live statistic updates
  chrome.runtime.sendMessage({ action: "statsUpdated", stats, connectionStatus });
}

// Save stats periodically on timer
setInterval(saveStats, 10000);

// ==========================================
// 4. MESSAGE DISPATCHER
// ==========================================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getConfig") {
    sendResponse({ config: currentConfig, connectionStatus, stats });
  } else if (message.action === "updateConfig") {
    currentConfig = { ...currentConfig, ...message.config };
    chrome.storage.local.set({ config: currentConfig }, () => {
      applyConfig();
      sendResponse({ status: "success", connectionStatus });
    });
  } else if (message.action === "getStats") {
    sendResponse({ stats, connectionStatus });
  } else if (message.action === "resetStats") {
    stats = {
      blockedAds: 0,
      blockedTrackers: 0,
      spoofedFingerprints: 0,
      webrtcBlocks: 0,
      cnameResolutions: 0
    };
    saveStats();
    sendResponse({ stats });
  } else if (message.action === "incrementFingerprintBlocked") {
    stats.spoofedFingerprints++;
    saveStats();
    sendResponse({ status: "ok" });
  }
  return true;
});
