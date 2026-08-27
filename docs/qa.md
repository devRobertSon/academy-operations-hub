# QA 기준

## 간단한 수정

영향받는 단위 테스트와 정적 검사를 실행합니다.

```powershell
node --test tests/eduok-import.test.mjs
npm run check
```

## 기능·권한·구조 수정

```powershell
npm run qa
```

## 운영 전 수동 확인

- 관리자와 선생님 권한별 메뉴
- 선생님에게 담당하지 않은 학생이 보이지 않는지
- 모바일 390px, 태블릿 768px, 데스크톱 1440px 화면
- 에듀오케이 실제 익명 파일의 열 인식과 중복 분류
- Firestore 규칙 에뮬레이터의 허용·거부 테스트
- Google 로그인 팝업과 모바일 브라우저 로그인
- 개인정보처리방침의 운영자·보유기간·위탁 현황 확정
