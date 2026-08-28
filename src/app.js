import { appConfig, isFirebaseConfigured } from "./config.js?v=20260827-1";
import {
  demoAssessmentResults,
  demoClasses,
  demoConsultations,
  demoImportBatches,
  demoProgressRecords,
  demoStudents,
  demoUsers
} from "./data/demo-data.js?v=20260828-1";
import { buildEduokImportPreview } from "./lib/eduok-import.js";
import { createFirebaseStore } from "./lib/firebase-store.js?v=20260828-1";

const state = {
  user: null,
  view: "dashboard",
  search: "",
  studentStatus: "all",
  selectedStudentId: null,
  selectedConsultationId: null,
  store: null,
  firebaseReady: null,
  importPreview: null,
  data: emptyData()
};

const elements = {
  login: document.querySelector("#login-view"),
  workspace: document.querySelector("#workspace"),
  loginStatus: document.querySelector("#login-status"),
  loginButton: document.querySelector("#google-login"),
  nav: document.querySelector("#main-nav"),
  pageTitle: document.querySelector("#page-title"),
  pageEyebrow: document.querySelector("#page-eyebrow"),
  topbarActions: document.querySelector("#topbar-actions"),
  content: document.querySelector("#page-content"),
  modalRoot: document.querySelector("#modal-root"),
  toastRoot: document.querySelector("#toast-root")
};

const adminNav = [
  ["운영", "dashboard", "layout-dashboard", "운영 현황"],
  ["학사", "students", "users-round", "학생 관리"],
  ["학사", "classes", "calendar-days", "수업 · 반"],
  ["학사", "learning", "chart-no-axes-column-increasing", "평가 · 진도"],
  ["입학", "admissions", "clipboard-pen-line", "입학 상담"],
  ["입학", "timetable", "route", "시간표 · 로드맵"],
  ["시스템", "imports", "file-up", "에듀오케이 가져오기"]
];

const teacherNav = [
  ["수업", "classes", "calendar-days", "내 수업"],
  ["수업", "students", "users-round", "담당 학생"],
  ["기록", "learning", "square-pen", "평가 · 진도"]
];

await bootstrap();

async function bootstrap() {
  document.querySelectorAll("#login-academy-name, #sidebar-academy-name").forEach((node) => {
    node.textContent = appConfig.academyName;
  });
  document.querySelector("#payroll-link").href = appConfig.payrollUrl;
  bindStaticEvents();

  const demoRole = new URLSearchParams(location.search).get("demo");
  const localDemo = ["localhost", "127.0.0.1"].includes(location.hostname) && demoUsers[demoRole];
  if (localDemo) {
    loadDemoData();
    await openWorkspace(demoUsers[demoRole]);
  } else if (isFirebaseConfigured()) {
    try {
      const restored = await ensureFirebaseReady();
      if (restored) await openWorkspace(restored);
    } catch (error) {
      setLoginStatus(error.message || "Firebase 연결을 확인해 주세요.");
    }
  } else {
    elements.loginButton.disabled = true;
    setLoginStatus("새 Firebase 프로젝트 연결 설정이 필요합니다.", false);
  }
  refreshIcons();
}

function bindStaticEvents() {
  elements.loginButton.addEventListener("click", async () => {
    try {
      setLoginStatus("Google 로그인을 준비하고 있습니다.", false);
      const restored = await ensureFirebaseReady();
      if (restored) {
        await openWorkspace(restored);
        return;
      }
      setLoginStatus("Google 계정을 확인하고 있습니다.", false);
      const user = await state.store.signIn();
      if (user) await openWorkspace(user);
    } catch (error) {
      setLoginStatus(error.message || "로그인하지 못했습니다.");
    }
  });

  document.querySelector("#logout-button").addEventListener("click", logout);
  document.querySelector("#mobile-menu").addEventListener("click", () => elements.workspace.classList.toggle("menu-open"));
  elements.nav.addEventListener("click", (event) => {
    const button = event.target.closest("[data-view]");
    if (!button) return;
    state.view = button.dataset.view;
    state.search = "";
    elements.workspace.classList.remove("menu-open");
    render();
  });
  elements.topbarActions.addEventListener("click", handleActionClick);
  elements.content.addEventListener("click", handleContentClick);
  elements.content.addEventListener("input", handleContentInput);
  elements.content.addEventListener("change", handleContentChange);
  elements.modalRoot.addEventListener("click", handleModalClick);
  elements.modalRoot.addEventListener("change", handleModalChange);
  elements.modalRoot.addEventListener("submit", handleModalSubmit);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && elements.modalRoot.childElementCount) closeModal();
  });
}

async function ensureFirebaseReady() {
  if (!state.firebaseReady) {
    state.firebaseReady = (async () => {
      state.store = await createFirebaseStore(appConfig.firebase);
      return state.store.restoreSession();
    })();
  }

  try {
    return await state.firebaseReady;
  } catch (error) {
    state.store = null;
    state.firebaseReady = null;
    throw error;
  }
}

function loadDemoData() {
  state.data = {
    students: structuredClone(demoStudents),
    classes: structuredClone(demoClasses),
    enrollments: [],
    assessmentResults: structuredClone(demoAssessmentResults),
    progressRecords: structuredClone(demoProgressRecords),
    consultations: structuredClone(demoConsultations),
    diagnosticResults: [],
    importBatches: structuredClone(demoImportBatches)
  };
}

async function openWorkspace(user) {
  state.user = user;
  state.view = hasRole("teacher") && !hasRole("academic_admin") ? "classes" : "dashboard";
  if (state.store) state.data = { ...emptyData(), ...await state.store.loadWorkspace(user) };
  elements.login.hidden = true;
  elements.workspace.hidden = false;
  document.querySelector("#user-name").textContent = user.displayName || user.email;
  document.querySelector("#user-role").textContent = roleLabel(user.roles);
  document.querySelector("#user-avatar").textContent = (user.displayName || user.email || "사").slice(0, 1);
  render();
}

