/* 정식 광고는 여기에 발행자 번호만 넣으면 연결됩니다.
   번호를 넣기 전에는 게임 안의 미리보기 광고가 그대로 재생됩니다.
   window.LUMEN_ADS = {
     provider: "adsense",
     client: "ca-pub-xxxxxxxxxxxxxxxx",
     frequency: "30s"
   };
*/
(function (global) {
  const cfg = global.LUMEN_ADS || {};

  function officialReady() {
    return cfg.provider === "adsense" && typeof global.adBreak === "function";
  }

  if (cfg.provider === "adsense" && cfg.client) {
    const script = document.createElement("script");
    script.async = true;
    script.crossOrigin = "anonymous";
    script.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + encodeURIComponent(cfg.client);
    script.setAttribute("data-ad-client", cfg.client);
    script.setAttribute("data-ad-frequency-hint", cfg.frequency || "30s");
    script.setAttribute("data-adbreak-test", cfg.test ? "on" : "off");
    script.addEventListener("load", () => {
      global.adsbygoogle = global.adsbygoogle || [];
      const adConfig = global.adConfig;
      if (typeof adConfig === "function") {
        adConfig({
          preloadAdBreaks: "on",
          sound: "on",
        });
      }
    });
    document.head.appendChild(script);
  }

  function requestReward(name, onReward, onClose) {
    if (!officialReady()) return false;
    let rewarded = false;
    let settled = false;
    function finish(ok) {
      if (settled) return;
      settled = true;
      if (ok) onReward();
      else onClose();
    }
    try {
      global.adBreak({
        type: "reward",
        name,
        beforeReward(showAd) {
          showAd();
        },
        adViewed() {
          rewarded = true;
        },
        adDismissed() {
          finish(false);
        },
        adBreakDone() {
          finish(rewarded);
        },
      });
      return true;
    } catch (err) {
      return false;
    }
  }

  global.LumenAds = { requestReward, officialReady };
})(window);
