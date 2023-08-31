import { ConfigValueType } from "./config";

export function parseEntry(typ: ConfigValueType, val: any): any {
  if (typ == ConfigValueType.String) {
    return val == null ? null : String(val);
  } else if (typ == ConfigValueType.Number) {
    return val == null ? null : Number(val);
  } else if (typ == ConfigValueType.Boolean) {
    if (val == null) {
      return null;
    }
    if (typeof(val) === 'boolean') {
      return val;
    }
    if (typeof(val) === 'string') {
      return val.toLowerCase() === 'true';
    }
    return null;
  }
  return null;
}
