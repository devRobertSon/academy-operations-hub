# Firestore 데이터 모델

## 사용자와 권한

### `users/{uid}`

```json
{
  "displayName": "사용자 이름",
  "email": "user@example.invalid",
  "roles": ["teacher"],
  "status": "active",
  "teacherId": "teacher-id"
}
```

첫 `academic_admin` 문서는 Firebase 콘솔에서 직접 만듭니다. 클라이언트는 스스로 관리자 권한을 부여할 수 없습니다.

### `accessRequests/{uid}`

처음 로그인한 Google 계정의 승인 요청입니다. `pending`, `approved`, `rejected` 상태를 사용합니다.

## 학생과 수업

### `students/{studentId}`

학습 업무에 필요한 최소 학생정보만 저장합니다.

- `externalId`: 에듀오케이의 안정적인 학생 식별번호
- `name`, `schoolName`, `grade`, `status`
- `activeClassIds`, `activeClassNames`
- `activeTeacherUids`: 현재 담당 선생님 읽기 권한
- `source`, `sourceUpdatedAt`, `updatedAt`

### `studentPrivate/{studentId}`

보호자 이름·연락처·주소 등 상담 관리자에게만 필요한 정보를 분리합니다. 선생님은 읽을 수 없습니다.

### `classes/{classId}`

- `externalId`, `name`, `category`
- `scheduleSlots`, `room`, `capacity`
- `teacherUids`, `teacherNames`
- `status`, `effectiveFrom`, `effectiveTo`

### `enrollments/{enrollmentId}`

학생의 수강 이력을 덮어쓰지 않고 기간별 문서로 보존합니다.

- `studentId`, `classId`
- `teacherUids`
- `startedAt`, `endedAt`, `status`
- `source`, `externalId`

## 학습 기록

### `assessmentDefinitions/{assessmentId}`

평가명, 단원, 만점, 평가 기준과 버전을 저장합니다.

### `assessmentResults/{resultId}`

- `studentId`, `classId`, `assessmentId`
- `score`, `maxScore`, `assessedAt`
- `teacherUid`, `createdBy`, `createdAt`, `updatedAt`
- `revision`, `status`

### `progressRecords/{recordId}`

- `studentId`, `classId`
- `material`, `unit`, `note`, `recordedAt`
- `teacherUid`, `createdBy`, `createdAt`, `updatedAt`

평가와 진도 삭제는 학사 관리자만 할 수 있습니다. 선생님 수정 시 학생·반·작성자 식별자는 변경할 수 없습니다.

## 입학 상담

### `consultations/{consultationId}`

상담자, 보호자, 상담일, 상담 내용, 상태와 등록 전환 결과를 저장합니다.

### `diagnosticResults/{resultId}`

진단평가 템플릿 버전, 영역별 점수, 해석 기준과 관리자 확정 상태를 저장합니다.

### `roadmapPlans/{planId}`

추천 수업, 적용 시간표 버전, 학습 단계와 관리자 확정본을 저장합니다. 시간표가 바뀌어도 과거 상담 결과가 변하지 않도록 스냅샷을 보존합니다.

## 외부 연동과 감사

### `importBatches/{batchId}`

파일명, 해시, 미리보기·확정 상태, 신규·변경·제외·오류 건수와 수행자를 저장합니다. 원본 CSV 내용은 저장하지 않습니다.

### `externalMappings/{mappingId}`

에듀오케이 외부 ID와 내부 문서 ID를 연결합니다.

### `auditLogs/{logId}`

중요 변경의 수행자, 대상, 시각과 작업 유형을 보존합니다. 수정과 삭제을 허용하지 않습니다.
