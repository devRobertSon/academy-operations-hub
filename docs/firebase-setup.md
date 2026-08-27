# 새 Firebase 프로젝트 설정

이 문서는 `academy-operations-hub` 학사 포털만 위한 설정입니다. 기존 급여 프로젝트를 수정하지 않습니다.

## 권장 이름

- 프로젝트 표시 이름: `academy-operations-hub`
- 프로젝트 ID: Firebase가 제안한 사용 가능한 ID
- Gemini: 사용하지 않음
- Google Analytics: 내부 업무 포털에는 우선 사용하지 않음

프로젝트 ID는 생성 후 변경할 수 없지만 사용자 화면에는 표시되지 않으므로 자동으로 붙은 숫자가 있어도 괜찮습니다.

## 순서

1. Firebase 콘솔에서 프로젝트를 생성합니다.
2. 웹 앱 `academy-operations-web`을 등록합니다.
3. Authentication의 로그인 방법에서 Google을 사용 설정합니다.
4. 승인된 도메인에 `devrobertson.github.io`와 나중에 `academy.robertson.kr`을 추가합니다.
5. Cloud Firestore를 생성합니다.
6. 이 저장소의 `firestore.rules`를 규칙 탭에 붙여 넣고 게시합니다.
7. `firestore.indexes.json`의 복합 색인을 필요 시 Firebase CLI 또는 콘솔에서 생성합니다.
8. App Check에서 웹 앱과 reCAPTCHA v3를 연결합니다.
9. Firebase 웹 앱 공개 설정을 `src/config.js`에 입력합니다.

## 첫 관리자

Google 로그인만 사용 설정한 뒤 한 번 로그인하면 `accessRequests/{uid}`가 생성됩니다. Firebase Authentication 사용자 목록에서 UID를 확인하고 Firestore 콘솔에 다음 문서를 직접 만듭니다.

- 컬렉션: `users`
- 문서 ID: 로그인한 관리자의 UID

```json
{
  "displayName": "관리자 이름",
  "email": "관리자 Google 이메일",
  "roles": ["academic_admin", "counselor"],
  "status": "active"
}
```

Firebase 웹 설정 값과 App Check 사이트 키는 브라우저 앱 식별용 공개 값입니다. 서비스 계정 JSON, reCAPTCHA 비밀 키, OAuth 클라이언트 비밀 값은 저장소에 넣지 않습니다.
