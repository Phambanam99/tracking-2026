const FULL = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LIMITED = "ABCDEFGHJKLMNPQRSTUVWXYZ";

type NumericMapping = {
  hexStart: number;
  first: number;
  count: number;
  template: string;
};

type StrideMappingInput = {
  hexStart: number;
  s1: number;
  s2: number;
  prefix: string;
  alphabet?: string;
  first?: string;
  last?: string;
};

type StrideMapping = StrideMappingInput & {
  alphabet: string;
  offset: number;
  hexEnd: number;
};

const NUMERIC_MAPPINGS: NumericMapping[] = [
  { hexStart: 0x140000, first: 0, count: 100000, template: "RA-00000" },
  { hexStart: 0x0B03E8, first: 1000, count: 1000, template: "CU-T0000" },
];

const STRIDE_MAPPINGS: StrideMapping[] = [
  createStrideMapping({ hexStart: 0x380000, s1: 1024, s2: 32, prefix: "F-B" }),
  createStrideMapping({ hexStart: 0x388000, s1: 1024, s2: 32, prefix: "F-I" }),
  createStrideMapping({ hexStart: 0x390000, s1: 1024, s2: 32, prefix: "F-G" }),
  createStrideMapping({ hexStart: 0x398000, s1: 1024, s2: 32, prefix: "F-H" }),
  createStrideMapping({ hexStart: 0x3A0000, s1: 1024, s2: 32, prefix: "F-O" }),
  createStrideMapping({ hexStart: 0x3C4421, s1: 1024, s2: 32, prefix: "D-A", first: "AAA", last: "OZZ" }),
  createStrideMapping({ hexStart: 0x3C0001, s1: 26 * 26, s2: 26, prefix: "D-A", first: "PAA", last: "ZZZ" }),
  createStrideMapping({ hexStart: 0x3C8421, s1: 1024, s2: 32, prefix: "D-B", first: "AAA", last: "OZZ" }),
  createStrideMapping({ hexStart: 0x3C2001, s1: 26 * 26, s2: 26, prefix: "D-B", first: "PAA", last: "ZZZ" }),
  createStrideMapping({ hexStart: 0x3CC000, s1: 26 * 26, s2: 26, prefix: "D-C" }),
  createStrideMapping({ hexStart: 0x3D04A8, s1: 26 * 26, s2: 26, prefix: "D-E" }),
  createStrideMapping({ hexStart: 0x3D4950, s1: 26 * 26, s2: 26, prefix: "D-F" }),
  createStrideMapping({ hexStart: 0x3D8DF8, s1: 26 * 26, s2: 26, prefix: "D-G" }),
  createStrideMapping({ hexStart: 0x3DD2A0, s1: 26 * 26, s2: 26, prefix: "D-H" }),
  createStrideMapping({ hexStart: 0x3E1748, s1: 26 * 26, s2: 26, prefix: "D-I" }),
  createStrideMapping({ hexStart: 0x448421, s1: 1024, s2: 32, prefix: "OO-" }),
  createStrideMapping({ hexStart: 0x458421, s1: 1024, s2: 32, prefix: "OY-" }),
  createStrideMapping({ hexStart: 0x460000, s1: 26 * 26, s2: 26, prefix: "OH-" }),
  createStrideMapping({ hexStart: 0x468421, s1: 1024, s2: 32, prefix: "SX-" }),
  createStrideMapping({ hexStart: 0x490421, s1: 1024, s2: 32, prefix: "CS-" }),
  createStrideMapping({ hexStart: 0x4A0421, s1: 1024, s2: 32, prefix: "YR-" }),
  createStrideMapping({ hexStart: 0x4B8421, s1: 1024, s2: 32, prefix: "TC-" }),
  createStrideMapping({ hexStart: 0x740421, s1: 1024, s2: 32, prefix: "JY-" }),
  createStrideMapping({ hexStart: 0x760421, s1: 1024, s2: 32, prefix: "AP-" }),
  createStrideMapping({ hexStart: 0x768421, s1: 1024, s2: 32, prefix: "9V-" }),
  createStrideMapping({ hexStart: 0x778421, s1: 1024, s2: 32, prefix: "YK-" }),
  createStrideMapping({ hexStart: 0xC00001, s1: 26 * 26, s2: 26, prefix: "C-F" }),
  createStrideMapping({ hexStart: 0xC044A9, s1: 26 * 26, s2: 26, prefix: "C-G" }),
  createStrideMapping({ hexStart: 0xE01041, s1: 4096, s2: 64, prefix: "LV-" }),
];

function createStrideMapping(input: StrideMappingInput): StrideMapping {
  const alphabet = input.alphabet ?? FULL;
  const offset = input.first
    ? alphabet.indexOf(input.first[0]) * input.s1
      + alphabet.indexOf(input.first[1]) * input.s2
      + alphabet.indexOf(input.first[2])
    : 0;

  let hexEnd: number;
  if (input.last) {
    const c1 = alphabet.indexOf(input.last[0]);
    const c2 = alphabet.indexOf(input.last[1]);
    const c3 = alphabet.indexOf(input.last[2]);
    hexEnd = input.hexStart - offset + c1 * input.s1 + c2 * input.s2 + c3;
  } else {
    const n = alphabet.length;
    hexEnd = input.hexStart - offset + (n - 1) * input.s1 + (n - 1) * input.s2 + (n - 1);
  }

  return {
    ...input,
    alphabet,
    offset,
    hexEnd,
  };
}

