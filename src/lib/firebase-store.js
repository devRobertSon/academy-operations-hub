const FIREBASE_VERSION = "12.17.1";
const sdk = (module) => `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-${module}.js`;

export async function createFirebaseStore(config) {
  const [appSdk, authSdk, firestoreSdk, appCheckSdk] = await Promise.all([
    import(sdk("app")),
    import(sdk("auth")),
    import(sdk("firestore")),
    import(sdk("app-check"))
  ]);

  const app = appSdk.initializeApp(config);
  if (config.appCheckSiteKey) {
    appCheckSdk.initializeAppCheck(app, {
      provider: new appCheckSdk.ReCaptchaV3Provider(config.appCheckSiteKey),
      isTokenAutoRefreshEnabled: true
    });
  }

  const auth = authSdk.getAuth(app);
  const db = firestoreSdk.getFirestore(app);
  await authSdk.setPersistence(auth, authSdk.browserLocalPersistence);

  async function createOrRefreshAccessRequest(firebaseUser) {
    const reference = firestoreSdk.doc(db, "accessRequests", firebaseUser.uid);
    const snapshot = await firestoreSdk.getDoc(reference);
    const previous = snapshot.exists() ? snapshot.data() : null;
    if (previous?.status === "pending") return "pending";

    await firestoreSdk.setDoc(reference, {
      uid: firebaseUser.uid,
      email: firebaseUser.email || "",
      displayName: firebaseUser.displayName || firebaseUser.email || "승인 대기 사용자",
      status: "pending",
      requestedAt: firestoreSdk.serverTimestamp()
    });
    return previous?.status === "rejected" ? "resubmitted" : "created";
  }

  async function sessionFromUser(firebaseUser) {
    if (!firebaseUser) return null;
    const snapshot = await firestoreSdk.getDoc(firestoreSdk.doc(db, "users", firebaseUser.uid));
    if (!snapshot.exists()) {
      const result = await createOrRefreshAccessRequest(firebaseUser);
      await authSdk.signOut(auth);
      if (result === "resubmitted") throw new Error("계정 승인 요청을 다시 보냈습니다. 관리자가 승인한 뒤 로그인해 주세요.");
      if (result === "created") throw new Error("계정 승인 요청을 보냈습니다. 관리자가 승인한 뒤 로그인해 주세요.");
      throw new Error("계정 승인 요청이 대기 중입니다.");
    }

    const profile = snapshot.data();
    if (profile.status !== "active") {
      await authSdk.signOut(auth);
      throw new Error("비활성화된 계정입니다. 관리자에게 문의해 주세요.");
    }
    return {
      uid: firebaseUser.uid,
      email: firebaseUser.email || "",
      displayName: profile.displayName || firebaseUser.displayName || firebaseUser.email,
      roles: Array.isArray(profile.roles) ? profile.roles : [],
      ...profile
    };
  }

  async function signIn() {
    const provider = new authSdk.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    try {
      const credential = await authSdk.signInWithPopup(auth, provider);
      return sessionFromUser(credential.user);
    } catch (error) {
      if (error.code === "auth/popup-blocked") throw new Error("Google 로그인 창이 차단되었습니다. 팝업을 허용한 뒤 다시 시도해 주세요.");
      if (["auth/popup-closed-by-user", "auth/cancelled-popup-request"].includes(error.code)) throw new Error("Google 로그인이 취소되었습니다.");
      if (["auth/operation-not-supported-in-this-environment", "auth/web-storage-unsupported"].includes(error.code)) {
        throw new Error("이 브라우저에서는 Google 로그인을 사용할 수 없습니다. Safari 또는 Chrome에서 링크를 직접 열어 주세요.");
      }
      throw error;
    }
  }

  async function restoreSession() {
    const firebaseUser = await new Promise((resolve) => {
      const unsubscribe = authSdk.onAuthStateChanged(auth, (user) => {
        unsubscribe();
        resolve(user);
      });
    });
    return sessionFromUser(firebaseUser);
  }

  async function loadCollection(path, constraints = []) {
    const base = firestoreSdk.collection(db, path);
    const reference = constraints.length ? firestoreSdk.query(base, ...constraints) : base;
    const snapshot = await firestoreSdk.getDocs(reference);
    return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  }

  async function loadWorkspace(user) {
    const roles = new Set(user.roles || []);
    const isAdmin = roles.has("academic_admin");
    const isCounselor = roles.has("counselor");
    const teacherOnly = roles.has("teacher") && !isAdmin && !isCounselor;
    const collections = teacherOnly ? [
      ["students", [firestoreSdk.where("activeTeacherUids", "array-contains", user.uid)]],
      ["classes", [firestoreSdk.where("teacherUids", "array-contains", user.uid)]],
      ["enrollments", [firestoreSdk.where("teacherUids", "array-contains", user.uid)]],
      ["assessmentResults", [firestoreSdk.where("teacherUid", "==", user.uid)]],
      ["progressRecords", [firestoreSdk.where("teacherUid", "==", user.uid)]]
    ] : [
      ["students", []],
      ["classes", []],
      ["enrollments", []],
      ["assessmentResults", []],
      ["progressRecords", []]
    ];
    if (isAdmin || isCounselor) collections.push(["consultations", []], ["diagnosticResults", []]);
    if (isAdmin) collections.push(["importBatches", []]);

    const loaded = await Promise.all(collections.map(async ([path, constraints]) => {
      try {
        return [path, await loadCollection(path, constraints)];
      } catch (error) {
        console.warn(`${path} 자료를 불러오지 못했습니다.`, error);
        return [path, []];
      }
    }));
    return Object.fromEntries(loaded);
  }

  async function createDocument(path, data) {
    const reference = await firestoreSdk.addDoc(firestoreSdk.collection(db, path), {
      ...data,
      createdAt: firestoreSdk.serverTimestamp()
    });
    return { id: reference.id };
  }

  async function logout() {
    await authSdk.signOut(auth);
  }

  return { signIn, restoreSession, loadWorkspace, createDocument, logout };
}

