import { invoke } from '@tauri-apps/api/core';

export interface GreetResponse {
  message: string;
}

export async function greet(name: string): Promise<GreetResponse> {
  return invoke('greet', { name });
}

export async function getAppVersion(): Promise<string> {
  return invoke('get_app_version');
}
