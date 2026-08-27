export const appConfig = {
  academyName: "학원 운영 포털",
  payrollUrl: "https://payroll.robertson.kr/",
  portalUrl: "https://academy.robertson.kr/",
  firebase: {
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: "",
    appCheckSiteKey: ""
  }
};

export function isFirebaseConfigured(config = appConfig.firebase) {
  return ["apiKey", "authDomain", "projectId", "appId"].every((key) => Boolean(config[key]));
}
