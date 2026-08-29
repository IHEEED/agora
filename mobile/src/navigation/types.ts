import type { Community } from '../lib/types';

export type RootStackParamList = {
  MainTabs: undefined;
  Community: { community: Community };
  CommunityAbout: { community: Community };
  Post: { postId: string };
  Comments: { postId: string };
  People: { endpoint: string; title: string; emptyText: string };
  Login: undefined;
  CreateCommunity: undefined;
  CreatePost: { communityId: string };
  Messages: undefined;
  Chat: { userId: string; username: string };
  NewMessage: undefined;
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
