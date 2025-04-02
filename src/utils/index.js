import FingerprintJS from "@fingerprintjs/fingerprintjs";

let fpID = null;

// 立即初始化获取 fpID
FingerprintJS.load({
    // 禁用不稳定的监测项
    excludes: {
      // 可能变化的项目
      pixelRatio: true,
      screenResolution: true,
      availableScreenResolution: true,
      timezone: true,
      sessionStorage: true,
      localStorage: true,
      indexedDb: true,
      // 其他可能变化的项目...
    }
})
  .then(fp => fp.get())
  .then(result => {
    fpID = result.visitorId;
  });

// 导出同步获取方法
export const getFnID = () => fpID;

  