async function logout() {
  if (state.store) await state.store.logout();
  state.user = null;
  elements.workspace.hidden = true;
  elements.login.hidden = false;
  setLoginStatus("");
}

function render() {
  renderNavigation();
  const renderers = {
    dashboard: renderDashboard,
    students: renderStudents,
    classes: renderClasses,
    learning: renderLearning,
    admissions: renderAdmissions,
    timetable: renderTimetable,
    imports: renderImports
  };
  (renderers[state.view] || renderDashboard)();
  refreshIcons();
}

function renderNavigation() {
  const nav = hasRole("academic_admin") || hasRole("counselor") ? adminNav : teacherNav;
  const groups = new Map();
  nav.forEach(([group, view, icon, label]) => {
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push({ view, icon, label });
  });
  elements.nav.innerHTML = [...groups.entries()].map(([group, items]) => `
    <div class="nav-group">
      <span class="nav-group-label">${e(group)}</span>
      ${items.map((item) => `
        <button class="nav-button ${state.view === item.view ? "active" : ""}" type="button" data-view="${item.view}">
          <i data-lucide="${item.icon}" aria-hidden="true"></i>${e(item.label)}
        </button>
      `).join("")}
    </div>
  `).join("");
}

function renderDashboard() {
  setPage("학사 운영", "운영 현황");
  const activeStudents = state.data.students.filter((student) => student.status === "active").length;
  const activeClasses = state.data.classes.length;
  const recentResults = state.data.assessmentResults.length;
  const pendingConsultations = state.data.consultations.filter((item) => item.status !== "completed").length;
  elements.content.innerHTML = `
    <div class="metric-strip">
      ${metric("재원 학생", `${activeStudents}명`, "에듀오케이 기준")}
      ${metric("운영 수업", `${activeClasses}개`, "현재 개설")}
      ${metric("평가 기록", `${recentResults}건`, "최근 불러온 기록")}
      ${metric("상담 진행", `${pendingConsultations}건`, "예정 · 검토")}
    </div>
    <section class="section">
      <div class="section-header"><div><h2 class="section-title">업무 바로가기</h2><span class="section-meta">권한에 따라 열리는 업무</span></div></div>
      <div class="module-grid">
        ${moduleButton("students", "users-round", "학생 관리", "수강 이력과 평가 기록")}
        ${moduleButton("classes", "calendar-days", "수업 · 반", "시간표와 담당 선생님")}
        ${moduleButton("learning", "chart-no-axes-column-increasing", "평가 · 진도", "단원평가와 학습 진도")}
        ${moduleButton("admissions", "clipboard-pen-line", "입학 상담", "진단평가와 상담 원서")}
        ${moduleButton("timetable", "route", "시간표 · 로드맵", "수업 배정과 학습 계획")}
        ${moduleButton("imports", "file-up", "에듀오케이 가져오기", "학생·반 자료 비교")}
      </div>
    </section>
    <section class="section">
      <div class="section-header"><div><h2 class="section-title">최근 학습 기록</h2><span class="section-meta">평가와 진도 입력 순</span></div></div>
      ${learningTable(state.data.assessmentResults.slice(0, 4), state.data.progressRecords.slice(0, 4))}
    </section>
  `;
}

function renderStudents() {
  setPage("학사 · 학생", hasRole("teacher") && !hasRole("academic_admin") ? "담당 학생" : "학생 관리");
  const students = visibleStudents().filter((student) => {
    const text = `${student.name} ${student.schoolName} ${student.grade} ${(student.activeClassNames || []).join(" ")}`.toLowerCase();
    return text.includes(state.search.toLowerCase()) && (state.studentStatus === "all" || student.status === state.studentStatus);
  });
  if (!state.selectedStudentId || !students.some((item) => item.id === state.selectedStudentId)) state.selectedStudentId = students[0]?.id || null;
  const selected = state.data.students.find((item) => item.id === state.selectedStudentId);
  elements.content.innerHTML = `
    <div class="toolbar">
      <label class="search-box"><i data-lucide="search" aria-hidden="true"></i><input id="student-search" class="input" value="${e(state.search)}" placeholder="이름·학교·반 검색" /></label>
      <select id="student-status" class="select" aria-label="학생 상태">
        ${option("all", "전체 상태", state.studentStatus)}${option("active", "재원", state.studentStatus)}${option("paused", "휴원", state.studentStatus)}${option("inactive", "퇴원", state.studentStatus)}
      </select>
    </div>
    <div class="split-layout">
      <div class="data-panel"><div class="table-scroll"><table class="data-table">
        <thead><tr><th>학생</th><th>학년</th><th>현재 수업</th><th>상태</th></tr></thead>
        <tbody>${students.length ? students.map(studentRow).join("") : `<tr><td colspan="4" class="empty-state">표시할 학생이 없습니다.</td></tr>`}</tbody>
      </table></div></div>
      ${studentDetail(selected)}
    </div>
  `;
}

function renderClasses() {
  setPage("학사 · 수업", hasRole("teacher") && !hasRole("academic_admin") ? "내 수업" : "수업 · 반");
  const classes = visibleClasses();
  elements.content.innerHTML = `
    <section class="section">
      <div class="section-header"><div><h2 class="section-title">현재 수업</h2><span class="section-meta">${classes.length}개 반</span></div></div>
      <div class="data-panel"><div class="table-scroll"><table class="data-table">
        <thead><tr><th>반</th><th>담당 선생님</th><th>시간</th><th>강의실</th><th>정원</th></tr></thead>
        <tbody>${classes.length ? classes.map((item) => `<tr><td><div class="table-primary"><strong>${e(item.name)}</strong><span>${e(item.category || "미분류")}</span></div></td><td>${e((item.teacherNames || []).join(", ") || "미배정")}</td><td>${e(item.schedule || "미등록")}</td><td>${e(item.room || "미등록")}</td><td>${e(item.studentCount || 0)} / ${e(item.capacity || "-")}</td></tr>`).join("") : `<tr><td colspan="5" class="empty-state">배정된 수업이 없습니다.</td></tr>`}</tbody>
      </table></div></div>
    </section>
  `;
}

