export const demoUsers = {
  admin: {
    uid: "demo-admin",
    displayName: "운영 관리자",
    roles: ["academic_admin", "counselor"],
    status: "active"
  },
  teacher: {
    uid: "demo-teacher",
    displayName: "샘플 선생님",
    roles: ["teacher"],
    status: "active"
  }
};

export const demoStudents = [
  {
    id: "student-001",
    externalId: "EDUOK-S001",
    name: "샘플 학생 1",
    schoolName: "샘플중",
    grade: "중2",
    status: "active",
    activeClassNames: ["중2 수학 A"],
    activeTeacherUids: ["demo-teacher"]
  },
  {
    id: "student-002",
    externalId: "EDUOK-S002",
    name: "샘플 학생 2",
    schoolName: "샘플중",
    grade: "중3",
    status: "active",
    activeClassNames: ["중3 수학 B"],
    activeTeacherUids: ["demo-teacher"]
  },
  {
    id: "student-003",
    externalId: "EDUOK-S003",
    name: "샘플 학생 3",
    schoolName: "샘플고",
    grade: "고1",
    status: "inactive",
    activeClassNames: [],
    activeTeacherUids: []
  }
];

export const demoClasses = [
  {
    id: "class-001",
    name: "중2 수학 A",
    category: "수학",
    stage: "중2-1학기",
    targetSchools: ["영재학교", "과학고", "자사고", "일반고"],
    schedule: "월·수 17:00",
    room: "2강의실",
    studentCount: 8,
    capacity: 10,
    teacherUids: ["demo-teacher"],
    teacherNames: ["샘플 선생님"]
  },
  {
    id: "class-002",
    name: "중3 수학 B",
    category: "수학",
    stage: "중3-1학기",
    targetSchools: ["영재학교", "과학고", "자사고", "일반고"],
    schedule: "화·목 19:00",
    room: "1강의실",
    studentCount: 10,
    capacity: 12,
    teacherUids: ["demo-teacher"],
    teacherNames: ["샘플 선생님"]
  },
  {
    id: "class-003",
    name: "KMO 기하",
    category: "수학",
    stage: "중2-2학기",
    targetSchools: ["영재학교", "과학고"],
    schedule: "화 16:00~18:00",
    room: "3강의실",
    studentCount: 7,
    capacity: 10,
    teacherUids: ["demo-teacher"],
    teacherNames: ["샘플 선생님"]
  },
  {
    id: "class-004",
    name: "KMO 정수",
    category: "수학",
    stage: "중3-1학기",
    targetSchools: ["영재학교", "과학고"],
    schedule: "토 10:00~12:00",
    room: "2강의실",
    studentCount: 6,
    capacity: 10,
    teacherUids: ["demo-teacher"],
    teacherNames: ["샘플 선생님"]
  },
  {
    id: "class-005",
    name: "중등 심화과학",
    category: "과학",
    stage: "중2-1학기",
    targetSchools: ["영재학교", "과학고", "자사고", "일반고"],
    schedule: "금 16:00~18:00",
    room: "과학실",
    studentCount: 8,
    capacity: 12,
    teacherUids: ["demo-teacher"],
    teacherNames: ["샘플 선생님"]
  },
  {
    id: "class-006",
    name: "영재 파이널 과학",
    category: "과학",
    stage: "중3-1학기",
    targetSchools: ["영재학교"],
    schedule: "토 14:00~16:00",
    room: "과학실",
    studentCount: 5,
    capacity: 8,
    teacherUids: ["demo-teacher"],
    teacherNames: ["샘플 선생님"]
  }
];

export const demoAssessmentResults = [
  {
    id: "result-001",
    studentId: "student-001",
    studentName: "샘플 학생 1",
    classId: "class-001",
    className: "중2 수학 A",
    title: "일차함수 단원평가",
    score: 84,
    maxScore: 100,
    assessedAt: "2026-08-21",
    teacherUid: "demo-teacher"
  },
  {
    id: "result-002",
    studentId: "student-002",
    studentName: "샘플 학생 2",
    classId: "class-002",
    className: "중3 수학 B",
    title: "이차방정식 단원평가",
    score: 91,
    maxScore: 100,
    assessedAt: "2026-08-20",
    teacherUid: "demo-teacher"
  }
];

export const demoProgressRecords = [
  {
    id: "progress-001",
    studentId: "student-001",
    studentName: "샘플 학생 1",
    classId: "class-001",
    className: "중2 수학 A",
    material: "개념서",
    unit: "일차함수 3단원",
    note: "그래프 해석 복습 필요",
    recordedAt: "2026-08-22",
    teacherUid: "demo-teacher"
  },
  {
    id: "progress-002",
    studentId: "student-002",
    studentName: "샘플 학생 2",
    classId: "class-002",
    className: "중3 수학 B",
    material: "유형서",
    unit: "이차방정식 심화",
    note: "응용 문제 풀이 안정적",
    recordedAt: "2026-08-22",
    teacherUid: "demo-teacher"
  }
];

export const demoConsultations = [
  {
    id: "consultation-001",
    applicantName: "상담 학생 1",
    grade: "중1",
    targetSchool: "영재학교",
    consultationMonth: "2026-08",
    mathProgress: "중1-2학기",
    scienceProgress: "중1-1학기",
    diagnosticLabel: "진단 완료",
    consultedAt: "2026-08-26",
    status: "review",
    recommendedClass: "중1 기초반"
  },
  {
    id: "consultation-002",
    applicantName: "상담 학생 2",
    grade: "초6",
    targetSchool: "과학고",
    consultationMonth: "2026-08",
    mathProgress: "중1-1학기",
    scienceProgress: "초6-2학기",
    diagnosticLabel: "평가 예정",
    consultedAt: "2026-08-27",
    status: "scheduled",
    recommendedClass: "미정"
  }
];

export const demoImportBatches = [
  {
    id: "import-001",
    filename: "eduok_students_sample.csv",
    importedAt: "2026-08-25 14:30",
    createdCount: 2,
    updatedCount: 1,
    skippedCount: 0,
    status: "preview"
  }
];

