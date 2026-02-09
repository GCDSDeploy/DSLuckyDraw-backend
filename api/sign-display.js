/**
 * Map DB sign (id, level, type, reward_code) to API response shape.
 * Does not change DB. title/description/imageUrl are derived for API only.
 */

/**
 * @param {{ id: string, level: number, type: string, reward_code: string }} sign
 * @returns {{ id: string, type: string, title: string, level: number, description: string, imageUrl: string }}
 */
export function signToDrawResponse(sign) {
  const levelLabels = {
    0: '空签',
    1: '上上签',
    2: '上签',
    3: '特签',
  };
  const title = levelLabels[sign.level] ?? sign.type ?? '';
  const description = sign.level === 0
    ? '所行皆明，所向皆顺。新年快乐！'
    : `恭喜抽中${title}，祝新年顺遂。`;
  return {
    id: sign.id,
    type: sign.type,
    title,
    level: sign.level,
    description,
    imageUrl: '', // Frontend uses its own assets; optional for API contract
  };
}
