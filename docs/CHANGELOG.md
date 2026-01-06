# Changelog

모든 주목할 만한 변경 사항이 이 파일에 문서화됩니다.

이 프로젝트는 [Semantic Versioning](https://semver.org/)을 따릅니다.

## [Unreleased]

### 계획됨
- 주파수 도메인 HRV 분석 (LF/HF ratio)
- 감정 인식 기능
- 피로도 분석
- WebWorker 지원

---

## [1.0.0] - 2026-01-06

### Added
- 🎉 최초 릴리즈
- ✨ **심박수 측정 (rPPG)**
  - Butterworth 대역통과 필터 (0.75-3.0 Hz)
  - FFT 기반 주파수 분석
  - 신호 품질 지표
  - 45-180 BPM 범위 지원
- ✨ **HRV 분석**
  - SDNN (Standard Deviation of NN intervals)
  - RMSSD (Root Mean Square of Successive Differences)
  - pNN50 (Percentage of NN50)
  - 스트레스 지수 (0-100)
- ✨ **눈 깜빡임 감지**
  - EAR (Eye Aspect Ratio) 알고리즘
  - 분당 깜빡임 횟수
  - 깜빡임 패턴 안정성
- ✨ **시선 추적**
  - 시선 방향 (x, y)
  - 시선 안정성 점수
  - 화면 응시 감지
- ✨ **머리 자세 추정**
  - Pitch (상하)
  - Yaw (좌우)
  - Roll (기울기)
- ✨ **집중도 점수**
  - 가중치 기반 종합 점수 (0-100)
  - 실시간 및 세션 평균

### Technical
- TypeScript 5.3+ 지원
- ES2020 타겟
- CommonJS 및 ESM 모듈 지원
- 완전한 타입 정의 (.d.ts)

### Documentation
- README.md 작성
- API Reference 문서
- 아키텍처 문서
- 기여 가이드

---

## 버전 관리 정책

### 버전 번호 형식

`MAJOR.MINOR.PATCH`

- **MAJOR**: 호환되지 않는 API 변경
- **MINOR**: 하위 호환 기능 추가
- **PATCH**: 하위 호환 버그 수정

### 예시

- `1.0.0` → `1.0.1`: 버그 수정
- `1.0.0` → `1.1.0`: 새 기능 추가 (예: 감정 인식)
- `1.0.0` → `2.0.0`: API 변경 (예: processFrame 시그니처 변경)

---

## 릴리즈 프로세스

1. 변경 사항 작성 (이 파일)
2. package.json 버전 업데이트
3. 커밋 및 태그 생성
4. GitHub Release 자동 생성

```bash
# 패치 릴리즈
npm run release:patch

# 마이너 릴리즈
npm run release:minor

# 메이저 릴리즈
npm run release:major
```

---

[Unreleased]: https://github.com/excatt/SuperKiwiSDK/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/excatt/SuperKiwiSDK/releases/tag/v1.0.0
