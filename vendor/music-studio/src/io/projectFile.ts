import { validateProject } from '../model/schema';
import type { Project } from '../model/types';
import { downloadBytes, safeName } from './download';

export function saveProject(project: Project): void {
  downloadBytes(JSON.stringify(project, null, 2), `${safeName(project.name)}.studio.json`, 'application/json');
}

export async function loadProjectFile(file: File): Promise<Project> {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Project file is not valid JSON');
  }
  return validateProject(parsed);
}
