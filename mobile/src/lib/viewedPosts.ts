import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'viewed-posts';

async function readViewed(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const ids = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(ids) ? ids : []);
  } catch {
    return new Set();
  }
}

// возвращает true, если это первый просмотр этого поста на устройстве
// (и в этом случае сразу помечает его просмотренным)
export async function markPostViewed(postId: string): Promise<boolean> {
  const viewed = await readViewed();
  if (viewed.has(postId)) return false;

  viewed.add(postId);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(viewed)));
  return true;
}
