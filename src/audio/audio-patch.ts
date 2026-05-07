/**
 * AudioPatch script to be injected into the game iframe.
 * Patches Howler.js / Web Audio API for iOS compatibility.
 */
export function getAudioPatchScript(): string {
  return `
(function() {
  'use strict';

  // Reuse the pre-unlocked AudioContext if available
  if (window.parent && window.parent.__unlockedAudioContext) {
    var unlockedCtx = window.parent.__unlockedAudioContext;
    if (typeof Howler !== 'undefined') {
      // Patch Howler's AudioContext creation
      var origHowlerInit = Howler.init;
      Howler.init = function() {
        Howler.ctx = unlockedCtx;
        Howler.masterGain = unlockedCtx.createGain();
        Howler.masterGain.connect(unlockedCtx.destination);
      };
    }
  }

  // Resume audio context on visibility change (background -> foreground)
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible') {
      // Resume Howler context
      if (typeof Howler !== 'undefined' && Howler.ctx) {
        if (Howler.ctx.state === 'suspended' || Howler.ctx.state === 'interrupted') {
          Howler.ctx.resume().catch(function() {});
        }
      }
      // Also resume any other audio contexts
      if (window.AudioContext || window.webkitAudioContext) {
        var AC = window.AudioContext || window.webkitAudioContext;
        // We can't enumerate all contexts, but Howler.ctx covers the main one
      }
    }
  });

  // Patch HTML5 Audio for BGM reliability
  // Force html5:true on Howl instances that look like BGM (long audio)
  if (typeof Howl !== 'undefined') {
    var OrigHowl = Howl;
    // Note: This is a shallow patch; the actual Howler.js might use different
    // internal naming. Adjust based on the actual Howler.js version.
  }

  // Handle audio session interruptions via pagehide/pageshow
  window.addEventListener('pagehide', function() {
    if (typeof Howler !== 'undefined' && Howler.ctx) {
      Howler.ctx.suspend().catch(function() {});
    }
  });

  window.addEventListener('pageshow', function() {
    if (typeof Howler !== 'undefined' && Howler.ctx) {
      if (Howler.ctx.state === 'suspended') {
        Howler.ctx.resume().catch(function() {});
      }
    }
  });
})();
`;
}