function renderLearning() {
  setPage("학사 · 학습 기록", "평가 · 진도");
  elements.topbarActions.innerHTML = `<button class="button button-primary" type="button" data-action="open-learning-record"><i data-lucide="plus"></i>기록 입력</button>`;
  elements.content.innerHTML = `
    <section class="section">
      <div class="section-header"><div><h2 class="section-title">단원평가</h2><span class="section-meta">학생별 평가 결과</span></div></div>
      ${assessmentTable(visibleAssessmentResults())}
    </section>
    <section class="section">
      <div class="section-header"><div><h2 class="section-title">진도 기록</h2><span class="section-meta">수업별 최근 진도</span></div></div>
      ${progressTable(visibleProgressRecords())}
    </section>
  `;
}

function renderAdmissions() {
  if (!hasRole("academic_admin") && !hasRole("counselor")) return renderDashboard();
  setPage("입학 · 상담", "입학 상담");
  elements.topbarActions.innerHTML = `<button class="button button-primary" type="button" data-action="open-consultation"><i data-lucide="plus"></i>상담 등록</button>`;
  elements.content.innerHTML = `
    <div class="metric-strip">
      ${metric("상담 예정", `${state.data.consultations.filter((item) => item.status === "scheduled").length}건`, "일정 등록")}
      ${metric("결과 검토", `${state.data.consultations.filter((item) => item.status === "review").length}건`, "진단 완료")}
      ${metric("원서 작성", "0건", "출력 대기")}
      ${metric("등록 전환", "0명", "이번 달")}
    </div>
    <section class="section"><div class="section-header"><div><h2 class="section-title">상담 목록</h2><span class="section-meta">진단평가와 추천 반</span></div></div>
      <div class="data-panel"><div class="table-scroll"><table class="data-table"><thead><tr><th>상담 학생</th><th>학년</th><th>목표 학교</th><th>상담일</th><th>진단평가</th><th>추천 반</th><th>상태</th></tr></thead><tbody>
        ${state.data.consultations.length ? state.data.consultations.map((item) => `<tr><td><strong>${e(item.applicantName)}</strong></td><td>${e(item.grade)}</td><td>${e(item.targetSchool || "미정")}</td><td>${e(item.consultedAt)}</td><td>${e(item.diagnosticLabel)}</td><td>${e(item.recommendedClass)}</td><td>${statusBadge(item.status)}</td></tr>`).join("") : `<tr><td colspan="7" class="empty-state">등록된 상담이 없습니다.</td></tr>`}
      </tbody></table></div></div>
    </section>
  `;
}

function renderTimetable() {
  if (!hasRole("academic_admin") && !hasRole("counselor")) return renderDashboard();
  setPage("입학 · 배정", "시간표 · 로드맵");
  const consultations = [...state.data.consultations].sort((a, b) => String(b.consultedAt || "").localeCompare(String(a.consultedAt || "")));
  if (!state.selectedConsultationId || !consultations.some((item) => item.id === state.selectedConsultationId)) {
    state.selectedConsultationId = consultations[0]?.id || null;
  }
  const consultation = consultations.find((item) => item.id === state.selectedConsultationId);
  if (!consultation) {
    elements.content.innerHTML = `<div class="notice"><i data-lucide="info" aria-hidden="true"></i><span>입학 상담을 먼저 등록하면 목표 학교와 현재 진도를 바탕으로 로드맵과 맞춤 시간표를 생성합니다.</span></div>`;
    return;
  }
  const recommendation = buildRecommendation(consultation, state.data.classes);
  elements.content.innerHTML = `
    <section class="roadmap-control">
      <label class="field"><span>상담 학생</span><select id="roadmap-consultation" class="select">${consultations.map((item) => `<option value="${e(item.id)}" ${item.id === consultation.id ? "selected" : ""}>${e(item.applicantName)} · ${e(item.targetSchool || "목표 미정")}</option>`).join("")}</select></label>
      <div class="roadmap-student-summary"><div><span>현재 학년</span><strong>${e(consultation.grade || "미정")}</strong></div><div><span>목표 학교</span><strong>${e(consultation.targetSchool || "미정")}</strong></div><div><span>수학 진도</span><strong>${e(consultation.mathProgress || "미등록")}</strong></div><div><span>과학 진도</span><strong>${e(consultation.scienceProgress || "미등록")}</strong></div></div>
    </section>
    <div class="recommendation-banner"><i data-lucide="sparkles" aria-hidden="true"></i><div><strong>${e(consultation.targetSchool || "목표 학교")} 준비 과정 ${recommendation.courses.length}개를 자동 선택했습니다.</strong><span>${recommendation.subjects.map((item) => e(item)).join(" · ") || "목표 학교를 지정하면 필요한 과목이 표시됩니다."}</span></div></div>
    <section class="section"><div class="section-header"><div><h2 class="section-title">합격 준비 로드맵</h2><span class="section-meta">현재 진도 이후의 개설 과정</span></div></div>
      ${roadmapMarkup(recommendation)}
    </section>
    <section class="section"><div class="section-header"><div><h2 class="section-title">맞춤형 주간 시간표</h2><span class="section-meta">자동 선택된 개설 수업의 실제 시간</span></div></div>
      ${weeklyScheduleMarkup(recommendation.scheduledCourses)}
    </section>
  `;
}

