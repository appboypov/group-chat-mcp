import { Profile } from './profile.js';

export interface Agent {
  id: string;
  projectPath: string;
  profile: Profile;
  joinedAt: number;
  conversations: string[];
  hasAnnounced: Record<string, boolean>;
  pid: number;
}
