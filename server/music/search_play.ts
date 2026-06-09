/**
 * Shared music search + play logic.
 * Search via ncm-cli (authenticated, VIP supported).
 * Playback via ncm-cli mpv (authenticated stream).
 * Frontend syncs state via WebSocket poller.
 */
import { exec } from 'child_process';
import { loadEmotionalState } from '../personality/state';
import { emitMusicAtmosphere } from '../socket/music';
import { getFallbackScene, MusicScene } from './scene_generator';

const moodSearchMap: Record<string, string> = {
  happy: '欢快 流行', playful: '轻松 治愈', warm: '温暖 民谣',
  sad: '伤感 安静', melancholic: '怀旧 老歌', tired: '轻音乐 纯音乐',
  curious: '新歌 推荐', focused: '专注 纯音乐', contemplative: '安静 钢琴',
  excited: '热歌 嗨', peaceful: '治愈 轻松',
};

const moodReasonMap: Record<string, string> = {
  tired: '感觉你有点累了', sad: '感觉你心情不太好', happy: '感觉你今天心情不错',
  excited: '感觉你挺兴奋的', peaceful: '现在挺安静的', contemplative: '你好像在想事情',
  focused: '你在专注工作呢', melancholic: '有点怀旧的感觉', warm: '感觉挺温暖的',
};

function ncmExec(args: string, timeout = 15000): Promise<string> {
  const mpvPath = 'C:\\Program Files\\MPV Player';
  return new Promise((resolve) => {
    exec(`npx @music163/ncm-cli ${args} --output json`, {
      timeout,
      env: { ...process.env, PATH: `${mpvPath};${process.env.PATH || ''}` },
    }, (err, stdout) => {
      resolve(stdout || '');
    });
  });
}

function tryParse(text: string): any {
  try { return JSON.parse(text); } catch { return null; }
}

/** Fire-and-forget ncm-cli play — mpv handles audio, frontend syncs via poller */
function ncmFirePlay(encryptedId: string, originalId: string): void {
  const mpvPath = 'C:\\Program Files\\MPV Player';
  exec(`npx @music163/ncm-cli play --song --encrypted-id "${encryptedId}" --original-id "${originalId}" --output json`, {
    timeout: 30000,
    env: { ...process.env, PATH: `${mpvPath};${process.env.PATH || ''}` },
  }, (err, stdout) => {
    if (err?.killed) {
      // OK — long-running play, daemon/mpv continue independently
    }
  });
}

function extractTarget(userText: string): string | null {
  let t = userText.replace(/[。！？，\s]+/g, ' ').trim();
  const prefixWords = /^(给我|帮我|我想|我要|来|放|播放|搜|听|来点|随便放|随便来|一首|一个|点|下|一下|首|的)\s*/;
  const suffixWords = /\s*(歌|歌曲|音乐|的歌|的歌曲|的音乐|的歌单|吧|啊|呢|哦|哈|呀)$/;
  let changed = true;
  while (changed) {
    changed = false;
    const before = t;
    t = t.replace(prefixWords, '').replace(suffixWords, '');
    if (t !== before) changed = true;
  }
  t = t.trim();
  if (!t || /^(歌|音乐|首|点|下|一个|一首|一下|随便|推荐|热门|好听)$/.test(t)) return null;
  return t.length > 0 && t.length <= 30 ? t : null;
}

export async function searchAndPlay(
  userId: string,
  socket: any,
  userText?: string,
): Promise<{ success: boolean; text?: string }> {
  const emotionalState = loadEmotionalState(userId);
  const mood = emotionalState.dominantMood || 'peaceful';

  let keyword: string;
  if (userText) {
    const target = extractTarget(userText);
    keyword = target || moodSearchMap[mood] || '推荐 热门';
    if (target) console.log(`[Music] User target: "${target}"`);
  } else {
    keyword = moodSearchMap[mood] || '推荐 热门';
  }

  // Search via ncm-cli
  const searchRaw = await ncmExec(`search song --keyword "${keyword}" --limit 5`);
  const searchData = tryParse(searchRaw);
  const allSongs = searchData?.data?.records || [];
  const playable = allSongs.filter((s: any) => s.playFlag !== false);
  if (playable.length === 0) return { success: false };

  const pick = playable[Math.floor(Math.random() * playable.length)];
  const trackInfo = {
    name: pick.name,
    artists: (pick.artists || pick.fullArtists || []).map((a: any) => a.name),
    album: pick.album?.name,
    duration: pick.duration,
    coverUrl: pick.coverImgUrl,
  };

  // Fire ncm-cli play — mpv handles audio
  ncmFirePlay(pick.id, pick.originalId);

  // No audioUrl — mpv handles audio, frontend uses local ticker for progress
  console.log(`[Music] Selected: "${trackInfo.name}"`);

  // Lyrics (public API)
  let lyricsData: any[] = [];
  try {
    const lyricRes = await fetch(`https://music.163.com/api/song/lyric?os=pc&id=${pick.originalId}&lv=-1&kv=-1&tv=-1`, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://music.163.com/' },
    });
    const lyricJson = await lyricRes.json() as any;
    const lrcText = lyricJson?.lrc?.lyric || '';
    for (const line of lrcText.split('\n')) {
      const m = line.match(/^\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)$/);
      if (m) {
        const time = parseInt(m[1]) * 60 + parseInt(m[2]) + parseInt(m[3]) / (m[3].length === 3 ? 1000 : 100);
        const text = m[4].trim();
        if (text) lyricsData.push({ time, text });
      }
    }
  } catch {}

  // Scene
  let scene: MusicScene = getFallbackScene(mood, { valence: emotionalState.valence, arousal: emotionalState.arousal });
  try {
    const { generateMusicScene } = await import('../music/scene_generator');
    const llmScene = await generateMusicScene(userId, trackInfo, mood);
    if (llmScene) scene = llmScene;
  } catch {}

  const reasonPhrase = moodReasonMap[mood] || '根据你现在的状态';
  const lumiReason = `${reasonPhrase}，给你放一首「${trackInfo.name}」，希望你喜欢。`;

  console.log(`[Music] Scene: ${scene.scene}, particles=${scene.particles}`);
  emitMusicAtmosphere(socket, {
    track: trackInfo,
    mood,
    audioUrl: '',
    lyrics: lyricsData,
    lumiReason,
    scene,
  });

  return { success: true, text: lumiReason };
}