function renderImports() {
  if (!hasRole("academic_admin")) return renderDashboard();
  setPage("시스템 · 데이터", "에듀오케이 가져오기");
  const preview = state.importPreview;
  elements.content.innerHTML = `
    <div class="notice"><i data-lucide="shield-check" aria-hidden="true"></i><span>선택한 파일은 이 화면에서만 분석됩니다. 가져오기 확정 기능을 연결하기 전에는 Firebase에 저장되지 않습니다.</span></div>
    <section class="section">
      <label class="import-dropzone" for="eduok-file">
        <input id="eduok-file" type="file" accept=".csv,text/csv" />
        <i data-lucide="file-up" aria-hidden="true"></i>
        <strong>에듀오케이 CSV 선택</strong>
        <span>학생명 또는 원생명 열이 포함된 CSV</span>
      </label>
    </section>
    ${preview ? importPreviewMarkup(preview) : ""}
    <section class="section"><div class="section-header"><div><h2 class="section-title">최근 가져오기</h2><span class="section-meta">미리보기와 확정 이력</span></div></div>
      <div class="data-panel"><div class="table-scroll"><table class="data-table"><thead><tr><th>파일</th><th>시간</th><th>신규</th><th>변경</th><th>제외</th><th>상태</th></tr></thead><tbody>
        ${state.data.importBatches.length ? state.data.importBatches.map((item) => `<tr><td>${e(item.filename)}</td><td>${e(item.importedAt)}</td><td>${e(item.createdCount)}</td><td>${e(item.updatedCount)}</td><td>${e(item.skippedCount)}</td><td><span class="badge neutral">미리보기</span></td></tr>`).join("") : `<tr><td colspan="6" class="empty-state">가져오기 이력이 없습니다.</td></tr>`}
      </tbody></table></div></div>
    </section>
  `;
}

function handleContentClick(event) {
  const viewButton = event.target.closest("[data-open-view]");
  if (viewButton) {
    state.view = viewButton.dataset.openView;
    render();
    return;
  }
  const studentRowElement = event.target.closest("[data-student-id]");
  if (studentRowElement) {
    state.selectedStudentId = studentRowElement.dataset.studentId;
    renderStudents();
    refreshIcons();
    return;
  }
  const toastButton = event.target.closest("[data-toast]");
  if (toastButton) showToast(toastButton.dataset.toast);
}

function handleActionClick(event) {
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (action === "open-learning-record") openLearningRecordModal();
  if (action === "open-consultation") openConsultationModal();
}

function handleModalClick(event) {
  if (event.target.closest("[data-modal-close]") || event.target.matches(".modal-overlay")) closeModal();
}

function handleModalChange(event) {
  if (event.target.id === "record-type") syncLearningRecordFields();
}

async function handleModalSubmit(event) {
  event.preventDefault();
  if (event.target.id === "learning-record-form") await saveLearningRecord(event.target);
  if (event.target.id === "consultation-form") await saveConsultation(event.target);
}

function handleContentInput(event) {
  if (event.target.id === "student-search") {
    state.search = event.target.value;
    renderStudents();
    refreshIcons();
    const input = document.querySelector("#student-search");
    input?.focus();
    input?.setSelectionRange(state.search.length, state.search.length);
  }
}

async function handleContentChange(event) {
  if (event.target.id === "student-status") {
    state.studentStatus = event.target.value;
    renderStudents();
    refreshIcons();
    return;
  }
  if (event.target.id === "eduok-file") {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      showToast("현재 미리보기는 CSV 파일만 지원합니다.");
      return;
    }
    state.importPreview = buildEduokImportPreview(await file.text(), state.data.students);
    renderImports();
    refreshIcons();
    return;
  }
  if (event.target.id === "roadmap-consultation") {
    state.selectedConsultationId = event.target.value;
    renderTimetable();
    refreshIcons();
  }
}

function setPage(eyebrow, title) {
  elements.pageEyebrow.textContent = eyebrow;
  elements.pageTitle.textContent = title;
  elements.topbarActions.innerHTML = "";
}

function visibleStudents() {
  if (!hasRole("teacher") || hasRole("academic_admin")) return state.data.students;
  return state.data.students.filter((student) => (student.activeTeacherUids || []).includes(state.user.uid));
}

function visibleClasses() {
  if (!hasRole("teacher") || hasRole("academic_admin")) return state.data.classes;
  return state.data.classes.filter((item) => (item.teacherUids || []).includes(state.user.uid));
}

function visibleAssessmentResults() {
  if (!hasRole("teacher") || hasRole("academic_admin")) return state.data.assessmentResults;
  return state.data.assessmentResults.filter((item) => item.teacherUid === state.user.uid);
}

function visibleProgressRecords() {
  if (!hasRole("teacher") || hasRole("academic_admin")) return state.data.progressRecords;
  return state.data.progressRecords.filter((item) => item.teacherUid === state.user.uid);
}

function openLearningRecordModal() {
  const students = visibleStudents();
  const classes = visibleClasses();
  const ready = students.length && classes.length;
  openModal("평가·진도 기록 입력", `
    <form id="learning-record-form">
      <div class="form-grid">
        <label class="field field-wide"><span>기록 구분</span><select id="record-type" name="recordType" class="select">${option("assessment", "단원평가", "assessment")}${option("progress", "진도", "assessment")}</select></label>
        <label class="field"><span>학생</span><select name="studentId" class="select" required>${students.map((item) => `<option value="${e(item.id)}">${e(item.name)} · ${e(item.grade || "학년 미등록")}</option>`).join("")}</select></label>
        <label class="field"><span>수업</span><select name="classId" class="select" required>${classes.map((item) => `<option value="${e(item.id)}">${e(item.name)}</option>`).join("")}</select></label>
        <div class="form-grid field-wide" data-record-fields="assessment">
          <label class="field field-wide"><span>평가명</span><input name="title" class="input" maxlength="80" placeholder="예: 일차함수 단원평가" required /></label>
          <label class="field"><span>점수</span><input name="score" class="input" type="number" min="0" step="1" required /></label>
          <label class="field"><span>총점</span><input name="maxScore" class="input" type="number" min="1" step="1" value="100" required /></label>
          <label class="field field-wide"><span>평가일</span><input name="assessedAt" class="input" type="date" value="${todayDate()}" required /></label>
        </div>
        <div class="form-grid field-wide" data-record-fields="progress" hidden>
          <label class="field"><span>교재</span><input name="material" class="input" maxlength="80" placeholder="예: 개념서" disabled required /></label>
          <label class="field"><span>진도</span><input name="unit" class="input" maxlength="120" placeholder="예: 일차함수 3단원" disabled required /></label>
          <label class="field field-wide"><span>메모</span><textarea name="note" class="textarea" rows="3" maxlength="500" disabled></textarea></label>
          <label class="field field-wide"><span>기록일</span><input name="recordedAt" class="input" type="date" value="${todayDate()}" disabled required /></label>
        </div>
      </div>
      ${ready ? "" : `<p class="modal-note">기록할 학생과 수업을 먼저 등록해 주세요.</p>`}
      ${modalActions("기록 저장", !ready)}
    </form>
  `);
}

