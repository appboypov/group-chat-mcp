export interface Profile {
  name?: string;
  role?: string;
  expertise?: string;
  status?: string;
}

export interface ProfileUpdate {
  name?: string;
  role?: string;
  expertise?: string;
  status?: string;
}

export interface Agent {
  id: string;
  projectPath: string;
  profile: Profile;
  joinedAt: number;
  conversations: string[];
}
