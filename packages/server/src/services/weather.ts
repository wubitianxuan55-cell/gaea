/**
 * Free weather lookup via wttr.in — no API key required.
 * Returns a concise one-line weather summary for proactive notifications.
 */

let cachedWeather: { text: string; timestamp: number } | null = null;
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

export async function getWeather(city: string = 'Beijing'): Promise<string> {
  const now = Date.now();
  if (cachedWeather && (now - cachedWeather.timestamp) < CACHE_TTL) {
    return cachedWeather.text;
  }

  try {
    const url = `https://wttr.in/${encodeURIComponent(city)}?format=%C+%t+%h+%w&lang=en`;
    const res = await fetch(url, { headers: { 'User-Agent': 'curl' } });
    const text = await res.text();
    const weather = text.trim();
    cachedWeather = { text: weather, timestamp: now };
    return weather;
  } catch {
    return 'Weather unavailable';
  }
}

export async function getWeatherBrief(): Promise<string> {
  const weather = await getWeather();
  if (weather === 'Weather unavailable') return '';
  return `Weather: ${weather}`;
}

/**
 * Generate a morning briefing combining weather + pending reminders + recent patterns
 */
export function getTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'night' {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'night';
}

export function getTimeGreeting(): string {
  const tod = getTimeOfDay();
  const greetings: Record<string, string[]> = {
    morning: ['Good morning', '早安', 'Rise and shine', 'Morning'],
    afternoon: ['Good afternoon', '下午好', 'Hope your day is going well'],
    evening: ['Good evening', '晚上好', 'Winding down?'],
    night: ['Still up?', '夜深了', 'Late night grind?'],
  };
  const opts = greetings[tod];
  return opts[Math.floor(Math.random() * opts.length)];
}
