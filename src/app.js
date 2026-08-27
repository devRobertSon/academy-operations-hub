import { appConfig, isFirebaseConfigured } from "./config.js";
import {
  demoAssessmentResults,
  demoClasses,
  demoConsultations,
  demoImportBatches,
  demoProgressRecords,
  demoStudents,
  demoUsers
} from "./data/demo-data.js";
import { buildEduokImportPreview } from "./lib/eduok-import.js";
import { createFirebaseStore } from "./lib/firebase-store.js";

const state = {
  user: null,
  view: "dashboard",
  search: "",
  studentStatus: "all",
  selectedStudentId: null,
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
  elements.content.addEventListener("click", handleContentClick);
  elements.content.addEventListener("input", handleContentInput);
  elements.content.addEventListener("change", handleContentChange);
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
  elements.topbarActions.innerHTML = `<button class="button button-primary" type="button" data-toast="평가·진도 입력 화면은 다음 단계에서 Firestore 저장과 연결합니다."><i data-lucide="plus"></i>기록 입력</button>`;
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
  elements.topbarActions.innerHTML = `<button class="button button-primary" type="button" data-toast="상담 등록 양식은 진단평가 서식을 받은 뒤 연결합니다."><i data-lucide="plus"></i>상담 등록</button>`;
  elements.content.innerHTML = `
    <div class="metric-strip">
      ${metric("상담 예정", `${state.data.consultations.filter((item) => item.status === "scheduled").length}건`, "일정 등록")}
      ${metric("결과 검토", `${state.data.consultations.filter((item) => item.status === "review").length}건`, "진단 완료")}
      ${metric("원서 작성", "0건", "출력 대기")}
      ${metric("등록 전환", "0명", "이번 달")}
    </div>
    <section class="section"><div class="section-header"><div><h2 class="section-title">상담 목록</h2><span class="section-meta">진단평가와 추천 반</span></div></div>
      <div class="data-panel"><div class="table-scroll"><table class="data-table"><thead><tr><th>상담 학생</th><th>학년</th><th>상담일</th><th>진단평가</th><th>추천 반</th><th>상태</th></tr></thead><tbody>
        ${state.data.consultations.length ? state.data.consultations.map((item) => `<tr><td><strong>${e(item.applicantName)}</strong></td><td>${e(item.grade)}</td><td>${e(item.consultedAt)}</td><td>${e(item.diagnosticLabel)}</td><td>${e(item.recommendedClass)}</td><td>${statusBadge(item.status)}</td></tr>`).join("") : `<tr><td colspan="6" class="empty-state">등록된 상담이 없습니다.</td></tr>`}
      </tbody></table></div></div>
    </section>
  `;
}

function renderTimetable() {
  if (!hasRole("academic_admin") && !hasRole("counselor")) return renderDashboard();
  setPage("입학 · 배정", "시간표 · 로드맵");
  elements.content.innerHTML = `
    <div class="notice"><i data-lucide="info" aria-hidden="true"></i><span>시간표 원본과 반 배정 기준을 받은 뒤 진단 결과, 수업 시간, 정원과 선수 단계를 함께 계산합니다.</span></div>
    <section class="section"><div class="section-header"><div><h2 class="section-title">개설 시간표</h2><span class="section-meta">로드맵 배정 기준</span></div></div>
      <div class="data-panel"><div class="table-scroll"><table class="data-table"><thead><tr><th>반</th><th>수업 시간</th><th>선생님</th><th>정원</th><th>배정 가능</th></tr></thead><tbody>
        ${state.data.classes.map((item) => `<tr><td><strong>${e(item.name)}</strong></td><td>${e(item.schedule)}</td><td>${e((item.teacherNames || []).join(", "))}</td><td>${e(item.studentCount)} / ${e(item.capacity)}</td><td>${item.studentCount < item.capacity ? `<span class="badge success">가능</span>` : `<span class="badge warning">검토</span>`}</td></tr>`).join("")}
      </tbody></table></div></div>
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