function nLetter(rem: number): string {
  if (rem === 0) {
    return "";
  }
  return LIMITED[rem - 1] ?? "";
}

function nLetters(rem: number): string {
  if (rem === 0) {
    return "";
  }
  const r = rem - 1;
  return `${LIMITED[Math.floor(r / 25)] ?? ""}${nLetter(r % 25)}`;
}

function resolveNNumber(hex: number): string | null {
  let offset = hex - 0xA00001;
  if (offset < 0 || offset >= 915399) {
    return null;
  }

  const d1 = Math.floor(offset / 101711) + 1;
  let registration = `N${d1}`;
  offset %= 101711;
  if (offset <= 600) {
    return registration + nLetters(offset);
  }

  offset -= 601;
  const d2 = Math.floor(offset / 10111);
  registration += d2;
  offset %= 10111;
  if (offset <= 600) {
    return registration + nLetters(offset);
  }

  offset -= 601;
  const d3 = Math.floor(offset / 951);
  registration += d3;
  offset %= 951;
  if (offset <= 600) {
    return registration + nLetters(offset);
  }

  offset -= 601;
  const d4 = Math.floor(offset / 35);
  registration += d4;
  offset %= 35;
  if (offset <= 24) {
    return registration + nLetter(offset);
  }

  return registration + String(offset - 25);
}

function resolveJapanRegistration(hex: number): string | null {
  let offset = hex - 0x840000;
  if (offset < 0 || offset >= 229840) {
    return null;
  }

  let registration = "JA";
  const d1 = Math.floor(offset / 22984);
  if (d1 < 0 || d1 > 9) {
    return null;
  }
  registration += String(d1);
  offset %= 22984;

  const d2 = Math.floor(offset / 916);
  if (d2 < 0 || d2 > 9) {
    return null;
  }
  registration += String(d2);
  offset %= 916;

  if (offset < 340) {
    const d3 = Math.floor(offset / 34);
    registration += String(d3);
    offset %= 34;
    return offset < 10 ? registration + String(offset) : registration + (LIMITED[offset - 10] ?? "");
  }

  offset -= 340;
  const l3 = Math.floor(offset / 24);
  return registration + (LIMITED[l3] ?? "") + (LIMITED[offset % 24] ?? "");
}

function resolveSouthKoreaRegistration(hex: number): string | null {
  if (hex >= 0x71BA00 && hex <= 0x71BF99) {
    return `HL${(hex - 0x71BA00 + 0x7200).toString(16).toUpperCase()}`;
  }
  if (hex >= 0x71C000 && hex <= 0x71C099) {
    return `HL${(hex - 0x71C000 + 0x8000).toString(16).toUpperCase()}`;
  }
  if (hex >= 0x71C200 && hex <= 0x71C299) {
    return `HL${(hex - 0x71C200 + 0x8200).toString(16).toUpperCase()}`;
  }
  return null;
}

function resolveNumericRegistration(hex: number): string | null {
  for (const mapping of NUMERIC_MAPPINGS) {
    const hexEnd = mapping.hexStart + mapping.count - 1;
    if (hex < mapping.hexStart || hex > hexEnd) {
      continue;
    }

    const numericSuffix = String(hex - mapping.hexStart + mapping.first);
    return mapping.template.slice(0, mapping.template.length - numericSuffix.length) + numericSuffix;
  }

  return null;
}

function resolveStrideRegistration(hex: number): string | null {
  for (const mapping of STRIDE_MAPPINGS) {
    if (hex < mapping.hexStart || hex > mapping.hexEnd) {
      continue;
    }

    const offset = hex - mapping.hexStart + mapping.offset;
    const i1 = Math.floor(offset / mapping.s1);
    const i2 = Math.floor((offset % mapping.s1) / mapping.s2);
    const i3 = (offset % mapping.s1) % mapping.s2;

    if (i1 < 0 || i2 < 0 || i3 < 0) {
      continue;
    }

    const c1 = mapping.alphabet[i1];
    const c2 = mapping.alphabet[i2];
    const c3 = mapping.alphabet[i3];
    if (!c1 || !c2 || !c3) {
      continue;
    }

    return `${mapping.prefix}${c1}${c2}${c3}`;
  }

  return null;
}

export function resolveRegistrationFromHex(icaoHex: string): string | null {
  const normalized = icaoHex.trim().toUpperCase();
  if (!/^[0-9A-F]{6}$/u.test(normalized)) {
    return null;
  }

  const hex = Number.parseInt(normalized, 16);
  return (
    resolveNNumber(hex)
    ?? resolveJapanRegistration(hex)
    ?? resolveSouthKoreaRegistration(hex)
    ?? resolveNumericRegistration(hex)
    ?? resolveStrideRegistration(hex)
  );
}
