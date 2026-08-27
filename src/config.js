export const appConfig = {
  academyName: "학원 운영 포털",
  payrollUrl: "https://payroll.robertson.kr/",
  portalUrl: "https://academy.robertson.kr/",
  firebase: {
    apiKey: "AIzaSyDd7tq1_xHseFTQrT-BOjCK8wTmAlGRlxk",
    authDomain: "academy-operations-hub.firebaseapp.com",
    projectId: "academy-operations-hub",
    storageBucket: "academy-operations-hub.firebasestorage.app",
    messagingSenderId: "300551162748",
    appId: "1:300551162748:web:6218485fe010958190b2f9",
    appCheckSiteKey: ""
  }
};

export function isFirebaseConfigured(config = appConfig.firebase) {
  return ["apiKey", "authDomain", "projectId", "appId"].every((key) => Boolean(config[key]));
}
