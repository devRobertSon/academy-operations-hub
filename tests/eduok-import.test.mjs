import test from "node:test";
import assert from "node:assert/strict";
import { buildEduokImportPreview, parseCsv, resolveEduokColumns } from "../src/lib/eduok-import.js";

test("parseCsv handles quoted commas and escaped quotes", () => {
  const rows = parseCsv('원생명,메모\r\n"샘플 학생","복습, 필요"\r\n"샘플 ""학생"" 2",완료');
  assert.deepEqual(rows, [
    ["원생명", "메모"],
    ["샘플 학생", "복습, 필요"],
    ['샘플 "학생" 2', "완료"]
  ]);
});

test("resolveEduokColumns accepts common Korean aliases", () => {
  assert.deepEqual(resolveEduokColumns(["원생번호", "원생명", "재원상태", "수강반", "학교명", "학년"]), {
    externalId: 0,
    name: 1,
    status: 2,
    className: 3,
    schoolName: 4,
    grade: 5,
    enrolledAt: -1
  });
});

test("buildEduokImportPreview separates create, update, skip and error rows", () => {
  const csv = [
    "원생번호,원생명,재원상태,수강반,학교명,학년",
    "S001,샘플 학생 1,재원,중2 수학 A,샘플중,중2",
    "S002,샘플 학생 2,재원,중3 수학 B,샘플중,중3",
    "S003,샘플 학생 3,휴원,중1 수학,샘플중,중1",
    "S003,중복 학생,재원,중1 수학,샘플중,중1"
  ].join("\n");
  const existing = [
    { externalId: "S001", name: "샘플 학생 1", status: "active", schoolName: "샘플중", grade: "중2", activeClassNames: ["중2 수학 A"] },
    { externalId: "S002", name: "샘플 학생 2", status: "paused", schoolName: "샘플중", grade: "중3", activeClassNames: ["중3 수학 B"] }
  ];

  const preview = buildEduokImportPreview(csv, existing);
  assert.equal(preview.error, "");
  assert.deepEqual(preview.summary, { create: 1, update: 1, skip: 1, error: 1 });
});

test("buildEduokImportPreview rejects files without a student-name column", () => {
  const preview = buildEduokImportPreview("번호,학년\n1,중1");
  assert.match(preview.error, /학생명/);
});
