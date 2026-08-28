import type { Community } from '../lib/types';

export type RootStackParamList = {
  MainTabs: undefined;
  Community: { community: Community };
  Post: { postId: string };
  Login: undefined;
  CreateCommunity: undefined;
  CreatePost: { communityId: string };
  Messages: undefined;
  Chat: { userId: string; username: string };
  Notifications: undefined;
  Search: undefined;
  User: { userId: string };
  Settings: undefined;
  SettingsSection: { section: string; title: string };
  ProfileEdit: undefined;
  Moderation: undefined;
  Verification: undefined;
  Stats: undefined;
};

export type TabParamList = {
  Feed: undefined;
  Communities: undefined;
  MessagesTab: undefined;
  Profile: undefined;
};
