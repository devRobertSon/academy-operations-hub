# Academy Operations Hub

Robertson 학원의 학생, 수업, 평가, 진도, 입학 상담과 학습 로드맵을 관리하는 정적 웹 포털입니다.

## 서비스 분리

- `academy.robertson.kr`: 이 저장소의 학사·상담 포털
- `payroll.robertson.kr`: 기존 `academy-payroll-console` 급여 포털
- Firebase 프로젝트도 학사와 급여를 분리합니다.

## 현재 구현 범위

- 관리자와 선생님 역할별 메뉴
- 학생·반·단원평가·진도·상담 현황 화면
- 선생님의 담당 학생·반 범위 제한 구조
- 에듀오케이 CSV 가져오기 미리보기와 중복 분류
- Firestore 데이터 모델, 보안 규칙과 색인
- 개인정보처리방침·서비스 약관 운영 전 초안
- GitHub Pages `Deploy from a branch` 배포 구조

실제 개인정보, 학생 내보내기 파일, Firebase 비밀정보는 저장소에 넣지 않습니다.

## 로컬 확인

```powershell
npm start
```

- 관리자 미리보기: `http://127.0.0.1:4174/?demo=admin`
- 선생님 미리보기: `http://127.0.0.1:4174/?demo=teacher`

데모 진입은 `localhost`와 `127.0.0.1`에서만 작동합니다.

## QA

```powershell
npm test
npm run check
npm run qa
```

간단한 수정은 영향받는 테스트와 `npm run check`만 실행합니다. 기능·권한·배포 구조 변경은 전체 `npm run qa`를 실행합니다.

## 설정 순서

1. 새 Firebase 프로젝트를 생성합니다.
2. Authentication에서 Google 로그인을 사용 설정합니다.
3. Cloud Firestore를 생성하고 `firestore.rules`와 색인을 게시합니다.
4. 웹 앱을 등록하고 `src/config.js`의 빈 Firebase 공개 설정을 채웁니다.
5. 첫 관리자 UID로 `users/{uid}` 문서를 Firebase 콘솔에서 직접 생성합니다.
6. GitHub Pages를 `main` 브랜치의 `/ (root)`에서 배포합니다.
7. Cloudflare에 `academy` CNAME을 추가하고 GitHub Pages 사용자 지정 도메인을 설정합니다.

세부 절차는 [Firebase 설정](docs/firebase-setup.md), [구조](docs/architecture.md), [데이터 모델](docs/firestore-schema.md), [에듀오케이 가져오기](docs/eduok-import.md)를 확인합니다.

## 배포 원칙

- `.github/workflows`를 만들지 않습니다.
- GitHub Pages는 저장소 설정의 `Deploy from a branch`를 사용합니다.
- 학생·상담·평가 자료는 Git에 커밋하지 않습니다.
- 원본 파일은 가져오기 미리보기 단계에서 브라우저 안에서만 읽습니다.