function openConsultationModal() {
  const grades = ["초1", "초2", "초3", "초4", "초5", "초6", "중1", "중2", "중3", "고1", "고2", "고3"];
  const schoolGoals = ["영재학교", "과학고", "자사고", "국제고", "외고", "일반고"];
  openModal("입학 상담 등록", `
    <form id="consultation-form">
      <div class="form-grid">
        <label class="field"><span>학생 이름</span><input name="applicantName" class="input" maxlength="40" autocomplete="off" required /></label>
        <label class="field"><span>학년</span><select name="grade" class="select" required><option value="">선택</option>${grades.map((item) => `<option>${item}</option>`).join("")}</select></label>
        <label class="field"><span>목표 학교</span><select name="targetSchool" class="select" required><option value="">선택</option>${schoolGoals.map((item) => `<option>${item}</option>`).join("")}</select></label>
        <label class="field"><span>상담 기준 월</span><input name="consultationMonth" class="input" type="month" value="${todayDate().slice(0, 7)}" required /></label>
        <label class="field"><span>수학 진도</span><input name="mathProgress" class="input" maxlength="40" placeholder="예: 중3-2학기" /></label>
        <label class="field"><span>과학 진도</span><input name="scienceProgress" class="input" maxlength="40" placeholder="예: 중2-2학기" /></label>
        <label class="field"><span>상담일</span><input name="consultedAt" class="input" type="date" value="${todayDate()}" required /></label>
        <label class="field"><span>상태</span><select name="status" class="select">${option("scheduled", "상담 예정", "scheduled")}${option("review", "결과 검토", "scheduled")}${option("completed", "완료", "scheduled")}</select></label>
        <label class="field"><span>진단평가</span><select name="diagnosticLabel" class="select"><option>평가 예정</option><option>진단 완료</option><option>진단 면제</option></select></label>
        <label class="field"><span>추천 반</span><input name="recommendedClass" class="input" maxlength="80" placeholder="미정" /></label>
        <label class="field field-wide"><span>상담 내용</span><textarea name="note" class="textarea" rows="4" maxlength="1000" placeholder="상담 내용과 요청 사항을 입력하세요."></textarea></label>
      </div>
      ${modalActions("상담 저장")}
    </form>
  `);
}

function openModal(title, body) {
  elements.modalRoot.innerHTML = `<div class="modal-overlay"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header class="modal-header"><h2 id="modal-title">${e(title)}</h2><button class="icon-button" type="button" data-modal-close aria-label="닫기" title="닫기"><i data-lucide="x"></i></button></header><div class="modal-body">${body}</div></section></div>`;
  document.body.classList.add("modal-open");
  refreshIcons();
  elements.modalRoot.querySelector("input:not([disabled]), select:not([disabled])")?.focus();
}

function closeModal() {
  elements.modalRoot.innerHTML = "";
  document.body.classList.remove("modal-open");
}

function modalActions(label, disabled = false) {
  return `<p class="modal-status" role="status"></p><div class="form-actions"><button class="button button-secondary" type="button" data-modal-close>취소</button><button class="button button-primary" type="submit" ${disabled ? "disabled" : ""}>${e(label)}</button></div>`;
}

function syncLearningRecordFields() {
  const type = elements.modalRoot.querySelector("#record-type")?.value;
  elements.modalRoot.querySelectorAll("[data-record-fields]").forEach((group) => {
    const active = group.dataset.recordFields === type;
    group.hidden = !active;
    group.querySelectorAll("input, textarea, select").forEach((field) => { field.disabled = !active; });
  });
}

async function saveLearningRecord(form) {
  const values = Object.fromEntries(new FormData(form));
  const student = state.data.students.find((item) => item.id === values.studentId);
  const classItem = state.data.classes.find((item) => item.id === values.classId);
  if (!student || !classItem) return setModalStatus("학생과 수업 정보를 다시 선택해 주세요.");

  const common = {
    studentId: student.id,
    studentName: student.name,
    classId: classItem.id,
    className: classItem.name,
    teacherUid: hasRole("teacher") && !hasRole("academic_admin") ? state.user.uid : classItem.teacherUids?.[0] || state.user.uid,
    createdBy: state.user.uid
  };
  let collection;
  let record;
  if (values.recordType === "assessment") {
    if (Number(values.score) > Number(values.maxScore)) return setModalStatus("점수는 총점보다 클 수 없습니다.");
    collection = "assessmentResults";
    record = { ...common, title: values.title.trim(), score: Number(values.score), maxScore: Number(values.maxScore), assessedAt: values.assessedAt };
  } else {
    collection = "progressRecords";
    record = { ...common, material: values.material.trim(), unit: values.unit.trim(), note: values.note.trim(), recordedAt: values.recordedAt };
  }
  await persistModalRecord(form, collection, record, () => {
    state.data[collection].unshift(record);
    closeModal();
    renderLearning();
    refreshIcons();
    showToast("학습 기록을 저장했습니다.");
  });
}

