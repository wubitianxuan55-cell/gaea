import { ToolRegistry } from '../registry';

async function ocrScreen(_args: Record<string, any>, context?: any): Promise<string> {
  if (!context?.desktopRelay) {
    throw new Error('OCR tools require the Tauri desktop app');
  }
  // Capture screen via desktop relay, then the caller (LLM) should use vision to read it
  // We return the base64 image for vision model consumption
  return context.desktopRelay('desktop_capture_screen', { quality: 50 });
}

async function ocrRegion(args: Record<string, any>, context?: any): Promise<string> {
  if (!context?.desktopRelay) {
    throw new Error('OCR tools require the Tauri desktop app');
  }
  // region support: x, y, width, height — currently captures full screen
  // Future: pass region params to a Rust-side cropping
  return context.desktopRelay('desktop_capture_screen', { quality: 50 });
}

export function registerOCRTools(registry: ToolRegistry): void {
  registry.register({
    name: 'ocr_screen',
    description:
      'Capture a screenshot of the user\'s screen and return it as a base64 image for visual analysis. Use this when the user asks "what\'s on my screen?", "read this error", or when you need to see what the user is looking at. The image can be analyzed by vision-capable models.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    handler: ocrScreen,
    permission: 'user',
    securityLevel: 'confirm',
  });

  registry.register({
    name: 'ocr_region',
    description:
      'Capture a specific region of the user\'s screen. Specify x, y, width, height in pixels. Use this when you only need to read a specific area like a dialog box, error message, or code editor window.',
    parameters: {
      type: 'object',
      properties: {
        x: { type: 'number', description: 'Left edge in pixels' },
        y: { type: 'number', description: 'Top edge in pixels' },
        width: { type: 'number', description: 'Region width in pixels' },
        height: { type: 'number', description: 'Region height in pixels' },
      },
      required: ['x', 'y', 'width', 'height'],
    },
    handler: ocrRegion,
    permission: 'user',
    securityLevel: 'confirm',
  });
}
