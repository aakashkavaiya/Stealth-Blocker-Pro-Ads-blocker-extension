// Stealth Blocker Pro - Popup Dashboard Logic

document.addEventListener("DOMContentLoaded", () => {
  // Elements
  const badge = document.getElementById("backend-status-badge");
  const badgeText = document.getElementById("backend-status-text");
  
  const statAds = document.getElementById("stat-ads");
  const statTrackers = document.getElementById("stat-trackers");
  const statFingerprints = document.getElementById("stat-fingerprints");
  const statCnames = document.getElementById("stat-cnames");

  const toggleAdblock = document.getElementById("toggle-adblock");
  const toggleCosmetic = document.getElementById("toggle-cosmetic");
  const toggleFingerprint = document.getElementById("toggle-fingerprint");
  const toggleCname = document.getElementById("toggle-cname");
  const toggleWebrtc = document.getElementById("toggle-webrtc");

  const btnReset = document.getElementById("btn-reset");

  // Load configuration and initial statistics
  chrome.runtime.sendMessage({ action: "getConfig" }, (response) => {
    if (chrome.runtime.lastError) {
      console.warn("Could not communicate with background script.");
      updateStatusBadge("Disconnected");
      return;
    }

    if (response) {
      // Sync toggle switches
      toggleAdblock.checked = response.config.adBlockEnabled;
      toggleCosmetic.checked = response.config.cosmeticFiltering;
      toggleFingerprint.checked = response.config.fingerprintShield;
      toggleCname.checked = response.config.dynamicCnameUncloaking;
      toggleWebrtc.checked = response.config.webRTCProtection;

      // Sync stats
      updateStatsDisplay(response.stats);

      // Sync status badge
      updateStatusBadge(response.connectionStatus);
    }
  });

  // Listen for real-time stats updates from background worker
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "statsUpdated") {
      updateStatsDisplay(message.stats);
      updateStatusBadge(message.connectionStatus);
    }
  });

  // Bind change events to toggles
  const saveConfig = () => {
    const config = {
      adBlockEnabled: toggleAdblock.checked,
      cosmeticFiltering: toggleCosmetic.checked,
      fingerprintShield: toggleFingerprint.checked,
      dynamicCnameUncloaking: toggleCname.checked,
      webRTCProtection: toggleWebrtc.checked
    };

    chrome.runtime.sendMessage({ action: "updateConfig", config }, (response) => {
      if (response) {
        updateStatusBadge(response.connectionStatus);
      }
    });
  };

  toggleAdblock.addEventListener("change", saveConfig);
  toggleCosmetic.addEventListener("change", saveConfig);
  toggleFingerprint.addEventListener("change", saveConfig);
  toggleCname.addEventListener("change", saveConfig);
  toggleWebrtc.addEventListener("change", saveConfig);

  // Reset Stats Button
  btnReset.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "resetStats" }, (response) => {
      if (response && response.stats) {
        updateStatsDisplay(response.stats);
      }
    });
  });

  // UI Helpers
  function updateStatsDisplay(stats) {
    if (!stats) return;
    
    // Smooth counter transition
    animateCounter(statAds, stats.blockedAds);
    animateCounter(statTrackers, stats.blockedTrackers);
    animateCounter(statFingerprints, stats.spoofedFingerprints);
    animateCounter(statCnames, stats.cnameResolutions);
  }

  function animateCounter(element, newValue) {
    const oldValue = parseInt(element.textContent) || 0;
    if (oldValue === newValue) return;

    // Simple smooth step-up counter animation for premium feel
    let current = oldValue;
    const step = Math.ceil((newValue - oldValue) / 10) || 1;
    
    const interval = setInterval(() => {
      current += step;
      if ((step > 0 && current >= newValue) || (step < 0 && current <= newValue)) {
        current = newValue;
        clearInterval(interval);
      }
      element.textContent = current.toLocaleString();
    }, 30);
  }

  function updateStatusBadge(status) {
    badge.className = "status-badge";
    badgeText.textContent = status;

    if (status === "Connected") {
      badge.classList.add("connected");
      badgeText.textContent = "Rust Core Active";
    } else if (status === "Connecting") {
      badge.classList.add("connecting");
      badgeText.textContent = "Connecting Core...";
    } else {
      badgeText.textContent = "Local Shield Only";
    }
  }
});