async function saveConsultation(form) {
  const values = Object.fromEntries(new FormData(form));
  const record = {
    applicantName: values.applicantName.trim(),
    grade: values.grade,
    targetSchool: values.targetSchool,
    consultationMonth: values.consultationMonth,
    mathProgress: values.mathProgress.trim(),
    scienceProgress: values.scienceProgress.trim(),
    consultedAt: values.consultedAt,
    status: values.status,
    diagnosticLabel: values.diagnosticLabel,
    recommendedClass: values.recommendedClass.trim() || "미정",
    note: values.note.trim(),
    createdBy: state.user.uid
  };
  await persistModalRecord(form, "consultations", record, () => {
    state.data.consultations.unshift(record);
    closeModal();
    renderAdmissions();
    refreshIcons();
    showToast("상담을 등록했습니다.");
  });
}

async function persistModalRecord(form, collection, record, onSuccess) {
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true;
  setModalStatus("저장하고 있습니다.", false);
  try {
    if (state.store) {
      const saved = await state.store.createDocument(collection, record);
      record.id = saved.id;
    } else {
      record.id = `demo-${Date.now()}`;
    }
    onSuccess();
  } catch (error) {
    submit.disabled = false;
    setModalStatus(error.message || "저장하지 못했습니다.");
  }
}

function setModalStatus(message, error = true) {
  const status = elements.modalRoot.querySelector(".modal-status");
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("error", error);
}

function todayDate() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

function buildRecommendation(consultation, classes) {
  const profiles = {
    "영재학교": ["수학", "과학"],
    "과학고": ["수학", "과학"],
    "자사고": ["수학", "과학", "영어", "국어"],
    "국제고": ["영어", "국어", "사회"],
    "외고": ["영어", "국어", "사회"],
    "일반고": ["수학", "영어", "국어", "과학"]
  };
  const subjects = profiles[consultation.targetSchool] || [...new Set(classes.map(courseSubject).filter(Boolean))];
  const progressBySubject = {
    "수학": stageRank(consultation.mathProgress),
    "과학": stageRank(consultation.scienceProgress)
  };
  const courses = classes.filter((item) => {
    const subject = courseSubject(item);
    if (!subjects.includes(subject)) return false;
    if (Array.isArray(item.targetSchools) && item.targetSchools.length && !item.targetSchools.includes(consultation.targetSchool)) return false;
    const completedRank = progressBySubject[subject] || 0;
    const itemRank = stageRank(item.stage || item.level || item.name);
    return !completedRank || !itemRank || itemRank > completedRank;
  }).sort((a, b) => {
    const subjectOrder = subjects.indexOf(courseSubject(a)) - subjects.indexOf(courseSubject(b));
    if (subjectOrder) return subjectOrder;
    return (Number(a.roadmapOrder) || stageRank(a.stage || a.level || a.name)) - (Number(b.roadmapOrder) || stageRank(b.stage || b.level || b.name));
  });
  const month = consultation.consultationMonth || String(consultation.consultedAt || "").slice(0, 7);
  const scheduledCourses = courses.filter((item) => isCourseOpenInMonth(item, month));
  return { subjects, courses, scheduledCourses };
}

function roadmapMarkup(recommendation) {
  if (!recommendation.courses.length) return `<div class="empty-roadmap"><strong>조건에 맞는 개설 과정이 없습니다.</strong><span>수업·반에 과목, 대상 학교와 과정 단계를 등록하면 자동으로 연결됩니다.</span></div>`;
  return `<div class="roadmap-board">${recommendation.subjects.map((subject) => {
    const courses = recommendation.courses.filter((item) => courseSubject(item) === subject);
    if (!courses.length) return "";
    return `<div class="roadmap-lane"><div class="roadmap-lane-title"><span class="subject-swatch ${subjectClass(subject)}"></span><strong>${e(subject)}</strong></div><div class="roadmap-track">${courses.map((item, index) => `<article class="roadmap-course ${subjectClass(subject)}"><span>${e(coursePeriod(item, index))}</span><strong>${e(item.name)}</strong><small>${e((item.teacherNames || []).join(", ") || "담당 미정")}</small></article>`).join("")}</div></div>`;
  }).join("")}</div>`;
}

function weeklyScheduleMarkup(courses) {
  const days = ["월", "화", "수", "목", "금", "토", "일"];
  const sessions = courses.flatMap((course) => courseSessions(course).map((session) => ({ ...session, course })));
  if (!sessions.length) return `<div class="empty-roadmap"><strong>배치할 수업 시간이 없습니다.</strong><span>개설 수업에 요일과 시작·종료 시간을 등록해 주세요.</span></div>`;
  const cells = Array.from({ length: 26 * 7 }, (_, index) => `<span class="schedule-cell" style="grid-column:${(index % 7) + 2};grid-row:${Math.floor(index / 7) + 2}"></span>`).join("");
  const times = Array.from({ length: 14 }, (_, index) => `<span class="schedule-time" style="grid-column:1;grid-row:${index * 2 + 2}">${String(index + 9).padStart(2, "0")}:00</span>`).join("");
  const events = sessions.map(({ course, day, start, end }) => {
    const dayIndex = days.indexOf(day);
    const startMinutes = timeMinutes(start);
    const endMinutes = timeMinutes(end);
    if (dayIndex < 0 || startMinutes < 540 || startMinutes >= 1320) return "";
    const row = Math.floor((startMinutes - 540) / 30) + 2;
    const span = Math.max(1, Math.ceil((Math.min(endMinutes, 1320) - startMinutes) / 30));
    return `<article class="schedule-event ${subjectClass(courseSubject(course))}" style="grid-column:${dayIndex + 2};grid-row:${row} / span ${span}"><strong>${e(course.name)}</strong><span>${e(start)}~${e(end)}</span><small>${e((course.teacherNames || []).join(", ") || "담당 미정")}</small></article>`;
  }).join("");
  return `<div class="schedule-panel"><div class="schedule-scroll"><div class="weekly-grid"><span class="schedule-corner"></span>${days.map((day, index) => `<strong class="schedule-day" style="grid-column:${index + 2}">${day}</strong>`).join("")}${times}${cells}${events}</div></div><div class="schedule-list"><strong>자동 선택 수업</strong>${sessions.map(({ course, day, start, end }) => `<span><i class="subject-swatch ${subjectClass(courseSubject(course))}"></i>${e(day)} ${e(start)}~${e(end)} · ${e(course.name)}</span>`).join("")}</div></div>`;
}

