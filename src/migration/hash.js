function sortDeep(value) {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (!value || typeof value !== 'object') return value;

  const out = {};
  Object.keys(value)
    .sort()
    .forEach((key) => {
      out[key] = sortDeep(value[key]);
    });
  return out;
}

export function stableStringify(value) {
  return JSON.stringify(sortDeep(value));
}

export function fnv1aHash(input) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function hashValue(value) {
  return fnv1aHash(stableStringify(value));
}

export function createSnapshotHash(snapshotLike) {
  return `snap_${hashValue(snapshotLike)}`;
}
