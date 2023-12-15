import { DateTime } from "luxon";
import { Readable } from "stream";

export function nowDateTime() {
  return DateTime.local().setZone("utc");
}

export function nowISODateString() {
  return nowDateTime().toISO();
}

export function dateTimeFromISO(isoDateString: string) {
  return DateTime.fromISO(isoDateString).setZone("utc");
}

export function dateTimeFromUnixTimestamp(timestamp: number) {
  return DateTime.fromSeconds(timestamp).setZone("utc");
}

export function dateTimeFromMilliseconds(milliseconds: number) {
  return DateTime.fromMillis(milliseconds).setZone("utc");
}

export function incrementDateTimeByWeekdays(
  date: DateTime,
  weekdaysToAdvance: number
) {
  let newDate = date;

  for (let i = 1; i <= weekdaysToAdvance; i++) {
    const daysToNextWeekday =
      // Mon - Wed, or Sun, add 1 day to get next week day.
      newDate.weekday <= 4 || newDate.weekday === 7
        ? 1
        : // Fri add 3 to get back to Mon.
        newDate.weekday === 5
        ? 3
        : // Sat add 2 to get to Mon.
          2;

    newDate = newDate.plus({ days: daysToNextWeekday });
  }

  return newDate;
}

export function isSameISODate(a: DateTime, b: DateTime) {
  return a.setZone("utc").toISODate() === b.setZone("utc").toISODate();
}

export function env<T extends any = string>(
  name: string,
  defaultValue?: T,
  parseAs: "string" | "integer" = "string"
) {
  if (parseAs === "integer") {
    let value = process.env[name] ? parseInt("" + process.env[name], 10) : null;

    if (value === null || isNaN(value)) {
      value = defaultValue as any;
    }

    return value as unknown as T;
  } else {
    return (process.env[name] || defaultValue) as unknown as T;
  }
}

export function randomIntBetween(min: number, max: number) {
  // Min and max inclusive.
  return Math.floor(Math.random() * (max - min + 1) + min);
}

export function hasArrayOrderChanged(a?: any[], b?: any[]) {
  if (!a && !b) {
    return false;
  }

  if (a && !b) {
    return true;
  }

  if (!a && b) {
    return true;
  }

  if (a!.length !== b!.length) {
    return true;
  }

  for (let i = 0; i < a!.length; i++) {
    if (a![i] !== b![i]) {
      return true;
    }
  }

  return false;
}

export function clamp(number: number, min: number, max: number) {
  return Math.min(max, Math.max(min, number));
}

export function clampImageHeight(
  height: number,
  width: number,
  maxHeight: number
) {
  let newHeight = height;
  let newWidth = width;

  if (height > maxHeight) {
    const ratio = maxHeight / height;
    newHeight = height * ratio;
    newWidth = width * ratio;
  }

  return [newHeight, newWidth] as [number, number];
}

export function clampImageWidth(
  height: number,
  width: number,
  maxWidth: number
) {
  let newHeight = height;
  let newWidth = width;

  if (width > maxWidth) {
    const ratio = maxWidth / width;
    newHeight = height * ratio;
    newWidth = width * ratio;
  }

  return [newHeight, newWidth] as [number, number];
}

export function clampImageSize(
  height: number,
  width: number,
  maxHeight: number,
  maxWidth: number
) {
  return clampImageWidth(
    ...clampImageHeight(height, width, maxHeight),
    maxWidth
  );
}

interface JSObject {
  [key: string]: any;
}
// Lol this type.
type ObjectPatch<T extends JSObject> = Partial<{
  // If the object is an indexed object (it doesn't specify every
  // object property by name), e.g. { [key: string]: any }, then we
  // allow the patch values to be a patch or null.
  [K in keyof T]: string extends K
    ? T[K] extends JSObject
      ? ObjectPatch<T[K]> | null
      : T[K] | null
    : // If the property is optional, e.g. { foo?: string }, then we
    // allow it to be deleted with null.
    undefined extends T[K]
    ? JSObject extends T[K]
      ? ObjectPatch<T[K]> | null
      : T[K] | null
    : // Otherwise if it's an object recursively apply the patch.
    T[K] extends JSObject
    ? ObjectPatch<T[K]>
    : T[K];
}>;
export function patchObject<T extends JSObject>(
  obj: T,
  objPatch: ObjectPatch<T>
): T {
  const newObj = { ...obj };

  for (const [key, val] of Object.entries(objPatch)) {
    const prop = key as keyof T;

    if (val === null) {
      delete newObj[prop];
    } else if (typeof val === "object" && !Array.isArray(val)) {
      newObj[prop as keyof T] = patchObject(
        { ...newObj[prop as keyof T] },
        val
      );
    } else {
      newObj[prop as keyof T] = val;
    }
  }

  return newObj;
}

export function bufferToText(data: Buffer) {
  return data.toString("utf-8");
}

export async function bufferToJson(data: Buffer) {
  const text = bufferToText(data);
  return JSON.parse(text);
}

export async function readableToBuffer(readable: Readable) {
  const chunks: Buffer[] = [];

  for await (const chunk of readable) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

export async function readableToText(readable: Readable) {
  const data = await readableToBuffer(readable);
  return bufferToText(data);
}

export async function readableToJson(readable: Readable) {
  const data = await readableToBuffer(readable);
  return bufferToJson(data);
}

export function sleep(milliseconds: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

export function getDelta(oldVal: number, newVal: number): [number, number] {
  if (oldVal === 0 && newVal !== 0) {
    return [newVal, 100];
  }

  if (oldVal === 0 && newVal === 0) {
    return [0, 0];
  }

  if (oldVal !== 0 && newVal === 0) {
    return [oldVal * -1, -100];
  }

  const delta = newVal - oldVal;
  const percent =
    delta < 0 ? (Math.abs(delta) / oldVal) * -100 : (delta / oldVal) * 100;

  return [delta, percent];
}

export function chunkArray<T>(arr: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  const arrCopy = arr.slice();

  while (arrCopy.length > 0) {
    chunks.push(arrCopy.splice(0, chunkSize));
  }

  return chunks;
}