function courseSubject(item) {
  const text = `${item.category || ""} ${item.subject || ""} ${item.name || ""}`;
  return ["수학", "과학", "영어", "국어", "사회"].find((subject) => text.includes(subject)) || item.category || item.subject || "기타";
}

function subjectClass(subject) {
  return { "수학": "subject-math", "과학": "subject-science", "영어": "subject-english", "국어": "subject-korean", "사회": "subject-social" }[subject] || "subject-other";
}

function stageRank(value) {
  const text = String(value || "");
  const match = text.match(/([초중고])(\d)/);
  if (!match) return 0;
  const base = { "초": 0, "중": 6, "고": 9 }[match[1]] + Number(match[2]);
  const semester = /(?:-|\s)(2)|2학기/.test(text) ? 2 : 1;
  return base * 2 + semester;
}

function isCourseOpenInMonth(item, month) {
  if (!month || (!item.openFrom && !item.openUntil)) return true;
  return (!item.openFrom || month >= item.openFrom) && (!item.openUntil || month <= item.openUntil);
}

function coursePeriod(item, index) {
  if (item.openFrom || item.openUntil) return `${item.openFrom || "현재"} ~ ${item.openUntil || "계속"}`;
  return item.stage || item.level || `${index + 1}단계`;
}

function courseSessions(item) {
  if (Array.isArray(item.sessions) && item.sessions.length) {
    return item.sessions.map((session) => ({ day: session.day, start: session.start, end: session.end || addMinutes(session.start, item.durationMinutes || 120) }));
  }
  const schedule = String(item.schedule || "");
  const timeMatches = [...schedule.matchAll(/(\d{1,2}):(\d{2})/g)];
  if (!timeMatches.length) return [];
  const start = `${timeMatches[0][1].padStart(2, "0")}:${timeMatches[0][2]}`;
  const end = timeMatches[1] ? `${timeMatches[1][1].padStart(2, "0")}:${timeMatches[1][2]}` : addMinutes(start, item.durationMinutes || 120);
  const dayText = schedule.slice(0, timeMatches[0].index);
  return [...new Set([...dayText].filter((character) => "월화수목금토일".includes(character)))].map((day) => ({ day, start, end }));
}

function timeMinutes(value) {
  const [hour, minute] = String(value || "0:0").split(":").map(Number);
  return hour * 60 + minute;
}

