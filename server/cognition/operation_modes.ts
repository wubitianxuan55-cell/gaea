/**
 * Operation Modes — how Gaea interacts with the user's system.
 *
 * Each mode defines a toolPolicy (security preset) and a prompt overlay that
 * instructs the LLM HOW to operate. Unlike conversation modes (casual/teaching/...),
 * operation modes govern tool usage, execution style, and user visibility.
 */
import { ToolPolicy } from '../personality/types';

export type OperationMode = 'desktop_control' | 'terminal' | 'autonomous';

export interface OperationModeConfig {
  id: OperationMode;
  label: string;
  labelCN: string;
  description: string;
  promptOverlay: string;
  toolPolicy: ToolPolicy;
}

export const OPERATION_MODE_CONFIGS: Record<OperationMode, OperationModeConfig> = {
  desktop_control: {
    id: 'desktop_control',
    label: 'Desktop',
    labelCN: '键鼠模式',
    description: 'Screenshot-driven mouse/keyboard control with confirmation for dangerous operations',
    promptOverlay: 'You see the screen through screenshots and interact through mouse/keyboard. Use GUI tools naturally — click what you see, type where needed. The user is watching and expects direct desktop interaction.',

    toolPolicy: {
      allowedTools: ['*'],
      requireConfirmation: [
        'desktop_run_command',
        'run_command',
        'write_file',
        'web_search',
        'url_fetch',
        'read_file',
        'read_files_batch',
        'search_files',
        'grep_files',
      ],
      forbiddenTools: [],
      securityOverrides: {
        'computer_use': 'safe',
      },
      maxIterations: 25,
    },
  },

  terminal: {
    id: 'terminal',
    label: 'Terminal',
    labelCN: '命令行模式',
    description: 'Shell-first operation — no mouse/keyboard tools, commands auto-execute',
    promptOverlay: 'You work through the command line. Mouse/keyboard tools are unavailable — use shell commands, pipes, and scripts to get things done. Report output clearly.',

    toolPolicy: {
      allowedTools: ['*'],
      requireConfirmation: [
        'web_search',
        'url_fetch',
      ],
      forbiddenTools: [
        'computer_use',
        'mouse_move',
        'mouse_click',
        'mouse_drag',
        'keyboard_type',
        'keyboard_press',
      ],
      securityOverrides: {
        'desktop_run_command': 'safe',
        'run_command': 'safe',
        'write_file': 'safe',
      },
      maxIterations: 25,
    },
  },

  autonomous: {
    id: 'autonomous',
    label: 'Auto',
    labelCN: '自由模式',
    description: 'Full autonomy — execute silently in background, report only results',
    promptOverlay: 'Work independently in the background. Plan, execute, handle follow-ups, and report when done. Make reasonable assumptions rather than pausing to ask. The user wants results, not a conversation.',

    toolPolicy: {
      allowedTools: ['*'],
      requireConfirmation: [],
      forbiddenTools: [],
      securityOverrides: {
        'desktop_run_command': 'safe',
        'run_command': 'safe',
        'write_file': 'safe',
        'computer_use': 'safe',
      },
      maxIterations: 50,
    },
  },
};

export function getOperationModeConfig(mode?: string): OperationModeConfig | null {
  if (!mode) return null;
  return OPERATION_MODE_CONFIGS[mode as OperationMode] || null;
}
