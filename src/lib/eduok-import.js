const COLUMN_ALIASES = {
  externalId: ["학생번호", "원생번호", "회원번호", "student_id", "id"],
  name: ["학생명", "원생명", "이름", "성명", "student_name", "name"],
  status: ["상태", "재원상태", "학생상태", "status"],
  className: ["반명", "학급명", "수강반", "강좌명", "class_name", "class"],
  schoolName: ["학교", "학교명", "school_name", "school"],
  grade: ["학년", "grade"],
  enrolledAt: ["등록일", "입학일", "수강시작일", "enrolled_at"]
};

const STATUS_MAP = new Map([
  ["재원", "active"],
  ["재학생", "active"],
  ["수강", "active"],
  ["active", "active"],
  ["휴원", "paused"],
  ["휴학생", "paused"],
  ["paused", "paused"],
  ["퇴원", "inactive"],
  ["퇴학생", "inactive"],
  ["inactive", "inactive"]
]);

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];
    if (character === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }

  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

export function resolveEduokColumns(headers) {
  const normalizedHeaders = headers.map(normalizeHeader);
  return Object.fromEntries(Object.entries(COLUMN_ALIASES).map(([field, aliases]) => {
    const aliasSet = new Set(aliases.map(normalizeHeader));
    return [field, normalizedHeaders.findIndex((header) => aliasSet.has(header))];
  }));
}

export function buildEduokImportPreview(csvText, existingStudents = []) {
  const rows = parseCsv(csvText.replace(/^\uFEFF/, ""));
  if (rows.length < 2) return emptyPreview("머리글과 학생 행이 포함된 CSV 파일이 필요합니다.");

  const columns = resolveEduokColumns(rows[0]);
  if (columns.name < 0) return emptyPreview("학생명 또는 원생명 열을 찾을 수 없습니다.");

  const existingByExternalId = new Map(existingStudents.filter((item) => item.externalId).map((item) => [item.externalId, item]));
  const existingByFallback = new Map(existingStudents.map((item) => [fallbackKey(item), item]));
  const seenKeys = new Set();
  const previewRows = rows.slice(1).map((source, rowIndex) => {
    const record = normalizeEduokRecord(source, columns);
    const errors = [];
    if (!record.name) errors.push("학생명 누락");
    const key = record.externalId || fallbackKey(record);
    if (seenKeys.has(key)) errors.push("파일 내 중복");
    seenKeys.add(key);

    const existing = record.externalId
      ? existingByExternalId.get(record.externalId)
      : existingByFallback.get(fallbackKey(record));
    const action = errors.length ? "error" : existing ? (hasChanges(existing, record) ? "update" : "skip") : "create";
    return { rowNumber: rowIndex + 2, record, action, errors };
  });

  return {
    error: "",
    columns,
    rows: previewRows,
    summary: summarizeActions(previewRows)
  };
}

export function normalizeEduokRecord(source, columns) {
  const read = (field) => columns[field] >= 0 ? String(source[columns[field]] || "").trim() : "";
  const rawStatus = read("status").toLowerCase();
  return {
    externalId: read("externalId"),
    name: read("name"),
    status: STATUS_MAP.get(rawStatus) || "active",
    className: read("className"),
    schoolName: read("schoolName"),
    grade: read("grade"),
    enrolledAt: read("enrolledAt")
  };
}

function normalizeHeader(value) {
  return String(value || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function fallbackKey(record) {
  return [record.name, record.schoolName, record.grade].map((value) => String(value || "").trim().toLowerCase()).join("|");
}

function hasChanges(existing, incoming) {
  return ["name", "status", "schoolName", "grade"].some((field) => String(existing[field] || "") !== String(incoming[field] || ""))
    || (incoming.className && !(existing.activeClassNames || []).includes(incoming.className));
}

function summarizeActions(rows) {
  return rows.reduce((summary, row) => {
    summary[row.action] += 1;
    return summary;
  }, { create: 0, update: 0, skip: 0, error: 0 });
}

function emptyPreview(error) {
  return { error, columns: {}, rows: [], summary: { create: 0, update: 0, skip: 0, error: 0 } };
}