function addMinutes(value, amount) {
  const total = timeMinutes(value) + amount;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function studentRow(student) {
  return `<tr data-selectable data-student-id="${e(student.id)}"><td><div class="table-primary"><strong>${e(student.name)}</strong><span>${e(student.schoolName || "학교 미등록")}</span></div></td><td>${e(student.grade || "미등록")}</td><td>${e((student.activeClassNames || []).join(", ") || "없음")}</td><td>${studentStatusBadge(student.status)}</td></tr>`;
}

function studentDetail(student) {
  if (!student) return `<aside class="detail-panel"><div class="empty-state">학생을 선택해 주세요.</div></aside>`;
  const results = state.data.assessmentResults.filter((item) => item.studentId === student.id);
  const progress = state.data.progressRecords.filter((item) => item.studentId === student.id);
  const timeline = [
    ...results.map((item) => ({ date: item.assessedAt, title: `${item.title} ${item.score}/${item.maxScore}`, type: "평가" })),
    ...progress.map((item) => ({ date: item.recordedAt, title: `${item.material} · ${item.unit}`, type: "진도" }))
  ].sort((a, b) => b.date.localeCompare(a.date));
  return `<aside class="detail-panel">
    <div class="detail-header"><h2>${e(student.name)}</h2><p>${e(student.externalId || "외부 식별번호 미등록")}</p></div>
    <div class="detail-section"><h3>현재 학사 정보</h3><dl class="detail-list"><div><dt>학교·학년</dt><dd>${e(student.schoolName || "-")} · ${e(student.grade || "-")}</dd></div><div><dt>수강 반</dt><dd>${e((student.activeClassNames || []).join(", ") || "없음")}</dd></div><div><dt>상태</dt><dd>${studentStatusLabel(student.status)}</dd></div></dl></div>
    <div class="detail-section"><h3>최근 기록</h3><div class="timeline">${timeline.length ? timeline.slice(0, 6).map((item) => `<div class="timeline-item"><strong>${e(item.title)}</strong><span>${e(item.date)} · ${e(item.type)}</span></div>`).join("") : `<span class="section-meta">기록이 없습니다.</span>`}</div></div>
  </aside>`;
}

function assessmentTable(items) {
  return `<div class="data-panel"><div class="table-scroll"><table class="data-table"><thead><tr><th>학생</th><th>수업</th><th>평가</th><th>점수</th><th>평가일</th></tr></thead><tbody>${items.length ? items.map((item) => `<tr><td><strong>${e(item.studentName)}</strong></td><td>${e(item.className)}</td><td>${e(item.title)}</td><td>${e(item.score)} / ${e(item.maxScore)}</td><td>${e(item.assessedAt)}</td></tr>`).join("") : `<tr><td colspan="5" class="empty-state">평가 기록이 없습니다.</td></tr>`}</tbody></table></div></div>`;
}

function progressTable(items) {
  return `<div class="data-panel"><div class="table-scroll"><table class="data-table"><thead><tr><th>학생</th><th>수업</th><th>교재</th><th>진도</th><th>기록일</th></tr></thead><tbody>${items.length ? items.map((item) => `<tr><td><strong>${e(item.studentName)}</strong></td><td>${e(item.className)}</td><td>${e(item.material)}</td><td><div class="table-primary"><strong>${e(item.unit)}</strong><span>${e(item.note || "")}</span></div></td><td>${e(item.recordedAt)}</td></tr>`).join("") : `<tr><td colspan="5" class="empty-state">진도 기록이 없습니다.</td></tr>`}</tbody></table></div></div>`;
}

function learningTable(results, progress) {
  const rows = [
    ...results.map((item) => ({ studentName: item.studentName, className: item.className, record: `${item.title} ${item.score}/${item.maxScore}`, date: item.assessedAt, type: "평가" })),
    ...progress.map((item) => ({ studentName: item.studentName, className: item.className, record: `${item.material} · ${item.unit}`, date: item.recordedAt, type: "진도" }))
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  return `<div class="data-panel"><div class="table-scroll"><table class="data-table"><thead><tr><th>학생</th><th>수업</th><th>구분</th><th>기록</th><th>날짜</th></tr></thead><tbody>${rows.length ? rows.map((item) => `<tr><td><strong>${e(item.studentName)}</strong></td><td>${e(item.className)}</td><td><span class="badge">${e(item.type)}</span></td><td>${e(item.record)}</td><td>${e(item.date)}</td></tr>`).join("") : `<tr><td colspan="5" class="empty-state">학습 기록이 없습니다.</td></tr>`}</tbody></table></div></div>`;
}

function importPreviewMarkup(preview) {
  if (preview.error) return `<section class="section"><div class="notice"><i data-lucide="triangle-alert"></i><span>${e(preview.error)}</span></div></section>`;
  return `<section class="section">
    <div class="section-header"><div><h2 class="section-title">가져오기 미리보기</h2><span class="section-meta">Firebase에는 아직 저장되지 않음</span></div><button class="button button-primary" type="button" disabled>가져오기 확정</button></div>
    <div class="import-summary"><div><span>신규</span><strong>${preview.summary.create}</strong></div><div><span>변경</span><strong>${preview.summary.update}</strong></div><div><span>동일</span><strong>${preview.summary.skip}</strong></div><div><span>오류</span><strong>${preview.summary.error}</strong></div></div>
    <div class="data-panel"><div class="table-scroll"><table class="data-table"><thead><tr><th>행</th><th>학생</th><th>학교·학년</th><th>반</th><th>처리</th></tr></thead><tbody>
      ${preview.rows.slice(0, 100).map((item) => `<tr><td>${item.rowNumber}</td><td><div class="table-primary"><strong>${e(item.record.name || "이름 없음")}</strong><span>${e(item.record.externalId || "식별번호 없음")}</span></div></td><td>${e(item.record.schoolName || "-")} · ${e(item.record.grade || "-")}</td><td>${e(item.record.className || "-")}</td><td>${importActionBadge(item)}</td></tr>`).join("")}
    </tbody></table></div></div>
  </section>`;
}

function importActionBadge(item) {
  const values = {
    create: ["success", "신규"],
    update: ["warning", "변경"],
    skip: ["neutral", "동일"],
    error: ["danger", item.errors.join(", ") || "오류"]
  };
  const [className, label] = values[item.action] || values.error;
  return `<span class="badge ${className}">${e(label)}</span>`;
}

function moduleButton(view, icon, title, description) {
  const disallowed = (view === "imports" && !hasRole("academic_admin")) || (["admissions", "timetable"].includes(view) && !hasRole("academic_admin") && !hasRole("counselor"));
  if (disallowed) return "";
  return `<button class="module-link" type="button" data-open-view="${view}"><span class="module-icon"><i data-lucide="${icon}"></i></span><span><strong>${e(title)}</strong><span>${e(description)}</span></span></button>`;
}

function metric(label, value, detail) {
  return `<div class="metric"><span>${e(label)}</span><strong>${e(value)}</strong><small>${e(detail)}</small></div>`;
}

function option(value, label, selected) {
  return `<option value="${e(value)}" ${value === selected ? "selected" : ""}>${e(label)}</option>`;
}

function studentStatusBadge(status) {
  const values = { active: ["success", "재원"], paused: ["warning", "휴원"], inactive: ["neutral", "퇴원"] };
  const [className, label] = values[status] || values.inactive;
  return `<span class="badge ${className}">${label}</span>`;
}

function studentStatusLabel(status) {
  return { active: "재원", paused: "휴원", inactive: "퇴원" }[status] || "미등록";
}

function statusBadge(status) {
  const values = { scheduled: ["warning", "상담 예정"], review: ["success", "결과 검토"], completed: ["neutral", "완료"] };
  const [className, label] = values[status] || values.completed;
  return `<span class="badge ${className}">${label}</span>`;
}

function hasRole(role) {
  return Boolean(state.user?.roles?.includes(role));
}

function roleLabel(roles = []) {
  if (roles.includes("academic_admin")) return "학사 관리자";
  if (roles.includes("counselor")) return "상담 관리자";
  if (roles.includes("teacher")) return "선생님";
  return "사용자";
}

function setLoginStatus(message, error = true) {
  elements.loginStatus.textContent = message;
  elements.loginStatus.style.color = error ? "var(--danger)" : "var(--ink-500)";
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  elements.toastRoot.append(toast);
  setTimeout(() => toast.remove(), 3200);
}

function refreshIcons() {
  if (window.lucide) window.lucide.createIcons();
}

function emptyData() {
  return { students: [], classes: [], enrollments: [], assessmentResults: [], progressRecords: [], consultations: [], diagnosticResults: [], importBatches: [] };
}

function e(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}

