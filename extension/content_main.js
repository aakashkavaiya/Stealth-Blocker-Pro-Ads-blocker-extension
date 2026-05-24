// Stealth Blocker - MAIN World Runtime Scriptlet
// Injected at document_start in the page's execution environment.
(function() {
  'use strict';
  
  console.log("[Stealth Blocker] MAIN World Runtime active. Armed defenses.");

  // Dispatch custom events to report blocked fingerprinting actions back to isolated world
  const reportFingerprintBlocked = (type) => {
    try {
      window.dispatchEvent(new CustomEvent('stealth-fingerprint-blocked', { detail: { type } }));
    } catch (e) {}
  };

  // Config object to control features dynamically
  const config = {
    fingerprintShield: {
      canvas: true,
      webgl: true,
      audio: true,
      navigator: true
    },
    antiAdblockShield: {
      mockDetectorProps: true,
      stealthDOM: true
    }
  };

  // ==========================================
  // 1. NAVIGATOR SPOOFING (Anti-Detection)
  // ==========================================
  if (config.fingerprintShield.navigator) {
    try {
      // Modern anti-bot and anti-adblock checkers look at navigator.webdriver
      if (navigator.webdriver !== undefined) {
        Object.defineProperty(Object.getPrototypeOf(navigator), 'webdriver', {
          get: () => {
            reportFingerprintBlocked('navigator_webdriver');
            return false;
          },
          configurable: true
        });
      }
      
      // Spoof hardware concurrency to generic 8 cores to limit fingerprint uniqueness
      Object.defineProperty(Object.getPrototypeOf(navigator), 'hardwareConcurrency', {
        get: () => {
          reportFingerprintBlocked('hardware_concurrency');
          return 8;
        },
        configurable: true
      });

      // Avoid deviceMemory fingerprints (often used to group users)
      if (navigator.deviceMemory) {
        Object.defineProperty(Object.getPrototypeOf(navigator), 'deviceMemory', {
          get: () => {
            reportFingerprintBlocked('device_memory');
            return 8;
          },
          configurable: true
        });
      }
      
      // Override languages to maintain common profile
      Object.defineProperty(Object.getPrototypeOf(navigator), 'languages', {
        get: () => ['en-US', 'en'],
        configurable: true
      });
      
      console.log("[Stealth Blocker] Navigator fingerprint shield initialized.");
    } catch (e) {
      console.warn("[Stealth Blocker] Failed to hook navigator: ", e);
    }
  }

  // ==========================================
  // 2. CANVAS FINGERPRINT SHIELD
  // ==========================================
  if (config.fingerprintShield.canvas) {
    try {
      // We hook CanvasRenderingContext2D.prototype.getImageData
      // to add a micro-jitter (changing a single pixel's LSB by 1)
      // which completely alters the MD5/SHA256 canvas hash without any visual impact.
      const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
      
      CanvasRenderingContext2D.prototype.getImageData = function(sx, sy, sw, sh) {
        reportFingerprintBlocked('canvas_getimagedata');
        const imageData = originalGetImageData.apply(this, arguments);
        const data = imageData.data;
        
        // Jitter the least significant bit of color channels of a few pixels
        // to make the canvas fingerprint unique/randomized per session,
        // preventing canvas tracking while keeping the image looking perfect.
        const length = data.length;
        if (length > 0) {
          // We apply deterministic session-based micro-jitter
          // so that canvas edits don't continuously thrash, but each site gets a distinct canvas hash.
          const sessionSeed = Math.floor(Math.random() * 5) + 1; 
          for (let i = 0; i < length; i += 400 * sessionSeed) {
            // Apply +/- 1 to red channel
            data[i] = (data[i] + (i % 2 === 0 ? 1 : -1)) & 0xFF;
            // Apply +/- 1 to green channel
            data[i+1] = (data[i+1] + (i % 2 === 0 ? -1 : 1)) & 0xFF;
          }
        }
        return imageData;
      };
      
      // Hook toDataURL to prevent direct data extraction hashes
      const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function(type, encoderOptions) {
        reportFingerprintBlocked('canvas_todataurl');
        // Draw something extremely subtle on canvas before outputting to change hash
        const ctx = this.getContext('2d');
        if (ctx) {
          const originalFillStyle = ctx.fillStyle;
          ctx.fillStyle = 'rgba(255,255,255,0.01)'; // invisible pixel
          ctx.fillRect(0, 0, 1, 1);
          ctx.fillStyle = originalFillStyle;
        }
        return originalToDataURL.apply(this, arguments);
      };

      console.log("[Stealth Blocker] Canvas fingerprint shield initialized.");
    } catch (e) {
      console.warn("[Stealth Blocker] Failed to hook Canvas: ", e);
    }
  }

  // ==========================================
  // 3. WEBGL FINGERPRINT SHIELD
  // ==========================================
  if (config.fingerprintShield.webgl) {
    try {
      const originalReadPixels = WebGLRenderingContext.prototype.readPixels;
      WebGLRenderingContext.prototype.readPixels = function(x, y, width, height, format, type, pixels) {
        reportFingerprintBlocked('webgl_readpixels');
        originalReadPixels.apply(this, arguments);
        // Inject tiny jitter in WebGL pixels readback
        if (pixels && pixels.length > 0) {
          const step = Math.floor(pixels.length / 10) || 1;
          for (let i = 0; i < pixels.length; i += step) {
            pixels[i] = (pixels[i] + 1) & 0xFF;
          }
        }
      };
      console.log("[Stealth Blocker] WebGL fingerprint shield initialized.");
    } catch (e) {
      console.warn("[Stealth Blocker] Failed to hook WebGL: ", e);
    }
  }

  // ==========================================
  // 4. AUDIO FINGERPRINT SHIELD
  // ==========================================
  if (config.fingerprintShield.audio) {
    try {
      const originalGetByteFrequencyData = AudioContext.prototype.getByteFrequencyData || 
                                           OfflineAudioContext.prototype.getByteFrequencyData;
      if (originalGetByteFrequencyData) {
        const hookGetByteFrequencyData = function(array) {
          reportFingerprintBlocked('audio_frequency_data');
          originalGetByteFrequencyData.apply(this, arguments);
          if (array && array.length > 0) {
            // Apply micro-jitter to the audio frequencies
            for (let i = 0; i < array.length; i += 10) {
              array[i] = (array[i] + (Math.random() > 0.5 ? 1 : -1)) & 0xFF;
            }
          }
        };
        AudioContext.prototype.getByteFrequencyData = hookGetByteFrequencyData;
        if (window.OfflineAudioContext) {
          OfflineAudioContext.prototype.getByteFrequencyData = hookGetByteFrequencyData;
        }
      }
      console.log("[Stealth Blocker] Audio fingerprint shield initialized.");
    } catch (e) {
      console.warn("[Stealth Blocker] Failed to hook Audio: ", e);
    }
  }

  // ==========================================
  // 5. ANTI-ANTI-ADBLOCK & STEALTH DOM
  // ==========================================
  if (config.antiAdblockShield.mockDetectorProps) {
    try {
      // Mock global variables commonly checked by detectors
      window.adblock = false;
      window.adblock_installed = false;
      window.hasAdBlocker = false;
      window.adBlockEnabled = false;
      window.isAdblockerActive = false;
      window.blockerActive = false;
      window.google_ad_status = 1; // Google script loaded ok
      
      // Override document property checks if checkers look for adblock indicators
      window.document.adblock = undefined;
      window.document.hasAdBlocker = false;
      
      // Hook window-level errors (some detectors look for script errors on missing libraries)
      // and suppress typical blocked-url errors.
      window.addEventListener('error', function(event) {
        if (event.message && (
          event.message.includes('adsbygoogle') || 
          event.message.includes('doubleclick') ||
          event.message.includes('google-analytics')
        )) {
          // Prevent the error from triggering anti-adblock scripts
          event.preventDefault();
          event.stopPropagation();
          console.log("[Stealth Blocker] Blocked ad-script error bubble to page scripts.");
        }
      }, true);

      console.log("[Stealth Blocker] Anti-Anti-Adblock mocks successfully bound.");
    } catch (e) {
      console.warn("[Stealth Blocker] Failed to bind Anti-Anti-Adblock mocks: ", e);
    }
  }

})();
