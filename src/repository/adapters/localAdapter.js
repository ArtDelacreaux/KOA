import {
  readJson as readJsonFromLocal,
  readText as readTextFromLocal,
  removeStoredItem,
  writeJson as writeJsonToLocal,
  writeText as writeTextToLocal,
} from '../../lib/localStore';

export function createLocalAdapter() {
  return {
    name: 'local',
    readJson(key, fallbackValue) {
      return readJsonFromLocal(key, fallbackValue);
    },
    writeJson(key, value) {
      writeJsonToLocal(key, value);
    },
    readText(key, fallbackValue = '') {
      return readTextFromLocal(key, fallbackValue);
    },
    writeText(key, value) {
      writeTextToLocal(key, value);
    },
    remove(key) {
      removeStoredItem(key);
    },
  };
}
